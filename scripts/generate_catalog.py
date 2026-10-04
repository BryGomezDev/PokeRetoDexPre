"""
generate_catalog.py
====================
ETL script: fetches TCG card data from TCGdex API and writes static JSON
catalogs to public/catalog/v1/en/{dexId}.json and public/catalog/v1/es/{dexId}.json.
Also writes public/catalog/v1/rarities.json and public/catalog/v1/_meta.json.

Usage:
    python scripts/generate_catalog.py [--force] [--dry-run]

Flags:
    --force    Overwrite existing output files (default: skip already-written dexIds).
    --dry-run  Run all API calls but do not write any files; print summary only.

Requirements:
    pip install requests
"""

import argparse
import datetime
import json
import logging
import os
import re
import sys
import time
from typing import Any, Optional

import requests

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
BASE_URL = "https://api.tcgdex.net/v2"
GRAPHQL_URL = f"{BASE_URL}/graphql"
HEADERS = {
    "User-Agent": "PokeRetoDex-catalog",
    "Content-Type": "application/json",
}
SLEEP_BETWEEN_REQUESTS = 0.5  # seconds – ≤ 2 req/s
MAX_RETRIES = 3
RETRY_BACKOFF = [1, 2, 4]     # seconds for attempt 1, 2, 3
MAX_CONSECUTIVE_ERRORS = 3

# Output paths are relative to the project root (parent of scripts/).
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_SCRIPT_DIR)
CATALOG_BASE = os.path.join(_PROJECT_ROOT, "public", "catalog", "v1")

# Series IDs from GET /v2/en/series that represent digital-only games.
# Verified 2026-10-04: "tcgp" = "Pokémon TCG Pocket" (15 sets: A1, A1a, A2, …, B2a, A4a).
# Source: GET https://api.tcgdex.net/v2/en/series/tcgp → {"id":"tcgp","name":"Pokémon TCG Pocket"}
DIGITAL_SERIES_IDS: frozenset[str] = frozenset({"tcgp"})

# Cross-check regex: Pocket set IDs start with an uppercase letter followed by a digit,
# or with "P-" (e.g. A1, A1a, B2b, P-A).  Used only to flag discrepancies with the
# serie-based filter — never as the sole exclusion criterion.
_POCKET_ID_PATTERN = re.compile(r"^[A-Z]\d|^P-")


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def _post_with_retry(payload: dict) -> Optional[dict]:
    """POST to GRAPHQL_URL with exponential backoff on 429/5xx."""
    for attempt, wait in enumerate(RETRY_BACKOFF, start=1):
        try:
            time.sleep(SLEEP_BETWEEN_REQUESTS)
            resp = requests.post(GRAPHQL_URL, json=payload, headers=HEADERS, timeout=20)
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code in (429, 500, 502, 503, 504):
                log.warning(
                    "HTTP %s from GraphQL (attempt %d/%d) — retrying in %ds",
                    resp.status_code, attempt, MAX_RETRIES, wait,
                )
                if attempt < MAX_RETRIES:
                    time.sleep(wait)
                continue
            log.error("Unexpected HTTP %s from GraphQL.", resp.status_code)
            return None
        except requests.exceptions.RequestException as exc:
            log.warning("Request error (attempt %d/%d): %s", attempt, MAX_RETRIES, exc)
            if attempt < MAX_RETRIES:
                time.sleep(wait)
            else:
                log.error("Exceeded %d retries for GraphQL.", MAX_RETRIES)
                return None
    return None


def _get_with_retry(url: str) -> Optional[Any]:
    """GET url with exponential backoff on 429/5xx. Returns parsed JSON or None."""
    for attempt, wait in enumerate(RETRY_BACKOFF, start=1):
        try:
            time.sleep(SLEEP_BETWEEN_REQUESTS)
            resp = requests.get(url, headers=HEADERS, timeout=30)
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code in (429, 500, 502, 503, 504):
                log.warning(
                    "HTTP %s from GET %s (attempt %d/%d) — retrying in %ds",
                    resp.status_code, url, attempt, MAX_RETRIES, wait,
                )
                if attempt < MAX_RETRIES:
                    time.sleep(wait)
                continue
            log.error("Unexpected HTTP %s for GET %s.", resp.status_code, url)
            return None
        except requests.exceptions.RequestException as exc:
            log.warning("Request error for %s (attempt %d/%d): %s", url, attempt, MAX_RETRIES, exc)
            if attempt < MAX_RETRIES:
                time.sleep(wait)
            else:
                log.error("Exceeded %d retries for %s.", MAX_RETRIES, url)
                return None
    return None


# ── ES index ──────────────────────────────────────────────────────────────────

def fetch_es_index() -> dict[str, dict]:
    """Fetch the full ES card index and return dict[card_id, {id, localId, name, image}].
    Called once per execution before the main dexId loop."""
    log.info("Fetching ES card index from %s/es/cards …", BASE_URL)
    data = _get_with_retry(f"{BASE_URL}/es/cards")
    if not data or not isinstance(data, list):
        log.error("Failed to fetch ES card index or unexpected format.")
        sys.exit(1)
    es_map = {card["id"]: card for card in data if isinstance(card, dict) and "id" in card}
    log.info("ES index loaded: %d cards.", len(es_map))
    return es_map


def fetch_digital_set_ids(digital_series: frozenset[str]) -> frozenset[str]:
    """Return set IDs that belong to digital-only series (e.g. tcgp).

    Calls GET /v2/en/series/{serie_id} once per digital serie — typically a single call.
    Called once per execution before the main dexId loop.
    """
    all_ids: set[str] = set()
    for serie_id in sorted(digital_series):
        log.info("Fetching set list for digital serie %r from %s/en/series/%s …",
                 serie_id, BASE_URL, serie_id)
        data = _get_with_retry(f"{BASE_URL}/en/series/{serie_id}")
        if not data or not isinstance(data, dict):
            log.warning("Could not fetch serie %r — digital filter may be incomplete.", serie_id)
            continue
        for s in data.get("sets", []):
            sid = s.get("id")
            if sid:
                all_ids.add(sid)
    log.info("Digital set IDs loaded: %d sets from series %s.", len(all_ids), sorted(digital_series))
    return frozenset(all_ids)


# ── GraphQL query ─────────────────────────────────────────────────────────────

GRAPHQL_QUERY = """
query CardsByDexId($dexId: Int!) {
  cards(filters: { dexId: $dexId }) {
    id
    localId
    name
    rarity
    image
    variants {
      normal
      holo
      reverse
      firstEdition
      wPromo
    }
    set {
      id
      name
    }
  }
}
"""


def fetch_cards_for_dex_id(dex_id: int) -> Optional[list[dict]]:
    """Return list of raw card dicts from TCGdex for a given national dex ID.
    Returns None on API/network error (used to track consecutive failures).
    Returns [] when the API succeeded but found no cards for this dexId."""
    payload = {
        "query": GRAPHQL_QUERY,
        "variables": {"dexId": dex_id},
    }
    result = _post_with_retry(payload)
    if result is None:
        log.error("GraphQL query failed for dexId=%d.", dex_id)
        return None
    errors = result.get("errors")
    if errors:
        log.error("GraphQL errors for dexId=%d: %s", dex_id, errors)
        return None
    cards = (result.get("data") or {}).get("cards") or []
    return cards


# ── Card entry builders ───────────────────────────────────────────────────────

def _variants_dict(raw_variants: Optional[dict]) -> dict:
    """Normalise the variants object; fill missing keys with False."""
    v = raw_variants or {}
    return {
        "normal":       bool(v.get("normal", False)),
        "holo":         bool(v.get("holo", False)),
        "reverse":      bool(v.get("reverse", False)),
        "firstEdition": bool(v.get("firstEdition", False)),
        "wPromo":       bool(v.get("wPromo", False)),
    }


def build_en_entry(card: dict) -> dict:
    set_info = card.get("set") or {}
    return {
        "id":       card["id"],
        "localId":  card.get("localId", ""),
        "name":     card.get("name", ""),
        "setId":    set_info.get("id", ""),
        "setName":  set_info.get("name", ""),
        "rarity":   card.get("rarity"),   # literal from API; null if missing
        "image":    card.get("image") or "",
        "variants": _variants_dict(card.get("variants")),
    }


def build_es_entry(en_entry: dict, es_card: dict) -> dict:
    """Build ES entry: name + image from ES index, everything else from EN."""
    entry = dict(en_entry)
    entry["name"]  = es_card.get("name", en_entry["name"])
    entry["image"] = es_card.get("image") or en_entry["image"]
    return entry


# ── File I/O ──────────────────────────────────────────────────────────────────

def _out_path(lang: str, dex_id: int) -> str:
    return os.path.join(CATALOG_BASE, lang, f"{dex_id}.json")


def _already_exists(dex_id: int) -> bool:
    # EN file is always written when cards exist for this dexId.
    # Some dexIds have no ES cards (EN-only sets) so checking only EN
    # prevents re-fetching those on restart.
    return os.path.exists(_out_path("en", dex_id))


def _write_json(path: str, data: Any, dry_run: bool) -> None:
    if dry_run:
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))


# ── Rarities catalog ──────────────────────────────────────────────────────────

def _rarities_path() -> str:
    return os.path.join(CATALOG_BASE, "rarities.json")


def _meta_path() -> str:
    return os.path.join(CATALOG_BASE, "_meta.json")


def _load_existing_rarities() -> dict[Optional[str], dict]:
    """Load existing rarities.json keyed by tcgdex value (None for JSON null).
    Returns empty dict if the file does not exist or is malformed."""
    path = _rarities_path()
    if not os.path.exists(path):
        return {}
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        return {
            entry.get("tcgdex"): entry
            for entry in data
            if isinstance(entry, dict) and "tcgdex" in entry
        }
    except (json.JSONDecodeError, ValueError):
        log.warning("Could not parse existing rarities.json — starting fresh.")
        return {}


def _build_rarities_list(
    rarity_counts: dict[Optional[str], int],
    existing: dict[Optional[str], dict],
) -> list[dict]:
    """Merge new rarity counts with existing human-curated es/wikidex values.

    Machine owns: tcgdex, cards.
    Human owns:   es, wikidex.
    Entries no longer present in the new run are dropped with a warning.
    """
    dropped = set(existing) - set(rarity_counts)
    if dropped:
        log.warning(
            "rarities.json: dropping %d stale entr%s: %s",
            len(dropped),
            "y" if len(dropped) == 1 else "ies",
            sorted(str(k) for k in dropped),
        )
    result = []
    for rarity_val, count in rarity_counts.items():
        old = existing.get(rarity_val, {})
        result.append({
            "tcgdex":  rarity_val,        # None → JSON null
            "es":      old.get("es"),
            "wikidex": bool(old.get("wikidex", False)),
            "cards":   count,
        })
    result.sort(key=lambda x: x["cards"], reverse=True)
    return result


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate TCG catalog JSON files under public/catalog/v1/."
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing output files (default: skip already-written dexIds).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run all API calls but do not write any files.",
    )
    args = parser.parse_args()

    if args.dry_run:
        log.info("DRY RUN — no files will be written.")

    digital_set_ids = fetch_digital_set_ids(DIGITAL_SERIES_IDS)
    es_map = fetch_es_index()

    total_en_files = 0
    total_es_files = 0
    total_cards_en = 0
    total_cards_es = 0
    skipped = 0
    digital_excluded = 0
    doubtful_sets: set[str] = set()
    consecutive_errors = 0
    rarity_counts: dict[Optional[str], int] = {}
    null_rarity_cards = 0

    for dex_id in range(1, 1026):
        if not args.force and _already_exists(dex_id):
            log.debug("Skipping dexId=%d (already exists; use --force to overwrite).", dex_id)
            skipped += 1
            continue

        raw_cards = fetch_cards_for_dex_id(dex_id)

        if raw_cards is None:
            consecutive_errors += 1
            log.error(
                "API error for dexId=%d (%d/%d consecutive failures).",
                dex_id, consecutive_errors, MAX_CONSECUTIVE_ERRORS,
            )
            if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                log.error(
                    "Aborting: %d consecutive API errors. "
                    "Check connectivity and retry (already-written files will be skipped).",
                    MAX_CONSECUTIVE_ERRORS,
                )
                sys.exit(2)
            continue

        consecutive_errors = 0

        if not raw_cards:
            # Write empty sentinel so _already_exists returns True on re-run.
            _write_json(_out_path("en", dex_id), [], args.dry_run)
            log.debug("No cards for dexId=%d — writing empty sentinel.", dex_id)
            continue

        en_entries: list[dict] = []
        es_entries: list[dict] = []

        for card in raw_cards:
            card_id = card.get("id")
            if not card_id:
                continue

            set_id = (card.get("set") or {}).get("id", "")
            is_digital_primary = set_id in digital_set_ids
            is_digital_regex   = bool(_POCKET_ID_PATTERN.match(set_id)) if set_id else False

            if is_digital_primary != is_digital_regex and set_id not in doubtful_sets:
                doubtful_sets.add(set_id)
                log.warning(
                    "Doubtful set %r: serie-based=%s but regex=%s — including card %r.",
                    set_id, is_digital_primary, is_digital_regex, card_id,
                )

            if is_digital_primary:
                digital_excluded += 1
                continue

            en_entry = build_en_entry(card)
            en_entries.append(en_entry)

            rarity_val = en_entry["rarity"]
            if rarity_val is None:
                null_rarity_cards += 1
            rarity_counts[rarity_val] = rarity_counts.get(rarity_val, 0) + 1

            if card_id in es_map:
                es_entries.append(build_es_entry(en_entry, es_map[card_id]))

        if en_entries:
            _write_json(_out_path("en", dex_id), en_entries, args.dry_run)
            total_en_files += 1
            total_cards_en += len(en_entries)

        if es_entries:
            _write_json(_out_path("es", dex_id), es_entries, args.dry_run)
            total_es_files += 1
            total_cards_es += len(es_entries)

        if dex_id % 100 == 0:
            log.info(
                "[%d/1025] EN files: %d | ES files: %d | cards: %d | digital excluded: %d",
                dex_id, total_en_files, total_es_files, total_cards_en, digital_excluded,
            )

    # ── rarities.json (merge: human-owned es/wikidex preserved) ───────────────
    existing_rarities = _load_existing_rarities()
    rarities_list = _build_rarities_list(rarity_counts, existing_rarities)
    _write_json(_rarities_path(), rarities_list, args.dry_run)

    # ── _meta.json ────────────────────────────────────────────────────────────
    meta = {
        "schema_version": 1,
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "dex_range": {"min": 1, "max": 1025},
        "files": {"en": total_en_files, "es": total_es_files},
        "cards": {"en": total_cards_en, "es": total_cards_es},
        "digital_exclusions": {
            "series_ids_treated_as_digital": sorted(DIGITAL_SERIES_IDS),
            "set_ids_prefetched": len(digital_set_ids),
            "cards_excluded": digital_excluded,
        },
        "doubtful_sets": sorted(doubtful_sets),
        "rarities": {
            "distinct_count": len(rarity_counts),
            "null_rarity_cards": null_rarity_cards,
        },
    }
    _write_json(_meta_path(), meta, args.dry_run)

    log.info("=" * 60)
    log.info("DONE%s.", " (dry run — nothing written)" if args.dry_run else "")
    log.info("  EN files written   : %d", total_en_files)
    log.info("  ES files written   : %d", total_es_files)
    log.info("  Cards EN           : %d", total_cards_en)
    log.info("  Cards ES           : %d", total_cards_es)
    log.info("  Digital excluded   : %d", digital_excluded)
    log.info("  Skipped (cached)   : %d", skipped)
    log.info("  Distinct rarities  : %d", len(rarity_counts))
    if null_rarity_cards:
        log.warning("  Null-rarity cards  : %d", null_rarity_cards)
    if doubtful_sets:
        log.warning("  Doubtful sets (%d) : %s", len(doubtful_sets), sorted(doubtful_sets))
    else:
        log.info("  Doubtful sets      : none")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
