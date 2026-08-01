# populate_pokemon.py

Phase 4 seed script for the National Pokédex Tracker PWA.

Reads every Pokémon (national dex numbers 1-1025, plus Mega/GMax/regional forms)
from PokéAPI and writes one document per Pokémon to the Firestore collection
`/pokemon/{slug}` in your Firebase project.

---

## Prerequisites

- Python 3.11 or later
- A Firebase project with **Cloud Firestore** enabled (Spark / Blaze plan)
- A **service account key** (JSON) with the `Cloud Datastore User` role
  (or `Firebase Admin SDK Administrator Service Agent`)

---

## 1. Obtain a Firebase service account key

1. Open the [Firebase console](https://console.firebase.google.com/) and select **PokeRetoDex**.
2. Go to **Project settings** > **Service accounts**.
3. Click **Generate new private key** and save the downloaded JSON file somewhere safe
   (e.g. `C:\keys\pokeretodex-sa.json`).
   Do **not** commit this file to version control.

---

## 2. Install Python dependencies

```powershell
# From the project root
pip install -r scripts/requirements.txt
```

---

## 3. Set the environment variable

### Windows (PowerShell)

```powershell
$env:FIREBASE_SERVICE_ACCOUNT_PATH = "C:\keys\pokeretodex-sa.json"
```

### Windows (CMD)

```cmd
set FIREBASE_SERVICE_ACCOUNT_PATH=C:\keys\pokeretodex-sa.json
```

### macOS / Linux

```bash
export FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/pokeretodex-sa.json
```

---

## 4. Run the script

```powershell
python scripts/populate_pokemon.py
```

The script will:

1. Fetch the full Pokémon list from PokéAPI (~1 300 slugs).
2. For each slug in scope (national dex 1-1025 + special forms), fetch its
   `/pokemon/{slug}` data.
3. Group forms per species, assign `form_index`, compute `sort_order`.
4. Write documents to Firestore in batches of 500 (Firestore limit).
5. Print a summary of written documents and any slugs that failed.

Estimated run time: 30-45 minutes (rate-limited to 10 req/s out of politeness
to PokéAPI's free tier).

---

## Document schema written to `/pokemon/{slug}`

| Field | Type | Description |
|---|---|---|
| `pokedex_number` | number | National Pokédex number |
| `form_index` | number | 0 = base form; 1, 2, … = alternate forms |
| `sort_order` | number | `pokedex_number * 1000 + form_index` |
| `name` | string | PokéAPI slug (e.g. `charizard-mega-x`) |
| `region` | string | One of: Kanto, Johto, Hoenn, Sinnoh, Unova, Kalos, Alola, Galar, Hisui, Paldea |
| `types` | array<string> | Pokémon type(s) |
| `sprite_url` | string | Official artwork URL (empty string if unavailable) |
| `is_special_form` | boolean | true for Mega, Gigantamax, and regional forms |

---

## Re-running safely

The script is **idempotent**: every document is written with `set()` (full
overwrite). Running it a second time refreshes all data without creating
duplicates.

---

## Troubleshooting

| Error | Fix |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_PATH is not set` | Set the environment variable as shown in step 3. |
| `Service account file not found` | Check the path in `FIREBASE_SERVICE_ACCOUNT_PATH`. |
| `HTTP 429` from PokéAPI | The script retries automatically. If it keeps failing, increase `SLEEP_BETWEEN_REQUESTS` in the script. |
| `PERMISSION_DENIED` from Firestore | Ensure the service account has the **Cloud Datastore User** IAM role. |
