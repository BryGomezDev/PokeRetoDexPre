"""
populate_pokemon.py
===================
Phase 4 – Seed /pokemon/{slug} in Cloud Firestore from PokéAPI.

Usage:
    FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/serviceAccount.json python scripts/populate_pokemon.py

Requirements:
    pip install -r scripts/requirements.txt
"""

import os
import sys
import time
import json
import logging
from typing import Optional

import requests
import firebase_admin
from firebase_admin import credentials, firestore

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
POKEAPI_BASE = "https://pokeapi.co/api/v2"
SLEEP_BETWEEN_REQUESTS = 0.1   # seconds – be polite to PokéAPI
BATCH_SIZE = 500                # Firestore batch write limit
MAX_RETRIES = 3
RETRY_BACKOFF = [1, 2, 4]      # seconds for attempt 1, 2, 3

# National Pokédex ranges per region (base-form Pokémon only).
# Hisui, Alola-forms, Galar-forms, Paldea-forms are detected by slug suffix.
REGION_RANGES = [
    (1,    151,  "Kanto"),
    (152,  251,  "Johto"),
    (252,  386,  "Hoenn"),
    (387,  493,  "Sinnoh"),
    (494,  649,  "Unova"),
    (650,  721,  "Kalos"),
    (722,  809,  "Alola"),
    (810,  905,  "Galar"),
    (906, 1025,  "Paldea"),
]

# Slug-suffix rules – order matters (more specific first)
REGIONAL_SUFFIXES = [
    ("-hisui",    "Hisui"),
    ("-alolan",   "Alola"),
    ("-alola",    "Alola"),
    ("-galarian", "Galar"),
    ("-galar",    "Galar"),
    ("-paldean",  "Paldea"),
    ("-paldea",   "Paldea"),
]

SPECIAL_FORM_PATTERNS = [
    "-mega",
    "-gmax",
    "-alola",
    "-alolan",
    "-galar",
    "-galarian",
    "-hisui",
    "-paldea",
    "-paldean",
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_with_retry(url: str) -> dict:
    """GET a URL with exponential backoff on 429/5xx. Raises on final failure."""
    for attempt, wait in enumerate(RETRY_BACKOFF, start=1):
        try:
            resp = requests.get(url, timeout=15)
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code in (429, 500, 502, 503, 504):
                log.warning("HTTP %s for %s (attempt %d/%d) – retrying in %ds",
                            resp.status_code, url, attempt, MAX_RETRIES, wait)
                time.sleep(wait)
                continue
            # Non-retryable error
            resp.raise_for_status()
        except requests.exceptions.RequestException as exc:
            log.warning("Request error for %s (attempt %d/%d): %s", url, attempt, MAX_RETRIES, exc)
            if attempt < MAX_RETRIES:
                time.sleep(wait)
            else:
                raise
    raise RuntimeError(f"Exceeded {MAX_RETRIES} retries for {url}")


def region_from_number(pokedex_number: int) -> str:
    """Return region name from national Pokédex number (base-form logic)."""
    for lo, hi, region in REGION_RANGES:
        if lo <= pokedex_number <= hi:
            return region
    return "Unknown"


def region_from_slug(slug: str, pokedex_number: int) -> str:
    """
    Determine region with suffix detection taking priority over number range.
    Regional-form slugs override the base-number region.
    """
    for suffix, region in REGIONAL_SUFFIXES:
        if suffix in slug:
            return region
    return region_from_number(pokedex_number)


def is_special_form(slug: str, pokedex_number: int) -> bool:
    """
    Returns True if the slug represents a Mega, Gigantamax, or regional form.
    Base-game Pokémon 906-1025 are NOT special forms unless they carry a suffix.
    """
    return any(pattern in slug for pattern in SPECIAL_FORM_PATTERNS)


# Substring markers that indicate a regional form.
# Using `in` instead of `endswith()` handles compound suffixes like
# "darmanitan-galar-standard" and "tauros-paldea-aqua-breed".
_REGIONAL_MARKERS = (
    "-alola", "-alolan",
    "-galar", "-galarian",
    "-hisui",
    "-paldea", "-paldean",
)

# Cosmetic slugs that contain a regional marker but are NOT regional forms.
_COSMETIC_EXCLUDE_SUFFIXES = ("-cap", "-cosplay", "-starter")


def compute_form_type(slug: str, special: bool) -> Optional[str]:
    """
    Classify a Pokémon into one of four form_type values:
      null       — base species
      "mega"     — Mega Evolution
      "gmax"     — Gigantamax
      "regional" — Alolan / Galarian / Hisuian / Paldean regional form
      "other"    — cosmetic or unclassified variant
    """
    if not special:
        return None
    s = slug.lower()
    if "-mega" in s:
        return "mega"
    if s.endswith("-gmax"):
        return "gmax"
    # Substring match handles compound suffixes; cosmetic variants excluded
    if not any(s.endswith(excl) for excl in _COSMETIC_EXCLUDE_SUFFIXES):
        if any(marker in s for marker in _REGIONAL_MARKERS):
            return "regional"
    return "other"


def build_pokemon_doc(slug: str, api_data: dict, species_id: int) -> dict:
    """
    Transform raw PokéAPI /pokemon response into the Firestore document schema.
    species_id is the national Pokédex number of the base species — for variants
    (Mega/GMax/regional) api_data["id"] is a high internal PokéAPI id, NOT the
    national dex number, so the caller must resolve species_id first.
    """
    pokedex_number: int = species_id

    # Types
    types = [t["type"]["name"] for t in api_data["types"]]

    # Official artwork – fall back to empty string if missing
    sprite_url: str = (
        (api_data.get("sprites") or {})
        .get("other", {})
        .get("official-artwork", {})
        .get("front_default") or ""
    )

    # Region and special-form flag
    region = region_from_slug(slug, pokedex_number)
    special = is_special_form(slug, pokedex_number)

    # form_index: position among sibling forms for the same species.
    # PokéAPI /pokemon?limit=10000 returns forms in discovery order;
    # we derive form_index later during the grouping step. Here we default to 0
    # and the caller will override it.
    form_index = 0  # placeholder – overridden by the caller

    return {
        "pokedex_number": pokedex_number,
        "form_index": form_index,
        "sort_order": pokedex_number * 1000 + form_index,
        "name": slug,
        "region": region,
        "types": types,
        "sprite_url": sprite_url,
        "is_special_form": special,
        "form_type": compute_form_type(slug, special),
    }


# ── Firebase initialisation ───────────────────────────────────────────────────

def init_firebase() -> firestore.Client:
    sa_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()
    if not sa_path:
        log.error(
            "Environment variable FIREBASE_SERVICE_ACCOUNT_PATH is not set.\n"
            "  Set it to the path of your Firebase service account JSON file, e.g.:\n"
            "    set FIREBASE_SERVICE_ACCOUNT_PATH=C:\\path\\to\\serviceAccount.json   (Windows)\n"
            "    export FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/serviceAccount.json   (Unix)\n"
            "  Then re-run the script."
        )
        sys.exit(1)

    if not os.path.isfile(sa_path):
        log.error("Service account file not found: %s", sa_path)
        sys.exit(1)

    # Read project_id from the JSON – never hardcode it
    with open(sa_path, "r", encoding="utf-8") as fh:
        sa_json = json.load(fh)
    project_id = sa_json.get("project_id")
    if not project_id:
        log.error("Could not read 'project_id' from service account JSON.")
        sys.exit(1)

    log.info("Initialising Firebase for project: %s", project_id)
    cred = credentials.Certificate(sa_path)
    firebase_admin.initialize_app(cred, {"projectId": project_id})
    return firestore.client()


# ── Slug discovery ────────────────────────────────────────────────────────────

def fetch_all_slugs() -> list[str]:
    """
    Fetch every Pokémon slug from PokéAPI /pokemon?limit=10000.
    Returns a list of slug strings.
    """
    log.info("Fetching master Pokémon list from PokéAPI …")
    data = get_with_retry(f"{POKEAPI_BASE}/pokemon?limit=10000&offset=0")
    slugs = [entry["name"] for entry in data["results"]]
    log.info("Found %d total slugs in PokéAPI.", len(slugs))
    return slugs


def should_include(slug: str, pokedex_number: int) -> bool:
    """
    Include a slug when its national Pokédex number is 1-1025,
    OR when it is a special form (Mega/GMax/regional) of a 1-1025 Pokémon.
    Slug IDs > 10000 in PokéAPI are internal variant IDs not tied to
    the national dex – they are excluded by the number check.
    """
    if 1 <= pokedex_number <= 1025:
        return True
    # Some form slugs carry an ID > 1025 but still belong to a 1-1025 species.
    # We accept them if they have a special-form suffix.
    if is_special_form(slug, pokedex_number):
        return True
    return False


# ── Main pipeline ─────────────────────────────────────────────────────────────

def main() -> None:
    db = init_firebase()
    collection = db.collection("pokemon")

    all_slugs = fetch_all_slugs()

    # ── Pass 1: fetch Pokémon data, filter, and group by species id ───────────
    log.info("Pass 1 – fetching Pokémon data and filtering …")

    # species_id → list of (slug, doc_dict) ordered by discovery
    species_groups: dict[int, list[tuple[str, dict]]] = {}
    failed_slugs: list[str] = []
    total_fetched = 0

    for idx, slug in enumerate(all_slugs, start=1):
        time.sleep(SLEEP_BETWEEN_REQUESTS)
        try:
            api_data = get_with_retry(f"{POKEAPI_BASE}/pokemon/{slug}")
        except Exception as exc:
            log.error("FAILED to fetch /pokemon/%s after retries: %s", slug, exc)
            failed_slugs.append(slug)
            continue

        api_id: int = api_data["id"]

        if not should_include(slug, api_id):
            # Skip slugs outside national dex range that are not special forms
            continue

        # Resolve national Pokédex number from species URL.
        # For base forms species_id == api_id; for Mega/GMax/regional variants
        # api_id is an internal PokéAPI id (10001+) while species_id is the
        # national dex number of the base Pokémon (e.g. 264 for linoone-galar).
        species_id = api_id
        species_url = (api_data.get("species") or {}).get("url", "")
        if species_url:
            try:
                # URL format: https://pokeapi.co/api/v2/pokemon-species/{id}/
                species_id = int(species_url.rstrip("/").split("/")[-1])
            except (ValueError, IndexError):
                pass

        doc = build_pokemon_doc(slug, api_data, species_id)
        total_fetched += 1

        if species_id not in species_groups:
            species_groups[species_id] = []
        species_groups[species_id].append((slug, doc))

        if total_fetched % 50 == 0:
            log.info(
                "[%d fetched so far] last: %s → %s (special=%s)",
                total_fetched, slug, doc["region"], doc["is_special_form"],
            )

    log.info(
        "Pass 1 complete. %d Pokémon fetched across %d species. %d failed.",
        total_fetched, len(species_groups), len(failed_slugs),
    )

    # ── Pass 2: assign form_index per species, then batch-write to Firestore ──
    log.info("Pass 2 – assigning form_index and writing to Firestore …")

    batch = db.batch()
    batch_count = 0
    written_count = 0
    processed_count = 0

    # Flatten groups: base form (lowest pokedex_number) gets form_index=0,
    # the rest get 1, 2, … in the order they appeared in the master list.
    for species_id in sorted(species_groups.keys()):
        entries = species_groups[species_id]

        # Sort: put the "base" slug (lowest id, or slug == species name) first,
        # then the rest in discovery order.
        def form_sort_key(entry: tuple[str, dict]) -> tuple[int, str]:
            _, doc = entry
            # Base form has id == species_id; special forms have higher ids.
            return (0 if doc["pokedex_number"] == species_id else 1, entry[0])

        entries.sort(key=form_sort_key)

        for form_index, (slug, doc) in enumerate(entries):
            doc["form_index"] = form_index
            doc["sort_order"] = doc["pokedex_number"] * 1000 + form_index

            ref = collection.document(slug)
            batch.set(ref, doc)
            batch_count += 1
            processed_count += 1

            if processed_count % 50 == 0:
                log.info(
                    "[%d/%d] %s → %s (special=%s)",
                    processed_count, total_fetched,
                    slug, doc["region"], doc["is_special_form"],
                )

            # Commit when batch limit reached
            if batch_count >= BATCH_SIZE:
                batch.commit()
                written_count += batch_count
                log.info("Committed batch of %d documents (total written: %d).", batch_count, written_count)
                batch = db.batch()
                batch_count = 0

    # Commit remaining documents
    if batch_count > 0:
        batch.commit()
        written_count += batch_count
        log.info("Committed final batch of %d documents (total written: %d).", batch_count, written_count)

    # ── Summary ───────────────────────────────────────────────────────────────
    log.info("=" * 60)
    log.info("DONE.")
    log.info("  Total documents written to Firestore : %d", written_count)
    log.info("  Total slugs that failed (skipped)    : %d", len(failed_slugs))
    if failed_slugs:
        log.info("  Failed slugs:")
        for s in failed_slugs:
            log.info("    - %s", s)
    log.info("=" * 60)


if __name__ == "__main__":
    main()
