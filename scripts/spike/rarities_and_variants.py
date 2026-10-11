"""
rarities_and_variants.py -- rarity mapping and variants structure

Key finding: the /lang/cards index only has {id, localId, name, image}.
Rarity is available via:
  1. /lang/rarities endpoint (list of rarity strings)
  2. Full card detail (individual /lang/cards/{id} fetches)
  3. Fetching a set's card list which MAY include rarity

We use /rarities endpoint + fetch a sample of EN card details for rarity distribution.
"""
import sys, os, json, time
sys.path.insert(0, os.path.dirname(__file__))
from utils import cached_get, BASE_URL, _cache_path, graphql_query

LANGUAGES = ["en", "es", "fr", "de", "it", "ja", "ko", "zh-tw", "zh-cn"]

RARITY_MAP_HINTS = {
    "Common": ("basica", "HIGH"),
    "Uncommon": ("basica", "HIGH"),
    "None": ("basica", "MED"),
    "Promo": ("basica", "MED"),
    "Black White Rare": ("holo", "MED"),
    "Rare": ("holo", "HIGH"),
    "Rare Holo": ("holo", "HIGH"),
    "Rare Holo EX": ("alternativa", "HIGH"),
    "Rare Holo GX": ("alternativa", "HIGH"),
    "Rare Holo V": ("alternativa", "HIGH"),
    "Rare Holo VMAX": ("alternativa", "HIGH"),
    "Rare Holo VSTAR": ("alternativa", "HIGH"),
    "Rare Ultra": ("alternativa", "HIGH"),
    "Ultra Rare": ("alternativa", "HIGH"),
    "Double Rare": ("alternativa", "HIGH"),
    "Amazing Rare": ("alternativa", "MED"),
    "Radiant Rare": ("alternativa", "MED"),
    "Character Rare": ("alternativa", "MED"),
    "Character Super Rare": ("alternativa", "MED"),
    "Trainer Gallery Rare Holo": ("holo", "MED"),
    "Rare Shining": ("holo", "MED"),
    "Rare Prime": ("holo", "MED"),
    "Rare ACE": ("alternativa", "MED"),
    "ACE SPEC Rare": ("alternativa", "MED"),
    "Rare BREAK": ("holo", "MED"),
    "Legend": ("alternativa", "MED"),
    "Futuristic Rare": ("alternativa", "MED"),
    "Rare Rainbow": ("fullart", "HIGH"),
    "Rare Secret": ("fullart", "HIGH"),
    "Rare Full Art": ("fullart", "HIGH"),
    "Hyper Rare": ("fullart", "HIGH"),
    "Special Illustration Rare": ("fullart", "HIGH"),
    "Illustration Rare": ("fullart", "HIGH"),
    "Classic Collection": ("alternativa", "MED"),
    "Shiny Rare": ("holo", "MED"),
    "Shiny Ultra Rare": ("fullart", "MED"),
    "Crown Rare": ("fullart", "HIGH"),
    "Mega Hyper Rare": ("fullart", "HIGH"),
}

def propose_mapping(rarity: str) -> tuple[str, str]:
    if rarity in RARITY_MAP_HINTS:
        return RARITY_MAP_HINTS[rarity]
    r_lower = rarity.lower()
    if any(x in r_lower for x in ("secret", "full art", "hyper", "crown", "special illustration")):
        return ("fullart", "MED")
    if any(x in r_lower for x in ("rainbow", "illustration", "shiny ultra")):
        return ("fullart", "MED")
    if any(x in r_lower for x in ("ultra", "double")):
        return ("alternativa", "MED")
    if any(x in r_lower for x in ("holo", "rare")):
        return ("holo", "MED")
    if any(x in r_lower for x in ("common", "uncommon", "promo", "none")):
        return ("basica", "MED")
    return ("AMBIGUOUS", "LOW")

def main():
    rarities_by_lang = {}

    print("Fetching /rarities endpoints...")
    for lang in LANGUAGES:
        rarities_ep = cached_get(f"{BASE_URL}/{lang}/rarities", f"{lang}_rarities_endpoint")
        if rarities_ep:
            rarities_by_lang[lang] = rarities_ep
            print(f"  {lang}: {len(rarities_ep)} rarities")
        else:
            print(f"  {lang}: no /rarities endpoint")

    # For rarity counts we need card details.
    # Use GraphQL to get a broad sample: fetch 200 EN cards with rarity
    print()
    print("Fetching EN rarity distribution via GraphQL (sample)...")
    # GraphQL can give us id + rarity in one query
    gql_result = graphql_query(
        '{ cards { id rarity } }',
        "en_all_rarities_sample"
    )
    rarity_counts = {}
    if gql_result and "data" in gql_result:
        all_cards = gql_result["data"].get("cards", [])
        print(f"  GraphQL returned {len(all_cards)} cards with rarity field")
        for card in all_cards:
            r = card.get("rarity") or "None"
            rarity_counts[r] = rarity_counts.get(r, 0) + 1
    else:
        print("  GraphQL rarity query failed or returned no data")

    # Variant structure -- from card details we already have
    print()
    print("Checking variant structure from cached card details...")
    out_dir = os.path.join(os.path.dirname(__file__), "out")
    detail_files = [f for f in os.listdir(out_dir) if f.startswith("en_card_detail_")]
    variant_examples = {}
    for fname in detail_files:
        try:
            with open(os.path.join(out_dir, fname), encoding="utf-8") as f:
                card = json.load(f)
        except (json.JSONDecodeError, ValueError):
            continue
        v = card.get("variants")
        if isinstance(v, dict):
            for k in v:
                if k not in variant_examples:
                    variant_examples[k] = []
                variant_examples[k].append((card.get("name","?"), v[k]))

    # English specific: Mega, GMax, Alolan counts via GraphQL
    print()
    print("English card name analysis (Mega/GMax/Alolan) via GraphQL...")
    gql_names = graphql_query('{ cards { id name dexId } }', "en_all_names_dexid")
    mega_count = gmax_count = alolan_count = no_dexid_count = 0
    mega_ex = []
    gmax_ex = []
    alolan_ex = []
    no_dexid_ex = []
    if gql_names and "data" in gql_names:
        all_named = gql_names["data"].get("cards", [])
        print(f"  GraphQL returned {len(all_named)} cards with name+dexId")
        for c in all_named:
            n = (c.get("name") or "").lower()
            d = c.get("dexId") or []
            if not d:
                no_dexid_count += 1
                if len(no_dexid_ex) < 3:
                    no_dexid_ex.append(c)
            if "mega" in n:
                mega_count += 1
                if len(mega_ex) < 3:
                    mega_ex.append(c)
            if "gmax" in n or "gigantamax" in n:
                gmax_count += 1
                if len(gmax_ex) < 3:
                    gmax_ex.append(c)
            if "alola" in n or "alolan" in n:
                alolan_count += 1
                if len(alolan_ex) < 3:
                    alolan_ex.append(c)

        def safe_name(s):
            return (s or "").encode("ascii", "replace").decode()

        print(f"\n  'Mega' in name: {mega_count}")
        for c in mega_ex:
            print(f"    {c.get('id','?')} - {safe_name(c.get('name'))} - dexId={c.get('dexId')}")
        print(f"\n  'GMax/Gigantamax' in name: {gmax_count}")
        for c in gmax_ex:
            print(f"    {c.get('id','?')} - {safe_name(c.get('name'))} - dexId={c.get('dexId')}")
        print(f"\n  'Alola/Alolan' in name: {alolan_count}")
        for c in alolan_ex:
            print(f"    {c.get('id','?')} - {safe_name(c.get('name'))} - dexId={c.get('dexId')}")
        print(f"\n  Cards without dexId (Trainer/Energy/other): {no_dexid_count}")
        for c in no_dexid_ex[:3]:
            print(f"    {c.get('id','?')} - {safe_name(c.get('name'))}")

    # Print rarity table
    print()
    print("=" * 80)
    print("ENGLISH RARITY VALUES + MAPPING PROPOSAL (from GraphQL)")
    print("=" * 80)
    if rarity_counts:
        sorted_r = sorted(rarity_counts.items(), key=lambda x: -x[1])
        print(f"  {'rarity':<45} {'count':>6}  proposed_mapping       confidence")
        print("-" * 85)
        for rarity, count in sorted_r:
            mapping, conf = propose_mapping(rarity)
            print(f"  {rarity:<45} {count:>6}  {mapping:<22} {conf}")
        unmappable = [(r, c) for r, c in sorted_r if propose_mapping(r)[0] == "AMBIGUOUS"]
        if unmappable:
            print(f"\n  Unmappable: {[r for r, _ in unmappable]}")
    else:
        print("  No rarity data available (GraphQL query may have returned cards without rarity)")
        print("  Available rarities per language from /rarities endpoint:")
        for lang, rarities in rarities_by_lang.items():
            print(f"    {lang}: {rarities}")

    # Variant structure table
    print()
    print("=" * 80)
    print("VARIANTS STRUCTURE (from card detail)")
    print("=" * 80)
    print("  variants is an object (dict) with boolean values.")
    variant_meanings = {
        "normal":       "Standard non-holo print",
        "holo":         "Holo foil print",
        "reverse":      "Reverse holo print (foil background)",
        "firstEdition": "First Edition stamp",
        "wPromo":       "Wizards of the Coast promo stamp",
    }
    print(f"  {'key':<15} {'meaning':<40} notes")
    print("-" * 70)
    for k, meaning in variant_meanings.items():
        print(f"  {k:<15} {meaning:<40}")

    print()
    print("  A single card CAN have multiple variant keys = True simultaneously.")
    print("  Example: a card may be both holo=True AND firstEdition=True.")
    print("  NOTE: TCGdex 'variants' (printing variants) != our app 'variant' (card quality tier).")
    print("  Our app variant (basica/holo/alternativa/fullart) maps to TCGdex RARITY, not variants.")

    # Language rarities comparison
    print()
    print("=" * 80)
    print("RARITIES PER LANGUAGE (from /rarities endpoint)")
    print("=" * 80)
    for lang, rarities in rarities_by_lang.items():
        safe_r = [r.encode('ascii', 'replace').decode() for r in rarities]
        print(f"  {lang}: {safe_r}")

if __name__ == "__main__":
    main()
