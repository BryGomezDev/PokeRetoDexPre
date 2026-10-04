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
        f"variantMapped must not be present in card entry, got keys: {list(entry)}"
    assert entry["id"] == "sv01-001"
    assert entry["setId"] == "sv01"

    # ── build_en_entry: null rarity preserved as None ─────────────────────────
    card_null = dict(card, rarity=None)
    entry_null = build_en_entry(card_null)
    assert entry_null["rarity"] is None, \
        f"Expected None for null rarity, got {entry_null['rarity']!r}"

    # ── build_es_entry: name and image overridden ─────────────────────────────
    es_card = {"name": "Herbizarre ES", "image": "https://assets.tcgdex.net/es/sv/sv01/001/high.webp"}
    es_entry = build_es_entry(entry, es_card)
    assert es_entry["name"] == "Herbizarre ES", \
        f"Expected ES name override, got {es_entry['name']!r}"
    assert es_entry["image"] == es_card["image"], \
        f"Expected ES image override"
    assert es_entry["rarity"] == "Common", \
        f"Expected rarity inherited from EN entry"
    assert "variantMapped" not in es_entry

    # ── _build_rarities_list: merge preserves human fields ───────────────────
    counts = {"Common": 500, "Rare Holo": 100, "Secret Rare": 10}
    existing = {
        "Common":     {"tcgdex": "Common",     "es": "Común",     "wikidex": True,  "cards": 400},
        "Rare Holo":  {"tcgdex": "Rare Holo",  "es": "Rara Holo", "wikidex": True,  "cards": 80},
        "Stale Rare": {"tcgdex": "Stale Rare", "es": None,        "wikidex": False, "cards": 1},
    }
    merged = _build_rarities_list(counts, existing)

    # Sorted by cards descending
    assert merged[0]["tcgdex"] == "Common" and merged[0]["cards"] == 500
    assert merged[0]["es"] == "Común" and merged[0]["wikidex"] is True
    assert merged[1]["tcgdex"] == "Rare Holo" and merged[1]["cards"] == 100
    assert merged[1]["es"] == "Rara Holo"
    # New entry starts with nulls
    assert merged[2]["tcgdex"] == "Secret Rare"
    assert merged[2]["es"] is None and merged[2]["wikidex"] is False
    # Stale entry dropped
    assert all(r["tcgdex"] != "Stale Rare" for r in merged)
    assert len(merged) == 3

    # ── _build_rarities_list: None key (null rarity from API) ────────────────
    counts_with_null = {None: 12, "Common": 500}
    merged_null = _build_rarities_list(counts_with_null, {})
    assert merged_null[0]["tcgdex"] == "Common"       # sorted DESC by cards
    assert merged_null[1]["tcgdex"] is None
    assert merged_null[1]["es"] is None
    assert merged_null[1]["wikidex"] is False

    # ── _variants_dict: partial input keeps present values ───────────────────
    v_none = _variants_dict(None)
    assert v_none == {"normal": False, "holo": False, "reverse": False,
                      "firstEdition": False, "wPromo": False}
    v_partial = _variants_dict({"holo": True, "reverse": True})
    assert v_partial["holo"] is True
    assert v_partial["reverse"] is True
    assert v_partial["normal"] is False
    assert v_partial["firstEdition"] is False

    print("All assertions passed.")
