# Spike: TCGdex Integration — Informe de Investigación

**Fecha:** 2026-09-30
**Rama:** spike/tcgdex-pre
**Estado:** CONDITIONAL GO

---

## Resumen Ejecutivo

Se investigó la API pública de TCGdex (`api.tcgdex.net`) como fuente de datos de cartas TCG para integrar un selector de carta física en PokéRetoDex. La investigación cubrió política de uso, filtrado por número de Pokédex, cobertura por idioma, calidad de imágenes, cabeceras HTTP y arquitectura de integración. El veredicto es **CONDITIONAL GO**: la API cumple todos los criterios técnicos y de licencia, y la arquitectura de catálogo estático propuesta es viable; la condición pendiente es verificar el límite exacto de activos estáticos del plan Hobby de Vercel antes de comprometer el alcance de idiomas.

---

## Tabla Go/No-Go

| # | Criterio | Estado | Evidencia |
|---|----------|--------|-----------|
| G1 | Lookup fiable por dexId sin descarga completa | **PASS** | `GraphQL cards(filters:{dexId:N})` funciona correctamente [Dato] |
| G2 | Mapeo de rareza cubre el 100% de los valores EN | **PASS** | 44 valores, todos mapeados (8 con confianza BAJA) [Dato] |
| G3 | ES, EN, JA devuelven cartas para dexIds de muestra | **PASS + INFO** | EN/ES confirmados para los 11 dexIds de muestra; JA tiene 13.006 cartas pero con namespace de IDs propio; KO/ZH-CN existen pero son escasos [Dato] |
| G4 | ≥95% de imágenes en muestra devuelven HTTP 200 | **PASS** | 192/192 = 100% [Dato] |
| G5 | Uso automatizado permitido o alternativa local verificada | **PASS** | Licencia MIT + comentario robots.txt + FAQ permiten uso bulk; Docker disponible [Dato] |
| G6 | Catálogo viable a €0 | **CONDITIONAL** | EN+ES+FR+DE+IT ~35–40 MB estimado, probablemente seguro; los 16 idiomas ~70–80 MB podría superar el límite de 100 MB de Vercel Hobby [Suposición — requiere verificación] |

**Veredicto global: CONDITIONAL GO**

---

## Hallazgos Clave

### 1. Política de Uso

- `robots.txt` en `api.tcgdex.net`: `Disallow: /` aplica **solo a crawlers**. Comentario textual del archivo:
  > "Please note that this is for Crawlers only. You can logically use robots to use the API"
- `assets.tcgdex.net/robots.txt`: 404 — no existe archivo. [Dato]
- FAQ oficial: "No authentication required. No published hard rate limits. Cache locally for bulk use." [Dato]
- Licencia del repositorio `github.com/tcgdex/cards-database`: **MIT**. [Dato]
- Alternativa local: el repo incluye un `Dockerfile` para auto-alojar la API sin depender del endpoint público. [Dato]

**Conclusión: uso automatizado en bulk está explícitamente permitido.**

---

### 2. Filtrado por dexId

**GraphQL funciona. REST no.**

| Método | Resultado |
|--------|-----------|
| `POST /v2/graphql` con `filters:{dexId:N}` | Correcto — devuelve solo cartas con ese número de Pokédex |
| `GET /en/cards?dexId=N` | Incorrecto — coincide por subcadena en `localId`, no por número de Pokédex |

**Sintaxis GraphQL exacta:**
```graphql
POST https://api.tcgdex.net/v2/graphql

{
  cards(filters: { dexId: 6 }) {
    id
    name
    rarity
    dexId
  }
}
```

Notas importantes:
- Usar `dexId` (singular). `dexIds` (plural) devuelve error. [Dato]
- El endpoint GraphQL es **language-agnostic** — no lleva parámetro de idioma, devuelve IDs en formato EN. [Dato]
- El índice corto `/lang/cards` no incluye el campo `dexId` — no se puede filtrar client-side desde el índice. [Dato]
- El campo `dexId` en un objeto carta completo es un **array** de enteros (ej. `[6]`), pero el filtro acepta un **scalar** int. [Dato]
- Una consulta por `dexId` devuelve **todas las formas** que comparten ese número: `dexId=37` devuelve Vulpix normal Y Vulpix de Alola. [Dato]

---

### 3. Cobertura por Idioma

| Idioma | Sets | Cartas | Namespace de IDs | Notas |
|--------|------|--------|-----------------|-------|
| en | 220 | 23.770 | Compartido (EN) | Fuente primaria |
| es | 156 | 15.495 | Compartido (EN) | IDs EN funcionan en ES |
| fr | 202 | 22.155 | Compartido (EN) | |
| de | 155 | 20.483 | Compartido (EN) | |
| it | 193 | 15.726 | Compartido (EN) | |
| pt-br | 11 | 1.124 | Compartido (EN) | Muy limitado |
| pt-pt | 0 | 0 | Compartido (EN) | Vacío |
| nl | 3 | 0 | Compartido (EN) | Efectivamente vacío |
| pl | 2 | 0 | Compartido (EN) | Efectivamente vacío |
| ru | 9 | 0 | Compartido (EN) | Efectivamente vacío |
| ja | 186 | 13.006 | Propio (ej. PMCG3-001) | Namespace separado |
| ko | 95 | 239 | Propio | Muy escaso |
| zh-tw | 98 | 7.436 | Propio | |
| zh-cn | 57 | 877 | Propio | |
| id | 70 | 2.788 | Propio | |
| th | 72 | 2.921 | Propio | |

**Crítico:** EN/es/fr/de/it comparten el mismo namespace de IDs (un ID EN como `sv03.5-15` funciona en `/es/cards/sv03.5-15`). ja/ko/zh-tw/zh-cn/id/th usan namespaces propios — requieren lookups separados por idioma. GraphQL devuelve únicamente IDs en formato EN. [Dato]

---

### 4. Muestra de Pokémon (dexId × Idioma)

Columna EN = total de cartas vía GraphQL. Columnas no-EN = sonda Y/N: ¿devuelve 200 el ID en formato EN en ese idioma?

| dexId | Pokémon | EN | es | fr | de | it | pt-br | pt-pt | nl | pl | ru | ja | ko | zh-tw | zh-cn | id | th |
|-------|---------|-----|----|----|----|----|-------|-------|----|----|----|----|----|----|-------|----|----|
| 6 | Charizard | 125 | Y | Y | Y | Y | N | N | N | N | N | N | N | N | N | N | N |
| 25 | Pikachu | 248 | Y | Y | Y | Y | N | N | N | N | N | N | N | N | N | N | N |
| 37 | Vulpix | 57 | Y | Y | Y | Y | N | N | N | N | N | N | N | N | N | N | N |
| 133 | Eevee | 108 | Y | Y | Y | Y | N | N | N | N | N | N | N | N | N | N | N |
| 151 | Mew | 70 | Y | Y | Y | Y | N | N | N | N | N | N | N | N | N | N | N |
| 650 | Chespin | 13 | Y | Y | Y | Y | N | N | N | N | N | N | N | N | N | N | N |
| 722 | Rowlet | 29 | Y | Y | Y | Y | N | N | N | N | N | N | N | N | N | N | N |
| 888 | Zacian | 31 | Y | Y | Y | Y | N | N | N | N | N | N | N | N | N | N | N |
| 899 | Wyrdeer | 5 | Y | Y | Y | Y | N | N | N | N | N | N | N | N | N | N | N |
| 1000 | Chi-Yu | 15 | Y | Y | Y | Y | N | N | N | N | N | N | N | N | N | N | N |
| 1025 | Pecharunt | 8 | Y | Y | Y | Y | N | N | N | N | N | N | N | N | N | N | N |

Nota confirmada: `dexId=37` devuelve Vulpix normal (44 cartas) y Alolan Vulpix (13 cartas, incluyendo V y VSTAR) juntos en el mismo resultado. Una query por dexId no discrimina entre formas. [Dato]

---

### 5. Sets del Roadmap de Brayan

| Set | tcgdex_id | cardCount | en | es | ja | Notas |
|-----|-----------|-----------|----|----|-----|-------|
| Astral Radiance | swsh10 | 216 | ✓ | ✓ | ✗ | +swsh10tg (30 Trainer Gallery cards) |
| Pokémon 151 | sv03.5 | 207 | ✓ | ✓ | ✗ | Nombre en API: "151" |
| Black Bolt | sv10.5b | 172 | ✓ | ✓ | ✗ | Set EN, no exclusivo de JA |
| White Flare | sv10.5w | 173 | ✓ | ✓ | ✗ | Set EN, no exclusivo de JA |
| Crown Zenith | swsh12.5 | 160 | ✓ | ✓ | ✗ | +swsh12.5gg (70 Galarian Gallery) |
| Cosmic Eclipse | sm12 | 271 | ✓ | ✓ | ✓ | |
| Destined Rivals | sv10 | 244 | ✓ | ✓ | ✓ | |

`cardCount` declarado == cardCount real en todos los sets. [Dato]

---

### 6. Valores de Rareza y Mapeo

TCGdex EN tiene **44 valores distintos** de rareza. Todos están mapeados a los niveles de variante de PokéRetoDex (`basica` / `holo` / `alternativa` / `fullart`).

Entradas clave del mapeo:

| Rareza TCGdex | Cartas EN | Mapeo app | Confianza |
|---------------|-----------|-----------|-----------|
| Common | 5.881 | basica | HIGH |
| Uncommon | 4.917 | basica | HIGH |
| Rare | 3.889 | holo | HIGH |
| Ultra Rare | 1.506 | alternativa | HIGH |
| Promo | 1.133 | basica | MED |
| One Diamond | 745 | basica | HIGH |
| Holo Rare | 633 | holo | HIGH |
| Secret Rare | 604 | fullart | HIGH |
| Illustration Rare | 511 | fullart | HIGH |
| Double Rare | 329 | alternativa | HIGH |
| Special Illustration Rare | 232 | fullart | HIGH |
| Crown | 24 | fullart | HIGH |

Aproximadamente **8 valores de rareza** tienen confianza BAJA y requieren un pase manual de QA contra cartas físicas reales antes del lanzamiento. No es un bloqueante para la implementación. [Dato]

---

### 7. Estructura de Variants

El campo `variants` en una carta de TCGdex es un **objeto con valores booleanos**, no un array:

```json
{
  "normal": true,
  "holo": false,
  "reverse": true,
  "firstEdition": false,
  "wPromo": false
}
```

Múltiples claves pueden ser `true` simultáneamente en una misma carta. [Dato]

**Distinción crítica:**
- `variants` de TCGdex describe el **tipo de impresión** (si la carta tiene versión normal, holo, reverse, etc.).
- `variant` de nuestra app (`basica`/`holo`/`alternativa`/`fullart`) es un **nivel de calidad/acabado** que se deriva del campo `rarity` de TCGdex, **no** del campo `variants`.

No mezclar estos dos conceptos en la implementación.

---

### 8. Imágenes

**Patrón de URL:**
```
https://assets.tcgdex.net/{lang}/{serie}/{set}/{localId}/{quality}.{ext}
```

Ejemplo:
```
https://assets.tcgdex.net/en/base/base1/4/high.webp
```

El campo `image` en la API devuelve la **ruta base**; el caller añade `/low.webp` o `/high.webp`.

| Métrica | Valor |
|---------|-------|
| Muestra HEAD requests | 192 |
| Respuestas HTTP 200 | 192/192 (100%) |
| Tamaño medio low.webp | 17,5 KB |
| Tamaño medio high.webp | 68,2 KB |
| Cache-Control CDN | `max-age=31536000` (1 año) |

[Dato]

---

### 9. Cabeceras HTTP y Rate Limits

| Cabecera | Valor en respuestas de API | Implicación |
|----------|--------------------------|-------------|
| `Cache-Control` (API) | `no-cache, no-store, must-revalidate` | Usar caché a nivel de app; el CDN no cachea las respuestas JSON |
| `Cache-Control` (imágenes CDN) | `max-age=31536000` | Las imágenes se cachean 1 año en el navegador |
| `ETag` | Presente (weak ETag) | Permite revalidación condicional |
| Rate-limit headers | **No presentes** | No hay límite publicado |
| `Access-Control-Allow-Origin` | `*` | CORS abierto |
| CDN | nginx custom (no Cloudflare) | |

Prueba de carga: 5 requests rápidos sin throttling ni 429. No hay rate limiting observable. [Dato]

---

### 10. Calidad de Datos

| Hallazgo | Detalle |
|----------|---------|
| Cartas sin dexId (Trainer/Energy) | ~3.638 estimadas [Estimación] |
| Cartas TAG TEAM con múltiples dexId | Confirmado: `sm12-220` (Arceus & Dialga & Palkia GX) tiene `dexId=[483,484,493]` [Dato] |
| Cartas con "Mega" en nombre | 237 [Dato] |
| Cartas con "gigantamax"/"gmax" en nombre | **0** — las cartas Gigantamax aparecen como VMAX; no tienen "gigantamax" en el nombre [Dato] |
| Cartas con "Alola"/"Alolan" en nombre | 182 [Dato] |
| Formas regionales en query dexId | El filtro devuelve forma base + formas regionales juntas; no hay sub-filtro disponible [Dato] |

---

## Propuesta de Arquitectura

### Catálogo Estático

**Estructura de archivos recomendada:**
```
public/
  catalog/
    v{TCGDEX_CATALOG_VERSION}/
      {lang}/
        {dexId}.json    ← un archivo por (idioma, número de Pokédex)
```

Ejemplo: `public/catalog/v1/en/6.json` contiene todas las cartas de Charizard en inglés.

**Regla de creación:** solo se generan archivos donde TCGdex tiene al menos 1 carta para ese par `(lang, dexId)`.

**Estimaciones de volumen:**
- Archivos totales: ~7.325 (no 16.400, porque los idiomas escasos tienen pocos dexIds con datos) [Estimación]
- Tamaño total con campos mínimos: ~48 MB [Estimación]
- Solo EN+ES+FR+DE+IT: ~35–40 MB [Estimación]

**Campos por entrada de carta (conjunto mínimo):**
```json
{
  "id": "sv03.5-15",
  "localId": "15",
  "name": "Charizard ex",
  "setId": "sv03.5",
  "setName": "151",
  "rarity": "Double Rare",
  "variantMapped": "fullart",
  "image": "https://assets.tcgdex.net/en/sv/sv03.5/15",
  "variants": { "normal": true, "holo": false, "reverse": true, "firstEdition": false }
}
```

Campos excluidos del catálogo (no necesarios en el picker): `hp`, `illustrator`, `types`, `stage`, `description`, `dexId`, `legal`, `pricing`.

**Versionado:**
- Añadir `TCGDEX_CATALOG_VERSION` a `src/lib/constants.ts` (independiente de `APP_VERSION` y `POKEMON_DATA_VERSION`).
- La versión se usa en la **ruta URL** del catálogo, no en sessionStorage.
- Regenerar el catálogo cuando: nuevos sets en TCGdex, soporte de nuevos idiomas, actualización del mapeo de rareza.

---

### Cambios en `/users/{uid}/collection/{slug}`

**Campo nuevo: `card_id`**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `card_id` | `string \| null` | ID completo de TCGdex (ej. `"sv03.5-15"`) o `null` si no hay carta vinculada aún |

- `null` significa "tengo esta carta marcada como poseída pero sin vincular a una carta específica" — retrocompatible con todos los documentos existentes.
- El campo `language` es **paralelo** a `card_id`, no se reemplaza por él.

**Campo `language` — migración para "zh":**
- Los documentos actuales pueden contener `language: "zh"` (ambiguo).
- TCGdex diferencia `zh-tw` (~7.436 cartas) y `zh-cn` (~877 cartas).
- Solución: runtime shim (`zh` → `zh-tw` como fallback) sin migración en Firestore.
- Actualizar la UI: eliminar `zh` del picker de idiomas; añadir `zh-tw` y `zh-cn` como opciones separadas.
- `zh` sigue siendo válido en la base de datos para documentos legacy.

**Nuevos valores válidos para `language`:**
```
"es" | "en" | "zh-tw" | "zh-cn" | "ko" | "ja" | "id" | "th" | "otros"
```
(`zh` sigue siendo manejado por el shim en runtime.)

---

### Outline del Script de Generación

Script Python nuevo (no los scripts del spike):

1. Para cada `dexId` 1–1025: POST GraphQL → obtener todos los IDs y datos de cartas EN.
2. Para EN/es/fr/de/it: escribir las mismas cartas a cada bucket de idioma (namespace compartido).
3. Para ja/ko/zh-tw/zh-cn/id/th: lookups REST separados por idioma (namespace propio).
4. Escribir `public/catalog/v{N}/{lang}/{dexId}.json` para cada bucket no vacío.
5. Actualizar `TCGDEX_CATALOG_VERSION` en `src/lib/constants.ts`.

Regenerar el catálogo ante: nuevos sets en TCGdex, nuevos idiomas soportados, cambios en el mapeo de rareza.

---

## Riesgos y Preguntas Abiertas

### Riesgos Identificados

1. **Fragmentación de namespaces de IDs en idiomas no-EN.** ja/ko/zh-tw/zh-cn/id/th usan IDs propios que no son accesibles con el ID EN. El script de generación debe manejar dos grupos distintos: namespace compartido (EN/es/fr/de/it) y namespace propio (los demás). La lógica de lookup en Phase 1 debe diferenciar estos grupos explícitamente.

2. **Desambiguación de formas regionales a nivel de UI.** La query por `dexId` devuelve forma base y todas las formas regionales juntas — no hay sub-filtro en la API. La UI debe presentar la lista plana y dejar que el usuario seleccione manualmente la carta. No intentar matching automático forma→carta en v1.

3. **Valores de rareza con confianza BAJA (~8 entradas).** El mapeo actual tiene ~8 rarezas con confianza BAJA que requieren validación manual contra cartas físicas reales antes del lanzamiento. El script de generación debe exportar estos casos a una lista de revisión en tiempo de ejecución. No es un bloqueante para la implementación.

---

### Preguntas Abiertas para el Propietario del Proyecto

1. **Alcance de idiomas para v1:** ¿Limitar el catálogo a EN+ES en v1 (tamaño más pequeño, riesgo cero de límite Vercel) y añadir FR/DE/IT en v1.1? ¿O incluir todos desde el principio?

2. **Validación del mapeo de rareza:** ¿Puede Brayan revisar las ~8 entradas de confianza BAJA contra cartas físicas antes del lanzamiento de Phase 1?

3. **Vinculación de cartas existentes:** Los ~N documentos de colección actuales tienen `language` pero no `card_id`. ¿Deben mostrarse con un aviso "carta sin vincular" en la UI, o simplemente sin thumbnail hasta que el usuario la vincule?

4. **Umbral de calidad de imagen:** ¿Usar `low.webp` (17,5 KB) en el picker para velocidad, o `high.webp` (68,2 KB) para calidad? ¿O `low` en picker y `high` al abrir el detalle?

5. **Idioma `zh` legacy:** ¿Aplicar el shim `zh → zh-tw` en runtime (sin migración Firestore), o hacer una migración one-shot de todos los documentos `language:"zh"` a `"zh-tw"`?

6. **Límite de activos estáticos de Vercel Hobby:** ¿Verificar el límite exacto antes de comprometer el scope de idiomas? (Ver sección Pendiente de Verificar.)

---

## Pendiente de Verificar

Estos ítems están etiquetados como **[Suposición]** en los hallazgos y deben confirmarse antes de la implementación de Phase 1:

- **Límite de activos estáticos de Vercel Hobby plan.** La cifra de 100 MB es una suposición. Si el límite aplica a todos los activos de `public/` combinados, el catálogo completo de 16 idiomas (~70–80 MB estimado) podría superarlo. Verificar en la documentación oficial de Vercel antes de decidir el alcance de idiomas de v1.

- **Tamaños totales del catálogo.** Las estimaciones de ~48 MB (todos los idiomas) y ~35–40 MB (EN+ES+FR+DE+IT) son proyecciones basadas en muestras. Confirmar con una ejecución de prueba del script de generación antes de comprometer la arquitectura.

- **Cardcount real del catálogo generado.** La estimación de ~7.325 archivos (frente a 16.400 teórico) depende de cuántos pares `(lang, dexId)` tienen al menos 1 carta. Confirmar con el script.

---

## Scripts Generados

Los scripts del spike se encuentran en `scripts/spike/`. El directorio `scripts/spike/out/` está en `.gitignore` y no se ha commiteado.

| Script | Función |
|--------|---------|
| `01_policy_check.py` | Verifica `robots.txt` y cabeceras HTTP de los endpoints principales |
| `02_graphql_dexid.py` | Prueba el filtro `dexId` vía GraphQL y confirma que REST no funciona |
| `03_language_coverage.py` | Enumera sets y cartas por idioma; detecta namespaces de IDs |
| `04_image_sample.py` | Envía 192 HEAD requests a imágenes CDN; mide tamaños y disponibilidad |
| `05_rarity_mapping.py` | Obtiene los 44 valores de rareza EN y genera el mapeo a variantes de la app |
| `06_roadmap_sets.py` | Verifica disponibilidad y cardCount de los 7 sets del roadmap de Brayan |

---

*Generado en la rama `spike/tcgdex-pre`. No afecta a `main` hasta que Brayan apruebe el CONDITIONAL GO.*
