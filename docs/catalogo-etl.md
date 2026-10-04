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

Validados con `scripts/validate_catalog.py` tras la ejecución 2. Ver salida del script para
evidencia numérica.
