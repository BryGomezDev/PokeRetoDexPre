#!/usr/bin/env python3
"""
analyze_catalog_rarities.py — Read-only analysis of TCG catalog rarities.

Sections:
  1. Promo sets identification + non-Promo rarities within them
  2. Null/None rarities in promo sets
  3. Shiny* rarities grouped by set

Run from project root:
  python scripts/analyze_catalog_rarities.py
"""
import json
import os
import collections

CATALOG = os.path.join(os.path.dirname(__file__), "..", "public", "catalog", "v1")


def load_en_cards() -> list[dict]:
    """Returns all EN cards across all 1025 dex files."""
    cards = []
    for dex_id in range(1, 1026):
        path = os.path.join(CATALOG, f"{dex_id}.json")
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        cards.extend(data.get("en", []))
    return cards


def is_promo_set(set_id: str) -> bool:
    # All promo sets in this catalog have a setId ending in 'p'.
    # Yields 13 sets total (basep, bwp, dpp, hgssp, mep, miscp, np, smp, svp,
    # swshp, tk-ex-p, tk-xy-p, xyp) — all have "Promos" or "Promo" in their
    # setName, confirming the suffix is the structural marker for this catalog.
    # Note: not all cards in these sets have rarity="Promo" (see Section 1 output).
    return set_id.endswith("p")


def main() -> None:
    print("Loading catalog…")
    cards = load_en_cards()
    print(f"Total EN cards: {len(cards)}\n")

    promo_set_cards: dict[str, list[dict]] = collections.defaultdict(list)

    for card in cards:
        if is_promo_set(card.get("setId", "")):
            promo_set_cards[card["setId"]].append(card)

    # ── Build setId -> setName map for display ────────────────────────────────
    set_names: dict[str, str] = {}
    for card in cards:
        sid = card.get("setId", "")
        if sid not in set_names:
            set_names[sid] = card.get("setName", "")

    print("=" * 60)
    print("SECTION 1 — Promo sets and non-'Promo' rarities within them")
    print("=" * 60)
    print()
    print(f"Promo sets identified (setId ends in 'p'): {len(promo_set_cards)}")
    for sid in sorted(promo_set_cards):
        print(f"  {sid:10} -> {set_names[sid]}  ({len(promo_set_cards[sid])} cards)")
    print()

    # Count rarities != "Promo" inside promo sets
    non_promo_rarity_counts: dict[str, int] = collections.Counter()
    non_promo_examples: dict[str, list[str]] = collections.defaultdict(list)

    for sid, set_cards in promo_set_cards.items():
        for card in set_cards:
            r = card.get("rarity", "")
            if r != "Promo":
                non_promo_rarity_counts[r] += 1
                key = f"{r}"
                if len(non_promo_examples[key]) < 3:
                    non_promo_examples[key].append(
                        f"{card['id']} ({set_names[sid]})"
                    )

    total_non_promo = sum(non_promo_rarity_counts.values())
    print(f"Cards in promo sets with rarity != 'Promo': {total_non_promo}")
    if non_promo_rarity_counts:
        for rarity, count in sorted(non_promo_rarity_counts.items(), key=lambda x: -x[1]):
            print(f"  {rarity or '(empty string)'!r:30}  count={count}")
            for ex in non_promo_examples[rarity]:
                print(f"      example: {ex}")
    else:
        print("  (none)")

    print()
    print("=" * 60)
    print("SECTION 2 — Cards with rarity 'None' (or null/absent) in promo sets")
    print("=" * 60)
    print()

    none_rarity_cards: list[dict] = []
    for sid, set_cards in promo_set_cards.items():
        for card in set_cards:
            r = card.get("rarity")
            if r is None or r == "None":
                none_rarity_cards.append(card)

    print(f"Cards with rarity 'None' or null in promo sets: {len(none_rarity_cards)}")
    if none_rarity_cards:
        for card in none_rarity_cards[:10]:
            print(f"  {card['id']:25}  set={card.get('setId','?'):10}  rarity={card.get('rarity')!r}")
        if len(none_rarity_cards) > 10:
            print(f"  … and {len(none_rarity_cards) - 10} more")

    print()
    print("=" * 60)
    print("SECTION 3 — Shiny* rarities (any rarity starting with 'Shiny'), grouped by set")
    print("=" * 60)
    print()

    # Across ALL cards (not just promo sets)
    shiny_by_set: dict[str, dict[str, int]] = collections.defaultdict(
        lambda: collections.defaultdict(int)
    )
    shiny_total = 0

    for card in cards:
        r = card.get("rarity", "") or ""
        if r.startswith("Shiny"):
            sid = card.get("setId", "?")
            shiny_by_set[sid][r] += 1
            shiny_total += 1

    print(f"Total cards with Shiny* rarity: {shiny_total}")
    print()

    for sid in sorted(shiny_by_set, key=lambda s: -sum(shiny_by_set[s].values())):
        set_total = sum(shiny_by_set[sid].values())
        print(f"  {sid:12}  {set_names.get(sid, '?'):35}  total={set_total}")
        for rarity, count in sorted(shiny_by_set[sid].items()):
            print(f"      {rarity:30}  {count}")

    print()
    print("=" * 60)
    print("Done.")


if __name__ == "__main__":
    main()
