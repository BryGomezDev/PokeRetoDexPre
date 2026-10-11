"""
explore_api.py — API structure discovery
Purpose: understand card data structure and find how to filter by dexId.
"""
import sys, os, time, json, requests
sys.path.insert(0, os.path.dirname(__file__))
from utils import cached_get, graphql_query, BASE_URL, HEADERS, DELAY, _cache_path

def main():
    print("=" * 60)
    print("STEP 1 — English cards index")
    print("=" * 60)
    index = cached_get(f"{BASE_URL}/en/cards", "en_cards_index")
    if index is None:
        print("  FAILED to fetch /en/cards")
        return
    print(f"  Total cards in index: {len(index)}")
    if index:
        first = index[0]
        print(f"  Fields on first item: {list(first.keys())}")
        print(f"  First item: {first}")

    print()
    print("=" * 60)
    print("STEP 2 — Full card detail")
    print("=" * 60)
    card_id = index[0]["id"] if index else "base1-1"
    print(f"  Fetching detail for: {card_id}")
    detail = cached_get(f"{BASE_URL}/en/cards/{card_id}", f"en_card_detail_{card_id}")
    if detail:
        print(f"  All fields present: {list(detail.keys())}")
        for k, v in detail.items():
            print(f"    {k}: {repr(v)[:120]}")
        variants = detail.get("variants")
        print(f"\n  variants type: {type(variants).__name__}, value: {variants}")
        dex_ids = detail.get("dexIds")
        print(f"  dexIds type: {type(dex_ids).__name__ if dex_ids is not None else 'NoneType'}, value: {dex_ids}")
    else:
        print("  FAILED to fetch card detail")

    print()
    print("=" * 60)
    print("STEP 3 — REST dexId filter tests")
    print("=" * 60)
    filter_candidates = [
        ("dexId=6",    f"{BASE_URL}/en/cards?dexId=6"),
        ("dexIds=6",   f"{BASE_URL}/en/cards?dexIds=6"),
        ("q=dexId:6",  f"{BASE_URL}/en/cards?q=dexId:6"),
    ]
    rest_winner = None
    for param, url in filter_candidates:
        time.sleep(DELAY)
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            count = len(r.json()) if r.status_code == 200 else "N/A"
            print(f"  {param} -> status={r.status_code}, results={count}")
            if r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) > 0 and rest_winner is None:
                rest_winner = (param, url, r.json())
                # cache it
                path = _cache_path("en_cards_dexid_6_rest")
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(r.json(), f, ensure_ascii=False, indent=2)
                print(f"    *** Winner! Cached as en_cards_dexid_6_rest ***")
        except Exception as e:
            print(f"  {param} -> ERROR: {e}")

    print()
    print("=" * 60)
    print("STEP 4 — GraphQL dexId filter tests")
    print("=" * 60)
    gql_tests = [
        ("a", '{ cards(filters: { dexIds: [6] }) { id name rarity dexIds } }'),
        ("b", '{ cards(filters: { dexId: 6 }) { id name } }'),
    ]
    gql_winner = None
    for label, query in gql_tests:
        result = graphql_query(query, f"dexid_6_{label}")
        if result and "data" in result and result["data"]:
            cards = result["data"].get("cards", [])
            print(f"  Query {label} -> worked! {len(cards)} cards returned")
            print(f"    Sample: {cards[:2]}")
            if gql_winner is None:
                gql_winner = label
        elif result and "errors" in result:
            print(f"  Query {label} -> errors: {result['errors'][:1]}")
        else:
            print(f"  Query {label} -> no data / failed")

    print()
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    if rest_winner:
        print(f"  Best dexId filter method: REST — ?{rest_winner[0]}")
        sample = rest_winner[2][:3]
        print(f"  Sample cards for dexId=6: {[c.get('name', c.get('id')) for c in sample]}")
    elif gql_winner:
        print(f"  Best dexId filter method: GraphQL — query variant {gql_winner}")
    else:
        print("  Best dexId filter method: client-side (no server-side filter worked)")

    if detail:
        print(f"  Card fields (full detail): {list(detail.keys())}")
        # field is 'dexId' (singular) in card detail
        dex_id_val = detail.get("dexId") or detail.get("dexIds")
        if dex_id_val is not None:
            inner = dex_id_val[0] if dex_id_val else None
            print(f"  dexId field type: array of {type(inner).__name__ if inner is not None else 'unknown'}")
        else:
            print("  dexId field: null/missing on this card")
        variants = detail.get("variants")
        if isinstance(variants, dict):
            print(f"  variants field structure: object with keys {list(variants.keys())}")
            print(f"  variants values: {variants}")
        elif isinstance(variants, list):
            print(f"  variants field structure: array of strings: {variants}")
        else:
            print(f"  variants field: {variants}")

if __name__ == "__main__":
    main()
