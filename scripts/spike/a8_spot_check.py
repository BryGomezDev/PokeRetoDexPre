"""
A8 spot-check: compare 20 catalog entries against live TCGdex API.
Run from project root: python scripts/spike/a8_spot_check.py
"""
import json, os, urllib.request, time

CATALOG_DIR = "public/catalog/v1"
TCGDEX = "https://api.tcgdex.net/v2"
CARD_IDS = [
    "base1-4",      "xy7-10",       "sm3-14",       "swsh1-25",
    "sv03.5-015",   "base1-58",     "neo1-16",       "ex1-101",
    "bw1-8",        "xy1-11",       "sm1-10",        "sm12-220",
    "bw11-101",     "xy12-1",       "sv01-001",      "swsh12.5-001",
    "sv06-001",     "swsh9-001",    "dp1-1",         "sv07-001",
]
CARD_SET = set(CARD_IDS)

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "PokeRetoDex-Audit/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=12) as r:
            return json.loads(r.read())
    except Exception as exc:
        return {"_error": str(exc)}

# ── 1. Build index from catalog ───────────────────────────────────────────────
print("Loading catalog files…", flush=True)
en_idx, es_idx = {}, {}
files = [f for f in os.listdir(CATALOG_DIR)
         if f.endswith(".json") and f not in ("rarities.json", "_meta.json")]
for i, fname in enumerate(files):
    if (i + 1) % 250 == 0:
        print(f"  {i+1}/{len(files)}", flush=True)
    with open(os.path.join(CATALOG_DIR, fname), encoding="utf-8") as fh:
        data = json.load(fh)
    for card in data.get("en", []):
        if card.get("id") in CARD_SET:
            en_idx[card["id"]] = card
    for card in data.get("es", []):
        if card.get("id") in CARD_SET:
            es_idx[card["id"]] = card

print(f"Catalog hit — EN: {len(en_idx)}, ES: {len(es_idx)}\n", flush=True)

# ── 2. Compare each card ──────────────────────────────────────────────────────
rows = []
for cid in CARD_IDS:
    cat_en = en_idx.get(cid)
    cat_es = es_idx.get(cid)

    api_en = fetch(f"{TCGDEX}/en/cards/{cid}")
    time.sleep(0.25)

    api_es = None
    if cat_es:
        api_es = fetch(f"{TCGDEX}/es/cards/{cid}")
        time.sleep(0.25)

    row = {"id": cid}

    # EN checks
    if "_error" in api_en:
        row["en_status"] = f"API_ERR:{api_en['_error'][:60]}"
    elif cat_en is None:
        row["en_status"] = "NOT_IN_CATALOG"
    else:
        api_set_id = (api_en.get("set") or {}).get("id", "")
        checks = {
            "name":   cat_en.get("name")   == api_en.get("name"),
            "rarity": cat_en.get("rarity") == api_en.get("rarity"),
            "setId":  cat_en.get("setId")  == api_set_id,
            "img":    (cat_en.get("image") or "").startswith("https://assets.tcgdex.net/"),
        }
        row["en_status"] = "PASS" if all(checks.values()) else "FAIL"
        row["en_checks"] = checks
        row["en_cat"] = {k: cat_en.get(k) for k in ("name", "rarity", "setId")}
        row["en_api"] = {"name": api_en.get("name"), "rarity": api_en.get("rarity"), "setId": api_set_id}

    # ES checks
    if cat_es is None:
        row["es_status"] = "NO_ES"
    elif api_es is None or "_error" in (api_es or {}):
        row["es_status"] = f"ES_API_ERR"
    else:
        name_ok = cat_es.get("name") == api_es.get("name")
        row["es_status"] = "PASS" if name_ok else "FAIL"
        row["es_cat_name"] = cat_es.get("name")
        row["es_api_name"] = api_es.get("name")

    rows.append(row)

# ── 3. Print results ──────────────────────────────────────────────────────────
print(f"{'ID':<20} {'EN':6} {'ES':6}  DETAIL")
print("-" * 80)
pass_count = 0
for r in rows:
    en_s = r.get("en_status", "?")
    es_s = r.get("es_status", "?")
    overall = "PASS" if en_s == "PASS" and es_s in ("PASS", "NO_ES") else "FAIL"
    if overall == "PASS":
        pass_count += 1

    detail_parts = []
    checks = r.get("en_checks", {})
    for field, ok in checks.items():
        if not ok:
            cat_v = r.get("en_cat", {}).get(field, "?")
            api_v = r.get("en_api", {}).get(field, "?")
            detail_parts.append(f"{field}: cat={cat_v!r} api={api_v!r}")
    if es_s == "FAIL":
        detail_parts.append(f"es_name: cat={r.get('es_cat_name')!r} api={r.get('es_api_name')!r}")

    detail = "; ".join(detail_parts) if detail_parts else "all fields match"
    print(f"{r['id']:<20} {en_s:<6} {es_s:<6}  {detail}")

print()
print(f"Result: {pass_count}/20 cards PASS")
