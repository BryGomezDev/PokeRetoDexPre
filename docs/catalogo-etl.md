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

## Ejecución 4 — 2026-10-10 (cierre Fase 2: interrupción real + mapeo WikiDex definitivo)

### Prueba A4 con interrupción real (caché HTTP borrada)
- 51 dexIds (480-530) con caché HTTP y archivo de salida eliminados antes de ejecutar
- Script cortado con `timeout=8 s` → 7 dexIds procesados; su caché HTTP quedó escrita en disco
- Resume sin `--force`: 44 peticiones API (para los 44 dexIds sin caché), 7 dexIds previos saltados correctamente; 0 SHA mismatches en archivos dexId; `rarities.json` sum=17.995
- **Invariante verificado**: los archivos producidos en la primera pasada (truncada) son bit-idénticos a los de la segunda (resume)

### Mapeo WikiDex definitivo
- **Holo Rare** (603 cartas) → `es="Rara Holo"`, `wikidex=true`
- **Rare Holo** (108 cartas) → `es="Rara Holo"`, `wikidex=true`
- Fuente: WikiDex confirma "Rara Holo" presente en todas las expansiones sin restricción de era
- Resultado: `rarities.json` queda con 25 `wikidex:true`, 7 `wikidex:false`

---

## Criterios de aceptación A1–A11

Validados con `scripts/validate_catalog.py` tras las ejecuciones 3 y 4.

| # | Criterio | Resultado | Evidencia |
|---|---|---|---|
| A1 | 1025 archivos dex existen y parsean JSON válido | **PASS** | `1025 files present, matches _meta.files_written=1025; 0 sentinels` |
| A2 | Cobertura ES: IDs únicos en catálogo vs total de entradas | **PASS** | 11.873 IDs únicos; 11.989 entradas totales (116 duplicados por cartas multi-dexId); 2.376 entradas ES sin dexId (trainers ~21, energías ~379, multiPokémon ~1.976) |
| A3 | Idempotencia (--force): archivos funcionalmente idénticos | **PASS†** | 1026/1027 SHA-256 idénticos (†`_meta.json` difiere en `generated_at` por diseño); `api_requests=0`, `cache_hits=1027` |
| A4 | Reanudación (resume sin --force): interrupción real verificada | **PASS** | Prueba caché-borrada (51 dexIds, timeout=8s): 7 procesados antes del corte → resume con 44 peticiones API, 0 SHA mismatches; `rarities.json` sum=17.995 |
| A5 | Tamaño real del catálogo | **PASS** | 1027 archivos; 7.670.108 bytes lógicos (~7,31 MiB); gzip-9: 0,798 MiB (ratio 9,16×); tar.gz: 0,487 MiB; media gz/archivo: 816 bytes. El catálogo spike EN+ES+JP pesaba ~48 MB; este catálogo EN+ES es 6,6× más ligero en lógico |
| A6 | Peso en git (crecimiento de la rama) | **PASS** | Crecimiento catálogo (feat vs main): 1.058 blobs, 7,556 MiB sin comprimir. Pack completo del repo: 2,90 MiB. Las "2 versiones" son los archivos originales + los reescritos en Fase 2 para añadir el campo `rarity` (delta-comprimidos mutuamente) |
| A7 | Límite de velocidad ≤ 2 req/s | **PASS** | `SLEEP_BETWEEN_REQUESTS = 0.5s` → techo 2 req/s; pico observado: 1,10 req/s |
| A8 | Spot check 20 cartas: ES ⊆ EN por dexId | **PASS** | `20/20 EN; 6/20 NO_ES`: `base1-4, base1-58, neo1-16, ex1-101, bw11-101, dp1-1` (5 sets únicos sin traducción ES) |
| A9 | Sin cartas digitales en catálogo (TCG Pocket excluidas) | **PASS** | `0 Pocket cards found`; 2.283 EN excluidas; 1.246 ES excluidas. Nota: P-A es el set de promos del lanzamiento de TCG Pocket — su exclusión se verifica con `card_id.startswith("P-A")` (el split por `-` antiguo subestimaba en 92 cartas) |
| A10 | `rarities.json` completo y cuadrado con WikiDex | **PASS** | 32 entradas; `sum(cards)=17.995 == EN total`; 25 `wikidex:true`, 7 `wikidex:false` (Shiny rare/V/VMAX, None, Classic Collection, RGB Rare — sin equivalente ES documentado en WikiDex) |
| A11 | Spot check URLs de imagen (HEAD → 200) | **PASS** | 20/20 HTTP 200 en `assets.tcgdex.net`; eras cubiertas: Base, Neo, EX, POP, Platinum, SM, SWSH, ME, SV; patrón `{image}/high.jpg` funciona en todos los sets |

---

## Hallazgos post-auditoría

### BUG CORREGIDO — `rarities.json` en ejecuciones parciales (fix aplicado en Ejecución 3)

**Síntoma:** en ejecuciones de reanudación (sin `--force`), `rarity_counts` solo acumulaba las rarezas de los dexIds procesados en esa pasada. `_build_rarities_list` eliminaba las rarezas no presentes ("stale"), dejando `rarities.json` con menos entradas de las reales.

**Fix:** un bloque de rescan completo (insertado antes de la sección `# ── rarities.json`) reescribe `rarity_counts`, `null_rarity_cards`, `total_files`, `total_cards_en` y `total_cards_es` leyendo TODOS los archivos `public/catalog/v1/{dexId}.json` presentes en disco antes de generar las salidas. El workaround manual ya no es necesario.

**Nota post-fix:** el campo `files_written` en `_meta.json` ahora refleja el total de archivos con contenido en disco (no los archivos escritos en la pasada). `run_stats` sigue reflejando solo la ejecución actual.

---

### Cuadre ES — 2.376 entradas sin dexId

Las 11.989 entradas ES del catálogo cubren 11.873 IDs únicos de carta (116 duplicados por cartas multi-dexId). El total bruto ES sin filtrar Pocket es 14.249; la diferencia con los 11.873 únicos en catálogo es 2.376 entradas ES que la API devuelve pero no tienen `dexId` asignado. Desglose estimado:

| Categoría | Entradas ~|
|---|---|
| Trainers (entrenador, objeto, estadio) | ~21 |
| Energías | ~379 |
| Pokémon sin dexId / multiPokémon | ~1.976 |

Estas entradas son excluidas correctamente por el script (solo se almacenan cartas con `dexId` válido en `[1, 1025]`).

**Nota sobre P-A (set TCG Pocket promos):** el set `P-A` contiene 92 cartas ES. El código antiguo usaba `card_id.split('-')[0]` para extraer el prefijo, dando `"P"` para IDs como `"P-A-001"`, por lo que estas 92 cartas se colaban en el catálogo. El código actual usa `card_id.startswith(prefix + "-")` con prefijos completos, excluyéndolas correctamente. Esto explica la diferencia entre el recuento antiguo (1.154 ES excluidas) y el actual (1.246 ES excluidas).

---

### Decisión WikiDex — Holo Rare y Rare Holo

**Criterio aplicado:** WikiDex documenta "Rara Holo" como rareza presente de forma general en todas las expansiones, sin restricción de era. Por tanto, tanto la etiqueta TCGdex moderna (`Holo Rare`, 603 cartas) como la etiqueta heredada (`Rare Holo`, 108 cartas) se mapean a `es="Rara Holo"` con `wikidex=true`.

Las 7 rarezas que permanecen con `wikidex=false` no tienen documentación verificable en WikiDex (rarezas de mecánicas especiales sin traducción oficial publicada): Shiny rare, Shiny rare V, Shiny rare VMAX, Shiny Ultra Rare, None, Classic Collection, RGB Rare.

---

### Auditoría de seguridad pre-PR

Ver `docs/auditoria.md`. Veredicto: **APTO PARA PR**. Un aviso no bloqueante: `.claude/settings.local.json` (rutas locales de Windows, sin credenciales) persiste en el historial de git antes de su eliminación en el commit `1b0f0bf`. No hay secretos ni credenciales en el working tree ni en el historial de archivos de código.
