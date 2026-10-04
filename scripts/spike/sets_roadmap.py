"""
sets_roadmap.py — Brayan's roadmap sets discovery
"""
import sys, os, json, time, requests
sys.path.insert(0, os.path.dirname(__file__))
from utils import cached_get, BASE_URL, HEADERS, DELAY, _cache_path

TARGET_SETS = [
    "Astral Radiance",
    "Pokémon 151",
    "Pokemon 151",
    "sv3.5",
    "sv3pt5",
    "Black Bolt",
    "White Flare",
    "Crown Zenith",
    "Cosmic Eclipse",
    "Destined Rivals",
]

def fuzzy_match(name: str, target: str) -> bool:
    return target.lower() in name.lower() or name.lower() in target.lower()

def probe_lang(lang: str, set_id: str) -> str:
    """Return '200' or '404' for a set in a given language."""
    url = f"{BASE_URL}/{lang}/sets/{set_id}"
    cache_key = f"{lang}_set_{set_id}"
    cache_path = _cache_path(cache_key)
    if os.path.exists(cache_path):
        return "200"
    for attempt in range(3):
        time.sleep(DELAY)
        try:
            r = requests.get(url, headers=HEADERS, timeout=15)
            if r.status_code == 200:
                with open(cache_path, "w", encoding="utf-8") as f:
                    json.dump(r.json(), f, ensure_ascii=False, indent=2)
                return "200"
            elif r.status_code in (429, 500, 502, 503):
                wait = 5 * (attempt + 1)
                print(f"  [{r.status_code}] {url} — waiting {wait}s...")
                time.sleep(wait)
            else:
                return str(r.status_code)
        except Exception as e:
            return f"ERR:{e}"
    return "ERR:max_retries"

def main():
    # Step 1: Load English sets
    print("Loading English sets...")
    en_sets = cached_get(f"{BASE_URL}/en/sets", "en_sets")
    if not en_sets:
        print("  FAILED to load /en/sets")
        en_sets = []

    # Also load Japanese sets for Black Bolt / White Flare
    print("Loading Japanese sets...")
    ja_sets = cached_get(f"{BASE_URL}/ja/sets", "ja_sets")
    if not ja_sets:
        ja_sets = []

    print(f"  EN sets: {len(en_sets)}, JA sets: {len(ja_sets)}")

    # Step 2: Fuzzy match targets in EN sets
    print()
    print("Matching target sets in EN catalog...")
    matched = {}  # target_name → set object
    for target in TARGET_SETS:
        for s in en_sets:
            sname = s.get("name", "")
            sid = s.get("id", "")
            if fuzzy_match(sname, target) or fuzzy_match(sid, target):
                # avoid duplicate entries
                key = sname or sid
                if key not in matched:
                    matched[key] = s
                    sname_safe = sname.encode('ascii', 'replace').decode()
                    print(f"  '{target}' -> matched EN set: id={sid}, name={sname_safe}")

    # Step 3: Fetch details for each matched set
    print()
    print("Fetching set details...")
    results = []
    seen_ids = set()

    for set_name, s in matched.items():
        set_id = s.get("id", "")
        if set_id in seen_ids:
            continue
        seen_ids.add(set_id)

        # EN set detail
        detail = cached_get(f"{BASE_URL}/en/sets/{set_id}", f"en_set_{set_id}")
        if not detail:
            detail = s  # use brief info

        declared_count = detail.get("cardCount", {})
        if isinstance(declared_count, dict):
            # some sets return {"official": N, "total": M}
            declared_total = declared_count.get("total", declared_count.get("official", "?"))
        elif isinstance(declared_count, int):
            declared_total = declared_count
        else:
            declared_total = "?"

        # Count actual cards
        cards_in_detail = detail.get("cards", [])
        actual_count = len(cards_in_detail) if cards_in_detail else "?"

        # Language availability
        en_status = "200"  # we already found it
        es_status = probe_lang("es", set_id)
        ja_status = probe_lang("ja", set_id)

        results.append({
            "name": detail.get("name", set_id),
            "id": set_id,
            "declared": declared_total,
            "actual": actual_count,
            "en": en_status,
            "es": es_status,
            "ja": ja_status,
            "notes": "",
        })
        print(f"  {set_id}: declared={declared_total}, actual={actual_count}, es={es_status}, ja={ja_status}")

    # Step 4: Check Japanese sets for anything not found in EN
    not_found_targets = []
    found_names = {r["name"].lower() for r in results}
    found_names.update({s.lower() for s in ["Pokémon 151", "Pokemon 151"]})  # aliases

    # Canonical target names (de-aliased)
    canonical = ["Astral Radiance", "Pokémon 151", "Black Bolt", "White Flare",
                 "Crown Zenith", "Cosmic Eclipse", "Destined Rivals"]
    for t in canonical:
        found = any(fuzzy_match(r["name"], t) for r in results)
        if not found:
            not_found_targets.append(t)

    if not_found_targets:
        print()
        print(f"Not found in EN — checking JA sets: {not_found_targets}")
        for target in not_found_targets:
            for s in ja_sets:
                sname = s.get("name", "")
                sid = s.get("id", "")
                if fuzzy_match(sname, target) or fuzzy_match(sid, target):
                    print(f"  '{target}' found in JA: id={sid}, name={sname.encode('ascii','replace').decode()}")
                    set_id = sid
                    if set_id not in seen_ids:
                        seen_ids.add(set_id)
                        detail = cached_get(f"{BASE_URL}/ja/sets/{set_id}", f"ja_set_{set_id}")
                        declared_count = (detail or s).get("cardCount", "?")
                        if isinstance(declared_count, dict):
                            declared_total = declared_count.get("total", declared_count.get("official", "?"))
                        elif isinstance(declared_count, int):
                            declared_total = declared_count
                        else:
                            declared_total = "?"
                        cards_in_detail = (detail or s).get("cards", [])
                        actual_count = len(cards_in_detail) if cards_in_detail else "?"
                        en_status = probe_lang("en", set_id)
                        es_status = probe_lang("es", set_id)
                        results.append({
                            "name": (detail or s).get("name", set_id),
                            "id": set_id,
                            "declared": declared_total,
                            "actual": actual_count,
                            "en": en_status,
                            "es": es_status,
                            "ja": "200",
                            "notes": "JA only (searched JA catalog)",
                        })

    # Print final table
    print()
    print("=" * 100)
    print("ROADMAP SETS TABLE")
    print("=" * 100)
    print(f"  {'set_name':<30} {'id':<15} {'declared':>9} {'actual':>7}  en    es    ja   notes")
    print("-" * 100)
    for r in results:
        safe_name = r['name'].encode('ascii', 'replace').decode()
        print(f"  {safe_name:<30} {r['id']:<15} {str(r['declared']):>9} {str(r['actual']):>7}  {r['en']:<5} {r['es']:<5} {r['ja']:<5} {r['notes']}")

    if not results:
        print("  No sets matched. Check target names vs API catalog.")
        # Print a sample of EN set names to help debug
        print()
        print("  Sample EN set names (first 20):")
        for s in en_sets[:20]:
            sn = s.get('name','?').encode('ascii','replace').decode()
            print(f"    id={s.get('id','?')}, name={sn}")

if __name__ == "__main__":
    main()
