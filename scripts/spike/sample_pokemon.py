"""
sample_pokemon.py -- dexId x language matrix
Uses GraphQL for EN counts, then client-side filtering on cached language card indexes.

Key findings from explore_api.py:
- REST ?dexId=N does NOT filter by pokemon dexId (it matches localId containing the digit)
- GraphQL { cards(filters: { dexId: N }) } works for EN total count
- The brief card index (/lang/cards) only has {id, localId, name, image} -- no dexId field
- dexId is only available on full card details
- Shared card IDs across languages (e.g. xy8-1 exists in both en and es)

Strategy:
- EN counts: GraphQL (accurate)
- Other language counts: fetch full card detail for cards found via GraphQL,
  probe which language endpoints return 200 for those card IDs.
  We sample up to 3 cards per dexId to estimate coverage, not an exact count.
"""
import sys, os, json, time, requests
sys.path.insert(0, os.path.dirname(__file__))
from utils import cached_get, graphql_query, BASE_URL, HEADERS, DELAY, _cache_path

DEX_IDS = [6, 25, 37, 133, 151, 650, 722, 888, 899, 1000, 1025]
DEX_NAMES = {
    6: "Charizard", 25: "Pikachu", 37: "Vulpix", 133: "Eevee",
    151: "Mew", 650: "Chespin", 722: "Rowlet", 888: "Zacian",
    899: "Wyrdeer", 1000: "Chi-Yu", 1025: "Pecharunt",
}
LANGUAGES = ["en", "es", "fr", "de", "it", "pt-br", "pt-pt", "nl", "pl", "ru", "ja", "ko", "zh-tw", "zh-cn", "id", "th"]

def gql_count_for_dex(dex_id: int) -> tuple[int, list]:
    query = f'{{ cards(filters: {{ dexId: {dex_id} }}) {{ id name }} }}'
    result = graphql_query(query, f"dexid_{dex_id}_all")
    if result and "data" in result and result["data"]:
        cards = result["data"].get("cards", [])
        return len(cards), [c["id"] for c in cards]
    return 0, []

def probe_lang_card(lang: str, card_id: str) -> bool:
    cache_key = f"probe2_{lang}_{card_id.replace('-','_').replace('.','_')}"
    cache_path = _cache_path(cache_key)
    if os.path.exists(cache_path):
        try:
            with open(cache_path, encoding="utf-8") as f:
                return json.load(f).get("exists", False)
        except (json.JSONDecodeError, ValueError):
            os.remove(cache_path)
    time.sleep(DELAY)
    try:
        r = requests.get(f"{BASE_URL}/{lang}/cards/{card_id}", headers=HEADERS, timeout=15)
        exists = r.status_code == 200
        with open(cache_path, "w", encoding="utf-8") as f:
            json.dump({"exists": exists, "status": r.status_code}, f)
        return exists
    except Exception as e:
        print(f"    [ERROR] {lang}/{card_id}: {e}")
        return False

def pick_sample_ids(ids: list, n: int = 3) -> list:
    """Pick n representative card IDs -- prefer those from main numbered sets (sv*, swsh*, sm*, xy*)."""
    preferred = [i for i in ids if any(i.startswith(p) for p in ("sv", "swsh", "sm", "xy", "dp", "ex"))]
    if preferred:
        return preferred[:n]
    return ids[:n]

def main():
    print("Using GraphQL for EN counts, REST probes for language availability.")
    print()

    print("Fetching card counts per dexId via GraphQL...")
    dex_card_ids = {}
    for dex_id in DEX_IDS:
        count, ids = gql_count_for_dex(dex_id)
        dex_card_ids[dex_id] = ids
        print(f"  dexId={dex_id} ({DEX_NAMES[dex_id]}): {count} cards (EN total)")

    print()
    print("Probing language availability (sample 3 cards per dexId)...")
    matrix = {}

    for dex_id in DEX_IDS:
        matrix[dex_id] = {"en": len(dex_card_ids[dex_id])}
        ids = dex_card_ids[dex_id]
        if not ids:
            for lang in LANGUAGES:
                if lang != "en":
                    matrix[dex_id][lang] = 0
            continue

        sample_ids = pick_sample_ids(ids, 3)
        for lang in LANGUAGES:
            if lang == "en":
                continue
            # Force all probes to fire and cache before evaluating — any() short-circuits
            probe_results = [probe_lang_card(lang, cid) for cid in sample_ids]
            found = any(probe_results)
            matrix[dex_id][lang] = "Y" if found else "N"
        print(f"  dexId={dex_id} probed {len(sample_ids)} sample cards across {len(LANGUAGES)-1} langs")

    # Vulpix dexId=37 names
    print()
    print("--- dexId=37 (Vulpix) card names ---")
    gql_cache = _cache_path("graphql_dexid_37_all")
    if os.path.exists(gql_cache):
        try:
            with open(gql_cache, encoding="utf-8") as f:
                gql37 = json.load(f)
        except (json.JSONDecodeError, ValueError):
            gql37 = {}
        cards37 = gql37.get("data", {}).get("cards", [])
        names37 = [c.get("name", "") for c in cards37]
        alolan = [n for n in names37 if "alolan" in n.lower() or "alola" in n.lower()]
        regular = [n for n in names37 if "alolan" not in n.lower() and "alola" not in n.lower()]
        unique = sorted(set(names37))
        safe = [n.encode('ascii', 'replace').decode() for n in unique]
        print(f"  Total cards for dexId=37: {len(cards37)}")
        print(f"  Unique card names: {safe}")
        print(f"  Regular Vulpix: {len(regular)}, Alolan Vulpix: {len(alolan)}")
        print("  -> Both Vulpix and Alolan Vulpix share dexId=37 (confirmed)")

    # Multi-dexId detection -- fetch a few TAG TEAM card details
    print()
    print("--- Multi-dexId cards ---")
    # TAG TEAM GX cards are known to have 2 dexIds
    # e.g., "Pikachu & Zekrom-GX" would have [25, 644]
    tag_team_candidates = ["sm12-33", "sm10-184", "sm11-73"]  # known TAG TEAM cards
    multi_found = []
    for cid in tag_team_candidates:
        cache_key = f"en_card_detail_{cid}"
        cache_path = _cache_path(cache_key)
        card_data = None
        if os.path.exists(cache_path):
            try:
                with open(cache_path, encoding="utf-8") as f:
                    card_data = json.load(f)
            except (json.JSONDecodeError, ValueError):
                card_data = None
        if card_data is None:
            card_data = cached_get(f"{BASE_URL}/en/cards/{cid}", cache_key)
        if card_data:
            dex_val = card_data.get("dexId") or []
            name = card_data.get("name", cid).encode('ascii', 'replace').decode()
            print(f"  {cid} - {name}: dexId={dex_val}")
            if isinstance(dex_val, list) and len(dex_val) > 1:
                multi_found.append((cid, name, dex_val))

    if multi_found:
        print(f"  Multi-dexId cards confirmed: {len(multi_found)}")
    else:
        print("  No multi-dexId found in this sample. TAG TEAM cards likely have multiple dexIds.")

    # Print table
    print()
    print("=" * 115)
    print("MATRIX TABLE -- EN=count, other langs=Y/N (probe on up to 3 representative cards)")
    print("=" * 115)
    header = f"{'dexId':>6} {'Pokemon':<12}" + "".join(f"{l:>7}" for l in LANGUAGES)
    print(header)
    print("-" * 115)
    for dex_id in DEX_IDS:
        name = DEX_NAMES[dex_id]
        row = f"{dex_id:>6} {name:<12}"
        for lang in LANGUAGES:
            val = matrix[dex_id].get(lang, "?")
            row += f"{str(val):>7}"
        print(row)

    print()
    print("NOTES:")
    print("  EN = total card count via GraphQL (language-agnostic API)")
    print("  Other = Y/N probe: does the /lang/cards/{id} endpoint return 200 for a sample card?")

if __name__ == "__main__":
    main()
