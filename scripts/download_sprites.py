"""Download 96x96 sprites for dex IDs 1–1025 from PokeAPI's GitHub sprites repo.

Idempotent: skips files that already exist on disk.
Usage: python scripts/download_sprites.py
"""

import time
import urllib.request
from pathlib import Path

BASE_URL = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{id}.png"
OUT_DIR = Path(__file__).parent.parent / "public" / "sprites"
DEX_RANGE = range(1, 1026)  # 1 to 1025 inclusive
DELAY = 0.5                 # ≤2 req/s
USER_AGENT = "PokeRetoDex-catalog"
MAX_CONSECUTIVE_ERRORS = 3
PROGRESS_EVERY = 50


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    downloaded = 0
    skipped = 0
    errors = 0
    consecutive_errors = 0

    for dex_id in DEX_RANGE:
        dest = OUT_DIR / f"{dex_id}.png"

        if dest.exists():
            skipped += 1
            consecutive_errors = 0
        else:
            url = BASE_URL.format(id=dex_id)
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            try:
                with urllib.request.urlopen(req, timeout=10) as resp:
                    dest.write_bytes(resp.read())
                downloaded += 1
                consecutive_errors = 0
                time.sleep(DELAY)
            except Exception as exc:
                print(f"  ERROR #{dex_id}: {exc}")
                errors += 1
                consecutive_errors += 1
                if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
                    print(f"\nAborted: {MAX_CONSECUTIVE_ERRORS} consecutive errors.")
                    break

        if dex_id % PROGRESS_EVERY == 0:
            print(f"  [{dex_id}/1025] downloaded={downloaded} skipped={skipped} errors={errors}")

    print(f"\nDone. downloaded={downloaded}, skipped={skipped}, errors={errors}")


if __name__ == "__main__":
    main()
