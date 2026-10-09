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
python scripts/validate_catalog.py           # 10 checks, exit 0 = todo OK
python scripts/validate_catalog.py --check-images  # + spot check de URLs de imagen (red)
```

## Criterios de aceptación (A1-A10)

| Criterio | Descripción | Resultado | Evidencia |
|---|---|---|---|
| A1 | 1025 archivos dex existen y parsean como JSON válido | **PASS** | `1025 files present, matches _meta.files_written=1025; 0 sentinels` |
| A2 | Cobertura ES: IDs únicos en catálogo vs total de entradas | **PASS** | 11.873 IDs únicos; 11.989 entradas totales (116 duplicados por cartas multi-dexId) |
| A3 | Idempotencia: dos ejecuciones producen ficheros byte-a-byte idénticos | **PASS** | `1025/1025 archivos con hashes SHA-256 idénticos tras --force` |
| A4 | Reanudación: al borrar 5 archivos y relanzar, 0 peticiones API nuevas | **PASS** | `Skipped: 1020, Files written: 5, API requests: 0, cache_hits: 7` — BUG asociado: ver sección de bug conocido |
| A5 | Sin contenido TCG Pocket — filtrado por serie "tcgp" | **PASS** | `0 Pocket cards found across 29984 cards; 2283 EN excluidas; 1246 ES excluidas` |
| A6 | Tamaño del catálogo en git dentro de presupuesto | **PASS** | Catálogo en disco: 9,8 MiB; comprimido en git: 2,90 MiB total del repo (`git count-objects -vH → size-pack: 2.90 MiB`) |
| A7 | Límite de velocidad: ≤ 2 req/s | **PASS** | `SLEEP_BETWEEN_REQUESTS = 0.5s` → techo 2 req/s. Pico observado: 1,10 req/s |
| A8 | Spot check 20 cartas: ES ⊆ EN por dexId; sets sin traducción ES identificados | **PASS** | `20/20 PASS EN; 6/20 NO_ES`: `base1-4, base1-58, neo1-16, ex1-101, bw11-101, dp1-1` (5 sets únicos: base1 aparece 2 veces) |
| A9 | Catálogo de rarezas: 32 entradas; mapeo WikiDex completado | **PASS** | 32 rarezas, `sum(cards)=17995 == EN total`; 23 con equivalente WikiDex (`wikidex:true`), 9 pendientes de decisión |
| A10 | Spot check de URLs de imagen (HEAD → 200) | **SKIPPED** | Requiere `--check-images`. No ejecutado en esta auditoría. Usar: `python scripts/validate_catalog.py --check-images` |

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

## Bug conocido — ejecuciones parciales
Una reanudación parcial (sin `--force`) corrompe `rarities.json`. Si eso ocurre:
1. `git checkout -- public/catalog/v1/rarities.json` (restaurar)
2. `python scripts/generate_catalog.py --force` (regenerar todo)
