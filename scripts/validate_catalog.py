#!/usr/bin/env python3
"""
validate_catalog.py — Acceptance tests for the TCG card catalog ETL output.

Acceptance criteria:
  A1  All 1025 dex files exist (or are accounted for by _meta.files_written)
  A2  Every dex file parses as valid JSON with top-level keys "en" and "es"
  A3  Global EN/ES card counts match _meta.json baseline (17993 / 11987)
  A4  rarities.json has exactly 32 entries and their card-count sum equals EN total
  A5  No card carries a "variantMapped" field (removed in PASO 3)
  A6  Every card has exactly the five variant keys; at least one is true
  A7  Image field is always a string (never null); non-empty URLs start with
      https://assets.tcgdex.net/
  A8  ES cards for each dex ID are a strict subset of EN cards (by card id)
  A9  No TCG Pocket set IDs leaked into the catalog (proxy: setId matches
      r"^[A-Z]\\d" or starts with "P-")
  A10 (--check-images) HTTP HEAD spot-check on a sample of non-empty image
      URLs returns 200; skipped unless flag is passed

Usage:
  python validate_catalog.py [--catalog-dir PATH] [--check-images]

Exit code 0 = all checks pass; 1 = any check failed.
"""

import argparse
import json
import os
import re
import sys
import urllib.request
import urllib.error
from pathlib import Path

# ── Baseline values (updated after dexId 896 recovered) ────────────────────
BASELINE_EN = 17995
BASELINE_ES = 11989
BASELINE_RARITIES = 32
BASELINE_FILES = 1025
EXPECTED_DEX_MAX = 1025

VARIANT_KEYS = frozenset({"normal", "holo", "reverse", "firstEdition", "wPromo"})
POCKET_RE = re.compile(r"^[A-Z]\d|^P-")
TCGDEX_IMAGE_PREFIX = "https://assets.tcgdex.net/"

IMAGE_SPOT_SAMPLE = 30  # number of URLs to HEAD-check in A10


def _catalog_dir_default() -> Path:
    here = Path(__file__).resolve().parent
    # scripts/ → project root → public/catalog/v1
    return here.parent / "public" / "catalog" / "v1"


def _meta_path(catalog: Path) -> Path:
    return catalog / "_meta.json"


def _rarities_path(catalog: Path) -> Path:
    return catalog / "rarities.json"


# ── Result helpers ──────────────────────────────────────────────────────────

class Result:
    def __init__(self, label: str, description: str):
        self.label = label
        self.description = description
        self.passed: bool | None = None
        self.evidence: str = ""
        self.failures: list[str] = []

    def pass_(self, evidence: str) -> "Result":
        self.passed = True
        self.evidence = evidence
        return self

    def fail(self, evidence: str, failures: list[str] | None = None) -> "Result":
        self.passed = False
        self.evidence = evidence
        self.failures = failures or []
        return self


def _print_result(r: Result) -> None:
    status = "PASS" if r.passed else "FAIL"
    print(f"  [{status}] {r.label}: {r.description}")
    print(f"         {r.evidence}")
    if not r.passed:
        for line in r.failures[:10]:
            print(f"         ! {line}")
        if len(r.failures) > 10:
            print(f"         ! ... and {len(r.failures) - 10} more")


# ── Load all dex files once ─────────────────────────────────────────────────

def _load_catalog(catalog: Path) -> dict[int, dict]:
    """Returns {dex_id: parsed_json} for all {N}.json files."""
    data: dict[int, dict] = {}
    for entry in catalog.iterdir():
        if entry.suffix != ".json" or entry.name.startswith("_") or entry.stem in ("rarities",):
            continue
        try:
            dex_id = int(entry.stem)
        except ValueError:
            continue
        with entry.open(encoding="utf-8") as fh:
            data[dex_id] = json.load(fh)
    return data


# ── Individual checks ───────────────────────────────────────────────────────

def check_a1(catalog: Path, meta: dict) -> Result:
    """A1: File count matches _meta.files_written; all files parse cleanly."""
    r = Result("A1", "dex file count == _meta.files_written")
    files = [
        f for f in catalog.iterdir()
        if f.suffix == ".json" and not f.name.startswith("_") and f.stem != "rarities"
        and f.stem.isdigit()
    ]
    actual = len(files)
    expected = meta.get("files_written", BASELINE_FILES)
    if actual == expected:
        return r.pass_(f"{actual} files present, matches _meta.files_written={expected}")
    return r.fail(
        f"{actual} files present, expected {expected} per _meta.files_written",
        [f"Difference: {actual - expected:+d}"],
    )


def check_a2(catalog: Path) -> Result:
    """A2: Every dex JSON has top-level keys 'en' and 'es' (both lists)."""
    r = Result("A2", "all dex files parse as JSON with keys 'en' and 'es'")
    bad: list[str] = []
    files = sorted(
        (f for f in catalog.iterdir() if f.suffix == ".json" and f.stem.isdigit()),
        key=lambda f: int(f.stem),
    )
    for f in files:
        try:
            with f.open(encoding="utf-8") as fh:
                d = json.load(fh)
        except json.JSONDecodeError as exc:
            bad.append(f"{f.name}: JSON parse error — {exc}")
            continue
        if not isinstance(d.get("en"), list) or not isinstance(d.get("es"), list):
            bad.append(f"{f.name}: missing 'en' or 'es' list key, got keys={list(d.keys())}")
    if not bad:
        return r.pass_(f"{len(files)} files checked, all valid")
    return r.fail(f"{len(bad)}/{len(files)} files failed", bad)


def check_a3(catalog_data: dict[int, dict], meta: dict) -> Result:
    """A3: Total EN and ES card counts match _meta baseline."""
    r = Result("A3", f"sum(EN)==_meta.cards.en  sum(ES)==_meta.cards.es")
    total_en = sum(len(d.get("en", [])) for d in catalog_data.values())
    total_es = sum(len(d.get("es", [])) for d in catalog_data.values())
    cards_meta = meta.get("cards", {})
    meta_en = cards_meta.get("en", -1)
    meta_es = cards_meta.get("es", -1)
    failures = []
    if total_en != meta_en:
        failures.append(f"EN: counted {total_en}, _meta says {meta_en}")
    if total_es != meta_es:
        failures.append(f"ES: counted {total_es}, _meta says {meta_es}")
    if failures:
        return r.fail(f"count mismatch", failures)
    return r.pass_(f"EN={total_en}, ES={total_es} — both match _meta.json")


def check_a4(catalog: Path, catalog_data: dict[int, dict]) -> Result:
    """A4: rarities.json has 32 entries; sum(cards) == total EN cards."""
    r = Result("A4", f"rarities.json has {BASELINE_RARITIES} entries; sum(cards)==EN total")
    with _rarities_path(catalog).open(encoding="utf-8") as fh:
        rarities = json.load(fh)
    count = len(rarities)
    rarity_sum = sum(entry.get("cards", 0) for entry in rarities)
    total_en = sum(len(d.get("en", [])) for d in catalog_data.values())
    failures = []
    if count != BASELINE_RARITIES:
        failures.append(f"Expected {BASELINE_RARITIES} rarity entries, found {count}")
    if rarity_sum != total_en:
        failures.append(f"sum(rarities.cards)={rarity_sum} != total EN cards={total_en}")
    if failures:
        return r.fail(f"rarities={count}, sum={rarity_sum}, EN={total_en}", failures)
    return r.pass_(f"{count} rarities, sum(cards)={rarity_sum} == EN total")


def check_a5(catalog_data: dict[int, dict]) -> Result:
    """A5: No card has a 'variantMapped' field (should have been removed in PASO 3)."""
    r = Result("A5", "no 'variantMapped' field in any card")
    found: list[str] = []
    for dex_id, d in catalog_data.items():
        for lang in ("en", "es"):
            for card in d.get(lang, []):
                if "variantMapped" in card:
                    found.append(f"{dex_id}.json / {lang} / {card['id']}")
    if not found:
        return r.pass_(f"0 cards with variantMapped across {len(catalog_data)} dex files")
    return r.fail(f"{len(found)} cards still carry variantMapped", found)


def check_a6(catalog_data: dict[int, dict]) -> Result:
    """A6: Every card has exactly the 5 variant keys; at least one is true."""
    r = Result("A6", "each card has exactly 5 variant keys; at least one is true")
    wrong_keys: list[str] = []
    all_false: list[str] = []
    for dex_id, d in catalog_data.items():
        for lang in ("en", "es"):
            for card in d.get(lang, []):
                v = card.get("variants", {})
                if set(v.keys()) != VARIANT_KEYS:
                    wrong_keys.append(
                        f"{dex_id}.json/{lang}/{card['id']}: keys={sorted(v.keys())}"
                    )
                elif not any(v.values()):
                    all_false.append(f"{dex_id}.json/{lang}/{card['id']}")
    failures = wrong_keys + all_false
    if not failures:
        total = sum(len(d.get(l, [])) for d in catalog_data.values() for l in ("en", "es"))
        return r.pass_(f"all {total} cards have correct variant shape")
    detail = []
    if wrong_keys:
        detail.append(f"{len(wrong_keys)} cards with wrong variant keys")
    if all_false:
        detail.append(f"{len(all_false)} cards with all-false variants")
    return r.fail("; ".join(detail), failures)


def check_a7(catalog_data: dict[int, dict]) -> Result:
    """A7: image is always a string; non-empty values start with TCGDEX prefix."""
    r = Result("A7", "image is string (never null); non-empty URLs start with tcgdex prefix")
    null_image: list[str] = []
    bad_url: list[str] = []
    for dex_id, d in catalog_data.items():
        for lang in ("en", "es"):
            for card in d.get(lang, []):
                img = card.get("image")
                if not isinstance(img, str):
                    null_image.append(f"{dex_id}.json/{lang}/{card['id']}: image={img!r}")
                elif img and not img.startswith(TCGDEX_IMAGE_PREFIX):
                    bad_url.append(f"{dex_id}.json/{lang}/{card['id']}: {img[:80]}")
    failures = null_image + bad_url
    if not failures:
        total = sum(len(d.get(l, [])) for d in catalog_data.values() for l in ("en", "es"))
        return r.pass_(f"all {total} cards have valid image field")
    detail = []
    if null_image:
        detail.append(f"{len(null_image)} null/non-string image fields")
    if bad_url:
        detail.append(f"{len(bad_url)} URLs with unexpected prefix")
    return r.fail("; ".join(detail), failures)


def check_a8(catalog_data: dict[int, dict]) -> Result:
    """A8: ES card IDs for each dex entry are a strict subset of EN card IDs."""
    r = Result("A8", "ES cards are a strict subset of EN cards (by id) per dex file")
    violations: list[str] = []
    for dex_id, d in catalog_data.items():
        en_ids = {c["id"] for c in d.get("en", []) if c.get("id")}
        es_ids = {c["id"] for c in d.get("es", []) if c.get("id")}
        extra = es_ids - en_ids
        if extra:
            violations.append(f"{dex_id}.json: ES-only ids={sorted(extra)[:3]}")
    if not violations:
        return r.pass_(f"ES subset-of EN verified for all {len(catalog_data)} dex files")
    return r.fail(f"{len(violations)} dex files have ES ids not present in EN", violations)


def check_a9(catalog_data: dict[int, dict]) -> Result:
    """A9: No TCG Pocket set IDs in any card (regex: ^[A-Z]\\d or ^P-)."""
    r = Result("A9", "no TCG Pocket setIds leaked (proxy: ^[A-Z]\\d or ^P-)")
    pocket_cards: list[str] = []
    for dex_id, d in catalog_data.items():
        for lang in ("en", "es"):
            for card in d.get(lang, []):
                if POCKET_RE.match(card.get("setId", "")):
                    pocket_cards.append(
                        f"{dex_id}.json/{lang}/{card.get('id','?')} setId={card.get('setId','')}"
                    )
    if not pocket_cards:
        total = sum(len(d.get(l, [])) for d in catalog_data.values() for l in ("en", "es"))
        return r.pass_(f"0 Pocket cards found across {total} cards")
    return r.fail(f"{len(pocket_cards)} Pocket-looking cards found", pocket_cards)


def check_a10(catalog_data: dict[int, dict]) -> Result:
    """A10: HTTP HEAD spot-check on a sample of non-empty image URLs returns 200."""
    r = Result("A10", f"image URL spot-check (HEAD {IMAGE_SPOT_SAMPLE} URLs → 200)")
    # Collect a deterministic sample of non-empty EN image URLs
    urls: list[str] = []
    for dex_id in sorted(catalog_data.keys()):
        for card in catalog_data[dex_id].get("en", []):
            img = card.get("image", "")
            if img and img.startswith(TCGDEX_IMAGE_PREFIX):  # re-validate before urlopen
                urls.append(img)
        if len(urls) >= IMAGE_SPOT_SAMPLE * 5:
            break
    # Pick evenly spread
    if not urls:
        return r.fail("No non-empty image URLs found to sample", [])
    step = max(1, len(urls) // IMAGE_SPOT_SAMPLE)
    sample = urls[::step][:IMAGE_SPOT_SAMPLE]
    bad: list[str] = []
    for url in sample:
        try:
            req = urllib.request.Request(url, method="HEAD")
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status != 200:
                    bad.append(f"HTTP {resp.status}: {url}")
        except urllib.error.HTTPError as exc:
            bad.append(f"HTTP {exc.code}: {url}")
        except Exception as exc:
            bad.append(f"Error ({exc}): {url}")
    checked = len(sample)
    if not bad:
        return r.pass_(f"{checked}/{checked} sampled URLs returned 200")
    return r.fail(f"{len(bad)}/{checked} URLs did not return 200", bad)


# ── Main ────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="Validate TCG catalog ETL output.")
    parser.add_argument(
        "--catalog-dir",
        type=Path,
        default=_catalog_dir_default(),
        help="Path to public/catalog/v1 (default: auto-detected from script location)",
    )
    parser.add_argument(
        "--check-images",
        action="store_true",
        help="Enable A10: HTTP HEAD spot-check on image URLs (requires network)",
    )
    args = parser.parse_args()

    catalog: Path = args.catalog_dir.resolve()
    if not catalog.is_dir():
        print(f"ERROR: catalog directory not found: {catalog}", file=sys.stderr)
        return 1

    meta_file = _meta_path(catalog)
    rarities_file = _rarities_path(catalog)
    for required in (meta_file, rarities_file):
        if not required.exists():
            print(f"ERROR: required file missing: {required}", file=sys.stderr)
            return 1

    with meta_file.open(encoding="utf-8") as fh:
        meta = json.load(fh)

    print(f"\nValidating catalog: {catalog}")
    print(f"  _meta.generated_at : {meta.get('generated_at', 'unknown')}")
    print(f"  schema_version     : {meta.get('schema_version', '?')}")
    print()

    # Load all dex data once; checks share it (no re-reads)
    catalog_data = _load_catalog(catalog)
    print(f"  Loaded {len(catalog_data)} dex files into memory.\n")

    results: list[Result] = [
        check_a1(catalog, meta),
        check_a2(catalog),
        check_a3(catalog_data, meta),
        check_a4(catalog, catalog_data),
        check_a5(catalog_data),
        check_a6(catalog_data),
        check_a7(catalog_data),
        check_a8(catalog_data),
        check_a9(catalog_data),
    ]

    if args.check_images:
        print("  Running A10 (network): HEAD-checking image URLs …")
        results.append(check_a10(catalog_data))
    else:
        skipped = Result("A10", "image URL spot-check (skipped — pass --check-images to enable)")
        skipped.passed = True
        skipped.evidence = "skipped"
        results.append(skipped)

    print("=" * 60)
    for r in results:
        _print_result(r)
    print("=" * 60)

    failed = [r for r in results if not r.passed]
    passed = len(results) - len(failed)
    print(f"\n  {passed}/{len(results)} checks passed.")

    if failed:
        print(f"  FAILED: {', '.join(r.label for r in failed)}")
        return 1

    print("  All checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
