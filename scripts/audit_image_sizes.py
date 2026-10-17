"""
Tarea B — Tamaño de imágenes (Content-Length)
Lee public/catalog/v1/25.json, toma las primeras 10 entradas de data.en
con imagen no vacía, y hace HTTP HEAD para /high.jpg, /low.jpg, /low.webp.
"""
import json
import os
import urllib.request
from typing import Optional

CATALOG = os.path.join(os.path.dirname(__file__), "..", "public", "catalog", "v1")
FORMATS = ["high.jpg", "low.jpg", "low.webp"]


def head_content_length(url: str) -> Optional[int]:
    """Returns Content-Length int, or None if absent (chunked / error)."""
    try:
        req = urllib.request.Request(url, method="HEAD")
        req.add_header("User-Agent", "pokeretodex-audit/1.0")
        with urllib.request.urlopen(req, timeout=10) as resp:
            cl = resp.headers.get("Content-Length")
            return int(cl) if cl else None
    except Exception:
        return None


with open(os.path.join(CATALOG, "25.json"), encoding="utf-8") as f:
    data = json.load(f)

cards_with_image = [c for c in data.get("en", []) if c.get("image")][:10]

# Header
col_w = 12
print(f"{'Card ID':<20}  {'high.jpg':>{col_w}}  {'low.jpg':>{col_w}}  {'low.webp':>{col_w}}")
print("-" * 62)

totals: dict[str, list[int]] = {fmt: [] for fmt in FORMATS}

for card in cards_with_image:
    row = f"{card['id']:<20}"
    for fmt in FORMATS:
        url = f"{card['image']}/{fmt}"
        cl = head_content_length(url)
        if cl is not None:
            totals[fmt].append(cl)
            cell = f"{cl:>{col_w},}"
        else:
            cell = f"{'sin CL':>{col_w}}"
        row += f"  {cell}"
    print(f"[Dato] {row}")

print("-" * 62)
avg_row = f"{'Media':<20}"
for fmt in FORMATS:
    vals = totals[fmt]
    if vals:
        avg = int(sum(vals) / len(vals))
        avg_row += f"  {avg:>{col_w},}"
    else:
        avg_row += f"  {'N/A':>{col_w}}"
print(f"[Dato] {avg_row}")
