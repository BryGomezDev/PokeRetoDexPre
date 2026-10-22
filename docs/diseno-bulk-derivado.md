# Diseño: Bulk Derivado

**Fecha:** 2026-10-22
**Proyecto:** PokéRetoDex
**Destinatario:** Brayan Gómez (propietario del proyecto)
**Rama:** `docs/diseno-bulk-derivado`

Documento de referencia técnica interna. Cubre el inventario de campos del modelo de datos actual, el diseño del bulk derivado, las implicaciones en reglas Firestore, el impacto en el Dashboard, el análisis del catálogo de rarezas, y el plan de fases de implementación.

**Convención de etiquetas:**
- `[Dato]` — verificado por grep/lectura directa de archivo
- `[Estimación]` — inferido con fundamento pero no ejecutado
- `[Suposición]` — hipótesis razonada sin confirmar

---

## Sección A — Inventario de campos en código fuente

El inventario que sigue fue generado con grep sobre `src/` y está etiquetado como [Dato]. Los números de línea son los del estado del código en la fecha de este documento y pueden desviarse en uno o dos por ediciones menores posteriores.

### Campo `is_bulk` (16 apariciones) [Dato]

| Campo | Archivo (src/) | Línea | Contexto |
|---|---|---|---|
| is_bulk | hooks/usePokedexData.ts | 42 | tipo — campo de PokemonWithStatus interface |
| is_bulk | hooks/usePokedexData.ts | 51 | tipo — retorno de toDisplayState() |
| is_bulk | hooks/usePokedexData.ts | 62 | lectura — parsing Firestore en toDisplayState() |
| is_bulk | hooks/usePokedexData.ts | 146 | lectura — construcción del array combined en load() |
| is_bulk | context/PokedexDataContext.tsx | 201 | lectura — construcción de PokemonWithStatus en load() |
| is_bulk | context/PokedexDataContext.tsx | 241 | lectura/escritura — reset optimista al desmarcar owned |
| is_bulk | context/PokedexDataContext.tsx | 257 | escritura — update.is_bulk = false al desmarcar owned |
| is_bulk | context/PokedexDataContext.tsx | 286 | escritura — actualización optimista en updateBulkStatus() |
| is_bulk | context/PokedexDataContext.tsx | 291 | escritura — setDoc a Firestore en updateBulkStatus() |
| is_bulk | components/PokemonModal.tsx | 72 | lectura — dependencia de useEffect que sincroniza estado local |
| is_bulk | components/PokemonModal.tsx | 311 | lectura — condicional para renderizar stepper |
| is_bulk | components/PokemonModal.tsx | 320 | lectura — condicional para mostrar sección de cantidad |
| is_bulk | components/PokemonCard.tsx | 136 | lectura — color del icono Layers |
| is_bulk | components/PokemonCard.tsx | 137 | lectura — condicional para mostrar badge de cantidad |
| is_bulk | app/(protected)/pokedex/page.tsx | 467 | lectura — argumento del handler onToggleBulk |
| is_bulk | app/(protected)/bulk/page.tsx | 200 | lectura — filtro .filter((p) => p.owned && p.is_bulk) |

### Campo `bulk_quantity` (18 apariciones) [Dato]

| Campo | Archivo (src/) | Línea | Contexto |
|---|---|---|---|
| bulk_quantity | hooks/usePokedexData.ts | 43 | tipo — campo de PokemonWithStatus interface |
| bulk_quantity | hooks/usePokedexData.ts | 51 | tipo — retorno de toDisplayState() |
| bulk_quantity | hooks/usePokedexData.ts | 63 | lectura — parsing Firestore en toDisplayState() |
| bulk_quantity | hooks/usePokedexData.ts | 147 | lectura — construcción del array combined en load() |
| bulk_quantity | context/PokedexDataContext.tsx | 202 | lectura — construcción de PokemonWithStatus en load() |
| bulk_quantity | context/PokedexDataContext.tsx | 242 | lectura/escritura — reset optimista a 0 al desmarcar owned |
| bulk_quantity | context/PokedexDataContext.tsx | 258 | escritura — update.bulk_quantity = 0 al desmarcar owned |
| bulk_quantity | context/PokedexDataContext.tsx | 286 | escritura — actualización optimista en updateBulkStatus() |
| bulk_quantity | context/PokedexDataContext.tsx | 291 | escritura — setDoc a Firestore en updateBulkStatus() |
| bulk_quantity | components/PokemonCard.tsx | 137 | lectura — condición bulk_quantity > 0 para badge |
| bulk_quantity | components/PokemonCard.tsx | 139 | lectura — valor mostrado en el badge |
| bulk_quantity | components/PokemonModal.tsx | 54 | lectura — inicialización useState(pokemon.bulk_quantity) |
| bulk_quantity | components/PokemonModal.tsx | 55 | lectura — inicialización useRef(pokemon.bulk_quantity) |
| bulk_quantity | components/PokemonModal.tsx | 70 | lectura — sincronización en useEffect |
| bulk_quantity | components/PokemonModal.tsx | 71 | lectura — sincronización de ref en useEffect |
| bulk_quantity | app/(protected)/bulk/page.tsx | 214 | lectura — reduce para calcular total de copias |
| bulk_quantity | app/(protected)/bulk/page.tsx | 233 | lectura — construcción del JSON de exportación |
| bulk_quantity | app/(protected)/bulk/page.tsx | 407 | lectura — renderizado columna "Cantidad" en tabla |

### Campo `is_shiny` (19 apariciones) [Dato]

| Campo | Archivo (src/) | Línea | Contexto |
|---|---|---|---|
| is_shiny | hooks/usePokedexData.ts | 40 | tipo — campo de PokemonWithStatus interface |
| is_shiny | hooks/usePokedexData.ts | 51 | tipo — retorno de toDisplayState() |
| is_shiny | hooks/usePokedexData.ts | 60 | lectura — parsing Firestore en toDisplayState() |
| is_shiny | hooks/usePokedexData.ts | 88 | tipo — union literal en firma de updateSpecialFlag |
| is_shiny | hooks/usePokedexData.ts | 144 | lectura — construcción del array combined en load() |
| is_shiny | hooks/usePokedexData.ts | 185 | lectura/escritura — reset optimista al desmarcar owned |
| is_shiny | hooks/usePokedexData.ts | 199 | escritura — update.is_shiny = false al desmarcar owned |
| is_shiny | hooks/usePokedexData.ts | 213 | tipo — union literal en updateSpecialFlag del hook |
| is_shiny | context/PokedexDataContext.tsx | 43 | tipo — firma del método updateSpecialFlag en el context |
| is_shiny | context/PokedexDataContext.tsx | 199 | lectura — construcción de PokemonWithStatus en load() |
| is_shiny | context/PokedexDataContext.tsx | 239 | lectura/escritura — reset optimista en el context |
| is_shiny | context/PokedexDataContext.tsx | 255 | escritura — reset en update al desmarcar owned |
| is_shiny | context/PokedexDataContext.tsx | 267 | tipo — firma de updateSpecialFlag en context |
| is_shiny | components/PokemonCard.tsx | 130 | lectura — color del icono Sparkles |
| is_shiny | components/PokemonModal.tsx | 276 | lectura — condicional de estilo del botón Shiny |
| is_shiny | app/(protected)/pokedex/page.tsx | 103 | comentario documentativo |
| is_shiny | app/(protected)/pokedex/page.tsx | 156 | lectura — filtro shinyFilter && !p.is_shiny |
| is_shiny | app/(protected)/pokedex/page.tsx | 465 | lectura — argumento del handler onToggleShiny |
| is_shiny | app/(protected)/dashboard/page.tsx | 111 | lectura — owned.filter((p) => p.is_shiny).length |

### Campo `is_promo` (19 apariciones) [Dato]

| Campo | Archivo (src/) | Línea | Contexto |
|---|---|---|---|
| is_promo | hooks/usePokedexData.ts | 41 | tipo — campo de PokemonWithStatus interface |
| is_promo | hooks/usePokedexData.ts | 51 | tipo — retorno de toDisplayState() |
| is_promo | hooks/usePokedexData.ts | 61 | lectura — parsing Firestore en toDisplayState() |
| is_promo | hooks/usePokedexData.ts | 88 | tipo — union literal en firma de updateSpecialFlag |
| is_promo | hooks/usePokedexData.ts | 145 | lectura — construcción del array combined en load() |
| is_promo | hooks/usePokedexData.ts | 186 | lectura/escritura — reset optimista al desmarcar owned |
| is_promo | hooks/usePokedexData.ts | 200 | escritura — update.is_promo = false al desmarcar owned |
| is_promo | hooks/usePokedexData.ts | 213 | tipo — union literal en updateSpecialFlag del hook |
| is_promo | context/PokedexDataContext.tsx | 43 | tipo — firma del método updateSpecialFlag en el context |
| is_promo | context/PokedexDataContext.tsx | 200 | lectura — construcción de PokemonWithStatus en load() |
| is_promo | context/PokedexDataContext.tsx | 240 | lectura/escritura — reset optimista en el context |
| is_promo | context/PokedexDataContext.tsx | 256 | escritura — reset en update al desmarcar owned |
| is_promo | context/PokedexDataContext.tsx | 267 | tipo — firma de updateSpecialFlag en context |
| is_promo | components/PokemonCard.tsx | 133 | lectura — color del icono Ticket |
| is_promo | components/PokemonModal.tsx | 289 | lectura — condicional de estilo del botón Promo |
| is_promo | app/(protected)/pokedex/page.tsx | 103 | comentario documentativo |
| is_promo | app/(protected)/pokedex/page.tsx | 157 | lectura — filtro promoFilter && !p.is_promo |
| is_promo | app/(protected)/pokedex/page.tsx | 466 | lectura — argumento del handler onTogglePromo |
| is_promo | app/(protected)/dashboard/page.tsx | 112 | lectura — owned.filter((p) => p.is_promo).length |

### Campo `variant` (31 apariciones relevantes) [Dato]

Se excluyen usos de `variant` como prop de shadcn/ui Button, que no son el campo del modelo de datos.

| Campo | Archivo (src/) | Línea | Contexto |
|---|---|---|---|
| variant | hooks/usePokedexData.ts | 38 | tipo — campo de PokemonWithStatus interface |
| variant | hooks/usePokedexData.ts | 50 | tipo — retorno de toDisplayState() |
| variant | hooks/usePokedexData.ts | 58 | lectura — parsing Firestore en toDisplayState() |
| variant | hooks/usePokedexData.ts | 83 | tipo — parámetro de updatePokemonStatus |
| variant | hooks/usePokedexData.ts | 142 | lectura — construcción del array combined en load() |
| variant | hooks/usePokedexData.ts | 170 | tipo — parámetro de updatePokemonStatus en el hook |
| variant | hooks/usePokedexData.ts | 174 | lectura/escritura — safeVariant = owned ? variant : null |
| variant | hooks/usePokedexData.ts | 183 | escritura — campo en actualización optimista |
| variant | hooks/usePokedexData.ts | 194 | escritura — campo en objeto update para Firestore |
| variant | context/PokedexDataContext.tsx | 38 | tipo — parámetro de updatePokemonStatus en el context |
| variant | context/PokedexDataContext.tsx | 197 | lectura — construcción de PokemonWithStatus en load() |
| variant | context/PokedexDataContext.tsx | 226 | tipo — parámetro en updatePokemonStatus del context |
| variant | context/PokedexDataContext.tsx | 228 | lectura/escritura — safeVariant = owned ? variant : null |
| variant | context/PokedexDataContext.tsx | 237 | escritura — campo en actualización optimista |
| variant | context/PokedexDataContext.tsx | 250 | escritura — campo en objeto update para Firestore |
| variant | components/PokemonCard.tsx | 19 | lectura — switch(pokemon.variant) para estilos de borde |
| variant | components/PokemonCard.tsx | 32 | lectura — switch(pokemon.variant) para estilos de fondo |
| variant | components/PokemonCard.tsx | 49 | lectura — condicional para efecto iridiscente |
| variant | components/PokemonModal.tsx | 47 | lectura — useState(pokemon.variant) |
| variant | components/PokemonModal.tsx | 64 | lectura — sincronización en useEffect |
| variant | components/PokemonModal.tsx | 66 | lectura — dependencia del useEffect de sincronización |
| variant | components/PokemonModal.tsx | 134 | lectura — pasado a onSave |
| variant | components/PokemonModal.tsx | 361 | lectura — comparación para marcar opción activa en grid 2×2 |
| variant | components/PokemonModal.tsx | 398 | lectura — condición owned && variant === null para deshabilitar Guardar |
| variant | app/(protected)/pokedex/page.tsx | 154 | lectura — filtro p.variant !== variantFilter |
| variant | app/(protected)/pokedex/page.tsx | 175 | tipo — parámetro del handler handleSave |
| variant | app/(protected)/pokedex/page.tsx | 177 | lectura — pasado a updatePokemonStatus |
| variant | app/(protected)/dashboard/page.tsx | 106 | lectura — p.variant === "basica" en variantStats |
| variant | app/(protected)/dashboard/page.tsx | 107 | lectura — p.variant === "holo" en variantStats |
| variant | app/(protected)/dashboard/page.tsx | 108 | lectura — p.variant === "alternativa" en variantStats |
| variant | app/(protected)/dashboard/page.tsx | 109 | lectura — p.variant === "fullart" en variantStats |

### Campo `language` (27 apariciones — solo CardLanguage, no LanguageContext de la app) [Dato]

| Campo | Archivo (src/) | Línea | Contexto |
|---|---|---|---|
| language | hooks/usePokedexData.ts | 39 | tipo — campo de PokemonWithStatus interface |
| language | hooks/usePokedexData.ts | 50 | tipo — retorno de toDisplayState() |
| language | hooks/usePokedexData.ts | 59 | lectura — parsing Firestore en toDisplayState() |
| language | hooks/usePokedexData.ts | 84 | tipo — parámetro de updatePokemonStatus |
| language | hooks/usePokedexData.ts | 143 | lectura — construcción del array combined en load() |
| language | hooks/usePokedexData.ts | 171 | tipo — parámetro de updatePokemonStatus en el hook |
| language | hooks/usePokedexData.ts | 175 | lectura/escritura — safeLanguage = owned ? language : null |
| language | hooks/usePokedexData.ts | 184 | escritura — campo en actualización optimista |
| language | hooks/usePokedexData.ts | 195 | escritura — campo en objeto update para Firestore |
| language | context/PokedexDataContext.tsx | 39 | tipo — parámetro de updatePokemonStatus en el context |
| language | context/PokedexDataContext.tsx | 198 | lectura — construcción de PokemonWithStatus en load() |
| language | context/PokedexDataContext.tsx | 226 | tipo — parámetro en updatePokemonStatus del context |
| language | context/PokedexDataContext.tsx | 229 | lectura/escritura — safeLanguage = owned ? language : null |
| language | context/PokedexDataContext.tsx | 238 | escritura — campo en actualización optimista |
| language | context/PokedexDataContext.tsx | 251 | escritura — campo en objeto update para Firestore |
| language | lib/cards.ts | 52 | tipo — campo en la interfaz de CardEntry |
| language | components/PokemonModal.tsx | 48 | lectura — useState(pokemon.language) |
| language | components/PokemonModal.tsx | 65 | lectura — sincronización en useEffect |
| language | components/PokemonModal.tsx | 66 | lectura — dependencia del useEffect de sincronización |
| language | components/PokemonModal.tsx | 134 | lectura — pasado a onSave |
| language | components/PokemonModal.tsx | 382 | lectura — comparación para marcar opción activa en selector |
| language | components/CardDetailModal.tsx | 33 | lectura — poke.cards[card.id]?.language ?? null |
| language | components/CardDetailModal.tsx | 40 | lectura — sincronización en useEffect |
| language | components/CardDetailModal.tsx | 76 | escritura — pasado a onUpdateEntry |
| language | app/(protected)/pokedex/page.tsx | 155 | lectura — filtro p.language !== languageFilter |
| language | app/(protected)/pokedex/page.tsx | 175 | tipo — parámetro del handler handleSave |
| language | app/(protected)/pokedex/page.tsx | 177 | lectura — pasado a updatePokemonStatus |

### Campo `owned` (~57 apariciones — muestra representativa) [Dato]

`owned` es el campo más transversal del modelo, con aproximadamente 57 apariciones en total. La tabla siguiente cubre los usos más representativos por tipo de operación y archivo.

| Campo | Archivo (src/) | Línea | Contexto |
|---|---|---|---|
| owned | hooks/usePokedexData.ts | 37 | tipo — campo de PokemonWithStatus interface |
| owned | hooks/usePokedexData.ts | 57 | lectura — parsing Firestore en toDisplayState() |
| owned | hooks/usePokedexData.ts | 141 | lectura — construcción del array combined en load() |
| owned | hooks/usePokedexData.ts | 170 | tipo — parámetro de updatePokemonStatus |
| owned | hooks/usePokedexData.ts | 172 | escritura — campo en actualización optimista |
| owned | hooks/usePokedexData.ts | 192 | escritura — campo en objeto update para Firestore |
| owned | context/PokedexDataContext.tsx | 196 | lectura — construcción de PokemonWithStatus en load() |
| owned | context/PokedexDataContext.tsx | 226 | tipo — parámetro en updatePokemonStatus del context |
| owned | context/PokedexDataContext.tsx | 234 | escritura — campo en actualización optimista |
| owned | components/PokemonCard.tsx | 15 | lectura — condicional para estilos visuales (atenuado/color) |
| owned | components/PokemonCard.tsx | 110 | lectura — condicional para mostrar iconos de estado |
| owned | components/PokemonModal.tsx | 46 | lectura — useState(pokemon.owned) |
| owned | components/PokemonModal.tsx | 398 | lectura — condición owned && variant === null para deshabilitar Guardar |
| owned | app/(protected)/pokedex/page.tsx | 153 | lectura — filtro por estado de posesión |
| owned | app/(protected)/bulk/page.tsx | 200 | lectura — filtro p.owned && p.is_bulk |
| owned | app/(protected)/dashboard/page.tsx | 89 | lectura — pokemon.filter((p) => p.owned && !p.is_special_form) |
| owned | app/(protected)/dashboard/page.tsx | 104 | lectura — pokemon.filter((p) => p.owned) para variantStats |

### `usePokedexData` — resolución de la contradicción (aviso F3) [Dato]

El archivo `src/hooks/usePokedexData.ts` existe y contiene código real y activo: define los tipos exportados `FormType`, `PokemonDoc`, `PokemonWithStatus`, `UserProfile`, `Variant`, `CardLanguage` y `CardEntry`, así como la función utilitaria exportada `toDisplayState`. Estos tipos y la función son importados activamente desde `context/PokedexDataContext.tsx` (líneas 21-22 de ese archivo).

El hook `usePokedexData` en sí, definido en el mismo módulo, no se importa en ningún otro archivo de `src/`. No hay ningún caller de `usePokedexData()` en la base de código.

La contradicción del aviso F3 se resuelve de la siguiente forma: el ARCHIVO es vivo (exporta tipos y una utilidad en uso activo), pero el HOOK es código muerto (la función `usePokedexData()` no tiene callers). El aviso anterior citaba el archivo completo como "sin uso", lo cual era incorrecto. Lo que está sin uso es específicamente la función del hook. La acción correcta en la fase de limpieza es eliminar únicamente la función del hook, no el archivo.

---

## Sección B — Diseño del bulk derivado

### B1. El contexto ya carga todas las cartas de colección en memoria [Dato]

`PokedexDataContext.tsx:152-156` ejecuta en cada montaje:

```typescript
getDocs(collection(db, "users", uidValue, "collection"))
```

Esto lee todos los documentos de `/users/{uid}/collection` de una vez. El array resultante `pokemon` (tipo `PokemonWithStatus[]`) vive en el contexto de React. Cada elemento ya contiene `cards` con todas las cartas catalogadas del usuario, incluyendo el campo `copies` por carta.

Lecturas Firestore por sesión: 1 `onSnapshot` sobre `/users/{uid}`, 1 `getDocs` sobre `/pokemon` (o 0 si hay caché en sessionStorage), y 1 `getDocs` sobre `/users/{uid}/collection`. El bulk derivado no añade ninguna lectura adicional a Firestore — los datos ya están en memoria.

### B2. Función pura `deriveBulkCount`

Función propuesta [Suposición — no implementada, requiere Fase 1]:

```typescript
// src/lib/cards.ts

/**
 * bulk(pokemon) = sum over cards of max(copies − 1, 0)
 */
export function deriveBulkCount(cards: Record<string, CardEntry>): number {
  let total = 0;
  for (const entry of Object.values(cards)) {
    if (entry.copies > 1) total += entry.copies - 1;
  }
  return total;
}
```

Archivo propuesto: `src/lib/cards.ts`. [Dato] El archivo ya contiene `applyCardEntry` y la interfaz `CardEntry` — es la única dependencia y el módulo natural para esta función. No se necesita crear ningún archivo nuevo.

### B3. Dónde se llama [Estimación]

En el componente consumidor mediante `useMemo`, no en el context. La pantalla `/bulk` es el único consumer actual. Ejemplo:

```typescript
// src/app/(protected)/bulk/page.tsx
const bulkPokemon = useMemo(
  () =>
    pokemon
      .filter((p) => deriveBulkCount(p.cards) > 0)
      .map((p) => ({ ...p, derivedBulk: deriveBulkCount(p.cards) }))
      .sort((a, b) => a.sort_order - b.sort_order),
  [pokemon]
);
```

Si el Dashboard también necesitara el total en el futuro, se elevaría al context en ese momento. Por ahora, `useMemo` local es suficiente.

### B4. Cómo queda la pantalla /bulk

Con el modelo derivado, los puntos de la pantalla cambian de la siguiente forma:

- **Lista mostrada:** Pokémon filtrado por `deriveBulkCount(p.cards) > 0` en lugar de `p.owned && p.is_bulk`
- **Cantidad en cada fila:** `deriveBulkCount(p.cards)` — automático, calculado en cliente, no un campo Firestore separado
- **Total en cabecera:** `bulkPokemon.reduce((sum, p) => sum + deriveBulkCount(p.cards), 0)`
- **Exportación JSON:** `quantity: deriveBulkCount(p.cards)` en lugar de `p.bulk_quantity`
- **Columnas de la tabla:** se mantienen `#` / Nombre / Región / Cantidad sin cambios visuales
- **Lógica de importación/comparación con amigo:** no cambia — sigue leyendo `quantity` del JSON externo importado

### B5. Tres opciones para documentos legacy

Los documentos que tienen `is_bulk: true` y `bulk_quantity > 0` en Firestore pero `cards: {}` vacío (creados con el modelo anterior) representan un caso edge. Hay tres caminos posibles:

| Opción | Descripción | Pros | Contras |
|---|---|---|---|
| A — Ignorar legacy | `deriveBulkCount({}) = 0` → esos Pokémon desaparecen silenciosamente de /bulk | Cero código extra, cero migración | Datos silenciosamente perdidos; el usuario ve desaparecer sus sobrantes sin aviso |
| B — Migración automática al primer login | Al detectar `is_bulk: true` + `cards: {}`, crear una CardEntry sintética `"legacy-bulk"` con `copies = bulk_quantity + 1` | El usuario no pierde datos visualmente | CardId sintético no corresponde a ninguna carta real; inconsistencias en la pantalla de cartas; escrituras inesperadas en login |
| C — Lectura híbrida transitoria | `deriveBulkCount` devuelve `Math.max(deriveFromCards, is_bulk ? bulk_quantity : 0)` | Retrocompatibilidad total, cero escrituras | Mantiene `is_bulk`/`bulk_quantity` en los tipos indefinidamente; lógica mixta confusa; deuda técnica con techo conocido |

**Decisión pendiente: elige Brayan.**

---

## Sección C — Reglas Firestore: `validCollectionDoc`

### Código actual [Dato]

`firestore.rules:5-16`:

```javascript
function validCollectionDoc(data) {
  return (!('owned' in data) || data.owned is bool)
    && (!('cards' in data) || (
          data.cards is map
          && data.cards.size() <= 500
       ))
    && (!('favorite' in data) || data.favorite is bool)
    && (!('bulk_quantity' in data) || (data.bulk_quantity is number && data.bulk_quantity >= 0))
    && (!('is_bulk' in data) || data.is_bulk is bool)
    && (!('is_shiny' in data) || data.is_shiny is bool)
    && (!('is_promo' in data) || data.is_promo is bool);
}
```

El patrón usado es permisivo: "si el campo está presente, debe ser del tipo correcto". La función valida `bulk_quantity >= 0` en la línea 12. Las validaciones de `is_bulk`, `is_shiny` e `is_promo` están en las líneas 13, 14 y 15 respectivamente.

### Qué mantener y qué eliminar

**Campos retirados por el bulk derivado** — se dejan de escribir en cuanto se implementa la Fase 1:

| Validación | Motivo | Decisión |
|---|---|---|
| `cards is map && size() <= 500` | `cards` es el campo central del modelo derivado | Mantener |
| `owned is bool` | Campo de compatibilidad legacy | Mantener mientras exista |
| `favorite is bool` | `favorite` sigue activo en el context | Mantener |
| `bulk_quantity >= 0` | `bulk_quantity` deja de escribirse al implementar el bulk derivado | Eliminar |
| `is_bulk is bool` | `is_bulk` deja de escribirse al implementar el bulk derivado | Eliminar |

**Campos condicionalmente futuros** — [Estimación] `is_shiny` e `is_promo` siguen escribiéndose por `updateSpecialFlag` en el flujo actual (`context/PokedexDataContext.tsx:267`). Su migración a rareza de carta es una decisión futura no confirmada. Mientras el cliente los siga escribiendo, **no eliminar estas validaciones** — hacerlo no rompe nada (el patrón es permisivo), pero describe incorrectamente el estado del sistema:

| Validación | Motivo | Decisión cuando se confirme la migración |
|---|---|---|
| `is_shiny is bool` | Todavía se escribe por el cliente; migración pendiente de confirmación | Eliminar cuando is_shiny migre a rareza de carta |
| `is_promo is bool` | Ídem para is_promo | Eliminar cuando is_promo migre a rareza de carta |

### Riesgo R12 — documentos legacy y orden de operaciones

[Suposición — comportamiento documentado de Firestore Security Rules con operaciones merge, no probado empíricamente en este proyecto] Si un documento legacy tiene `is_bulk: true` en Firestore y el cliente ejecuta cualquier `setDoc` con `merge: true` (incluso para actualizar otro campo completamente distinto), la operación **fallará** si se endurecen las reglas para prohibir ese campo. Esto se debe a que `request.resource.data` en operaciones merge refleja el documento resultante completo, no solo el delta enviado. El documento resultante incluirá el campo `is_bulk: true` ya existente, y la nueva regla lo rechazará.

**Orden correcto para endurecer las reglas:**
1. Migrar o limpiar los documentos legacy (via Admin SDK o lazy en cliente al detectarlos)
2. Actualizar el código cliente para que no escriba esos campos en nuevas operaciones
3. Endurecer `validCollectionDoc` para rechazar esos campos

Hacer esto en otro orden romperá escrituras en producción para cualquier usuario que tenga documentos legacy.

---

## Sección D — Impacto en Dashboard y contadores

[Dato] Archivo: `src/app/(protected)/dashboard/page.tsx`

### Contadores actuales

| Contador | Variable | Línea | Usa is_bulk / bulk_quantity |
|---|---|---|---|
| Progreso Nacional (owned/total) | nationalOwned / nationalTotal | 89-90 | No |
| Progreso por Región | regionStats | 93-101 | No |
| Variantes: básica/holo/alternativa/fullart | variantStats.{basica,holo,alternativa,fullart} | 106-109 | No |
| Total cartas poseídas | variantStats.total | 110 | No |
| Conteo Shiny | variantStats.shiny | 111 | is_shiny |
| Conteo Promo | variantStats.promo | 112 | is_promo |
| Formas especiales (mega/gmax/regional) | specialStats | 116-139 | No |
| Colección Total (owned/todos los Pokémon) | variantStats.total / pokemon.length | 391-398 | No |

[Dato] `is_bulk` y `bulk_quantity` no aparecen en ningún cálculo del Dashboard (grep confirmado, cero hits en `dashboard/page.tsx`).

### Contadores afectados por el cambio propuesto

**`variantStats.shiny` (`dashboard/page.tsx:111`)** — actualmente lee `p.is_shiny`. Si `is_shiny` se convierte en una rareza de carta del catálogo (modelo derivado), este contador necesitaría recalcularse contando cartas con rareza `Shiny*` poseídas, en lugar de leer el flag booleano. El cambio afecta a la semántica del cálculo pero no al lugar donde se muestra en la UI. [Estimación]

**`variantStats.promo` (`dashboard/page.tsx:112`)** — ídem para `is_promo` → rarity `"Promo"`. Si `is_promo` migra a rareza de carta, este contador cambia de `p.is_promo` a contar cartas con rareza promo poseídas. [Estimación]

**No existe ningún contador de bulk en el Dashboard** — el único sumatorio de `bulk_quantity` está en `/bulk/page.tsx:214`. El Dashboard no se ve afectado en absoluto por el cambio de bulk a modelo derivado.

---

## Sección E — Script de análisis de catálogo

El script `scripts/analyze_catalog_rarities.py` fue escrito y ejecutado. Identifica sets promo mediante el sufijo `p` en el `setId` del catálogo (todos los sets con ese sufijo tienen "Promos" o "Promo" en su nombre de set, confirmando que el sufijo es el marcador estructural del catálogo).

### Salida literal de ejecución [Dato]

```
Loading catalog…
Total EN cards: 17995

============================================================
SECTION 1 — Promo sets and non-'Promo' rarities within them
============================================================

Promo sets identified (setId ends in 'p'): 13
  basep      -> Wizards Black Star Promos  (49 cards)
  bwp        -> BW Black Star Promos  (93 cards)
  dpp        -> DP Black Star Promos  (51 cards)
  hgssp      -> HGSS Black Star Promos  (28 cards)
  mep        -> MEP Black Star Promos  (109 cards)
  miscp      -> Miscellaneous Promos  (1 cards)
  np         -> Nintendo Black Star Promos  (36 cards)
  smp        -> SM Black Star Promos  (261 cards)
  svp        -> SVP Black Star Promos  (220 cards)
  swshp      -> SWSH Black Star Promos  (295 cards)
  tk-ex-p    -> EX trainer Kit 2 (Plusle)  (7 cards)
  tk-xy-p    -> XY trainer Kit (Pikachu Libre)  (18 cards)
  xyp        -> XY Black Star Promos  (194 cards)

Cards in promo sets with rarity != 'Promo': 256
  'Common'                          count=205
      example: basep-13 (Wizards Black Star Promos)
      example: basep-1 (Wizards Black Star Promos)
      example: basep-4 (Wizards Black Star Promos)
  'Rare'                            count=31
      example: swshp-SWSH025 (SWSH Black Star Promos)
      example: bwp-BW45 (BW Black Star Promos)
      example: bwp-BW51 (BW Black Star Promos)
  'None'                            count=15
      example: tk-xy-p-14 (XY trainer Kit (Pikachu Libre))
      example: tk-xy-p-30 (XY trainer Kit (Pikachu Libre))
      example: tk-xy-p-7 (XY trainer Kit (Pikachu Libre))
  'Uncommon'                        count=4
      example: tk-xy-p-19 (XY trainer Kit (Pikachu Libre))
      example: tk-xy-p-24 (XY trainer Kit (Pikachu Libre))
      example: tk-xy-p-4 (XY trainer Kit (Pikachu Libre))
  'Ultra Rare'                      count=1
      example: swshp-SWSH230 (SWSH Black Star Promos)

============================================================
SECTION 2 — Cards with rarity 'None' (or null/absent) in promo sets
============================================================

Cards with rarity 'None' or null in promo sets: 15
  tk-xy-p-14                 set=tk-xy-p     rarity='None'
  tk-xy-p-30                 set=tk-xy-p     rarity='None'
  tk-xy-p-7                  set=tk-xy-p     rarity='None'
  tk-xy-p-11                 set=tk-xy-p     rarity='None'
  tk-xy-p-28                 set=tk-xy-p     rarity='None'
  tk-xy-p-13                 set=tk-xy-p     rarity='None'
  tk-xy-p-22                 set=tk-xy-p     rarity='None'
  tk-xy-p-16                 set=tk-xy-p     rarity='None'
  tk-ex-p-4                  set=tk-ex-p     rarity='None'
  tk-ex-p-2                  set=tk-ex-p     rarity='None'
  … and 5 more

============================================================
SECTION 3 — Shiny* rarities (any rarity starting with 'Shiny'), grouped by set
============================================================

Total cards with Shiny* rarity: 332

  sv04.5        Paldean Fates                        total=132
      Shiny Ultra Rare                12
      Shiny rare                      120
  swsh4.5sv     Shining Fates Shiny Vault            total=120
      Shiny rare                      104
      Shiny rare V                    9
      Shiny rare VMAX                 7
  sma           Hidden Fates Shiny Vault             total=80
      Shiny rare                      80

============================================================
Done.
```

### Interpretación

De las 1362 cartas en los 13 sets promo, 256 (18,8%) no tienen rareza `"Promo"`. Las más frecuentes son `"Common"` (205) y `"Rare"` (31), concentradas mayoritariamente en `basep` (Wizards Black Star Promos, la era más antigua del juego, donde las rarezas de las promos no estaban estandarizadas). Los 15 con rareza `"None"` son exclusivamente Trainer Kits (`tk-xy-p` y `tk-ex-p`), conjuntos de entrenamiento donde las rarezas no fueron catalogadas en la fuente de datos.

Las cartas con rareza `Shiny*` se concentran en 3 sets específicos: Paldean Fates, Shining Fates Shiny Vault y Hidden Fates Shiny Vault, con un total de 332 cartas. Esto confirma que "Shiny" como rareza es un atributo estructural del catálogo de carta (pertenece al objeto `CardEntry` del set), no una marca subjetiva de la colección del usuario. Este resultado es coherente con la decisión de negocio de mover `is_shiny` de campo booleano de colección a rareza de carta en el modelo derivado.

---

## Sección F — Plan por fases

### Tabla de fases

| Fase | Descripción | Archivos principales afectados | Tamaño | Riesgo | Dependencias | Estado |
|---|---|---|---|---|---|---|
| 1 | Bulk derivado + eliminar badge numérico de PokemonCard | `src/lib/cards.ts`, `src/app/(protected)/bulk/page.tsx`, `src/components/PokemonCard.tsx` | S | Bajo | Ninguna | ✅ Completa |
| 2 | Retirar PokemonModal | `src/app/(protected)/pokedex/page.tsx`, `src/components/PokemonModal.tsx`, `src/context/PokedexDataContext.tsx` | M | Medio | Fase 1 (el modal es el único escritor de is_bulk en el flujo UI actual) | Pendiente |
| 3 | Limpieza de tipos y código muerto | `src/hooks/usePokedexData.ts`, tipos legacy, imports muertos | S | Bajo | Fases 1 y 2 | Pendiente |

**Fase 1 — Estado: ✅ Completa (2026-10-22, rama `feat/bulk-derivado`)**

10 archivos modificados:

1. `src/lib/cards.ts` — función pura `deriveBulkCount(cards: Record<string, CardEntry>): number` añadida
2. `src/hooks/usePokedexData.ts` — campos `is_bulk` y `bulk_quantity` marcados como `@deprecated`
3. `src/context/PokedexDataContext.tsx` — función `updateBulkStatus` eliminada (función + interfaz + valor del context)
4. `src/components/PokemonModal.tsx` — toggle de bulk y stepper de cantidad eliminados (~60 líneas neto)
5. `src/app/(protected)/pokedex/page.tsx` — prop wiring de bulk eliminado
6. `src/components/PokemonCard.tsx` — icono Layers usa `deriveBulkCount(pokemon.cards)` en lugar de los campos deprecados; `aria-label` añadido al botón de la tarjeta
7. `src/lib/i18n/es.ts` — 6 claves nuevas: `pokedex.owned`, `cards.ownedSummary`, `cards.pokemonHeader`, `bulk.empty`, `bulk.emptyHint`, `bulk.myBulkTableLabel`, `bulk.friendBulkTableLabel`
8. `src/lib/i18n/en.ts` — ídem en inglés
9. `src/app/(protected)/pokedex/[dexId]/page.tsx` — línea de resumen de cartas poseídas (cartas distintas · copias totales · copias sobrantes); i18n de "Sin rareza" y "Pokémon #" corregido
10. `src/app/(protected)/bulk/page.tsx` — reconstruido sobre `deriveBulkCount`; validación de esquema en importación JSON; `aria-label` en tabla + `scope="col"` en `<th>`
11. `scripts/test-card-filter.ts` — casos E1–E7 para `deriveBulkCount` añadidos

Verificación: lint ✓, tsc ✓, build ✓, test:cards ✓

**Justificación de riesgos:**

**Fase 1 [Bajo]:** `deriveBulkCount` es una función pura sobre datos ya en memoria, sin efectos colaterales. El bloque de badge en `PokemonCard.tsx:111-116` (badge rojo de conteo sobre el icono Layers) es aproximadamente 6 líneas sin efecto colateral en el resto del componente.

**Fase 2 [Medio]:** `PokemonModal.tsx` es el único punto de la UI que escribe `variant`, `language`, `is_shiny` e `is_promo` via el flujo antiguo (`updatePokemonStatus`). Retirarlo sin reemplazar esas funciones deja al usuario sin forma de establecer la variante, que controla el estilo visual del borde de cada tarjeta. Si `variant` también migra a ser un atributo de `CardEntry` individual (una variante por carta, no por Pokémon), el riesgo baja porque el nuevo modal de carta (`CardDetailModal.tsx`) ya gestiona ese flujo. [Suposición]

**Precondición bloqueante de Fase 2:** confirmar que `CardDetailModal.tsx` asume la escritura de `variant` y `language` a nivel Pokémon, o definir explícitamente cómo se establecen esos campos en el nuevo modelo. Sin esto, retirar `PokemonModal` elimina la única UI para controlar el estilo visual de la tarjeta.

**Fase 3 [Bajo]:** eliminación de código muerto (la función `usePokedexData()` sin callers, tipos legacy, imports no usados). Sin cambio de comportamiento observable por el usuario.

### PR de limpieza pendiente — Hallazgos verificados

**1. onError del modal de carta — respaldo high.jpg / low.webp**

[Dato] No hay fallback entre calidades de imagen. `CardDetailModal.tsx:178` y `CardThumbnail.tsx:72` tienen `onError` que activa `imgError = true` y muestra un placeholder de texto. No hay intento de cargar `high.jpg` si `high.webp` falla, ni viceversa. Esto es comportamiento por diseño según `docs/diseno-selector-cartas.md:371`, no un bug pendiente.

**2. Hook `usePokedexData` — función sin callers**

[Dato] La función `usePokedexData` definida en `hooks/usePokedexData.ts:93` no tiene callers en ningún archivo de `src/`. El módulo sí es vivo (exporta tipos usados por el context y por componentes), pero la función del hook es código muerto. Acción en la fase de limpieza: eliminar la función, no el archivo.

**3. `docs/diseno-selector-cartas.md` — frase "queda vacío o se elimina"**

[Dato] La frase en el documento es descriptiva del comportamiento real de Firestore con `deleteField()`: cuando se elimina la última clave del mapa `cards`, el campo permanece como `{}` en el documento (Firestore no elimina el campo automáticamente). El texto del documento es factualmente correcto. No hay un error a corregir.

**4. Guarda del mapa vacío — cobertura de test**

[Dato] La guarda existe en `PokedexDataContext.tsx:416`:

```typescript
if (Object.keys(cardsToWrite).length === 0) return;
```

El test que la cubre existe en `scripts/test-card-filter.ts:76-79`, caso C8:

```typescript
const after8 = applyCardEntry({ "only-card": ... }, "only-card", null);
assert.strictEqual(Object.keys(after8).length, 0,
  "C8: eliminar última carta → mapa vacío — setDoc fallback debe omitirse");
```

Ejecutable con `npx tsx scripts/test-card-filter.ts`.

---

## Notas de seguridad

**R12** — ya cubierto en detalle en la Sección C. Resumen: el orden de operaciones es crítico antes de endurecer `validCollectionDoc`. Limpiar documentos legacy primero, actualizar código cliente segundo, endurecer reglas tercero.

**Otros hallazgos no bloqueantes:**

| # | Hallazgo | Severidad | Bloqueante |
|---|---|---|---|
| S1 | `unsafe-inline` + `unsafe-eval` en CSP (`next.config.mjs:5`) anula protección XSS | Media | No |
| S2 | Sin validación de esquema en `/users/{uid}` (solo auth/propiedad) | Baja | No |
| S3 | `img-src raw.githubusercontent.com` sin scope de path | Informacional | No |
| S4 | Cookie `session` accesible desde JS (`document.cookie` en `PokedexDataContext.tsx:112`) | Baja | No |
| S5 | `usePokedexData` con lógica Firestore activa pero no usada — riesgo de doble carga si se importa por error | Informacional | No |

---

## Cierre

Fecha del documento: 2026-10-22.

Los entregables A, B, C, D y E están completos con información verificada directamente en el código fuente. Los números de línea corresponden al estado del repositorio en la rama `docs/diseno-bulk-derivado` en la fecha indicada.

Las decisiones de arquitectura pendientes que requieren confirmación de Brayan antes de implementar son:

- **Sección B5** — qué opción elegir para los documentos legacy con `is_bulk: true` y `cards: {}` (Ignorar legacy / Migración automática / Lectura híbrida transitoria).
- **Alcance de la migración de `variant` en la Fase 2** — si `variant` migra a atributo de `CardEntry` individual (lo que reduciría el riesgo de Fase 2 de Medio a Bajo), o si se mantiene como campo de nivel Pokémon durante la transición.

El script `scripts/analyze_catalog_rarities.py` es ejecutable con `python scripts/analyze_catalog_rarities.py` desde la raíz del proyecto.
