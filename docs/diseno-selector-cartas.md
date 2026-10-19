# Diseño: Selector de cartas individuales por Pokémon

**Fecha:** 2026-10-11
**Rama de referencia:** `feat/catalog-etl`
**Autor:** Technical Writer — PokéRetoDex

---

## Alcance de este documento

Este documento describe el diseño completo de la nueva funcionalidad de selector de cartas individuales: qué datos existen, cómo se extiende el esquema de Firestore, cómo se presentan las cartas al usuario y qué fases de desarrollo se proponen.

No contiene instrucciones de implementación directas y no modifica ningún fichero de `src/`, ninguna regla de Firestore ni el catálogo estático. Es un documento de diseño y análisis; toda decisión que requiera acuerdo con Brayan está marcada explícitamente en la Sección 9.

---

## Sección 1 — Estado actual

### 1.1 Páginas y rutas

| Archivo | URL | Protegida |
|---|---|---|
| `src/app/page.tsx` | `/` | No — redirige a `/login` (línea 4) [Dato] |
| `src/app/login/page.tsx` | `/login` | No [Dato] |
| `src/app/registro/page.tsx` | `/registro` | No [Dato] |
| `src/app/legal/page.tsx` | `/legal` | No — server component estático [Dato] |
| `src/app/(protected)/pokedex/page.tsx` | `/pokedex` | Sí [Dato] |
| `src/app/(protected)/dashboard/page.tsx` | `/dashboard` | Sí [Dato] |
| `src/app/(protected)/bulk/page.tsx` | `/bulk` | Sí [Dato] |
| `src/app/(protected)/configuracion/page.tsx` | `/configuracion` | Sí [Dato] |

El grupo de rutas `(protected)` comparte `src/app/(protected)/layout.tsx` (client component). El guard de sesión vive en las líneas 10-29 de ese archivo: si `authLoading === false && user === null`, limpia la cookie y redirige a `/login`. El layout monta `PokedexDataProvider` una sola vez para las cuatro rutas hijas [Dato].

### 1.2 Componentes y contextos clave

**Componentes principales:**

| Componente | Fichero | Responsabilidad |
|---|---|---|
| `PokemonCard` | `src/components/PokemonCard.tsx` | Tarjeta del grid; borde visual por `variant`; iconos Shiny/Promo/Bulk en esquina [Dato] |
| `PokemonModal` | `src/components/PokemonModal.tsx` | Modal de detalle; toggle `owned`; selector de variante 2×2; toggles Shiny/Promo/Bulk; stepper bulk con debounce 1000 ms; botón Guardar deshabilitado si `owned && variant === null` (línea 382) [Dato] |
| `Navigation` | `src/components/Navigation.tsx` | Sidebar izquierdo en escritorio ≥lg; barra inferior en móvil; 4 destinos; enlace a `/legal` solo en sidebar [Dato] |
| `LoadingSpinner` | `src/components/LoadingSpinner.tsx` | Spinner centrado a pantalla completa [Dato] |
| `LangToggle` | `src/components/LangToggle.tsx` | Botones ES/EN; visible en Login y Registro [Dato] |
| `PokeballLogo` | `src/components/PokeballLogo.tsx` | Logo SVG; solo en Login y Registro [Dato] |

**Contextos:**

| Contexto | Fichero | Responsabilidad |
|---|---|---|
| `AuthContext` / `AuthProvider` | `src/context/AuthContext.tsx` | `onAuthStateChanged`; expone `user` y `loading` [Dato] |
| `LanguageProvider` / `useLanguage` | `src/context/LanguageContext.tsx` | Idioma activo; `t(key)`; persiste en `localStorage` antes del login y en `/users/{uid}.app_language` después (línea 68) [Dato] |
| `PokedexDataProvider` / `usePokedexContext` | `src/context/PokedexDataContext.tsx` | Carga `/pokemon` con caché sessionStorage y `/users/{uid}/collection`; expone `pokemon[]`, `userProfile`, `updatePokemonStatus`, `updateSpecialFlag`, `updateBulkStatus`; `onSnapshot` en `/users/{uid}` para detectar borrado de cuenta [Dato] |

### 1.3 Esquema Firestore real

**Colección `/pokemon/{slug}` — solo lectura:**

| Campo | Tipo | Línea en `PokedexDataContext.tsx` |
|---|---|---|
| `slug` | string (id del documento) | 148 [Dato] |
| `pokedex_number` | number | 148 [Dato] |
| `form_index` | number | 149 [Dato] |
| `sort_order` | number | 150 [Dato] |
| `name` | string | 151 [Dato] |
| `region` | string | 152 [Dato] |
| `types` | string[] | 153 [Dato] |
| `sprite_url` | string (URL a `raw.githubusercontent.com`) | 154 [Dato] |
| `is_special_form` | boolean | 155 [Dato] |
| `form_type` | `"mega"` \| `"gmax"` \| `"regional"` \| `null` | 156 [Dato] |

**Subcolección `/users/{uid}/collection/{pokemonSlug}` — lectura/escritura:**

| Campo | Tipo | Línea en `PokedexDataContext.tsx` |
|---|---|---|
| `owned` | boolean | 173 [Dato] |
| `variant` | `"basica"` \| `"holo"` \| `"alternativa"` \| `"fullart"` \| `null` | 176 [Dato] |
| `language` | `"es"` \| `"en"` \| `"zh"` \| `"ko"` \| `"ja"` \| `"otros"` \| `null` | 177 [Dato] |
| `is_shiny` | boolean | 178 [Dato] |
| `is_promo` | boolean | 179 [Dato] |
| `is_bulk` | boolean | 180 [Dato] |
| `bulk_quantity` | number | 181 [Dato] |
| `updated_at` | serverTimestamp | 243 [Dato] |

**Documento `/users/{uid}`:**

| Campo | Tipo | Fichero:línea |
|---|---|---|
| `username` | string | `registro/page.tsx:118` [Dato] |
| `created_at` | serverTimestamp | `registro/page.tsx:119` [Dato] |
| `avatar_pokemon_slug` | string | `registro/page.tsx:120` [Dato] |
| `app_language` | `"es"` \| `"en"` | `LanguageContext.tsx:68` [Dato] |

**Documento `/users/{uid}/config/rules`:** presente en `firestore.rules`; no hay ninguna lectura ni escritura a este path en el código cliente inspeccionado [Dato].

### 1.4 Obtención de Pokémon e imágenes

Los datos de Pokémon no se obtienen de PokeAPI en tiempo de ejecución. PokeAPI se usó exclusivamente en el script Python de la Fase 4 para poblar la colección `/pokemon`. Las URLs del campo `sprite_url` apuntan a `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{dexId}.png` [Dato].

La caché de sessionStorage está implementada en `PokedexDataContext.tsx` líneas 120–165 [Dato]:

- **Clave:** `pokedex_pokemon_cache_v${POKEMON_DATA_VERSION}` — la constante `POKEMON_DATA_VERSION` vive en `src/lib/constants.ts` [Dato].
- **Cache miss:** ejecuta `getDocs` contra Firestore y persiste el resultado con `sessionStorage.setItem` [Dato].
- **Cache hit:** omite completamente la lectura de `/pokemon` a Firestore [Dato].
- La colección del usuario (`/users/{uid}/collection`) nunca se cachea; siempre se lee fresca de Firestore [Dato].

`src/hooks/usePokedexData.ts` contiene una función `usePokedexData()` que también carga `/pokemon`, pero no es llamada por ningún componente ni página en la codebase actual. Solo exporta tipos que consume `PokedexDataContext.tsx` [Dato].

### 1.5 Dependencias del campo `variant`

| Componente / Fichero | Uso de `variant` |
|---|---|
| `PokemonCard.tsx:11–34` | `getCardStyle()`: aplica `boxShadow` dorado si `"holo"`, degradado si `"alternativa"` o `"fullart"` [Dato] |
| `PokemonCard.tsx:36–45` | `getBorderClass()`: clases Tailwind de borde por variante [Dato] |
| `PokemonModal.tsx:47` | Estado local inicializado desde `pokemon.variant` [Dato] |
| `PokemonModal.tsx:31` | `VARIANT_VALUES = ["basica","holo","alternativa","fullart"]` [Dato] |
| `PokemonModal.tsx:382` | Botón Guardar: `disabled` si `owned && variant === null` [Dato] |
| `PokemonModal.tsx:119` | `handleSave()`: pasa `variant` a `onSave()` [Dato] |
| `PokedexDataContext.tsx:176` | Lee `data.variant as Variant` del documento [Dato] |
| `PokedexDataContext.tsx:241, 252` | Escribe `variant` en `updatePokemonStatus()` [Dato] |
| `pokedex/page.tsx:96, 155` | Filtro `variantFilter` en el `useMemo` de filtrado [Dato] |
| `dashboard/page.tsx:103–113` | `variantStats` useMemo: cuenta Básica / Holo / Alternativa / Full Art [Dato] |

### 1.6 Reglas de seguridad Firestore actuales

Contenido literal del fichero `firestore.rules` (líneas 1–22) [Dato]:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /pokemon/{slug} {
      allow read: if true;
      allow write: if false;
    }
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      match /collection/{pokemonSlug} {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
      match /config/rules {
        allow read, write: if request.auth != null && request.auth.uid == uid;
      }
    }
  }
}
```

---

## Sección 2 — Cuotas y límites Firebase Spark

Referencia oficial: `https://firebase.google.com/docs/firestore/quotas`

| Límite | Valor |
|---|---|
| Tamaño máximo de un documento Firestore | 1 MiB (1,048,576 bytes) [Dato — verificar en firebase.google.com/docs/firestore/quotas] |
| Lecturas gratuitas diarias (plan Spark) | 50,000 lecturas/día [Dato] |
| Escrituras gratuitas diarias (plan Spark) | 20,000 escrituras/día [Dato] |
| Eliminaciones gratuitas diarias (plan Spark) | 20,000 eliminaciones/día [Dato] |
| Límite de campos por documento | Sin límite explícito; el límite real es el tamaño total de 1 MiB [Dato] |

**Cómo Firestore cuenta las lecturas:** leer un documento equivale a 1 lectura, independientemente de su tamaño. Un `getDocs` que devuelve 200 documentos son 200 lecturas. Un `onSnapshot` que recibe el estado inicial de 200 documentos son 200 lecturas; las actualizaciones posteriores solo cuentan los documentos que cambiaron [Dato].

---

## Sección 3 — Esquema de datos propuesto

### 3.1 Opción A+ (recomendada): extensión del documento existente

Se extiende `/users/{uid}/collection/{pokemonSlug}` con dos campos nuevos, sin romper los campos existentes:

```
/users/{uid}/collection/{pokemonSlug}
{
  // Campos legacy — se mantienen, coexisten sin cambio
  owned: bool,
  variant: "basica" | "holo" | "alternativa" | "fullart" | null,
  is_shiny: bool,
  is_promo: bool,
  is_bulk: bool,
  bulk_quantity: number,
  language: "es" | "en" | "zh" | "ko" | "ja" | "otros" | null,

  // Campos nuevos
  favorite: bool,
  cards: {
    "sv03.5-001": { copies: 2, language: "es" },
    "base1-44":   { copies: 1, language: "en" }
  },

  updated_at: timestamp
}
```

El campo `cards` es un mapa cuyas claves son los `card_id` del catálogo TCGdex. Cada entrada almacena el número de copias y el idioma de esa carta concreta. El campo `favorite` es un booleano simple por Pokémon.

### 3.2 Alternativa — Opción B: un documento por carta

```
/users/{uid}/cards/{card_id}
{ dexId: number, copies: number, language: string, updated_at: timestamp }

/users/{uid}/favorites/{pokemonSlug}
{ updated_at: timestamp }
```

### 3.3 Comparativa

| Criterio | Opción A+ (recomendada) | Opción B |
|---|---|---|
| Lecturas al iniciar sesión | ~200 (1 por Pokémon con cartas) [Estimación] | ~300–500 (1 por carta marcada; crece con la colección) [Estimación] |
| Escrituras para 5 cartas del mismo Pokémon | **1** — el mapa `cards` entero [Estimación] | **5** — una escritura por carta [Estimación] |
| Riesgo de límite de documento (1 MiB) | Ninguno — Charizard con todas sus cartas: ~10 KiB (ver análisis abajo) [Estimación] | Ninguno [Estimación] |
| Compatibilidad con esquema actual | Sí — campos legacy coexisten sin cambio [Dato] | No — requiere migración completa [Estimación] |
| Favoritos | Campo `favorite` en el documento existente [Estimación] | Subcolección separada adicional [Estimación] |

### 3.4 Análisis de tamaño de documento

Charizard (Pokémon #6) tiene aproximadamente 154 cartas en el catálogo [Dato: medido en `public/catalog/v1/6.json`]. Si el usuario marca todas:

```
154 cartas × ~64 bytes/entrada ≈ 9.9 KiB [Estimación]
```

El límite de Firestore es 1 MiB. El peor caso real medido no supera el 1% del límite [Estimación]. No hay riesgo práctico con Opción A+.

### 3.5 Impacto en lecturas por sesión

Con 300 cartas marcadas distribuidas en 200 Pokémon distintos, la carga inicial con Opción A+ es de 200 lecturas — idéntico al comportamiento actual [Estimación]. El esquema no empeora las lecturas respecto al estado hoy.

### 3.6 Impacto en escrituras por sesión

Con debounce de 1 segundo y agrupación por Pokémon, una sesión de 30 minutos marcando 20 cartas genera entre 15 y 20 escrituras [Estimación]. Trivial frente a las 20,000 escrituras/día gratuitas del plan Spark.

### 3.7 Función de adaptación `toDisplayState`

Esta función transforma el documento raw de Firestore en el estado de presentación que consumen todos los componentes actuales. Debe vivir en `src/hooks/usePokedexData.ts` y ser llamada desde el bloque de construcción de `collectionMap` en `PokedexDataContext.tsx` líneas 168–183 [Dato]:

```typescript
export interface CardEntry {
  copies: number;
  language: CardLanguage | null;
}

export function toDisplayState(raw: FirestoreDocData): CollectionDisplayState {
  const cards = (raw.cards ?? {}) as Record<string, CardEntry>;
  const hasCatalogCards = Object.keys(cards).length > 0;
  return {
    owned: hasCatalogCards || (raw.owned ?? false),
    variant: (raw.variant as Variant) ?? null,
    language: (raw.language as CardLanguage) ?? null,
    is_shiny: raw.is_shiny ?? false,
    is_promo: raw.is_promo ?? false,
    is_bulk: raw.is_bulk ?? false,
    bulk_quantity: raw.bulk_quantity ?? 0,
    cards,
    hasCatalogCards,
  };
}
```

La función maneja los tres estados posibles de un documento sin romper ningún consumidor existente (ver Sección 7.1).

---

## Sección 4 — Imágenes del panel principal

### 4.1 Pesos medidos y extrapolados

**Sprites pequeños** — `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{dexId}.png` (96×96 PNG):

| Métrica | Valor |
|---|---|
| Peso individual | 3–8 KB [Estimación] |
| Total para 1025 sprites | ~3–8.2 MB (punto medio ~5 MB) [Estimación] |

**Official artworks** — ya almacenados en el campo `sprite_url` de Firestore (475×475 PNG):

| Métrica | Valor |
|---|---|
| Peso individual | 25–80 KB [Estimación] |
| Total para 1025 artworks | ~25–82 MB [Estimación] |

Los artworks son aproximadamente 10 veces más pesados que los sprites pequeños [Estimación]. Para el panel principal (1025 tarjetas en grid), los artworks son excesivos.

### 4.2 Comparativa de estrategias para los sprites del panel

**(a) Hotlink directo a `raw.githubusercontent.com`**

- El dominio ya está en `img-src` de la CSP (`next.config.mjs:7`) y en `remotePatterns` [Dato].
- Para sprites pequeños, la URL es solo un cambio de path respecto al artwork; el dominio es idéntico [Dato].
- No hay rate limit documentado públicamente para imágenes individuales desde este dominio [Suposición].
- El repositorio PokeAPI/sprites desaconseja explícitamente hotlinkear si se usan todos los sprites [Suposición — verificar README del repo `PokeAPI/sprites` antes de implementar].
- Riesgo: si GitHub modifica la URL o bloquea el tráfico, la app queda sin imágenes [Suposición].
- **Veredicto:** viable en desarrollo; no recomendable en producción permanente.

**(b) Alojar sprites pequeños en `public/sprites/`**

- Peso estimado de 1025 sprites: ~5 MB [Estimación].
- El catálogo estático ya ocupa ~7.3 MiB en git [Dato: métricas de `catalogo-etl.md`].
- Total del repositorio con sprites añadidos: ~12.3 MB [Estimación] — manejable para git y muy por debajo del límite de despliegue de Vercel [Estimación — verificar en vercel.com/docs/limits antes de desplegar].
- Official artworks (~50 MB estimados) [Estimación] son excesivos para git; se descartan para el panel.
- Vercel Hobby incluye un límite de Fast Data Transfer mensual [Estimación — verificar cifra exacta en vercel.com/docs/limits]. Una carga completa del grid (~5 KB × 1025 sprites) ≈ 5 MB; con 2 usuarios el impacto es negligible [Estimación].
- Vercel sirve `public/` desde CDN edge con caché automática [Dato].
- **Veredicto: técnicamente sólido; elimina dependencias externas.** Los artworks en Firestore (`sprite_url`) se mantienen para el modal de detalle de cada Pokémon.

### 4.3 Estrategia recomendada

Descargar los 1025 sprites pequeños una vez mediante un script Python o Node, alojarlos en `public/sprites/{dexId}.png` y referenciarlos con `/sprites/{dexId}.png` desde las tarjetas del panel. Los artworks existentes en `sprite_url` siguen usándose en el modal.

### 4.4 Silueta gris (Pokémon sin cartas marcadas)

El efecto de silueta se consigue en CSS puro, sin archivos extra:

```css
filter: brightness(0) opacity(0.35);
```

`brightness(0)` convierte todos los píxeles opacos a negro puro respetando el canal alpha del PNG. `opacity()` da el tono gris. Nota: `grayscale(1)` no produce silueta — solo desatura la imagen; no es el filtro correcto para este efecto [Estimación].

---

## Sección 5 — Rendimiento del catálogo

### 5.1 Catálogo estático

El catálogo en `public/catalog/v1/` contiene un fichero JSON por Pokémon con todas sus cartas TCGdex. Totales [Dato]:

- 17,995 cartas en inglés
- 11,989 cartas en español
- 32 rarezas distintas

El catálogo se carga desde el cliente con `fetch('/catalog/v1/{dexId}.json')`, sin API route intermediaria [Dato: Next.js sirve `public/` de forma estática].

### 5.2 Los 10 ficheros más grandes del catálogo

| Archivo | Bytes | Pokémon | Razón del tamaño |
|---|---|---|---|
| `25.json` | 95,709 | Pikachu | Más formas y variantes que ningún otro (gorras de eventos, starter, cosplay…) [Dato] |
| `6.json` | 49,867 | Charizard | Muchas cartas históricas; Mega X, Mega Y, Gigantamax [Dato] |
| `150.json` | 39,137 | Mewtwo | Popular; Mega X y Mega Y; aparece en todos los sets [Dato] |
| `133.json` | 38,601 | Eevee | Alta frecuencia en sets temáticos de Eeveelutions [Dato] |
| `448.json` | 28,338 | Lucario | Mega Lucario; popular en muchos sets [Dato] |
| `26.json` | 28,300 | Raichu | Raichu de Alola; muchas cartas históricas [Dato] |
| `52.json` | 27,847 | Meowth | Formas de Alola, Galar y Gigantamax [Dato] |
| `201.json` | 26,370 | Unown | 28 letras × múltiples sets [Dato] |
| `282.json` | 26,246 | Gardevoir | Mega Gardevoir; aparece en muchas eras [Dato] |
| `151.json` | 25,283 | Mew | Icónico; set dedicado "Pokémon 151"; aparece en todos los sets clásicos [Dato] |

### 5.3 Estrategia de caché del catálogo en Vercel

Vercel sirve `public/` con `Cache-Control: public, max-age=0, must-revalidate` por defecto [Dato]. Para el catálogo estático, que no cambia entre releases, se recomienda añadir la siguiente configuración en `next.config.mjs` o `vercel.json`:

```json
{
  "source": "/catalog/v1/(.*)",
  "headers": [{
    "key": "Cache-Control",
    "value": "public, max-age=31536000, immutable"
  }]
}
```

Cuando los datos del catálogo cambien, subir `POKEMON_DATA_VERSION` en `src/lib/constants.ts` invalida la caché de sessionStorage del contexto — mecanismo ya existente [Dato: CLAUDE.md sección 16]. Para la caché del navegador/CDN, el versionado del path (o un query param) es la estrategia complementaria [Estimación].

### 5.4 Carga diferida de imágenes de cartas

Para la pantalla de cartas de un Pokémon se recomienda el atributo `loading="lazy"` nativo en `<img>` [Estimación]. Tiene soporte universal en Chrome, Firefox, Edge y Safari [Dato] y no requiere código adicional frente a un Intersection Observer manual (~15–30 líneas de ciclo de vida por componente).

Para cartas sin imagen (`image: ""`en el catálogo), el placeholder recomendado es un rectángulo con proporciones de carta TCG (63 mm × 88 mm, ratio 5:7), fondo `bg-zinc-800`, icono central y texto con `setName` y `rarity` — ambos campos siempre presentes aunque `image` esté vacío [Dato]. El mismo placeholder se muestra en el evento `onError` cuando la URL devuelve 404 [Estimación].

El sprite del Pokémon no debe usarse como placeholder de carta — confundiría la imagen del panel principal con la imagen de la carta del catálogo [Estimación].

### 5.5 Cambios necesarios en la CSP

La CSP actual en `next.config.mjs:7` [Dato]:

```
img-src 'self' data: blob: https://raw.githubusercontent.com
```

CSP propuesta (cambio bloqueante antes de producción):

```
img-src 'self' data: blob: https://raw.githubusercontent.com https://assets.tcgdex.net
```

Sin este cambio, las imágenes de cartas de TCGdex son bloqueadas por la política CSP en producción. Si se usa el componente `<Image>` de Next.js para las cartas, añadir también en `remotePatterns` de `next.config.mjs`:

```js
{ protocol: 'https', hostname: 'assets.tcgdex.net' }
```

`connect-src` no requiere cambios si el cliente solo carga imágenes de TCGdex y no hace `fetch` directo a su API [Estimación].

---

## Sección 6 — UX y filtros

### 6.1 Pantallas y estados

#### Panel principal `/pokedex` — modificaciones al existente

| Estado de tarjeta | Presentación |
|---|---|
| Sin cartas marcadas | Silueta gris con `filter: brightness(0) opacity(0.35)` [Estimación] |
| Con ≥1 carta marcada | Sprite en color + badge numérico con el número de `card_id`s distintos (no copias totales) [Estimación] |
| `favorite === true` | Icono de favorito visible en la tarjeta [Estimación] |
| Cargando | Skeleton existente; añadir círculo gris en esquina para el badge [Estimación] |

El grid muestra actualmente ~1215 entradas (1025 especies base + ~190 formas especiales — Mega, Gigantamax, Regionales), porque `filteredPokemon` itera sobre todos los Pokémon sin excluir `is_special_form` cuando `categoryFilter === ""` [Dato — verificado en `pokedex/page.tsx:148–170`]. Ver decisión D7 en la Sección 9.

#### Pantalla de cartas de un Pokémon — nueva ruta `/pokedex/{dexId}`

| Estado | Presentación |
|---|---|
| Normal | Cabecera con sprite + nombre + número + tipos del contexto; contador «X/Y cartas»; grid de tarjetas del catálogo con imagen, `setName` y rareza como badge [Estimación] |
| Carta marcada | Imagen en color + badge de copias + badge de idioma [Estimación] |
| Carta no marcada | Imagen en gris desaturado [Estimación] |
| Cargando | Skeleton de rectángulos en proporciones de carta TCG (ratio 5:7) [Estimación] |
| Sin cartas en catálogo | «No hay cartas catalogadas para este Pokémon todavía.» + botón de regreso [Estimación — caso raro en producción] |

La navegación de regreso usa `router.back()` para preservar la posición del scroll en el grid [Estimación].

#### Modal / detalle de carta

- **Móvil:** bottom sheet [Estimación — coherente con sección 5.8 de CLAUDE.md].
- **Escritorio:** modal centrado [Estimación — coherente con sección 5.8 de CLAUDE.md].
- No se propone una ruta dedicada `/carta/{id}` — el contexto visual del grid detrás aporta valor [Estimación].

| Estado de la carta | Contenido del modal |
|---|---|
| No marcada | Imagen grande, set, rareza, variantes disponibles (solo las con `variants.X === true`), serie/era derivada del `setId`. Botón «¡La tengo!» [Estimación] |
| Marcada | Todo lo anterior + selector de idioma + stepper de copias (mínimo 1, debounce 1000 ms) + botón «Quitar de mi colección» con confirmación inline [Estimación] |

Cierre del modal: botón ×, tap en backdrop, tecla Escape, swipe down en móvil [Estimación].

#### Menú contextual (tap en tarjeta del panel principal)

Propuesta: `shadcn/ui Popover` compacto anclado a la tarjeta — no un bottom sheet, que es excesivo para 2–3 acciones [Estimación]. Un solo componente para móvil y escritorio, sin detección de tipo de dispositivo [Dato: shadcn/ui disponible en el stack].

Contenido propuesto:
- «Ver cartas» → navega a `/pokedex/{dexId}` [Estimación]
- Toggle «Favorito» (persistido en Firestore) [Estimación]
- «Ver mis cartas (X)» opcional cuando hay cartas marcadas [Estimación]

Cierre: tap fuera del popover, tecla Escape, scroll del grid.

### 6.2 Filtros viables con los datos reales del catálogo

| Filtro | Campo del catálogo | Valores | Control UI | Ejecución |
|---|---|---|---|---|
| Estado | Ninguno (cruza catálogo + colección del usuario) | Todas / Las tengo / Me faltan | 3 chips, selección única | 100% cliente [Dato] |
| Colección/Set | `setName` [Dato] | Discretos; dependen del Pokémon (hasta ~40 en Pikachu) | Select desplegable | 100% cliente |
| Rareza | `rarity` [Dato] | Hasta 32 globales; 3–8 por Pokémon [Estimación] | Select con 5 grupos (ver 6.3) | 100% cliente |
| Idioma | Para ES: el bloque `es` del JSON de catálogo indica si la carta tiene edición en español — es un dato derivado del catálogo [Dato: estructura de `1.json` confirmada]. Para EN/ZH/KO/JA/Otros: no está en el catálogo; es atributo que el usuario asigna al marcar la carta [Dato]. Ver D6 en Sección 9 | EN / ES / ZH / KO / JA / Otros | Chips, selección múltiple | 100% cliente |
| Serie/Era | `setId`, prefijo hasta el primer dígito [Dato] | Véase tabla de prefijos abajo | Chips scroll o select | 100% cliente |
| Variante de carta | `variants` — objeto booleano: `normal` / `holo` / `reverse` / `firstEdition` / `wPromo` [Dato] | 5 claves; multi-selección | Chips; solo las variantes presentes en ese Pokémon | 100% cliente |

Todos los filtros se aplican íntegramente en el cliente. No se requieren queries adicionales a Firestore ni cambios de índices.

**Nota sobre idioma de cartas:** cada JSON del catálogo tiene dos arrays de primer nivel: `en` y `es`. Una carta en el bloque `es` significa que fue editada en español [Dato — verificado en `public/catalog/v1/1.json`]. No hay bloques `zh`, `ko`, `ja` en el catálogo local; para otros idiomas el único dato disponible es el atributo `language` que el usuario asigna manualmente al marcar su carta. Ver D6 en Sección 9 para la decisión sobre qué filtro(s) implementar.

**Tabla de prefijos de serie (`setId` → nombre):**

| Prefijo | Serie |
|---|---|
| `sv` | Scarlet & Violet |
| `swsh` | Sword & Shield |
| `sm` | Sun & Moon |
| `xy` | XY |
| `bw` | Black & White |
| `dp` | Diamond & Pearl |
| `pl` | Platinum |
| `ex` | EX Series |
| `ecard` | E-Card |
| `neo` | Neo |
| `gym` | Gym Heroes / Challenge |
| `base` | Base Set |
| `me` | Mega Evolution |
| `pop` | POP Series |
| `lc` | Legendary Collection |
| `det1` | Detective Pikachu |

### 6.3 Etiquetado y agrupación de rarezas

La agrupación de rarezas para el filtro está pendiente de confirmación con Brayan (ver D5 en Sección 9). Las 32 rarezas brutas del catálogo y su correspondencia con WikiDex están documentadas en `public/catalog/v1/rarities.json` [Dato].

**Rarezas sin traducción al español (7):** None, Shiny rare, Classic Collection, Shiny Ultra Rare, Shiny rare V, Shiny rare VMAX, RGB Rare [Dato]. Para estas rarezas se muestra el nombre inglés de TCGdex con un indicador visual (asterisco o etiqueta «EN») [Estimación]. No se inventan traducciones: «Shiny rare» tiene significado técnico específico en el TCG.

**Rareza `"None"`:** se muestra como «—» en la tarjeta y como «Sin rareza» en el filtro [Estimación].

### 6.4 Tarjetas sin imagen (`image: ""`)

Cuando el campo `image` del catálogo está vacío, el placeholder recomendado es:

- Rectángulo con `aspect-ratio: 5/7` (proporciones físicas de carta TCG)
- Fondo `bg-zinc-800`
- Icono centrado
- Texto con `setName` y `rarity` — ambos campos siempre presentes aunque `image` esté vacío [Dato]

No usar el sprite del Pokémon como placeholder. En una pantalla con varias cartas del mismo Pokémon, usar el sprite causaría confusión visual entre la imagen del panel principal y las imágenes de cartas del catálogo [Estimación].

### 6.5 Accesibilidad básica (WCAG AA)

El color gris de la silueta no puede ser el único indicador de estado — viola WCAG 1.4.1 (uso del color). Indicadores adicionales propuestos [Estimación]:

- Ausencia del badge numérico en tarjetas sin cartas
- En la pantalla de cartas, overlay semitransparente + badge de texto con las copias como indicador de estado

| Elemento | Atributo `alt` propuesto |
|---|---|
| Imagen de carta | `"[name] - [setName] - [rarity]"` [Dato: campos disponibles en catálogo] |
| Silueta sin cartas | `"[nombre] [número] - sin cartas marcadas"` [Estimación] |
| Sprite con cartas | `"[nombre] [número] - [N] cartas marcadas"` [Estimación] |

Focus trap en el modal: shadcn/ui Dialog lo incluye de forma nativa [Dato: shadcn/ui en el stack].

Roles ARIA para los filtros [Estimación]:
- Filtros de selección única: `role="radiogroup"` + `role="radio"`
- Filtros de selección múltiple: `role="group"` + `role="checkbox"`

### 6.6 Responsive

El layout de la pantalla de cartas sigue el mismo patrón responsive establecido en CLAUDE.md sección 5.8 [Dato].

| Viewport | Columnas en el grid de cartas | Filtros |
|---|---|---|
| Móvil (<640 px) | 2 columnas [Estimación] | Chips scroll horizontal; botón «Más filtros» abre bottom sheet [Estimación] |
| Tablet (640–1023 px) | 3 columnas [Estimación] | — |
| Escritorio (≥1024 px) | 4–5 columnas [Estimación] | Barra horizontal completa sin scroll [Estimación] |
| Pantalla grande (≥1280 px) | 5–6 columnas [Estimación] | — |

Proporción de tarjeta en CSS: `aspect-ratio: 5/7` [Estimación]. El menú contextual usa `shadcn/ui Popover` en todos los viewports, sin lógica de detección de tipo de dispositivo [Dato: shadcn/ui en stack; Estimación: un solo componente].

---

## Sección 7 — Convivencia con datos existentes

### 7.1 Tres estados posibles de un documento de colección

Con el nuevo esquema, un documento en `/users/{uid}/collection/{pokemonSlug}` puede estar en uno de tres estados:

| Estado | Tiene `variant` | Tiene `cards` | Origen |
|---|---|---|---|
| A | Sí | No | Documento creado con el esquema actual (hoy) |
| B | No | Sí | Documento creado con el nuevo sistema |
| C | Sí | Sí | Documento actualizado parcialmente durante la transición |

La función `toDisplayState()` (ver Sección 3.7) maneja los tres estados. El contexto sigue exponiendo los mismos campos que hoy (`owned`, `is_shiny`, etc.) — todos los consumidores existentes continúan funcionando sin cambio [Dato: los componentes desestructuran solo los campos que necesitan].

### 7.2 Impacto en el Dashboard

El Dashboard calcula `variantStats` en `dashboard/page.tsx:103–114` iterando sobre `pokemon.filter(p => p.owned)` y contando por `p.variant`. Con el nuevo esquema, las cartas marcadas únicamente con el campo `cards` tendrán `variant === null` y no aparecerán en ningún contador de variante [Dato].

Corrección mínima recomendada: actualizar únicamente el contador «Colección Total» para que use el `owned` derivado de `toDisplayState`. Es un cambio de una línea en `dashboard/page.tsx` [Estimación]. La decisión de reemplazar los contadores de variante por contadores de rareza queda para una sesión futura, una vez que la nueva pantalla esté validada.

### 7.3 Migración de datos

No es necesaria ninguna migración. Los documentos con `variant` son documentos Firestore válidos bajo el nuevo esquema. Una migración formal no sería significativa: el campo `variant` no contiene información suficiente para identificar qué `card_id` específica tenía el usuario [Estimación]. La coexistencia indefinida de los dos formatos es la estrategia recomendada.

### 7.4 El campo `owned` derivado

Ninguna query de Firestore en el código actual filtra por `owned` en el servidor. Todas son `getDocs` sin cláusula `where` sobre `owned`, verificado en `PokedexDataContext.tsx:136` [Dato]. El campo `owned` puede derivarse íntegramente en el cliente mediante `toDisplayState`:

```
owned = hasCatalogCards || legacyOwned
```

No es necesario escribir el campo `owned` en Firestore para los documentos nuevos.

---

## Sección 8 — Plan por fases

### 8.1 Resumen del esfuerzo

| Fase | Días | Resultado |
|---|---|---|
| A | 3 [Estimación] | Panel funcional + favoritos |
| B | 2 [Estimación] | Visualización completa del catálogo con filtros |
| C | 3 [Estimación] | Marcado de cartas individuales y gestión de copias |
| D | 1 [Estimación] | Consistencia con datos existentes y bump de versión |
| **Total** | **9** [Estimación] | **MVP del selector de cartas** |

### 8.2 Fase A — Panel con siluetas, favoritos y ruta shell

**Entregables:**
- Script `scripts/download_sprites.py` (idempotente): descarga los 1025 sprites 96×96 en `public/sprites/{dexId}.png`
- Panel principal actualizado: sprites pequeños, CSS silueta para Pokémon sin cartas marcadas, badge numérico de cartas, icono de favorito en tarjeta
- Menú contextual (Popover) en tarjeta: «Ver cartas» / toggle «Favorito» / «Ver mis cartas (X)»
- `toDisplayState` integrada en el contexto; campo `favorite` en `PokemonWithStatus`; `updateFavorite` en `PokedexDataContext`
- Ruta shell `/pokedex/[dexId]` — cabecera + skeleton, sin lógica de catálogo todavía
- CSP actualizada: `https://assets.tcgdex.net` añadido a `img-src` y `remotePatterns`
- Reglas Firestore con `validCollectionDoc()` preparadas en `firestore.rules` (sin desplegar)

**Archivos afectados:**

| Archivo | Tipo de cambio |
|---|---|
| `scripts/download_sprites.py` | Nuevo (externo a `src/`) |
| `src/app/(protected)/pokedex/[dexId]/page.tsx` | Nuevo — ruta shell |
| `src/hooks/usePokedexData.ts` | Nuevos tipos + `toDisplayState` + `favorite` en `PokemonWithStatus` |
| `src/context/PokedexDataContext.tsx` | Usar `toDisplayState`; añadir `updateFavorite` |
| `src/components/PokemonCard.tsx` | Sprites pequeños + CSS silueta + menú contextual + icono favorito |
| `src/lib/i18n/es.ts` y `en.ts` | Nuevas claves de traducción |
| `next.config.mjs` | Añadir `https://assets.tcgdex.net` a `img-src` y `remotePatterns` |
| `firestore.rules` | Añadir `validCollectionDoc()` (preparación, sin desplegar) |

**Criterios de listo:**
- Script descarga 1025 sprites y omite los ya existentes en disco
- `PokemonCard` muestra silueta gris (`filter: brightness(0) opacity(0.35)`) para Pokémon sin cartas
- Tap en tarjeta abre el menú contextual (Popover); «Ver cartas» navega a `/pokedex/{dexId}`
- Favorito persiste en Firestore y se refleja en el icono de la tarjeta
- `toDisplayState` devuelve `owned: true` para documentos que solo tienen `variant`
- Sin regresión en el grid, el modal existente ni el Dashboard
- `npm run build` pasa sin errores con la nueva CSP

**Dependencias:** ninguna.

**Nota técnica:** la ruta `/pokedex/[dexId]` coexiste con la ruta `/pokedex` (listado) sin conflicto en Next.js App Router. El guard de sesión del layout `(protected)` se hereda sin modificaciones. Confirmar que el grupo de rutas `(protected)` no tiene restricciones de nombrado que choquen con segmentos dinámicos `[dexId]` antes de implementar [Estimación].

### 8.3 Fase B — Pantalla de cartas y filtros

**Entregables:** imágenes reales de cartas desde `card.image` del catálogo; filtros (Estado, Rareza, Set, Serie, Variante); badge «tengo esta» en tarjetas ya marcadas; contador X/Y.

**Archivos de `src/` afectados:**

| Archivo | Tipo de cambio |
|---|---|
| `src/app/(protected)/pokedex/[dexId]/page.tsx` | Ampliar |
| `src/components/CardThumbnail.tsx` | Nuevo componente |
| `src/lib/i18n/es.ts` y `en.ts` | Nuevas claves |

**Dependencias:** Fase A completa.

### 8.4 Fase C — Detalle de carta, marcado y copias

**Entregables:** modal de carta (`CardDetailModal`); toggle «tengo esta carta»; stepper de copias; selector de idioma por carta; función `updateCardEntry(slug, cardId, entry | null)` en el contexto.

**Archivos de `src/` afectados:**

| Archivo | Tipo de cambio |
|---|---|
| `src/context/PokedexDataContext.tsx` | Añadir `updateCardEntry` |
| `src/app/(protected)/pokedex/[dexId]/page.tsx` | Integrar modal |
| `src/components/CardDetailModal.tsx` | Nuevo componente |
| `src/lib/i18n/es.ts` y `en.ts` | Nuevas claves |

**Nota de implementación crítica:** para eliminar una entrada del mapa `cards` en Firestore, **no** usar `setDoc` con `merge: true` y `deleteField()` dentro del objeto `cards` — no elimina claves de un mapa anidado [Dato].

Adicionalmente, algunos `card_id` contienen puntos (ej. `"sv03.5-001"`). La notación de plantilla `` { [`cards.${cardId}`]: deleteField() } `` los interpreta como separadores de ruta de campo, lo que apuntaría a una ruta incorrecta. En esos casos, usar `FieldPath` con segmentos separados [No puedo confirmar esto sin prueba en emulador — requiere verificación antes de la Fase C]:

```typescript
import { FieldPath, deleteField, updateDoc } from 'firebase/firestore';

// Para card_ids sin puntos (ej. "base1-44") — notación de punto funciona:
await updateDoc(ref, { [`cards.${cardId}`]: deleteField() });

// Para card_ids con puntos (ej. "sv03.5-001") — usar FieldPath:
await updateDoc(ref, new FieldPath('cards', cardId), deleteField());
```

Verificar en el emulador de Firestore con un `card_id` que contenga un punto antes de dar por válida esta implementación.

**Dependencias:** Fase B completa.

### 8.5 Fase D — Verificación de convivencia y cierre

**Entregables:** test manual de los tres estados de documento (A, B, C); corrección del contador «Colección Total» en Dashboard; verificación de filtros de ownership en `/pokedex`; bump de versión a `APP_VERSION 1.2.0`.

**Archivos de `src/` afectados:**

| Archivo | Tipo de cambio |
|---|---|
| `src/app/(protected)/dashboard/page.tsx` | Corregir total en `variantStats` |
| `src/app/(protected)/pokedex/page.tsx` | Verificar filtros de ownership |
| `src/lib/constants.ts` | Bump `APP_VERSION` a `1.2.0` |

**Dependencias:** Fase C. Puede ejecutarse en paralelo con Fase A si se prioriza la compatibilidad con datos existentes desde el inicio.

### 8.6 Riesgos

**R1 — Caché del catálogo estático en Vercel** [Dato parcial]

Sin `Cache-Control: immutable` en Vercel para `/catalog/v1/`, cada navegación a `/pokedex/{dexId}` hace una revalidación al servidor aunque el archivo no haya cambiado. Mitigación: añadir la cabecera en `next.config.mjs` (ver Sección 5.3). Es una línea de configuración.

**R2 — `deleteField()` en mapas anidados + `card_id` con puntos** [Dato parcial]

`setDoc(..., { cards: { "sv03.5-001": deleteField() } }, { merge: true })` no elimina la clave del mapa — el error es silencioso [Dato]. Además, `card_id` como `"sv03.5-001"` contiene un punto: la notación de plantilla `` `cards.${cardId}` `` generaría la ruta `"cards.sv03.5-001"`, que Firestore interpreta como tres niveles anidados (`cards` → `sv03` → `5-001`). Usar `FieldPath` con segmentos separados para esos casos [No puedo confirmar esto sin prueba en emulador]. Ver nota de implementación en Fase C.

**R3 — Tamaño de documento en Pokémon muy populares** [Estimación]

Charizard (peor caso real medido: ~154 cartas en catálogo) con todas marcadas: ~10 KiB. Límite Firestore: 1 MiB. Sin riesgo práctico.

**R4 — Modal antiguo (`PokemonModal`) no limpia `cards` al desmarcar `owned`** [Dato]

Si el usuario desmarca `owned` desde el modal antiguo, `updatePokemonStatus` escribe `owned: false` pero no limpia `cards`. `toDisplayState` devolverá `owned: true` porque `hasCatalogCards` sigue siendo verdadero. Mitigación: en Fase D, añadir en `updatePokemonStatus` un guard que cuando `owned === false` también escriba `cards: {}`.

**R5 — Verificar compatibilidad de ruta dinámica `[dexId]` en el grupo `(protected)`** [Estimación]

La ruta `/pokedex/[dexId]` hereda el guard de sesión del layout sin modificaciones. Confirmar antes de implementar que el grupo de rutas `(protected)` no tiene restricciones de nomenclatura que choquen con segmentos dinámicos.

**R6 — CSP no se aplica en entorno de desarrollo** [Dato]

El servidor de desarrollo de Next.js (`npm run dev`) no aplica los headers definidos en `next.config.mjs`. Las imágenes de `assets.tcgdex.net` se cargarán sin restricción en desarrollo aunque la CSP esté mal configurada, enmascarando errores de producción. Verificar la CSP en `npm run build && npm run start` (o en un Preview de Vercel) antes de declarar el cambio como válido.

**R7 — `Cache-Control: immutable` para el catálogo** [Estimación]

Si se configura `max-age=31536000, immutable` para `/catalog/v1/`, los usuarios verán la versión antigua durante hasta 1 año si hay un error en el catálogo — el navegador no revalidará. Mitigación: combinar con un query param o versionado de path (`?v=2`) para poder forzar revalidación cuando sea necesario, o mantener un `max-age` más corto sin `immutable` hasta que el catálogo sea estable.

**R8 — Contraste de la silueta (WCAG AA)** [Estimación]

`filter: brightness(0) opacity(0.35)` sobre un fondo oscuro produce un gris cuyo ratio de contraste no ha sido medido. WCAG 1.4.3 exige ratio ≥ 3:1 para componentes de interfaz gráfica no textuales. Medir con una herramienta de contraste (ej. Chrome DevTools o Colour Contrast Analyser) antes de la Fase A para confirmar que el valor de `opacity` elegido cumple el umbral, o ajustarlo si no lo hace.

### 8.7 Seguridad

**Cambio bloqueante antes de producción — CSP:** añadir `https://assets.tcgdex.net` a `img-src` en `next.config.mjs:7`. Sin este cambio, las imágenes del catálogo son bloqueadas por la política CSP en producción (ver Sección 5.5).

**Reglas Firestore propuestas:** las reglas actuales cubren estructuralmente el campo `cards` porque es un mapa en el mismo documento, no una subcolección. Se propone añadir validación mínima de tipos con una función auxiliar:

```
function validCollectionDoc(data) {
  return data.owned is bool
    && (!('cards' in data) || data.cards is map)
    && (!('favorite' in data) || data.favorite is bool)
    && (!('bulk_quantity' in data) || (data.bulk_quantity is number && data.bulk_quantity >= 0))
    && (!('is_bulk' in data) || data.is_bulk is bool)
    && (!('is_shiny' in data) || data.is_shiny is bool)
    && (!('is_promo' in data) || data.is_promo is bool);
}
```

Aplicar como condición adicional en la regla `allow write` de `/collection/{pokemonSlug}`. La función no usa `get()`, por lo que no añade lecturas adicionales.

El campo `favorite` vive en el documento de `/collection/{pokemonSlug}`, no en una subcolección separada. Las reglas existentes ya lo cubren sin cambios.

El catálogo en `public/catalog/v1/` contiene solo datos de cartas TCG públicos. No hay datos de usuario. No es necesario protegerlo con autenticación.

---

## Sección 9 — Decisiones pendientes para Brayan

Las siguientes decisiones requieren confirmación antes de comenzar la implementación. Cada una incluye una recomendación por defecto para desbloquear el desarrollo si no hay preferencia explícita.

**D1 — ¿El modal antiguo coexiste con la nueva pantalla o se reemplaza?**

- Opción A: mantenerlo. Tap en tarjeta del grid → modal antiguo (comportamiento actual). Dentro del modal, botón «Ver cartas» → navega a `/pokedex/{dexId}`.
- Opción B: reemplazarlo. Tap en tarjeta del grid → navega directamente a `/pokedex/{dexId}`.
- **Recomendación por defecto durante Fases A–C:** opción A; deprecar el modal antiguo cuando la nueva pantalla esté validada.

**D2 — ¿Qué idioma de carta se pre-selecciona en el nuevo modal de detalle?**

- Opción A: pre-seleccionar el idioma activo de la app en el momento de abrir el modal (si está en ES, pre-selecciona ES).
- Opción B: no pre-seleccionar; el usuario elige siempre.
- **Recomendación por defecto:** opción A.

**D3 — ¿`is_shiny` e `is_promo` se mantienen a nivel de Pokémon o se mueven a nivel de carta?**

Moverlos a `cards[id].is_shiny` sería más preciso pero requiere más cambios y afecta al Dashboard.
- **Recomendación por defecto:** mantenerlos en el documento raíz por ahora; granularidad por carta en fase futura si se necesita.

**D4 — ¿La nueva pantalla sustituye el flujo principal o es accesoria?** (equivalente a D1, formulado desde la perspectiva del flujo)

- Opción A: tap en tarjeta → `/pokedex/{dexId}` como destino principal.
- Opción B: tap en tarjeta → modal antiguo; «Ver cartas» dentro del modal → `/pokedex/{dexId}`.
- **Recomendación por defecto:** opción B. Menos disruptivo y permite validar la nueva pantalla antes de comprometerse a cambiar el flujo principal.

**D5 — ¿Cómo se agrupan las 32 rarezas para el filtro?**

La agrupación original en 5 grupos fue eliminada del documento por ser una estimación no validada. Las 32 rarezas brutas están en `rarities.json`. Brayan debe definir los grupos que reflejen su experiencia de coleccionista antes de la Fase B. Sin confirmación, el filtro de rareza se implementará sin agrupación (lista plana de las rarezas presentes en el Pokémon seleccionado).

**D6 — ¿Qué hace exactamente el filtro de idioma? (dos conceptos distintos)**

Los JSONs del catálogo tienen dos arrays separados: `en` y `es`. La presencia de una carta en el bloque `es` significa que fue editada en español [Dato — verificado en `public/catalog/v1/1.json`]. Los idiomas ZH, KO, JA, Otros **no** están en el catálogo; son solo atributos que el usuario asigna al marcar su carta.

Esto da lugar a dos filtros de distinta naturaleza:

- **«Disponible en español»**: filtra el catálogo mostrando solo las cartas que existen en el bloque `es` — opera sobre datos del catálogo, sin necesidad de que el usuario haya marcado nada.
- **«Mis cartas en idioma X»**: filtra la colección del usuario mostrando las cartas marcadas con `cards[id].language === "es"` (u otro idioma) — opera solo sobre las cartas que el usuario ya tiene marcadas.

**Opciones:**
- Opción A: implementar ambos filtros — «Disponible en ES» (catálogo) y «Mis cartas en idioma X» (colección).
- Opción B: implementar solo el filtro de colección del usuario («¿en qué idioma tengo esta carta?»), que es el caso de uso principal de coleccionista.
- **Recomendación por defecto:** Opción B — más simple y directamente útil. Añadir el filtro de «disponible en ES» en una iteración posterior si se necesita.

---

**D7 — ¿Cómo gestiona el grid los ~1215 Pokémon actuales (1025 base + ~190 formas)?** ✅ RESUELTA

El grid actual muestra las formas especiales (Mega, Gigantamax, Regionales) como fichas independientes junto a las especies base [Dato — verificado en `pokedex/page.tsx:148–170`]. El catálogo TCGdex está indexado por `dexId` (número nacional), no por slug. Existen tres estrategias posibles:

- **Opción A — Un dexId, una ficha**: el grid siempre muestra exactamente 1025 fichas (una por dexId). Las formas especiales de un Pokémon se acceden desde su ficha principal (dentro de `/pokedex/{dexId}`). Requiere restructurar el grid actual y cambiar el punto de entrada para las formas.
- **Opción B — Mantener el grid actual (~1215 fichas)**: formas y base son fichas independientes en el grid. La nueva pantalla `/pokedex/{dexId}` muestra las cartas del dexId del Pokémon base. Las formas no tienen pantalla de cartas propia (su `dexId` es el mismo que la base).
- **Opción C — Grid híbrido**: base + formas en el grid; cada forma tiene su propia ficha; la ruta sería `/pokedex/{dexId}` para base y `/pokedex/{dexId}/forma/{formType}` para formas (introduce complejidad de rutas).

**Recomendación:** Opción A. El catálogo está organizado por `dexId`, y la Pokédex Nacional tiene 1025 números. Un dexId = una ficha = una pantalla de cartas es el modelo más coherente con el catálogo. El coste es refactorizar el grid una vez.

**Implicación en la implementación:** si se elige la Opción A, el grid debe filtrarse a `basePokemon` (`form_type === null`) antes de proceder con la Fase A. Si se elige la Opción B o C, la Fase A puede proceder sin cambios en el grid.

---

**D8 — ¿`is_bulk` y `bulk_quantity` se mantienen a nivel de Pokémon o se mueven a nivel de carta?**

Actualmente `is_bulk` y `bulk_quantity` son campos raíz del documento de colección (nivel Pokémon). Con el nuevo sistema de `cards`, podría tener sentido indicar qué carta concreta está en bulk.

- **Opción A (recomendada):** mantenerlos a nivel de Pokémon. El bulk es "tengo copias sobrantes de alguna carta de este Pokémon" — su granularidad actual es suficiente para la pantalla `/bulk` y el sistema de exportación/importación.
- **Opción B:** mover a nivel de carta — `cards[id].is_bulk = true`, `cards[id].bulk_quantity = N`. Más preciso pero añade complejidad al modal de carta y requiere actualizar la pantalla `/bulk`.

---

**D9 — ¿Qué muestra la UI cuando un documento tiene `owned: true`, `variant: "holo"` pero `cards: {}`?**

`toDisplayState` devuelve `owned: true` (porque `legacyOwned === true`) y `hasCatalogCards === false`. En el grid, el Pokémon se vería como "poseído" (sprite en color) pero sin badge de número de cartas. En la pantalla de cartas, el Pokémon aparecería como "sin cartas marcadas".

- **Opción A (recomendada):** aceptar esta inconsistencia temporal. El usuario verá el Pokémon con sprite en color pero badge vacío hasta que migre manualmente al sistema nuevo desde el modal. No se requiere ninguna acción técnica adicional.
- **Opción B:** mostrar un indicador visual diferenciado ("tienes este Pokémon con el sistema antiguo — migrar") que invite al usuario a actualizar al nuevo sistema.

---

### Decisiones confirmadas

| Decisión | Resolución |
|---|---|
| Esquema de datos | **Opción A+** — extensión del documento existente con `cards` + `favorite` [Dato] |
| Ruta de la nueva pantalla | **`/pokedex/[dexId]`** — dexId numérico, no slug [Dato] |
| D3 — Shiny/Promo | Mantener a nivel de Pokémon; granularidad por carta en fase futura [Recomendación aceptada] |
| D7 — Grid con formas | **Opción A** — grid muestra exactamente 1025 fichas (`form_type === null`); formas accesibles desde `/pokedex/{dexId}` [Dato: decisión confirmada] |
| owned/hasCatalogCards contract | owned mostrado = hasCatalogCards \|\| owned_legacy. No se puede desmarcar owned desde el modal si hasCatalogCards=true; requiere eliminar las cartas primero desde /pokedex/{dexId}. [Dato: implementado en PokemonModal.tsx handleToggleOwned] |

---

## Sección 10 — Estado de implementación por fases

### Estado global de fases

| Fase | Estado | Fecha de cierre |
|---|---|---|
| A — Panel con siluetas, favoritos y ruta shell | ✅ Completa | — |
| B — Pantalla de cartas y filtros | ✅ Completa | 2026-10-17 |
| C — Detalle de carta, marcado y copias | ✅ Completa | 2026-10-18 |
| D — Verificación de convivencia y cierre | Pendiente | — |

---

## Sección 10.A — Estado de Fase B (archivo)

**Fecha de cierre:** 2026-10-17
**Rama:** `feat/ui-selector-fase-b`

### 10.A.1 Entregables completados

| Archivo | Tipo de cambio |
|---|---|
| `src/app/(protected)/pokedex/[dexId]/page.tsx` | Ampliado — implementación completa (sustituye la ruta shell de Fase A) [Dato] |
| `src/components/CardThumbnail.tsx` | Nuevo componente [Dato] |
| `src/lib/rarities.ts` | Nuevo — mapping estático de 32 rarezas desde `rarities.json` [Dato] |
| `src/lib/i18n/es.ts` y `en.ts` | Claves nuevas bajo el namespace `cards` [Dato] |

### 10.A.2 Hallazgos verificados sobre el catálogo

| Hallazgo | Tipo |
|---|---|
| Campos de cada carta: `id`, `localId`, `name`, `setId`, `setName`, `rarity`, `image`, `variants` | [Dato] |
| No existe campo de fecha/release ni campo de forma en los documentos de carta | [Dato] |
| Formato de imagen: `{image}/high.jpg` → HTTP 200 `image/jpeg` (verificado con HEAD) | [Dato] |
| Formatos alternativos disponibles en el mismo path base: `/high.webp`, `/high.png`, `/low.jpg` | [Dato] |
| Cartas con `image: ""` en Pikachu (dexId 25): 48 de 232 | [Dato] |
| Pikachu (dexId 25): 232 cartas EN, 141 cartas ES | [Dato] |
| Ningún Pokémon tiene 0 cartas EN en los 1025 archivos del catálogo | [Dato] |

### 10.A.3 Formas en el catálogo — aclaración de diseño

El catálogo (`{dexId}.json`) no tiene campo de forma. Todas las cartas de un `dexId` aparecen mezcladas en un único array `en`. Las distinciones de forma (Mega, GX, VMAX, etc.) existen solo en el string `name` de la carta (p. ej. "Charizard-GX", "Charizard VMAX"). No hay campo `formType` estructurado. El catálogo modela ediciones de impresión TCG, no formas de especie Pokémon — no es posible agrupar por forma a partir de los datos del catálogo sin parsear el nombre. [Dato]

### 10.A.4 Orden de las cartas

No existe campo de fecha de lanzamiento en las entradas del catálogo. El orden de presentación en Fase B es el orden del array JSON tal como lo produce el script ETL (aproximadamente por `setId` dentro del historial de cada Pokémon). [Dato]

### 10.A.5 Rendimiento

232 cartas EN (Pikachu, caso más grande) con CSS grid y `loading="lazy"` nativo en `<img>` no presentan problema de render medible. No se requiere virtualización para Fase B. [Dato]

### 10.A.6 Decisiones tomadas en Fase B

| Decisión | Resolución |
|---|---|
| D5 — Agrupación de rarezas | Lista plana (rarezas presentes en ese Pokémon, sin agrupar) — valor por defecto indicado en Sección 9 [Dato] |
| D6 — Filtro de idioma | Toggle de vista EN/ES (modo de visualización), no filtro de ownership. No oculta cartas. Coherente con la especificación. [Dato] |
| Retry ante error de carga | `retryCount` en estado local dispara re-ejecución del `useEffect` — sin recarga de página [Dato] |
| `clearFilters()` | Llama a `router.replace(pathname)` para eliminar todos los `searchParams` de una vez [Dato] |

### 10.A.7 Correcciones de accesibilidad aplicadas

- Estado "poseída" añadido al `aria-label` de cada carta (antes era silencioso para lectores de pantalla) [Dato]
- `aria-hidden` en el badge visual de checkmark (evita doble anuncio) [Dato]
- `aria-disabled` redundante eliminado (el atributo nativo `disabled` es suficiente) [Dato]

---

## Sección 10.B — Estado de Fase C

**Fecha de cierre:** 2026-10-18
**Rama:** `feat/ui-selector-fase-b`

### 10.B.1 Entregables completados

| Archivo | Tipo de cambio |
|---|---|
| `src/lib/cards.ts` | Añadida interfaz `CardEntry` (fuente de verdad del tipo) y función `applyCardEntry(cards, cardId, entry\|null)` [Dato] |
| `src/hooks/usePokedexData.ts` | Re-exporta `CardEntry` desde `@/lib/cards`; añadidos campos `cards` y `hasCatalogCards` a `PokemonWithStatus`; `toDisplayState` actualizada para poblarlos [Dato] |
| `src/context/PokedexDataContext.tsx` | Añadida función `updateCardEntry(slug, cardId, entry\|null): void` con optimistic UI, debounce de 500 ms por slug y rollback en error de escritura [Dato] |
| `src/components/CardDetailModal.tsx` | Nuevo componente — bottom sheet en móvil / modal centrado en escritorio; imagen `{card.image}/high.webp`; control de copias +/−; selector de idioma ES/EN/Otro; cierre con Esc, clic en backdrop y botón ×; accesibilidad ARIA [Dato] |
| `src/components/CardThumbnail.tsx` | Prop `onClick?` añadida; eliminada prop `disabled`; eliminado dead re-export de `CatalogCard`/`MergedCard` [Dato] |
| `src/app/(protected)/pokedex/[dexId]/page.tsx` | Integrado `CardDetailModal`; corregida race condition en `setParam` con `pendingParamsRef` [Dato] |
| `src/lib/i18n/es.ts` y `en.ts` | 10 claves nuevas bajo `cards.*`: `decreaseCopies`, `increaseCopies`, `noCopies`, `languageLabel`, `langEs`, `langEn`, `langOther`, `close`, `copiesLabel`, `saveError` [Dato] |
| `scripts/test-card-filter.ts` | Casos C1–C5 para `applyCardEntry` (añadir, aumentar copias, eliminar, ID con punto, cambiar idioma) [Dato] |
| `scripts/test-fieldpath.ts` | Tests A–I en emulador local (`PROJECT_ID="demo-test"`): comportamiento de `FieldPath` vs `setDoc(merge:true)` para claves con punto, seguridad de claves hermanas, `deleteField()`, y fallback not-found. Todos PASS tras corregir la aserción del Test D en commit `7293f27` [Dato] |
| `firestore.rules` | `validCollectionDoc()` actualizada: cap de `cards.size() <= 500` (subido de 200 en commit `5067ef9`); helper `validCardEntry` eliminado como código muerto en commit `7ee6ff0` [Dato] |

### 10.B.2 Decisiones técnicas tomadas en Fase C

| Decisión | Resolución | Justificación |
|---|---|---|
| Estrategia de escritura a Firestore para `cards` | `updateDoc(ref, new FieldPath("cards", cardId), entry)` para añadir/actualizar; `updateDoc(ref, new FieldPath("cards", cardId), deleteField())` para eliminar; `setDoc({cards: cardsToWrite, updated_at: serverTimestamp()}, {merge:true})` como fallback not-found | El emulador (Test D) confirmó que `setDoc(merge:true)` **preserva** las claves hermanas del mapa — un write parcial no borra las entradas ausentes. Consecuencia: el enfoque de mapa completo via `setDoc merge:true` no puede usarse para eliminar claves; las cartas borradas sobrevivían al reload. La solución quirúrgica es `FieldPath + deleteField()` por clave. El fallback not-found usa `setDoc(merge:true)` para crear el documento con el mapa completo sin sobrescribir campos legacy (`owned`, `variant`, etc.) si el documento ya existía [Dato — commit `af0159d`, Test D] |
| Claves con punto en `card_id` (ej. `"sv03.5-001"`) | Resuelto por `FieldPath` con segmentos separados: `new FieldPath("cards", "sv03.5-001")` | La notación de string `` `cards.${cardId}` `` en `updateDoc` interpreta el punto como separador de ruta, apuntando a la ruta `cards → sv03 → 5-001`. `FieldPath(seg1, seg2)` trata `cardId` como literal. Test A y Test I del emulador confirman que el punto no se interpreta como separador [Dato — tests A, I en `scripts/test-fieldpath.ts`] |
| Debounce de escritura | 500 ms por slug (frente a 1000 ms en el stepper de bulk existente) | Las interacciones de +/− en el stepper de copias son típicamente más rápidas que las del bulk; 500 ms ofrece un balance adecuado entre responsividad y agrupación de escrituras [Estimación] |
| Idiomas disponibles en `CardDetailModal` | Solo ES, EN, Otros (3 opciones) — no se exponen ZH, KO, JA | El catálogo solo distingue EN y ES; los idiomas adicionales del esquema (ZH, KO, JA) no tienen datos de catálogo que los respalden en esta pantalla. Se pueden añadir en una iteración futura si el usuario los necesita [Dato] |
| Iteración de claves dinámicas en Firestore Rules | No implementada — el DSL de Rules no tiene primitivas de iteración sobre mapas con claves dinámicas | `validCardEntry` queda como helper preparado para futuros paths con clave conocida. La validación de todas las entradas del mapa `cards` se delega al cliente [Dato] |

### 10.B.3 Comportamiento de `updateCardEntry`

La función, expuesta por `PokedexDataContext`, sigue este flujo para cada llamada:

1. Lee el estado base desde `pendingCardsRef` (tiene prioridad sobre el estado React para manejar clics rápidos consecutivos) o desde `pokemonRef`.
2. Guarda el estado original en `cardRollbackRef` solo al inicio de la ventana de debounce (no en cada clic).
3. Llama a `applyCardEntry(base, cardId, entry)` — si `entry === null`, elimina la clave; si no, la añade o actualiza.
4. Aplica el resultado como optimistic UI (`setPokemon`).
5. Resetea el timer de debounce (500 ms). Al dispararse, construye `writeArgs`: las claves presentes en `cardsToWrite` generan `FieldPath("cards", id) + entry`; las claves presentes en `rollbackCards` pero ausentes en `cardsToWrite` generan `FieldPath("cards", id) + deleteField()`. Añade `"updated_at" + serverTimestamp()`. Llama a `updateDoc(ref, ...writeArgs)`. Si el documento no existe (`not-found`), cae a `setDoc({cards: cardsToWrite, updated_at: serverTimestamp()}, {merge:true})`.
6. En caso de error de escritura, restaura el estado desde `cardRollbackRef` y muestra un error transitorio de 4 segundos.

### 10.B.4 Contrato de riesgo R2 — resuelto

El riesgo R2 de la Sección 8.6 (claves con punto en `card_id` + `deleteField()` en mapas anidados) queda cerrado. La implementación usa `FieldPath` con segmentos separados (`new FieldPath("cards", cardId)`) para todas las escrituras por clave, lo que trata el punto en el `cardId` como literal en lugar de separador de ruta. `deleteField()` se usa para eliminar entradas individuales del mapa. El Test D del emulador descartó el enfoque de mapa completo con `setDoc(merge:true)`: al escribir solo las claves presentes en la actualización, las claves ausentes (las que se querían borrar) sobrevivían en Firestore [Dato — `scripts/test-fieldpath.ts`].

### 10.B.5 Hallazgos adicionales de Fase C

#### Badge de cartas (cartas distintas, no copias totales)

El badge numérico en `PokemonCard.tsx` (línea 51) usa `Object.keys(pokemon.cards).length` — cuenta el número de **card IDs distintos** en el mapa, no la suma de `copies`. Un Pokémon con 3 Charizard Base + 1 Charizard Holo registra como **2 cartas**, no 4 [Dato — `PokemonCard.tsx:51`].

#### Fallback a imagen ES (240 cartas)

`MergedCard` expone el campo `imageEs: string | null` (imagen del lado ES del catálogo). `CardDetailModal.tsx:99` usa `card.image || card.imageEs` como imagen efectiva: si la entrada EN tiene `image: ""`, se cae al URL de la versión ES. Esto recupera **240 cartas** con imagen en ES pero sin imagen en EN (ej. Shining Legends). **1034 cartas** no tienen imagen en ningún idioma y muestran el placeholder `⊘` [Dato — commit `9c0aae6`, commit message].

> ⚠️ El formato `high.webp` se usa como primera opción sin haber sido verificado sistemáticamente para todas las imágenes (ver riesgos). `onError` en la imagen fallback al placeholder, por lo que no hay crash, pero sí degradación visual silenciosa si `high.webp` no existe para algunas cartas.

#### Cap `cards.size() <= 500` — justificación

El cap de 500 entradas por documento se estableció como límite de seguridad en las Firestore Rules. **No es un dato medido**: el Pokémon con más cartas en el catálogo es Pikachu con 232 cartas EN (dexId 25) [Dato — 10.A.2]. El cap de 500 es el doble de ese máximo conocido, con margen para expansiones futuras [Estimación]. Un atacante podría enviar un mapa con 501 entradas manualmente; la regla lo bloquea antes de escritura.

#### Comportamiento histórico del mapa completo (pre-`af0159d`) y `setDoc({cards:{}},{merge:true})`

Antes del commit `af0159d`, `updateCardEntry` construía el mapa completo y llamaba a `setDoc({cards: cardsToWrite, ...}, {merge:true})` en todos los casos (no solo en not-found). Al quitar la única carta de un Pokémon, `cardsToWrite` quedaba `{}` y se escribía `setDoc({cards:{}}, {merge:true})`.

Según **firebase-js-sdk #1371** (comportamiento documentado en SDK 5.5.7): `setDoc(ref, {cards:{}}, {merge:true})` sobre un documento existente **sustituye el campo `cards` por un mapa vacío**, en lugar de hacer una merge a nivel de clave. Esto es diferente al comportamiento del Test D (donde `setDoc({cards:{id1:...}}, {merge:true})` preserva las claves ausentes): la diferencia está en que un mapa vacío `{}` actúa como reemplazo del campo, no como fusión selectiva.

> **Fuente:** firebase-js-sdk #1371, comportamiento del SDK 5.5.7. **Confirmado en emulador con Firestore SDK 12.16.0** (Test J, ejecutado por Brayan). No probado contra Firestore real (producción).

Los Tests D y J explican conjuntamente el comportamiento completo del código pre-`af0159d`:

- **Quitar una carta con otras presentes (bug — la eliminación no persistía):** `cardsToWrite = {B: entry}` (la carta A se eliminó del mapa en cliente). `setDoc({cards:{B:entry}}, {merge:true})` → Test D confirma que la clave ausente A **sobrevive** en Firestore — el merge preserva las claves que no aparecen en la escritura. La carta A seguía en Firestore tras el reload. [Dato — Test D]
- **Quitar la única carta (funcionaba — la eliminación sí persistía):** `cardsToWrite = {}`. `setDoc({cards:{}}, {merge:true})` → Test J confirma que el campo `cards` queda **vacío o eliminado** en el documento. El mapa vacío actúa como sustitución del campo, no como fusión. [Dato — Test J, emulador Firestore SDK 12.16.0]

Esta lógica no tiene relación con el **fallback not-found**: ese fallback solo se ejecuta cuando `updateDoc` lanza `code === "not-found"`, es decir, cuando el documento aún no existe. El comportamiento de sustitución del mapa vacío aplica sobre documentos existentes.

La guarda `if (Object.keys(cardsToWrite).length === 0) return;` del commit actual protege el fallback not-found de hacer una escritura innecesaria (no añade ninguna carta nueva), pero no afecta a documentos existentes — el código actual ya usa `FieldPath + deleteField()` para esos casos.

#### Limitación de las reglas de Firestore — sin validación de entradas del mapa

El DSL de Firestore Rules no tiene primitivas de iteración sobre mapas con claves dinámicas. La función `validCollectionDoc` puede comprobar que `cards` es un mapa (`cards is map`) y que su tamaño es razonable (`cards.size() <= 500`), pero **no puede validar los valores de cada entrada** (ej. que `copies` sea un número positivo o que `language` sea uno de los valores permitidos). Esa validación se delega íntegramente al cliente [Dato — 10.B.2, DSL de reglas de Firestore].

#### Correcciones de accesibilidad (WCAG 2.1 AA) — ratios medidos

Commit `5fc38b9` (Accessibility Auditor, UX Architect):

| Elemento | Antes | Después | Ratio antes | Ratio después | Norma |
|---|---|---|---|---|---|
| `rarityLabel` en `CardDetailModal` cabecera | `text-gray-500` | `text-gray-400` | 3.67:1 | 6.99:1 | WCAG 1.4.3 (AA ≥ 4.5:1) |
| Placeholder `⊘` icono en `CardDetailModal` | `text-zinc-500` | `text-zinc-400` | — | — | decorativo; `aria-hidden` |
| `setName` en placeholder `CardDetailModal` | `text-zinc-500` | `text-zinc-400` | — | — | texto informativo |
| `rarityLabel` en placeholder `CardDetailModal` | `text-zinc-500` | `text-zinc-400` | — | — | texto informativo |
| `setName` en placeholder `CardThumbnail` | `text-zinc-500` | `text-zinc-400` | 3.08:1 | 5.81:1 | WCAG 1.4.3 |
| `rarityLabel` en `CardThumbnail` (placeholder y label) | `text-zinc-600` | `text-zinc-400` | 1.93:1 (**BLOCKER**) | 5.81:1 | WCAG 1.4.3 |

Otros cambios de accesibilidad en el mismo commit:
- **`aria-hidden` en overlay eliminado**: el overlay del `CardDetailModal` tenía `aria-hidden="true"`, lo que ocultaba el panel `role="dialog"` hijo a los lectores de pantalla. Se reemplazó por `role="presentation"` [Dato].
- **Focus trap añadido** (WCAG 2.1.2): el handler de `keydown` en `CardDetailModal` atrapa Tab/Shift-Tab dentro del panel [Dato].
- **`role="radio"`/`aria-checked` → `aria-pressed`**: los botones de idioma son toggles nullable, no un radio group — se corrigió el patrón ARIA [Dato].
- **`role="radiogroup"` eliminado**: el `<div>` interior era redundante con `<fieldset>/<legend>` ya presentes [Dato].
- **`HtmlLangSync` creado y revertido**: en el mismo commit se añadió un componente para sincronizar `document.documentElement.lang`; el commit siguiente (`f651ac9`) lo eliminó al detectar que `LanguageContext.tsx:52-55` ya contenía el mismo `useEffect` [Dato].

---

### 10.B.6 Riesgos pendientes para Fase D

| Riesgo | Estado | Notas |
|---|---|---|
| R1 — Caché del catálogo sin `Cache-Control: immutable` | Pendiente | Sin cambios en Fase C. Ver Sección 8.6 y 5.3 para la mitigación recomendada |
| R2 — `deleteField()` + `card_id` con puntos | ✅ Resuelto en Fase C | Ver 10.B.4. Implementación usa `FieldPath` + `deleteField()` por clave |
| R3 — Tamaño de documento en Pokémon populares | Sin riesgo práctico | Análisis en Sección 3.4 sigue vigente |
| R4 — `PokemonModal` no limpia `cards` al desmarcar `owned` | Pendiente | `PokemonModal.tsx` no se modificó en Fase C. Si el usuario desmarca `owned` desde ese modal, `cards` no se vacía. `toDisplayState` devolverá `owned: true` porque `hasCatalogCards` sigue siendo verdadero. Corrección planificada para Fase D |
| R5 — Compatibilidad de ruta dinámica `[dexId]` en `(protected)` | ✅ Resuelto en Fase A | Sin incidencias en Fases B y C |
| R6 — CSP en entorno de desarrollo | Pendiente | Sin cambios. Verificar en `npm run build && npm run start` o Preview de Vercel antes del deploy |
| R7 — `Cache-Control: immutable` para el catálogo | Pendiente | Ver Sección 5.3 |
| R8 — Contraste de la silueta (WCAG AA) | Pendiente | Sin cambios desde Fase A |
| R9 — `high.webp` sin verificación sistemática | **Pendiente** | `CardDetailModal` y `CardThumbnail` solicitan `{image}/high.webp`. Fase B verificó `high.jpg` con HEAD [Dato — 10.A.2], pero no `high.webp` ni los 240 URLs de fallback ES. Si `high.webp` no existe para alguna carta, `onError` muestra el placeholder silenciosamente. `scripts/check-images.ts` permite verificar una muestra de 30 cartas antes del deploy [Dato] |
| R10 — Modal antiguo (`PokemonModal`) no retirado | Pendiente | El modal de Fase 5 sigue siendo el punto de entrada desde el grid (decisión D1/D4). No sabe del campo `cards` y no lo limpia al desmarcar `owned` (ver R4). La sustitución del flujo principal por `/pokedex/{dexId}` queda para Fase D |
| R11 — Sin test automático de reglas Firestore | Pendiente | `firestore.rules` no tiene suite de tests automáticos (no hay `firebase emulators:exec` con fichero de rules tests). Única verificación: emulador manual de `test-fieldpath.ts`. Los tipos de las entradas del mapa `cards` no se validan en reglas (ver 10.B.5) |
| R12 — Despliegue de reglas sin auditar documentos existentes en PROD | **Pendiente — bloquea deploy de reglas** | La función `validCollectionDoc` evalúa el documento **resultante** (incluye campos preexistentes no tocados por la escritura). Si un documento antiguo tiene un campo con tipo incorrecto (ej. `owned: "yes"` en lugar de `true`, o `bulk_quantity: "3"` en lugar de número), `allow create, update` lo bloqueará para **todas sus escrituras futuras**, aunque el write concreto sea válido. Antes de desplegar las reglas a PROD se requiere un script de solo lectura que audite la colección `/users/{uid}/collection/*` buscando campos fuera de tipo. El script no está escrito aún. |

### 10.B.7 Pendiente para Fase D

- Corrección en `PokemonModal.tsx`: cuando `owned === false`, limpiar `cards: {}` en la escritura de `updatePokemonStatus` (cierre del riesgo R4).
- Corrección en `dashboard/page.tsx`: actualizar el contador "Colección Total" para usar el campo `owned` derivado de `toDisplayState` (incluye Pokémon cuyo `owned` proviene únicamente de `hasCatalogCards`).
- Verificación de filtros de ownership en `pokedex/page.tsx`: confirmar que el filtro "Tengo" usa `p.owned` (ya derivado correctamente por `toDisplayState`; verificación manual pendiente).
- Bump de versión: `APP_VERSION` → `1.2.0` en `src/lib/constants.ts`.
- Verificación de los tres estados de documento (A: solo `variant`, B: solo `cards`, C: ambos) en un entorno real con datos de usuario existentes.
- Decisión D1/D4: confirmar si el modal antiguo se retira o coexiste (cierre del riesgo R10).

---

### 10.B.8 Comprobación estática — escrituras a `/users/{uid}/collection/{slug}` vs `validCollectionDoc`

**Agente: Security Engineer**

`validCollectionDoc` valida: `owned` (bool), `cards` (mapa, size ≤ 500), `favorite` (bool), `bulk_quantity` (number ≥ 0), `is_bulk` (bool), `is_shiny` (bool), `is_promo` (bool). Los campos `variant`, `language` y `updated_at` **no están en la función** — cualquier valor en esos campos pasa sin validación de reglas.

| Función | Archivo:línea | Campos escritos | Tipos | Flag |
|---|---|---|---|---|
| `updatePokemonStatus` | `PokedexDataContext.tsx:261` | `owned` (bool), `variant` (Variant\|null), `language` (CardLanguage\|null), `updated_at`, +si !owned: `is_shiny=false`, `is_promo=false`, `is_bulk=false`, `bulk_quantity=0` | `owned` ✅ bool; `variant`/`language` ⚠️ pueden ser `null` con `owned=true` si el usuario no seleccionó; `is_shiny/is_promo/is_bulk` ✅ bool literal; `bulk_quantity=0` ✅ ≥ 0 | `variant` y `language` no están en `validCollectionDoc` → null no bloqueado por reglas. El modal nuevo bloquea "Guardar" si no hay variante; el modal antiguo no tiene esa guarda (ver R4) |
| `updateSpecialFlag` | `PokedexDataContext.tsx:272` | `[is_shiny\|is_promo]` (bool), `updated_at` | ✅ bool literal | OK |
| `updateBulkStatus` | `PokedexDataContext.tsx:289` | `is_bulk` (bool), `bulk_quantity` (number), `updated_at` | `is_bulk` ✅; `bulk_quantity` ⚠️ sin guarda de mínimo en la función — la UI limita a 1+ cuando `is_bulk=true` y a 0 cuando `is_bulk=false`, pero la función en sí acepta cualquier número. Un valor negativo sería bloqueado por la regla (`bulk_quantity >= 0`) | Riesgo bajo: la UI garantiza valores válidos; no hay guarda defensiva en el código |
| `updateFavorite` | `PokedexDataContext.tsx:304` | `favorite` (bool), `updated_at` | ✅ bool literal | OK |
| `updateCardEntry` (updateDoc FieldPath) | `PokedexDataContext.tsx:407` | `FieldPath("cards", cardId)` → entry `{copies, language}` ó `deleteField()`, `updated_at` | El documento resultante tiene `cards` como mapa ✅; `cards.size()` crece o decrece en 1 ✅ | OK. `validCollectionDoc` evalúa el doc resultante — `cards is map && size <= 500` se cumple |
| `updateCardEntry` (setDoc fallback not-found) | `PokedexDataContext.tsx:418` | `cards` (mapa, ≥ 1 entradas tras guarda), `updated_at` | ✅ mapa no vacío, `size` ≤ 500 (Pikachu = 232 máximo conocido) | OK tras commit `ea0eaec` |
| `updatePokemonStatus` (modal antiguo) | `usePokedexData.ts:203` | `owned`, `variant`, `language`, `updated_at`, +si !owned: `is_shiny=false`, `is_promo=false` | Igual que el de `PokedexDataContext` ⚠️ mismo flag de null | ⚠️ Además NO resetea `is_bulk`/`bulk_quantity` al desmarcar `owned`. No bloqueado por reglas, pero deja datos inconsistentes (is_bulk=true con owned=false). Ver R4 y R10 |
| `updateSpecialFlag` (modal antiguo) | `usePokedexData.ts:218` | `[is_shiny\|is_promo]` (bool), `updated_at` | ✅ bool literal | OK |

**Resumen de flags:**

| # | Descripción | Bloqueado por regla | Riesgo real |
|---|---|---|---|
| F1 | `variant: null` ó `language: null` con `owned=true` | No (campos fuera de `validCollectionDoc`) | Bajo — el modal nuevo bloquea guardar sin variante; el modal antiguo no (ver R4) |
| F2 | `bulk_quantity` sin guarda de no-negativo en `updateBulkStatus` | Sí si < 0 (regla lo bloquea) | Bajo — la UI impone mínimo 1 (is_bulk=true) ó 0 (is_bulk=false) |
| F3 | `usePokedexData.updatePokemonStatus` no resetea `is_bulk`/`bulk_quantity` al desmarcar `owned` | No bloqueado | Medio — documentos con `is_bulk=true` + `owned=false` posibles si se usa el modal antiguo. Cierre planificado: retirar modal antiguo (R10) |
