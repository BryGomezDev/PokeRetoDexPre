"""
Minimal smoke test for the project_id safety guard in populate_pokemon.

Run with:
    python scripts/test_project_guard.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from populate_pokemon import _check_project_id  # noqa: E402

errors = 0

# 1. Correct project_id must be accepted silently
try:
    _check_project_id("pokeretodexpre")
    print("✅ correct project_id accepted")
except ValueError:
    print("❌ FAIL: raised for correct project_id")
    errors += 1

# 2. PROD project_id must be rejected
try:
    _check_project_id("pokeretodex")
    print("❌ FAIL: PROD project_id was not rejected")
    errors += 1
except ValueError as e:
    print(f"✅ PROD project_id rejected: {e}")

# 3. Empty string must be rejected
try:
    _check_project_id("")
    print("❌ FAIL: empty project_id was not rejected")
    errors += 1
except ValueError as e:
    print(f"✅ empty project_id rejected: {e}")

# 4. Arbitrary string must be rejected
try:
    _check_project_id("my-other-project")
    print("❌ FAIL: arbitrary project_id was not rejected")
    errors += 1
except ValueError as e:
    print(f"✅ arbitrary project_id rejected: {e}")

if errors:
    print(f"\n❌ {errors} test(s) failed")
    sys.exit(1)

print("\n✅ All safety guard tests passed")
