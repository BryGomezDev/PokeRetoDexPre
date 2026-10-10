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

## Ejecución 3 — 2026-10-10 (fix de corrupción en ejecuciones parciales + validación A4 real)

### Fix aplicado
- `generate_catalog.py` — bloque de rescan completo antes de escribir `rarities.json` y `_meta.json`
- El bug de corrupción en ejecuciones parciales queda corregido; la sección "Bug conocido" del README se actualiza

### Resultado de la prueba A4 real (con fix)
- 40 archivos borrados (10 por cuartil de 1-1025), resume sin `--force`
- 0 peticiones API; 42 cache hits (40 dexId + 2 índices); 0 SHA mismatches; `rarities.json` sum=17.995

### A3 post-fix
- 1026/1027 archivos SHA-256 idénticos con `--force`; `_meta.json` difiere solo en `generated_at` (comportamiento esperado)

---

## Criterios de aceptación A1–A11

Validados con `scripts/validate_catalog.py` tras la ejecución 3.

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| A1 | 1025 archivos dex existen y parsean JSON válido | **PASS** | `1025 files present, matches _meta.files_written=1025; 0 sentinels` |
| A2 | Cobertura ES: IDs únicos en catálogo vs total de entradas | **PASS** | 11.873 IDs únicos; 11.989 entradas totales (116 duplicados por cartas multi-dexId) |
| A3 | Idempotencia (--force): archivos funcionalmente idénticos | **PASS†** | 1026/1027 SHA-256 idénticos (†`_meta.json` difiere en `generated_at` por diseño); `api_requests=0`, `cache_hits=1027` |
| A4 | Reanudación (resume sin --force): fix verificado | **PASS** | 40 archivos borrados y regenerados desde caché; 0 SHA mismatches en dexId files; `rarities.json` sum=17.995; `api_requests=0` |
| A5 | Tamaño real del catálogo | **PASS** | 1027 archivos; 7.670.108 bytes (~7,31 MiB lógicos); comprimido en git: 2,90 MiB; catálogo spike era ~48 MB → catálogo filtrado 6,6× más ligero |
| A6 | Peso en git (crecimiento de la rama) | **PASS** | `size-pack: 2,90 MiB`; 3 packs, 1511 objetos; crecimiento desde rama base: +2,90 MiB (incluye ambas versiones de los 1.025 archivos tras reescritura de Fase 2) |
| A7 | Límite de velocidad ≤ 2 req/s | **PASS** | `SLEEP_BETWEEN_REQUESTS = 0.5s` → techo 2 req/s; pico observado: 1,10 req/s |
| A8 | Spot check 20 cartas: ES ⊆ EN por dexId | **PASS** | `20/20 EN; 6/20 NO_ES`: `base1-4, base1-58, neo1-16, ex1-101, bw11-101, dp1-1` (5 sets únicos sin traducción ES) |
| A9 | Sin cartas digitales en catálogo (TCG Pocket excluidas) | **PASS** | `0 Pocket cards found`; 2.283 EN excluidas; 1.246 ES excluidas (set P-A incluido, ver nota Punto 4) |
| A10 | `rarities.json` completo y cuadrado con WikiDex | **PASS** | 32 entradas; `sum(cards)=17.995 == EN total`; 23 `wikidex:true`, 9 `wikidex:false` (pendientes de decisión del maintainer) |
| A11 | Spot check URLs de imagen (HEAD → 200) | **PASS** | 20/20 HTTP 200 en `assets.tcgdex.net`; eras cubiertas: Base, Neo, EX, POP, Platinum, SM, SWSH, ME, SV; patrón `{image}/high.jpg` funciona en todos los sets |

---

## Hallazgos post-auditoría

### BUG CORREGIDO — `rarities.json` en ejecuciones parciales (fix aplicado en Ejecución 3)

**Síntoma:** en ejecuciones de reanudación (sin `--force`), `rarity_counts` solo acumulaba las rarezas de los dexIds procesados en esa pasada. `_build_rarities_list` eliminaba las rarezas no presentes ("stale"), dejando `rarities.json` con menos entradas de las reales.

**Fix:** un bloque de rescan completo (insertado antes de la sección `# ── rarities.json`) reescribe `rarity_counts`, `null_rarity_cards`, `total_files`, `total_cards_en` y `total_cards_es` leyendo TODOS los archivos `public/catalog/v1/{dexId}.json` presentes en disco antes de generar las salidas. El workaround manual ya no es necesario.

**Nota post-fix:** el campo `files_written` en `_meta.json` ahora refleja el total de archivos con contenido en disco (no los archivos escritos en la pasada). `run_stats` sigue reflejando solo la ejecución actual.
