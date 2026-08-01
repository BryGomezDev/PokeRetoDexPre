"""
fix_form_type_others.py
=======================
One-time targeted fix for the 6 documents that came out as form_type="other"
after the backfill:

  DELETE:
    /pokemon/pikachu-alola-cap   (cosmetic event costume, not tracked)

  RECLASSIFY to form_type="regional":
    /pokemon/darmanitan-galar-standard
    /pokemon/darmanitan-galar-zen
    /pokemon/tauros-paldea-aqua-breed
    /pokemon/tauros-paldea-blaze-breed
    /pokemon/tauros-paldea-combat-breed

For the 5 reclassified documents, the script also verifies the `region` field
is correct (it should already be, given that region_from_slug() uses substring
matching, which works for compound suffixes).

Expected final counts after this script:
    null=1025, mega=97, gmax=34, regional=59, other=0  (total: 1215)

Usage:
    FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/serviceAccount.json python scripts/fix_form_type_others.py
"""

import os
import sys
import json
import logging

import firebase_admin
from firebase_admin import credentials, firestore

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

# ── Hardcoded targets ─────────────────────────────────────────────────────────

DELETE_SLUG = "pikachu-alola-cap"

# (slug → expected region)
RECLASSIFY: dict[str, str] = {
    "darmanitan-galar-standard": "Galar",
    "darmanitan-galar-zen":      "Galar",
    "tauros-paldea-aqua-breed":  "Paldea",
    "tauros-paldea-blaze-breed": "Paldea",
    "tauros-paldea-combat-breed":"Paldea",
}


def init_firebase():
    sa_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()
    if not sa_path or not os.path.isfile(sa_path):
        log.error("FIREBASE_SERVICE_ACCOUNT_PATH not set or file not found: %s", sa_path)
        sys.exit(1)
    with open(sa_path, "r", encoding="utf-8") as fh:
        project_id = json.load(fh).get("project_id")
    if not project_id:
        log.error("Could not read project_id from service account JSON.")
        sys.exit(1)
    log.info("Initialising Firebase for project: %s", project_id)
    cred = credentials.Certificate(sa_path)
    firebase_admin.initialize_app(cred, {"projectId": project_id})
    return firestore.client()


def main():
    db = init_firebase()
    col = db.collection("pokemon")

    # ── 1. Delete cosmetic document ───────────────────────────────────────────
    doc_ref = col.document(DELETE_SLUG)
    snap = doc_ref.get()
    if snap.exists:
        doc_ref.delete()
        log.info("DELETED: /pokemon/%s", DELETE_SLUG)
    else:
        log.warning("Not found (already deleted?): /pokemon/%s", DELETE_SLUG)

    # ── 2. Reclassify to "regional" ───────────────────────────────────────────
    for slug, expected_region in RECLASSIFY.items():
        ref = col.document(slug)
        snap = ref.get()

        if not snap.exists:
            log.warning("Not found (skipping): /pokemon/%s", slug)
            continue

        data = snap.to_dict()
        current_form_type = data.get("form_type", "<missing>")
        current_region    = data.get("region", "<missing>")

        updates: dict = {"form_type": "regional"}

        if current_region != expected_region:
            log.warning(
                "REGION MISMATCH on %s: got '%s', expected '%s' — fixing.",
                slug, current_region, expected_region,
            )
            updates["region"] = expected_region
        else:
            log.info(
                "region OK ('%s') for %s", current_region, slug,
            )

        ref.update(updates)
        log.info(
            "UPDATED /pokemon/%s: form_type '%s' → 'regional'%s",
            slug,
            current_form_type,
            f" + region '{current_region}' → '{expected_region}'" if "region" in updates else "",
        )

    log.info("=" * 60)
    log.info("DONE.")
    log.info("  Deleted : 1  (%s)", DELETE_SLUG)
    log.info("  Updated : %d  (form_type → 'regional')", len(RECLASSIFY))
    log.info("  Expected final counts: null=1025, mega=97, gmax=34, regional=59, other=0")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
