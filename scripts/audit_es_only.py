"""
Tarea A — Cartas ES-only (descartadas por mergeCards)
Recorre public/catalog/v1/1.json..1025.json y calcula
cuántas cartas están en data.es pero no en data.en.
"""
import json
import os

CATALOG = os.path.join(os.path.dirname(__file__), "..", "public", "catalog", "v1")

total_es_only = 0
dex_ids_with_es_only: set[int] = set()
examples: list[dict] = []

for dex_id in range(1, 1026):
    path = os.path.join(CATALOG, f"{dex_id}.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    ids_en = {c["id"] for c in data.get("en", [])}
    ids_es = {c["id"] for c in data.get("es", [])}
    es_only = ids_es - ids_en

    if es_only:
        total_es_only += len(es_only)
        dex_ids_with_es_only.add(dex_id)

        if len(examples) < 5:
            # Build a quick lookup: id -> card for es
            es_by_id = {c["id"]: c for c in data["es"]}
            for card_id in sorted(es_only):
                if len(examples) >= 5:
                    break
                card = es_by_id[card_id]
                examples.append({
                    "dexId": dex_id,
                    "card_id": card_id,
                    "card_name": card.get("name", ""),
                    "setName": card.get("setName", ""),
                })

print(f"[Dato] Total cartas ES-only (en es[] pero no en en[]): {total_es_only}")
print(f"[Dato] dexIds distintos con al menos una carta ES-only: {len(dex_ids_with_es_only)}")
print()
print("[Dato] Primeros 5 ejemplos:")
for ex in examples:
    print(f"  dexId={ex['dexId']}  id={ex['card_id']}  nombre='{ex['card_name']}'  set='{ex['setName']}'")
