# TCGdex Spike Scripts

Research spike for PokeRetoDex — exploring TCGdex API coverage and data quality.

## Requirements
- Python 3.10+ (uses `dict | list | None` union type hints)
- requests library: `pip install requests`

## Run Order
```bash
python scripts/spike/explore_api.py           # 1. API structure + dexId filter discovery
python scripts/spike/coverage_by_language.py  # 2. Language coverage matrix
python scripts/spike/sample_pokemon.py        # 3. dexId × language card counts
python scripts/spike/rarities_and_variants.py # 4. Rarity values + variant structure
python scripts/spike/sets_roadmap.py          # 5. Brayan's roadmap sets
```

## Output
All raw API responses are cached in `scripts/spike/out/` (git-ignored).
Running a script twice is safe — cached responses are reused.

## Rate limiting
Scripts use 0.5s delay between requests. User-Agent: PokeRetoDex-spike.

## Notes
- scripts/spike/out/ is in .gitignore — raw dumps are not committed
- utils.py provides shared caching and retry logic
