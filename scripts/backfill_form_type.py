"""
backfill_form_type.py
=====================
Adds the `form_type` field to all existing /pokemon/{slug} documents in
Firestore without re-fetching PokéAPI. Reads each document, computes
form_type from slug + is_special_form, then batch-updates only that field.

Usage:
    FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/serviceAccount.json python scripts/backfill_form_type.py

form_type values:
    null         — base species (is_special_form == False)
    "mega"       — Mega Evolution
    "gmax"       — Gigantamax
    "regional"   — Regional form (Alolan, Galarian, Hisuian, Paldean)
    "other"      — cosmetic or non-standard variant (review output manually)
"""

import os
import sys
import json
import logging
from typing import Optional

import firebase_admin
from firebase_admin import credentials, firestore

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

BATCH_SIZE = 500

# Substring markers that indicate a regional form.
# Using `in` instead of `endswith()` handles compound suffixes like
# "darmanitan-galar-standard" and "tauros-paldea-aqua-breed".
REGIONAL_MARKERS = (
    "-alola", "-alolan",
    "-galar", "-galarian",
    "-hisui",
    "-paldea", "-paldean",
)

# Cosmetic slugs that contain a regional marker but are NOT regional forms.
# Checked via endswith() so "-cap" won't accidentally exclude a real slug
# that merely has "cap" somewhere in the middle.
COSMETIC_EXCLUDE_SUFFIXES = ("-cap", "-cosplay", "-starter")


def compute_form_type(slug: str, is_special: bool) -> Optional[str]:
    """Return form_type for a Pokémon slug."""
    if not is_special:
        return None
    s = slug.lower()
    # Mega (covers "-mega", "-mega-x", "-mega-y", and any future variants)
    if "-mega" in s:
        return "mega"
    # Gigantamax
    if s.endswith("-gmax"):
        return "gmax"
    # Regional — substring match, but exclude known cosmetic variants
    if not any(s.endswith(excl) for excl in COSMETIC_EXCLUDE_SUFFIXES):
        if any(marker in s for marker in REGIONAL_MARKERS):
            return "regional"
    # Catch-all for anything else marked is_special_form
    return "other"


def init_firebase():
    sa_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()
    if not sa_path:
        log.error(
            "FIREBASE_SERVICE_ACCOUNT_PATH is not set.\n"
            "  Windows: set FIREBASE_SERVICE_ACCOUNT_PATH=C:\\path\\to\\serviceAccount.json\n"
            "  Unix:  export FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/serviceAccount.json"
        )
        sys.exit(1)
    if not os.path.isfile(sa_path):
        log.error("Service account file not found: %s", sa_path)
        sys.exit(1)
    with open(sa_path, "r", encoding="utf-8") as fh:
        sa_json = json.load(fh)
    project_id = sa_json.get("project_id")
    if not project_id:
        log.error("Could not read 'project_id' from service account JSON.")
        sys.exit(1)
    log.info("Initialising Firebase for project: %s", project_id)
    cred = credentials.Certificate(sa_path)
    firebase_admin.initialize_app(cred, {"projectId": project_id})
    return firestore.client()


def main():
    db = init_firebase()
    col = db.collection("pokemon")

    log.info("Reading all /pokemon documents …")
    all_docs = list(col.stream())
    log.info("Found %d documents.", len(all_docs))

    # Tally
    counts: dict[str, int] = {"null": 0, "mega": 0, "gmax": 0, "regional": 0, "other": 0}
    other_slugs: list[str] = []

    batch = db.batch()
    batch_count = 0
    total_updated = 0

    for snap in all_docs:
        data = snap.to_dict()
        slug = snap.id
        is_special = data.get("is_special_form", False)
        ft = compute_form_type(slug, is_special)

        key = str(ft) if ft is not None else "null"
        counts[key] = counts.get(key, 0) + 1
        if ft == "other":
            other_slugs.append(slug)

        batch.update(snap.reference, {"form_type": ft})
        batch_count += 1
        total_updated += 1

        if batch_count >= BATCH_SIZE:
            batch.commit()
            log.info("Committed batch of %d (total so far: %d)", batch_count, total_updated)
            batch = db.batch()
            batch_count = 0

    if batch_count > 0:
        batch.commit()
        log.info("Committed final batch of %d (total: %d)", batch_count, total_updated)

    log.info("=" * 60)
    log.info("DONE — %d documents updated with form_type.", total_updated)
    log.info("  null (base species) : %d", counts.get("null", 0))
    log.info("  mega                : %d", counts.get("mega", 0))
    log.info("  gmax                : %d", counts.get("gmax", 0))
    log.info("  regional            : %d", counts.get("regional", 0))
    log.info("  other               : %d", counts.get("other", 0))
    if other_slugs:
        log.info("  'other' slugs (first %d):", min(10, len(other_slugs)))
        for s in other_slugs[:10]:
            log.info("    - %s", s)
        if len(other_slugs) > 10:
            log.info("    … and %d more", len(other_slugs) - 10)
    log.info("=" * 60)


if __name__ == "__main__":
    main()
