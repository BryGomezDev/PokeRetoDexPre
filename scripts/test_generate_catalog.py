"""
test_generate_catalog.py
========================
Smoke tests for generate_catalog.py.

Run:
    python scripts/test_generate_catalog.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate_catalog import (
    build_en_entry,
    build_es_entry,
    _variants_dict,
    _build_rarities_list,
    _peak_req_per_second,
)

if __name__ == "__main__":
    # ── build_en_entry: literal rarity, no variantMapped ─────────────────────
    card = {
        "id": "sv01-001",
        "localId": "001",
        "name": "Sprigatito",
        "rarity": "Common",
        "image": "https://assets.tcgdex.net/en/sv/sv01/001/high.webp",
        "set": {"id": "sv01", "name": "Scarlet & Violet"},
        "variants": {"normal": True, "holo": False, "reverse": True,
                     "firstEdition": False, "wPromo": False},
    }
    entry = build_en_entry(card)

    assert entry["rarity"] == "Common", \
        f"Expected literal rarity 'Common', got {entry['rarity']!r}"
    assert "variantMapped" not in entry, \
        f"variantMapped must not be present, got keys: {list(entry)}"
    assert entry["id"] == "sv01-001"
    assert entry["setId"] == "sv01"

    # ── build_en_entry: null rarity preserved as None ─────────────────────────
    entry_null = build_en_entry(dict(card, rarity=None))
    assert entry_null["rarity"] is None, \
        f"Expected None for null rarity, got {entry_null['rarity']!r}"

    # ── build_es_entry: name and image overridden ─────────────────────────────
    es_card = {
        "name": "Herbizarre ES",
        "image": "https://assets.tcgdex.net/es/sv/sv01/001/high.webp",
    }
    es_entry = build_es_entry(entry, es_card)
    assert es_entry["name"] == "Herbizarre ES"
    assert es_entry["image"] == es_card["image"]
    assert es_entry["rarity"] == "Common"          # inherited from EN entry
    assert "variantMapped" not in es_entry

    # ── combined output structure: {"en": [...], "es": [...]} ────────────────
    # The ETL writes one file per dexId with both language arrays.
    combined = {"en": [entry], "es": [es_entry]}
    assert "en" in combined and "es" in combined
    assert combined["en"][0]["rarity"] == "Common"
    assert combined["es"][0]["name"] == "Herbizarre ES"

    # ── _build_rarities_list: merge preserves human fields ───────────────────
    counts = {"Common": 500, "Rare Holo": 100, "Secret Rare": 10}
    existing = {
        "Common":     {"tcgdex": "Common",     "es": "Común",     "wikidex": True,  "cards": 400},
        "Rare Holo":  {"tcgdex": "Rare Holo",  "es": "Rara Holo", "wikidex": True,  "cards": 80},
        "Stale Rare": {"tcgdex": "Stale Rare", "es": None,        "wikidex": False, "cards": 1},
    }
    merged = _build_rarities_list(counts, existing)

    assert merged[0]["tcgdex"] == "Common" and merged[0]["cards"] == 500
    assert merged[0]["es"] == "Común" and merged[0]["wikidex"] is True
    assert merged[1]["tcgdex"] == "Rare Holo" and merged[1]["cards"] == 100
    assert merged[2]["tcgdex"] == "Secret Rare"
    assert merged[2]["es"] is None and merged[2]["wikidex"] is False   # new entry defaults
    assert all(r["tcgdex"] != "Stale Rare" for r in merged)           # stale dropped
    assert len(merged) == 3

    # ── _build_rarities_list: None key (null rarity from API) ─────────────────
    merged_null = _build_rarities_list({None: 12, "Common": 500}, {})
    assert merged_null[0]["tcgdex"] == "Common"    # sorted DESC by cards
    assert merged_null[1]["tcgdex"] is None
    assert merged_null[1]["es"] is None and merged_null[1]["wikidex"] is False

    # ── _variants_dict: None input → all False ────────────────────────────────
    v_none = _variants_dict(None)
    assert v_none == {"normal": False, "holo": False, "reverse": False,
                      "firstEdition": False, "wPromo": False}

    # ── _variants_dict: partial input keeps present values ───────────────────
    v_partial = _variants_dict({"holo": True, "reverse": True})
    assert v_partial["holo"] is True
    assert v_partial["reverse"] is True
    assert v_partial["normal"] is False
    assert v_partial["firstEdition"] is False

    # ── _peak_req_per_second: basic correctness ───────────────────────────────
    # 3 requests 1 second apart → 3/10 = 0.3 req/s peak in a 10s window
    ts = [0.0, 1.0, 2.0]
    assert abs(_peak_req_per_second(ts, window=10.0) - 0.3) < 1e-9

    # 5 requests in 2 seconds, then silence → peak ≥ 5/10 = 0.5
    ts_burst = [0.0, 0.5, 1.0, 1.5, 2.0, 30.0]
    assert _peak_req_per_second(ts_burst, window=10.0) >= 0.5

    # empty list → 0.0
    assert _peak_req_per_second([], window=10.0) == 0.0

    print("All assertions passed.")
