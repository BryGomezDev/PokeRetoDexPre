# Catalog ETL — scripts/generate_catalog.py

## Qué hace
Genera el catálogo estático de cartas TCG en `public/catalog/v1/`. Consulta la API de TCGdex, filtra cartas digitales (TCG Pocket) y produce:
- `{dexId}.json` (1025 archivos): `{"en": [...], "es": [...]}` con cartas por Pokémon
- `rarities.json`: 32 rarezas distintas con conteos y mapeo a WikiDex
- `_meta.json`: estadísticas de la última ejecución

## Requisitos
- Python 3.11+
- `pip install requests`
- Red (primera ejecución); caché HTTP en `scripts/out/http_cache/`

## Ejecución

| Comando | Cuándo usarlo |
|---|---|
| `python scripts/generate_catalog.py` | Primera ejecución o reanudación tras interrupción |
| `python scripts/generate_catalog.py --force` | Regenerar todos los archivos desde caché |
| `python scripts/generate_catalog.py --dry-run` | Simular sin escribir archivos |
| `python scripts/generate_catalog.py --no-cache` | Forzar peticiones a la API (ignora caché) |

## Validación

```bash
python scripts/validate_catalog.py                 # 11 checks, exit 0 = todo OK
python scripts/validate_catalog.py --check-images  # A11: spot check HEAD a assets.tcgdex.net (20/20 HTTP 200)
```

## Criterios de aceptación (A1-A11)

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| A1 | 1025 archivos dex existen y parsean JSON válido | **PASS** | `1025 files present, matches _meta.files_written=1025; 0 sentinels` |
| A2 | Cobertura ES: IDs únicos en catálogo vs total de entradas | **PASS** | 11.873 IDs únicos; 11.989 entradas totales (116 duplicados por cartas multi-dexId) |
| A3 | Idempotencia (--force): archivos funcionalmente idénticos | **PASS†** | 1026/1027 SHA-256 idénticos (†`_meta.json` difiere en `generated_at` por diseño); `api_requests=0`, `cache_hits=1027` |
| A4 | Reanudación (resume sin --force): interrupción real verificada | **PASS** | Prueba caché-borrada (51 dexIds, timeout=8s): 7 antes del corte → resume con 44 peticiones API, 0 SHA mismatches; `rarities.json` sum=17.995 |
| A5 | Tamaño real del catálogo | **PASS** | 1027 archivos; 7.670.108 bytes lógicos (~7,31 MiB); gzip-9: 0,798 MiB (ratio 9,16×); tar.gz: 0,487 MiB; media gz/archivo: 816 bytes; catálogo spike EN+ES+JP ~48 MB → 6,6× más ligero |
| A6 | Peso en git (crecimiento de la rama) | **PASS** | 1.058 blobs nuevos vs main; 7,556 MiB sin comprimir; pack repo completo: 2,90 MiB. "2 versiones" = archivos originales + reescritos en Fase 2 para añadir campo `rarity` (delta-comprimidos) |
| A7 | Límite de velocidad ≤ 2 req/s | **PASS** | `SLEEP_BETWEEN_REQUESTS = 0.5s` → techo 2 req/s; pico observado: 1,10 req/s |
| A8 | Spot check 20 cartas: ES ⊆ EN por dexId | **PASS** | `20/20 EN; 6/20 NO_ES`: `base1-4, base1-58, neo1-16, ex1-101, bw11-101, dp1-1` (5 sets únicos sin traducción ES) |
| A9 | Sin cartas digitales en catálogo (TCG Pocket excluidas) | **PASS** | `0 Pocket cards found`; 2.283 EN excluidas; 1.246 ES excluidas. P-A (92 cartas) excluido por `card_id.startswith("P-A-")` |
| A10 | `rarities.json` completo y cuadrado con WikiDex | **PASS** | 32 entradas; `sum(cards)=17.995 == EN total`; 25 `wikidex:true`, 7 `wikidex:false`. Holo Rare + Rare Holo → `es="Rara Holo"` (WikiDex: todas las eras) |
| A11 | Spot check URLs de imagen (HEAD → 200) | **PASS** | 20/20 HTTP 200 en `assets.tcgdex.net`; eras cubiertas: Base, Neo, EX, POP, Platinum, SM, SWSH, ME, SV; patrón `{image}/high.jpg` funciona en todos los sets |

## Límites de velocidad
- `SLEEP_BETWEEN_REQUESTS = 0.5 s` → ≤ 2 req/s
- Pico observado en ejecución real: 1,10 req/s
- User-Agent: `PokeRetoDex-catalog`
- Circuit-breaker: para tras 3 errores consecutivos

## Caché HTTP
Todas las respuestas se guardan en `scripts/out/http_cache/` (gitignoreado).
El ES index (`es_index.json`) pesa ~3 MB — no borrar entre ejecuciones.
Para invalidar la caché: borrar `scripts/out/http_cache/` o usar `--no-cache`.

## POKEMON_DATA_VERSION
Definida en `src/lib/constants.ts`. Subir SOLO si se vuelve a ejecutar el ETL y los datos cambian (nuevo Pokémon, corrección de sprites). Ver `CLAUDE.md` sección 16.

## Comportamiento de `files_written` en `_meta.json`
Tras el fix de Ejecución 3, `files_written` refleja el total de archivos con contenido presente en disco (no archivos escritos solo en la pasada). `run_stats` (api_requests, retries, cache_hits, duration) sigue reflejando la ejecución actual.
