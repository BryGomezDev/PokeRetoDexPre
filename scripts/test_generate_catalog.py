"""
test_generate_catalog.py
========================
Smoke test for the rarity→variant mapping in generate_catalog.py.

Run:
    python scripts/test_generate_catalog.py
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from generate_catalog import map_rarity, RARITY_MAP

if __name__ == "__main__":
    assert RARITY_MAP.get("Secret Rare") == "fullart", \
        f"Expected 'fullart' for 'Secret Rare', got {RARITY_MAP.get('Secret Rare')!r}"

    assert map_rarity("Common") == "basica", \
        f"Expected 'basica' for 'Common', got {map_rarity('Common')!r}"

    assert map_rarity("UNKNOWN_RARITY") == "basica", \
        f"Expected fallback 'basica' for unknown rarity, got {map_rarity('UNKNOWN_RARITY')!r}"

    print("All assertions passed.")
