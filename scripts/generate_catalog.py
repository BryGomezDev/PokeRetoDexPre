"""
generate_catalog.py
====================
ETL script: fetches TCG card data from TCGdex API and writes static JSON
catalogs to public/catalog/v1/{dexId}.json, each containing:
  {"en": [...], "es": [...]}

Also writes public/catalog/v1/rarities.json and public/catalog/v1/_meta.json.

Usage:
    python scripts/generate_catalog.py [--force] [--dry-run] [--no-cache]

Flags:
    --force     Overwrite existing output files (default: skip already-written dexIds).
    --dry-run   Run all API calls but do not write any files; print summary only.
    --no-cache  Bypass reading from HTTP cache (still writes new responses to cache).

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

# HTTP response cache — keyed JSON files.  Gitignored (scripts/out/).
CACHE_DIR = os.path.join(_SCRIPT_DIR, "out", "http_cache")

# Series IDs from GET /v2/en/series that represent digital-only games.
# Verified 2026-10-04: "tcgp" = "Pokémon TCG Pocket" (15 sets: A1, A1a, …, A4a, B2a).
DIGITAL_SERIES_IDS: frozenset[str] = frozenset({"tcgp"})

# Cross-check regex: Pocket set IDs start with an uppercase letter + digit or "P-".
# Used only to flag discrepancies with the serie-based filter.
_POCKET_ID_PATTERN = re.compile(r"^[A-Z]\d|^P-")


# ── Run statistics ────────────────────────────────────────────────────────────
# Module-level so HTTP helpers can update them without signature changes.
STATS: dict[str, Any] = {
    "requests":       0,    # real API calls made (not cache hits)
    "retries":        0,    # HTTP-level retry attempts after the first
    "rate_429":       0,    # total 429 responses received
    "cache_hits":     0,    # responses served from disk cache
    "req_timestamps": [],   # time.monotonic() for each real API request
}


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def _post_with_retry(payload: dict) -> Optional[dict]:
    """POST to GRAPHQL_URL with exponential backoff on 429/5xx."""
    for attempt, wait in enumerate(RETRY_BACKOFF, start=1):
        try:
            time.sleep(SLEEP_BETWEEN_REQUESTS)
            if attempt == 1:
                STATS["requests"] += 1
                STATS["req_timestamps"].append(time.monotonic())
            else:
                STATS["retries"] += 1
            resp = requests.post(GRAPHQL_URL, json=payload, headers=HEADERS, timeout=20)
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code == 429:
                STATS["rate_429"] += 1
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
            if attempt == 1:
                STATS["requests"] += 1
                STATS["req_timestamps"].append(time.monotonic())
            else:
                STATS["retries"] += 1
            resp = requests.get(url, headers=HEADERS, timeout=30)
            if resp.status_code == 200:
                return resp.json()
            if resp.status_code == 429:
                STATS["rate_429"] += 1
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


# ── HTTP cache ────────────────────────────────────────────────────────────────

def _cache_path(key: str) -> str:
    return os.path.join(CACHE_DIR, f"{key}.json")


def _cache_read(key: str) -> Optional[Any]:
    path = _cache_path(key)
    if not os.path.exists(path):
        return None
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (json.JSONDecodeError, OSError):
        return None   # corrupt cache → treat as miss


def _cache_write(key: str, data: Any) -> None:
    os.makedirs(CACHE_DIR, exist_ok=True)
    try:
        with open(_cache_path(key), "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
    except OSError as exc:
        log.warning("Cache write failed for %r: %s", key, exc)  # non-fatal


# ── ES index ──────────────────────────────────────────────────────────────────

def fetch_es_index(no_cache: bool = False) -> dict[str, dict]:
    """Fetch the full ES card index. Called once per execution."""
    key = "es_index"
    if not no_cache:
        cached = _cache_read(key)
        if cached is not None:
            log.info("ES index: cache hit (%d cards).", len(cached))
            STATS["cache_hits"] += 1
            return {c["id"]: c for c in cached if isinstance(c, dict) and "id" in c}
    log.info("Fetching ES card index from %s/es/cards …", BASE_URL)
    data = _get_with_retry(f"{BASE_URL}/es/cards")
    if not data or not isinstance(data, list):
        log.error("Failed to fetch ES card index or unexpected format.")
        sys.exit(1)
    _cache_write(key, data)
    return {card["id"]: card for card in data if isinstance(card, dict) and "id" in card}


def fetch_digital_set_ids(
    digital_series: frozenset[str],
    no_cache: bool = False,
) -> frozenset[str]:
    """Return set IDs that belong to digital-only series (e.g. tcgp)."""
    all_ids: set[str] = set()
    for serie_id in sorted(digital_series):
        key = f"serie_{serie_id}"
        if not no_cache:
            cached = _cache_read(key)
            if cached is not None:
                log.info("Serie %r: cache hit.", serie_id)
                STATS["cache_hits"] += 1
                for s in cached.get("sets", []):
                    sid = s.get("id")
                    if sid:
                        all_ids.add(sid)
                continue
        log.info("Fetching set list for digital serie %r …", serie_id)
        data = _get_with_retry(f"{BASE_URL}/en/series/{serie_id}")
        if not data or not isinstance(data, dict):
            log.warning("Could not fetch serie %r — digital filter may be incomplete.", serie_id)
            continue
        _cache_write(key, data)
        for s in data.get("sets", []):
            sid = s.get("id")
            if sid:
                all_ids.add(sid)
    log.info("Digital set IDs: %d sets from series %s.", len(all_ids), sorted(digital_series))
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


def fetch_cards_for_dex_id(
    dex_id: int,
    no_cache: bool = False,
) -> Optional[list[dict]]:
    """Return list of raw card dicts for a dexId.
    Returns None on API error, [] when API succeeded but found no cards."""
    key = f"graphql_dexid_{dex_id:04d}"
    if not no_cache:
        cached = _cache_read(key)
        if cached is not None:
            STATS["cache_hits"] += 1
            return cached  # already the extracted cards list
    payload = {"query": GRAPHQL_QUERY, "variables": {"dexId": dex_id}}
    result = _post_with_retry(payload)
    if result is None:
        log.error("GraphQL query failed for dexId=%d.", dex_id)
        return None
    errors = result.get("errors")
    if errors:
        log.error("GraphQL errors for dexId=%d: %s", dex_id, errors)
        return None
    cards = (result.get("data") or {}).get("cards") or []
    _cache_write(key, cards)  # cache extracted list, not the full envelope
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
        "rarity":   card.get("rarity"),   # literal from API; None if missing
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

def _out_path(dex_id: int) -> str:
    return os.path.join(CATALOG_BASE, f"{dex_id}.json")


def _already_exists(dex_id: int) -> bool:
    return os.path.exists(_out_path(dex_id))


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
    """Load existing rarities.json keyed by tcgdex value (None for JSON null)."""
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
    """Merge new counts with existing human-curated es/wikidex values.

    Machine owns: tcgdex, cards.
    Human owns:   es, wikidex.
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
            "tcgdex":  rarity_val,
            "es":      old.get("es"),
            "wikidex": bool(old.get("wikidex", False)),
            "cards":   count,
        })
    result.sort(key=lambda x: x["cards"], reverse=True)
    return result


# ── Stats helpers ─────────────────────────────────────────────────────────────

def _peak_req_per_second(timestamps: list[float], window: float = 10.0) -> float:
    """Return max requests/s in any sliding window.  O(n), timestamps must be sorted."""
    if not timestamps:
        return 0.0
    peak = 0
    left = 0
    for right, ts in enumerate(timestamps):
        while timestamps[left] < ts - window:
            left += 1
        peak = max(peak, right - left + 1)
    return peak / window


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
    parser.add_argument(
        "--no-cache",
        action="store_true",
        dest="no_cache",
        help="Bypass reading from HTTP cache (still writes new responses to cache).",
    )
    args = parser.parse_args()

    if args.dry_run:
        log.info("DRY RUN — no files will be written.")
    if args.no_cache:
        log.info("--no-cache: HTTP cache reads bypassed.")

    start_time = time.monotonic()

    digital_set_ids = fetch_digital_set_ids(DIGITAL_SERIES_IDS, no_cache=args.no_cache)
    es_map = fetch_es_index(no_cache=args.no_cache)

    total_files = 0
    total_cards_en = 0
    total_cards_es = 0
    skipped = 0
    digital_excluded = 0
    doubtful_sets: set[str] = set()
    consecutive_errors = 0
    failed_dex_ids: list[int] = []
    rarity_counts: dict[Optional[str], int] = {}
    null_rarity_cards = 0

    for dex_id in range(1, 1026):
        if not args.force and _already_exists(dex_id):
            log.debug("Skipping dexId=%d (already exists).", dex_id)
            skipped += 1
            continue

        raw_cards = fetch_cards_for_dex_id(dex_id, no_cache=args.no_cache)

        if raw_cards is None:
            failed_dex_ids.append(dex_id)
            consecutive_errors += 1
            log.error(
                "API error for dexId=%d (%d/%d consecutive failures).",
                dex_id, consecutive_errors, MAX_CONSECUTIVE_ERRORS,
            )
            if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                log.error(
                    "Aborting: %d consecutive API errors. Failed dexIds so far: %s. "
                    "Retry with existing files skipped automatically.",
                    MAX_CONSECUTIVE_ERRORS, failed_dex_ids,
                )
                sys.exit(2)
            continue

        consecutive_errors = 0

        if not raw_cards:
            _write_json(_out_path(dex_id), {"en": [], "es": []}, args.dry_run)
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

        if not en_entries:
            # All cards were digital-excluded. Write sentinel so this dexId is not
            # re-fetched on resume runs.
            _write_json(_out_path(dex_id), {"en": [], "es": []}, args.dry_run)
            log.debug("All cards digital-excluded for dexId=%d — writing sentinel.", dex_id)
            continue

        _write_json(_out_path(dex_id), {"en": en_entries, "es": es_entries}, args.dry_run)
        total_files += 1
        total_cards_en += len(en_entries)
        total_cards_es += len(es_entries)

        if dex_id % 100 == 0:
            elapsed = time.monotonic() - start_time
            log.info(
                "[%d/1025] files: %d | cards EN: %d | digital excl: %d | %.0fs elapsed",
                dex_id, total_files, total_cards_en, digital_excluded, elapsed,
            )

    # ── rarities.json ─────────────────────────────────────────────────────────
    existing_rarities = _load_existing_rarities()
    rarities_list = _build_rarities_list(rarity_counts, existing_rarities)
    _write_json(_rarities_path(), rarities_list, args.dry_run)

    # ── _meta.json ────────────────────────────────────────────────────────────
    duration = time.monotonic() - start_time
    peak_rps = _peak_req_per_second(STATS["req_timestamps"])
    avg_rps = STATS["requests"] / duration if duration > 0 else 0.0
    meta = {
        "schema_version": 1,
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "dex_range": {"min": 1, "max": 1025},
        "files_written": total_files,
        "cards": {"en": total_cards_en, "es": total_cards_es},
        "digital_exclusions": {
            "series_ids_treated_as_digital": sorted(DIGITAL_SERIES_IDS),
            "set_ids_prefetched": len(digital_set_ids),
            "cards_excluded": digital_excluded,
        },
        "failed_dex_ids": sorted(failed_dex_ids),
        "doubtful_sets": sorted(doubtful_sets),
        "rarities": {
            "distinct_count": len(rarity_counts),
            "null_rarity_cards": null_rarity_cards,
        },
        "run_stats": {
            "api_requests": STATS["requests"],
            "retries": STATS["retries"],
            "rate_429": STATS["rate_429"],
            "cache_hits": STATS["cache_hits"],
            "duration_s": round(duration, 1),
            "avg_req_per_s": round(avg_rps, 2),
            "peak_req_per_s_10s": round(peak_rps, 2),
        },
    }
    _write_json(_meta_path(), meta, args.dry_run)

    log.info("=" * 60)
    log.info("DONE%s.", " (dry run — nothing written)" if args.dry_run else "")
    log.info("  Files written      : %d", total_files)
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
    log.info("  --- HTTP stats ---")
    log.info("  API requests       : %d", STATS["requests"])
    log.info("  Retries            : %d", STATS["retries"])
    log.info("  HTTP 429s          : %d", STATS["rate_429"])
    log.info("  Cache hits         : %d", STATS["cache_hits"])
    log.info("  Duration           : %.1fs", duration)
    log.info("  Avg req/s          : %.2f", avg_rps)
    log.info("  Peak req/s (10s)   : %.2f", peak_rps)
    log.info("=" * 60)
    if failed_dex_ids and not args.dry_run:
        log.warning(
            "FAILED dexIds (%d): %s — rerun without --force to retry.",
            len(failed_dex_ids), sorted(failed_dex_ids),
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
