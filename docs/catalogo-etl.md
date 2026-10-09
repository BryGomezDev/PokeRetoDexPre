# Catálogo ETL — Historial de ejecuciones

Cada ejecución de `scripts/generate_catalog.py` sobrescribe `_meta.json` con las estadísticas
de esa pasada. Este documento conserva el historial narrativo para referencia y auditoría.

---

## Ejecución 1 — 2026-10-04 (primera ejecución completa, parcial)

### Resultado
- **Archivos escritos**: 1 024 de 1 025 (dexId 896 falló con HTTP 503 tras 3 reintentos)
- El script terminó con `DONE` y exit code 0 — bug conocido, corregido antes de la ejecución 2

### Estadísticas HTTP
| Métrica | Valor |
|---|---|
| Peticiones API | 1 027 |
| Reintentos | 6 |
| HTTP 429 | 0 |
| Cache hits | 0 |
| Duración total | 1 095,8 s (~18,3 min) |
| Media req/s | 0,94 |
| Pico req/s (ventana 10 s) | 1,10 |

### Estadísticas de datos
| Métrica | Valor |
|---|---|
| Cartas EN | 17 993 |
| Cartas ES | 11 987 |
| Cartas digitales excluidas (TCG Pocket) | 2 283 |
| Rarezas distintas | 32 |
| Sets dudosos | 0 |

### Nota sobre `_meta.json`
`_meta.json` se sobrescribe en cada ejecución (los campos `generated_at` y `run_stats` cambian
siempre). Este documento es el registro histórico permanente; `_meta.json` refleja solo la
última pasada.

---

## Ejecución 2 — 2026-10-04 (resume, completar dexId 896)

### Resultado
- **Archivos escritos**: 1 (dexId 896 recuperado)
- Total acumulado: **1 025 archivos**

### Estadísticas HTTP
| Métrica | Valor |
|---|---|
| Peticiones API | ~2 (índice ES + dexId 896) |
| Reintentos | 0 |
| HTTP 429 | 0 |
| Cache hits | 1 024 skipped (ya existían) |
| Failed dexIds | 0 |

### Estadísticas de datos (acumuladas tras ejecución 2)
| Métrica | Valor |
|---|---|
| Cartas EN | 17 995 |
| Cartas ES | 11 989 |

> Valores confirmados comparando `_meta.json` tras la ejecución 2. La diferencia respecto a la
> ejecución 1 (+2 EN, +2 ES) corresponde a las cartas del dexId 896.

---

## Criterios de aceptación A1–A10

Validados con `scripts/validate_catalog.py` tras la ejecución 2.

| Criterio | Descripción | Resultado | Evidencia |
|---|---|---|---|
| A1 | 1025 archivos dex existen y parsean como JSON válido | **PASS** | `1025 files present, matches _meta.files_written=1025; 0 sentinels` |
| A2 | Cobertura ES: IDs únicos en catálogo vs total de entradas | **PASS** | 11.873 IDs únicos; 11.989 entradas totales (116 duplicados por cartas multi-dexId) |
| A3 | Idempotencia: dos ejecuciones producen ficheros byte-a-byte idénticos | **PASS** | `1025/1025 archivos con hashes SHA-256 idénticos tras --force` |
| A4 | Reanudación: al borrar 5 archivos y relanzar, 0 peticiones API nuevas | **PASS** | `Skipped: 1020, Files written: 5, API requests: 0, cache_hits: 7` — BUG asociado: ver sección de hallazgos |
| A5 | Sin contenido TCG Pocket — filtrado por serie "tcgp" | **PASS** | `0 Pocket cards found across 29984 cards; 2283 EN excluidas; 1246 ES excluidas` |
| A6 | Tamaño del catálogo en git dentro de presupuesto | **PASS** | Catálogo en disco: 9,8 MiB; comprimido en git: 2,90 MiB total del repo (`git count-objects -vH → size-pack: 2.90 MiB`) |
| A7 | Límite de velocidad: ≤ 2 req/s | **PASS** | `SLEEP_BETWEEN_REQUESTS = 0.5s` → techo 2 req/s. Pico observado: 1,10 req/s |
| A8 | Spot check 20 cartas: ES ⊆ EN por dexId; sets sin traducción ES identificados | **PASS** | `20/20 PASS EN; 6/20 NO_ES`: `base1-4, base1-58, neo1-16, ex1-101, bw11-101, dp1-1` (5 sets únicos: base1 aparece 2 veces) |
| A9 | Catálogo de rarezas: 32 entradas; mapeo WikiDex completado | **PASS** | 32 rarezas, `sum(cards)=17995 == EN total`; 23 con equivalente WikiDex (`wikidex:true`), 9 pendientes de decisión. Fuente del mapeo: https://www.wikidex.net/wiki/Rareza (leída 2026-10-09). Los 9 casos con `wikidex: false` son: `Holo Rare`, `None`, `Shiny rare`, `Rare Holo`, `Classic Collection`, `Shiny Ultra Rare`, `Shiny rare V`, `Shiny rare VMAX`, `RGB Rare` — ambiguos o sin equivalente claro; la decisión final los toma el maintainer del proyecto. |
| A10 | Spot check de URLs de imagen (HEAD → 200) | **SKIPPED** | Requiere `--check-images`. No ejecutado en esta auditoría. Usar: `python scripts/validate_catalog.py --check-images` |

---

## Hallazgos post-auditoría

### BUG CONOCIDO — `rarities.json` se corrompe en ejecuciones parciales (sin --force)

Durante el test A4 (reanudación), al ejecutar `generate_catalog.py` sin `--force` con solo 5 archivos faltantes, el script procesó únicamente esos 5 dexIds. Como `rarity_counts` solo contenía las 6 rarezas de esos 5 dexIds, la función `_build_rarities_list` marcó las otras 26 rarezas como "stale" y las eliminó, dejando `rarities.json` con 6 entradas en lugar de 32.

**Impacto:** cualquier ejecución de reanudación (sin `--force`) que no procese todos los dexIds corromperá `rarities.json`.

**Workaround actual:**
```bash
git checkout -- public/catalog/v1/rarities.json
python scripts/generate_catalog.py --force
```

**Corrección sugerida (pendiente de implementar):** acumular `rarity_counts` también desde los archivos de salida ya existentes antes de la fusión.
