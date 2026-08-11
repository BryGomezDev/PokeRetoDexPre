# CLAUDE.md — National Pokédex Tracker

Este documento es el contexto de referencia completo del proyecto. Léelo entero antes de empezar cualquier fase. Cualquier decisión de diseño, arquitectura o alcance ya está tomada aquí — no se debe reinterpretar ni añadir funcionalidades no listadas sin confirmarlo antes.

**Idioma de respuesta: responde SIEMPRE en español**, en cualquier resumen, explicación o mensaje de esta sesión, independientemente del idioma en que estén escritos el código, los nombres de variables, o los comentarios técnicos (esos se quedan en inglés según convención estándar de programación).

---

## 1. Objetivo del proyecto

Aplicación web (PWA) personal para llevar el seguimiento de una colección física de cartas Pokémon TCG, cubriendo la Pokédex Nacional completa (1025 Pokémon, 9 regiones: Kanto, Johto, Hoenn, Sinnoh, Teselia/Unova, Kalos, Alola, Galar, Hisui, Paldea).

Es multi-usuario: la usarán inicialmente 2 personas, con datos de colección totalmente independientes entre perfiles, y debe poder ampliarse a más usuarios en el futuro sin fricción.

**IMPORTANTE — Responsive real, no solo móvil:** la app se usará tanto desde el navegador de un móvil (instalada como PWA) como desde un navegador de escritorio en Windows. No es "mobile-only con versión de escritorio aceptable" — ambos son entornos de uso habituales y deben tener una experiencia igual de cuidada. Todo el desarrollo (Fase 5 en adelante) debe construirse con breakpoints responsive desde el principio, no como un añadido posterior.

**Aclaración de concepto — "app web" significa accesible por URL desde cualquier navegador:** el proyecto es una página web normal (Next.js en Vercel), con una URL pública, que se abre sin instalar nada desde cualquier navegador (Chrome, Firefox, Edge, Safari) en cualquier sistema operativo (Windows, macOS, Linux, Android, iOS). El soporte PWA es una capa opcional adicional sobre esa misma web (permite "instalarla" como icono en escritorio/móvil si el usuario quiere), pero nunca debe ser un requisito para usarla — el acceso principal y por defecto es simplemente abrir la URL en el navegador.

---

## 2. Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Estilos | Tailwind CSS + shadcn/ui |
| Backend/BBDD | Firebase Firestore (plan Spark, gratuito) |
| Autenticación | Firebase Authentication (Email/Password, ver sección 4) |
| Hosting | Vercel |
| PWA | Sí, instalable en iPhone/Android, pero la app web completa (navegador Windows/macOS) es un entorno de primer nivel, no un extra |
| Diseño | Responsive con Tailwind (mobile-first en el código, pero validando siempre el layout de escritorio ancho) |
| Origen de datos | PokéAPI (https://pokeapi.co) |
| Script de población de datos | Python |

**Restricción dura:** toda la infraestructura debe mantenerse 100% gratuita (Firestore Spark, sin Cloud Functions de pago, sin servicios externos de coste).

---

## 3. Autenticación (sin email visible)

Los usuarios se registran e inician sesión con **username + contraseña**, nunca con un email visible.

**Registro:**
1. Validar username: 3–20 caracteres, solo `[a-zA-Z0-9]`.
2. Normalizar a minúsculas → `usernameLower`.
3. Construir email sintético: `usernameLower + "@pokeretodex.firebaseapp.com"` (proyecto Firebase: **PokeRetoDex**, ID de proyecto confirmado: `pokeretodex`, sin sufijo).
4. `createUserWithEmailAndPassword(email, password)`.
   - Si el username ya está en uso, Firebase devuelve `auth/email-already-in-use` de forma nativa. **No crear ninguna colección adicional de unicidad de username.**
5. Tras el éxito, crear documento en `/users/{uid}` (ver esquema en sección 5).

**Login:** el usuario introduce username + contraseña; la app reconstruye el mismo email sintético internamente y llama a `signInWithEmailAndPassword`.

**Recuperación de contraseña:** NO implementar ningún flujo de recuperación en la UI (no hay email real al que enviar nada). Si un usuario se bloquea, el reseteo se hace manualmente desde la consola de Firebase por un administrador. No añadir pantallas de "olvidé mi contraseña".

---

## 4. Arquitectura de datos (Firestore)

### `/pokemon/{slug}` — colección global, solo lectura para clientes
Poblada por el script Python (Fase 4) desde PokéAPI. Compartida por todos los usuarios.

| Campo | Tipo | Descripción |
|---|---|---|
| `pokedex_number` | number | Número nacional |
| `form_index` | number | Índice de forma dentro del mismo número |
| `sort_order` | number | `pokedex_number * 1000 + form_index` |
| `name` | string | Nombre del Pokémon |
| `region` | string | Una de las 9 regiones |
| `types` | array\<string\> | Tipos |
| `sprite_url` | string | URL del artwork oficial de PokéAPI (`sprites.other['official-artwork']`) |
| `is_special_form` | boolean | true si es Mega/GMax/forma regional/otra variante |
| `form_type` | string \| null | `"mega"` \| `"gmax"` \| `"regional"` \| `null` (null = especie base). Calculado por el sufijo del nombre (usando "contiene", excluyendo sufijos cosméticos como `-cap`/`-cosplay`/`-starter`, que se tratan como "other" y se eliminan de la BBDD). **Recuentos validados**: `null`=1025, `mega`=97, `gmax`=34, `regional`=59, `other`=0. |

### `/users/{uid}` — documento de perfil
| Campo | Tipo | Descripción |
|---|---|---|
| `username` | string | Con capitalización original (display) |
| `created_at` | timestamp | Fecha de registro |
| `avatar_pokemon_slug` | string | Referencia a `/pokemon/{slug}` elegido como avatar de perfil |

### `/users/{uid}/collection/{pokemonSlug}` — un documento por Pokémon
| Campo | Tipo | Descripción |
|---|---|---|
| `owned` | boolean | ¿Tiene esta carta? |
| `variant` | string \| null | `"basica"` \| `"holo"` \| `"alternativa"` \| `"fullart"` — solo relevante si `owned == true` |
| `is_shiny` | boolean | Marca independiente de "carta Shiny/Radiante". Solo relevante si `owned == true` (se resetea a `false` al desmarcar `owned`). No excluyente con `variant` — una carta puede ser Holo Y Shiny a la vez. |
| `is_promo` | boolean | Marca independiente de "carta Promocional". Mismas reglas que `is_shiny`: solo relevante si `owned == true`, no excluyente con `variant` ni con `is_shiny`. |
| `is_bulk` | boolean | Marca independiente de "carta sobrante" (copias extra disponibles para intercambio). Solo relevante si `owned == true` (se resetea a `false` al desmarcar `owned`). No excluyente con `variant`, `is_shiny` ni `is_promo`. |
| `bulk_quantity` | number | Número de copias sobrantes. Solo relevante si `is_bulk == true` (se resetea a `0` al desmarcar `owned` o `is_bulk`). Valor mínimo cuando is_bulk=true: 1. |
| `language` | string \| null | `"es"` \| `"en"` \| `"zh"` \| `"ko"` \| `"ja"` \| `"otros"` — solo relevante si `owned == true` |
| `updated_at` | timestamp | Última modificación |

> Los documentos se crean bajo demanda cuando el usuario marca un Pokémon por primera vez, no se pre-crean todos en el registro.

### `/users/{uid}/config/rules` — configuración de seguimiento
| Campo | Tipo | Descripción |
|---|---|---|
| `excluded_form_slugs` | array\<string\> | Lista explícita de slugs excluidos dentro del álbum de formas especiales, para ajuste fino futuro (ej. seguir Megas pero no Gigantamax). No hay UI para editarlo todavía. |

**Principio de diseño:** ninguna forma está excluida por defecto de forma "hardcodeada" en el código — toda inclusión/exclusión pasa por este documento de configuración, por usuario.

**Decisión de arquitectura (revisión post-Fase 5, actualizada):** el objetivo de "Pokédex Nacional" (1025) es siempre estrictamente sobre especies base (`form_type == null`). El "Progreso por Región" del Dashboard cuenta solo especies base por región. Las formas especiales (Megas, Gigantamax, Formas Regionales) viven en un **álbum separado** ("Progreso de Formas Especiales"), que ahora es **SIEMPRE visible** (se eliminó el toggle `include_special_forms` — los filtros de `/pokedex`, la sección de Formas Especiales del Dashboard, y la sección "Colección Total" son suficientes para controlar qué se ve, sin necesidad de un interruptor adicional). Esto separa limpiamente el objetivo principal (1025) del contenido adicional opcional de coleccionismo, sin añadir un control de configuración extra que no aportaba valor real.

### Índices compuestos necesarios (orientativo, Firestore sugerirá los exactos en desarrollo)
- `collection`: `owned` ASC + `updated_at` DESC
- `pokemon`: `region` ASC + `sort_order` ASC
- `pokemon`: `region` ASC + `is_special_form` ASC + `sort_order` ASC
- `collection`: `variant` ASC
- `collection`: `language` ASC

### Reglas de seguridad (desplegadas y confirmadas en producción)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /pokemon/{slug} {
      allow read: if true;
      allow write: if false; // solo el script Python vía Admin SDK
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

> ⚠️ Nota importante: al crear la base de datos en "modo producción", Firebase aplica por defecto una regla de "denegar todo" (`match /{document=**} { allow read, write: if false; }`). Este proyecto tuvo ese problema exacto durante la Fase 5 (el `setDoc` de `/users/{uid}` fallaba silenciosamente con `Missing or insufficient permissions`, y la colección `/users` no llegaba a crearse) hasta que se publicaron manualmente las reglas de arriba en la consola de Firebase. Si se recrea el proyecto Firebase alguna vez, no olvidar este paso — es fácil pasarlo por alto porque la app no muestra ningún error visible al usuario cuando esto falla.

---

## 5. Pantallas y UX (validado con mockup en Google Stitch)

### 5.1 Registro
- Campo "Nombre de usuario" (3–20 caracteres, solo letras y números).
- Campo "Contraseña".
- Selector de avatar: grid de sprites de Pokémon para elegir como imagen de perfil (NO hay opción de subir foto).
- Botón "Crear cuenta".
- Enlace a login.

### 5.2 Login
- Campo "Nombre de usuario", campo "Contraseña", botón "Iniciar sesión".
- Enlace a registro.
- **Sin** opción de "¿Olvidaste tu contraseña?".

### 5.3 Pokédex Grid (pantalla principal)
- Grid de tarjetas: sprite, número, nombre.
- Indicador visual de estado: no poseído (atenuado/gris), poseído (color completo), con acabado distinto por variante (Holo = borde/brillo dorado, Full Art = borde iridiscente, Alternativa = marco especial, Básica = borde neutro).
- **Iconos Shiny/Promo/Bulk** en la esquina superior derecha de cada tarjeta (solo visibles si la carta está poseída): tres iconos distintos, mostrando el estado actual. Shiny y Promo son **solo indicadores visuales de solo lectura** (sombreados/apagados si no tienen la marca, a todo color si la tienen) — NO son interactivos en la tarjeta. El icono **Bulk** (Layers, verde esmeralda) **sí es interactivo**: tap togglea `is_bulk` directamente con `stopPropagation` (no abre el modal). Cuando `is_bulk=true`, muestra un badge numérico pequeño con `bulk_quantity`. El stepper de cantidad solo está en el modal de detalle.
- Píldoras de región (9 regiones + "Todas"), scrollables horizontalmente, cada una con su propio progreso.
- Buscador + filtros: tipo de Pokémon, estado de posesión, variante de carta, idioma de la carta, **Categoría** (Todas / Nacional / Megaevoluciones / Gigantamax / Formas Regionales, basado en `form_type`), y **Shiny/Promo** (filtros independientes, ej. "solo Shiny", "solo Promo", combinables entre sí y con el resto).
- Badge de progreso Nacional (X/1025) y badge de progreso de Formas Especiales combinado (X/190) en la cabecera, visualmente diferenciados.
- Navegación inferior fija: Pokédex / Dashboard / Sobrantes / Configuración.
- Avatar del usuario visible en cabecera.

### 5.4 Modal de detalle de Pokémon
- Sprite grande, nombre, número, tipo(s), región.
- Toggle "¿Tengo esta carta?".
- Si está activado:
  - **Tipo de carta**: Básica / Holo / Alternativa / Full Art, en **grid 2x2** (una sola opción excluyente).
  - **Idioma de la carta**: Español / Inglés / Chino / Coreano / Japonés / Otros.
  - **Tres iconos independientes** (no excluyentes entre sí ni con lo anterior): **Shiny**, **Promo** y **Bulk**, activables/desactivables con un toque **desde aquí, en el modal** (toggle directo, con upsert a Firestore). Icono sombreado/apagado cuando está desmarcado, a todo color cuando está marcado.
  - **Stepper de cantidad Bulk** (visible solo cuando Bulk está activo): botones +/- con feedback inmediato en UI y escritura a Firestore debounceada 1.000 ms. Cantidad mínima: 1.
- Botón "Guardar y Cerrar".
- **Sin** campo de "valor estimado".

### 5.5 Dashboard
- Progreso general (X/1025) con anillo/barra grande, contando **solo especies base** (`form_type == null`). **Sin** ningún indicador de nivel/XP/gamificación.
- Contadores por variante: Básica, Holo, Alternativa, Full Art (sobre el total de la colección, incluyendo formas especiales si el usuario las tiene marcadas).
- **Contadores de Shiny y Promo**: dos contadores independientes (ej. "Shiny: 4" / "Promo: 2"), sobre el total de cartas poseídas con esas marcas activas, sin importar la variante.
- **"Progreso por Región"**: desglose por las 9 regiones, contando solo especies base de cada región (`form_type == null`), ordenado de menor a mayor completitud.
- **"Progreso de Formas Especiales"** (SIEMPRE visible, ya no depende de ningún toggle): álbum separado del objetivo principal de 1025, con un total combinado (mega+gmax+regional) primero, y luego agrupado en dos niveles:
  - Por tipo: **Megaevoluciones**, **Gigantamax**, **Formas Regionales**.
  - Dentro de "Formas Regionales", subdividir por región de origen de la forma: Alola, Galar, Hisui, Paldea.
  - Cada grupo muestra su propio contador (ej. "Megaevoluciones: 12/97") y barra de progreso.
- **"Colección Total"**: sección final, siempre visible, con el progreso combinado de TODA la colección (especies base + todas las formas especiales), ej. "X/1215".
- **Sin** sección de "adquisiciones recientes".

### 5.6 Configuración
- Perfil: username + avatar (Pokémon elegido), con opción de cambiarlo. Lista de avatares ampliada a 19 opciones (las 9 originales + 10 nuevas).
- Gestión de datos: botón **"Exportar cartas faltantes (.txt)"** — exporta un `.txt` con dos secciones separadas: "Pokédex Nacional — faltan" (especies base, `form_type == null`, que el usuario no tiene) y "Formas Especiales — faltan" (megas/gmax/regionales que no tiene). Sin importación por ahora (queda para una versión futura, junto con exportar/importar la colección que sí se tiene).
- **Sin** botón de "Cerrar sesión" aquí — se queda donde está ahora mismo, en la cabecera de `/pokedex`.
- **Sin** toggle de "Incluir formas especiales" (eliminado — ver sección 4, los filtros de `/pokedex` y las secciones del Dashboard ya cumplen esa función).
- **Sin** toggle de modo oscuro (la app es oscura de forma fija, no configurable por ahora — ver nota en sección 6 sobre coste de añadir modo claro más adelante).
- **Sin** sección de notificaciones.
- **Sin** selector de idioma de la app todavía (ES/EN) — planificado como fase futura dedicada (i18n completo), no forma parte de esta pantalla por ahora.
- **Enlace a "Legal / Aviso de Privacidad"** (ver sección 12), visible también en Login/Registro.

### 5.7 Pantalla /bulk — Sobrantes

Ruta protegida `/bulk`, accesible desde la navegación principal (4.º ítem, icono Layers).

- **Sin sprites/imágenes** de Pokémon — tabla de texto ligero.
- **Contador único en cabecera**: suma total de copias (`bulk_quantity`) de todas las cartas marcadas como sobrante. (El contador de "tipos distintos" se eliminó — solo se muestra el total de copias.)
- **Botón de info (HelpCircle)**: abre un modal centrado con 4 pasos explicando el flujo exportar → compartir → importar → comparar. Debajo de los botones de acción hay siempre visible una línea resumen corta con la misma idea.
- **Filtro por región**: chips scrollables horizontalmente, solo mostrando las regiones que tengan al menos una carta en bulk.
- **Vista de tabla** ordenada por número de Pokédex, con columnas `#` / `Nombre` / `Región` / `Cantidad`. La cantidad se colorea en escala de intensidad: 1 copia → `emerald-600`, 2 → `emerald-500`, 3-4 → `emerald-400`, 5-9 → `emerald-300`, 10+ → `emerald-200`. Responsive: en móvil la columna `#` se oculta del encabezado y se muestra como texto pequeño encima del nombre dentro de la celda; la región aparece debajo del nombre en la misma celda.
- **Exportar JSON**: genera un `Blob` en cliente (sin llamadas a Firestore ni backend) con estructura `{ exported_by, exported_at, schema_version: 1, cards: [{ slug, pokedex_number, name, region, quantity }] }`. Nombre de archivo: `pokeretodex-bulk-<username>.json`.
- **Importar + comparación con amigo**: input file (`.json`), todo procesado en el navegador con `FileReader`. Valida `schema_version` y `cards[]`, cruza contra la colección del usuario en `PokedexDataContext` (sin lecturas adicionales a Firestore). Resultado efímero mostrado en la misma tabla (con variante de color azul): "Tu amigo X podría darte N carta(s)". No se persiste nada.
- Todos los datos provienen de `PokedexDataContext` — **cero lecturas adicionales a Firestore**.

---

### 5.8 Comportamiento responsive (escritorio ≥1024px)

El mockup de Stitch se diseñó en formato móvil; estas son las adaptaciones obligatorias para navegador de escritorio (Windows):

- **Navegación**: en móvil es una barra inferior fija (Pokédex / Dashboard / Sobrantes / Configuración). En escritorio pasa a ser una **barra lateral izquierda fija** (sidebar), con los mismos 4 destinos, más visible y sin ocupar espacio vertical del contenido.
- **Grid de Pokédex**: en móvil son ~3 columnas; en escritorio debe aprovechar el ancho disponible (ej. 6-8 columnas en pantallas anchas), manteniendo el tamaño de tarjeta legible, no estirándolas de forma desproporcionada.
- **Filtros y buscador**: en móvil son chips scrollables horizontalmente; en escritorio pueden mostrarse todos a la vez sin scroll (barra de filtros completa) o en un panel lateral colapsable.
- **Modal de detalle de Pokémon**: en móvil ocupa la pantalla completa (bottom sheet); en escritorio debe mostrarse como **modal centrado** o **panel lateral derecho**, no a pantalla completa, para no perder el contexto del grid detrás.
- **Dashboard**: en escritorio, los contadores por variante y el desglose por región pueden distribuirse en columnas (ej. 2-3 columnas) en lugar de apilarse verticalmente como en móvil.
- **Login/Registro**: en escritorio no deben ocupar todo el ancho de la pantalla — centrar el formulario en una tarjeta de ancho fijo (ej. 400-480px) sobre un fondo, en vez de estirarse edge-to-edge como en móvil.

Regla general: ningún elemento pensado para dedo/touch (áreas táctiles grandes, bottom sheets) debe trasladarse tal cual a escritorio sin adaptarse a interacción con ratón y pantallas anchas.

---

## 6. Explícitamente fuera de alcance

No implementar salvo que se indique lo contrario explícitamente en una conversación futura:
- Subida de fotos de cartas (todas las imágenes vienen de PokéAPI).
- Campo de "valor estimado" de las cartas.
- Gamificación: niveles, XP, insignias de "coleccionista de élite".
- Modo oscuro configurable (es oscuro fijo).
- Notificaciones.
- Sección de "añadidos/adquiridos recientemente".
- Recuperación de contraseña vía email.
- Cambio de username tras el registro (queda ligado al email interno de Auth).
- Toggle "Incluir Formas Especiales" (eliminado — los filtros de `/pokedex` y las secciones del Dashboard ya cumplen esa función).
- Importar datos / exportar la colección que sí se tiene (solo se exportan las cartas que faltan, por ahora).

### Consideraciones futuras (fuera de la Fase 5, pendientes de sesión dedicada)
- **Modo claro**: viable, coste depende de si los colores se implementaron con variables semánticas de shadcn/ui (fácil) o con clases de color literales por todo el código (requiere refactor, revisar antes de estimar).
- **Idioma de la app (ES/EN)**: requiere extraer todos los textos de la UI a un sistema de traducción (ej. `next-intl`) y tocar prácticamente cada componente. Tarea grande, merece su propia sesión.

---

## 7. Plan de desarrollo por fases

| Fase | Contenido | Estado |
|---|---|---|
| 1 | ADR de arquitectura (Firestore + Auth) | ✅ Completa — ver sección 4 |
| 2 | (definir con el agente correspondiente) | Pendiente |
| 3 | (definir con el agente correspondiente) | Pendiente |
| 4 | Script Python de población de datos desde PokéAPI (usa el agente `engineering-data-engineer.md`) — debe rellenar `sprite_url` (artwork oficial), `is_special_form`, `sort_order` para las 9 regiones | ✅ Completa — 1216 documentos en `/pokemon`, validado con casos de forma base, regional y Gmax |
| 5 | Componentes UI (Next.js + Tailwind + shadcn/ui) según sección 5 | ✅ Completa — autenticación, Pokédex Grid (con píldoras de región y filtro de Categoría), modal de detalle, Dashboard (con álbum de Formas Especiales y Colección Total) y Configuración (perfil + 19 avatares + exportar cartas faltantes en .txt), todo validado |
| 6 | Revisión final de código | Pendiente |

Los agentes personalizados de Claude Code están en `C:\Users\BryDev\.claude\agents`. Revisar esa carpeta para confirmar qué agente corresponde a cada fase antes de ejecutar.

---

## 8. Configuración personal del usuario (perfil de ejemplo, no hardcodear)

A modo de referencia (esto vive en `/users/{uid}/config/rules` de cada usuario, no en código):
- Brayan excluye actualmente: Megas, Gigantamax, y la mayoría de formas regionales.
- Brayan incluye: formas de Hisui y formas de género.

Esto es un ejemplo de configuración de un usuario concreto, no una regla del sistema — cada usuario define la suya propia desde Configuración.

---

## 9. Estado del proyecto TCG físico (contexto, no afecta al desarrollo de la app)

Para contexto del propietario del proyecto (no es un requisito funcional de la app):
- Kalos es la región más completa (~76%); Alola, Galar y Hisui son las menos desarrolladas.
- Roadmap de compras: Astral Radiance (Sinnoh + Hisui), Pokémon 151 (Kanto), Black Bolt & White Flare (Teselia), Crown Zenith (Galar), Cosmic Eclipse (Alola), Destined Rivals (Johto), singles para Kalos vía Cardmarket/TCGPlayer.

---

## 10. Próximo paso inmediato

**i18n cerrado del todo.** Queda pendiente: crear la página **Aviso Legal** (`/legal`, ver sección 12 — texto ya aprobado por el usuario), enlazada desde Login/Registro y Configuración. Después de eso, decidir entre Fase 6 (revisión final de código) o la sesión de modo claro, y finalmente inicializar git antes de desplegar a Vercel (ver sección 13).

---

## 11. Internacionalización (i18n) — Español/Inglés

**Arquitectura elegida:** Context de React ligero y propio, sin librería externa (next-intl se descartó por ser excesivo para 2-3 usuarios y añadir complejidad de enrutado `/es/`, `/en/` que no necesitamos).

- **Diccionarios**: `src/lib/i18n/es.ts` y `src/lib/i18n/en.ts`, objetos anidados con todas las claves de texto de la UI.
- **`LanguageProvider`** (`src/context/LanguageContext.tsx`): expone `language` ("es"|"en"), `setLanguage()`, y `t(key)` para resolver textos (con soporte de interpolación simple para valores dinámicos, ej. "X/Y").
- **Persistencia**:
  - Antes de iniciar sesión (Login/Registro): se guarda en `localStorage` (`app_language`), por defecto `"es"`.
  - Tras iniciar sesión: se lee/escribe en `/users/{uid}.app_language` (nuevo campo, default `"es"` si no existe). Se actualiza desde el selector en Configuración.
- **Selector de idioma**: un pequeño toggle "ES | EN" visible también en Login/Registro (antes de tener cuenta), y un selector formal en la pantalla de Configuración una vez logueado.
- **Alcance de traducción**: todo el texto de la UI (botones, labels, títulos, estados vacíos), nombres de región para mostrar (ej. "Teselia" en ES / "Unova" en EN — el valor interno guardado en Firestore sigue siendo `"unova"`, solo cambia la etiqueta mostrada), nombres de tipo de Pokémon (fuego/fire, agua/water, etc.), etiquetas de variante de carta (Básica/Basic, Full Art igual en ambos), etiquetas de categoría (Nacional/National, Megaevoluciones/Mega Evolutions, Gigantamax igual), y etiquetas de idioma de carta (Español/Spanish, etc. — esto es el idioma DE LA CARTA, no el idioma de la app, son conceptos independientes).
- **Nombres de Pokémon**: NO se traducen (siguen mostrando el nombre en inglés/slug tal cual, ej. "Charizard"), ya que la mayoría de nombres son idénticos o muy similares en ambos idiomas y añadir nombres localizados desde PokéAPI sería una complejidad desproporcionada para el valor que aporta.
- **Exportación de cartas faltantes (.txt)**: el contenido del archivo también se traduce según el idioma activo en el momento de exportar.

### Estado
✅ Completo — Sesiones A y B implementadas y validadas, incluyendo los 2 fixes finales (hidratación de Next.js resuelta con inicialización fija a "es" + lectura diferida a useEffect; nombre de archivo del export ya traducido).

---

## 12. Aviso Legal / Política de Privacidad

Proyecto de fans, sin ánimo de lucro. Se necesita un disclaimer visible para evitar problemas con Nintendo/Game Freak/The Pokémon Company, dado que la app usa nombres, sprites y datos de PokéAPI.

**Ubicación**: página dedicada `/legal` (implementada como server component estático, sin autenticación requerida), enlazada desde 4 sitios:
1. Sidebar de escritorio (Navigation.tsx) — parte inferior, oculto en la barra de navegación móvil.
2. Configuración — entre "Gestión de datos" e "Idioma de la aplicación".
3. Login — debajo del enlace a registro.
4. Registro — debajo del enlace a login.

El contenido de `/legal` se queda solo en español por ahora (no traducido); los enlaces cortos que apuntan a ella ("Aviso Legal"/"Legal Notice") sí están traducidos vía el sistema de i18n.

**Estado: ✅ Completo**, incluyendo traducción ES/EN del contenido (implementado como server wrapper + client component `LegalContent.tsx` para poder leer el `LanguageContext`).

---

## 14. Fase 6 — Revisión final de código y optimización de lecturas Firestore

Auditoría realizada con agente "Security Engineer" (seguridad, sección 13) y revisión de código general (Fase 6). Hallazgo **bloqueante** antes de desplegar:

**🔴 BLOQUEANTE — Exceso de lecturas Firestore**: `usePokedexData.ts` recarga TODA la colección `/pokemon` (~1215 docs) en cada montaje, sin caché. Al navegar entre Pokédex/Dashboard/Configuración, cada pantalla dispara su propia carga completa. Estimado: con 2 usuarios y uso normal (5 sesiones/día, 4 pantallas), se superan las 50.000 lecturas/día gratis del plan Spark.

**Fix elegido: Opción A — Context compartido a nivel de layout.** Los datos de `/pokemon` + `/collection` + `/users/{uid}` se cargan UNA sola vez por sesión (en un layout compartido para las 3 rutas protegidas: `/pokedex`, `/dashboard`, `/configuracion`), no en cada componente de página por separado.

**Otros hallazgos a corregir en la misma tanda de trabajo:**
- Lectura duplicada de `/users/{uid}` al login (`LanguageContext` y `usePokedexData` la piden por separado) → unificar en una sola lectura.
- Bug: `REGION_ORDER` en `configuracion/page.tsx` usa mayúsculas (`"Alola"`) pero los slugs reales son minúsculas → el orden del export de cartas faltantes nunca se aplica correctamente.
- Modal sin validación de variante: se puede guardar una carta como poseída sin elegir Tipo de carta → **decisión: bloquear el botón "Guardar" hasta que se seleccione una variante.**
- `LoadingSpinner` duplicado en 3 páginas + mensaje "Verificando sesión..." hardcodeado en español en `configuracion/page.tsx` (no traducido).
- `formatName` en `configuracion/page.tsx` duplica `formatAvatarName` ya existente en `src/lib/avatars.ts`.
- `src/hooks/useAuth.ts`: archivo muerto, re-export que nadie usa.
- Colisión de nombre de tipo `Language` (idioma de carta vs idioma de app) → renombrar el de la carta a `CardLanguage`.
- `form_type: "other"` sin documentos reales (0 en Firestore) → limpieza de tipo.

**Estado: ✅ Completa.** Tanda 1 (bloqueante de lecturas Firestore) y Tanda 2 (calidad de código) aplicadas y validadas. Nota: el punto "eliminar `uidValue`" se descartó intencionadamente — Claude Code identificó que esa variable sí es necesaria por una limitación real de inferencia de tipos de TypeScript en closures async anidados, no era código redundante como se pensó inicialmente.

**Texto** (pendiente de aprobación final del usuario — ver conversación):

> **PokéRetoDex** es un proyecto personal, sin ánimo de lucro, hecho por y para aficionados, con el único fin de llevar un seguimiento privado de una colección física de cartas Pokémon TCG.
>
> Este proyecto no está afiliado, patrocinado, respaldado ni asociado de ninguna forma con Nintendo, Game Freak, Creatures Inc. o The Pokémon Company. Todos los nombres, sprites e ilustraciones de Pokémon mostrados son marca registrada y propiedad de sus respectivos titulares, y se usan aquí únicamente con fines informativos y de organización personal, sin intención de infringir derechos de autor ni de marca.
>
> La aplicación no genera ingresos de ningún tipo (sin publicidad, sin ventas, sin suscripciones).
>
> Los datos almacenados (usuario, colección marcada, preferencias) se guardan en una base de datos privada (Firebase) y solo son accesibles por el propio usuario que los crea; no se comparten con terceros ni se usan con fines comerciales.
>
> — Todos los derechos de Pokémon a The Pokémon Company®

**Traducción al inglés (aprobada por el usuario):**

> **PokéRetoDex** is a personal, non-profit project, created by and for fans, with the sole purpose of privately tracking a physical collection of Pokémon TCG cards.
>
> This project is not affiliated with, sponsored by, endorsed by or associated in any way with Nintendo, Game Freak, Creatures Inc. or The Pokémon Company. All Pokémon names, sprites and illustrations shown are registered trademarks and the property of their respective owners, and are used here solely for informational and personal organisational purposes, with no intention of infringing copyright or trademark rights.
>
> The app does not generate any revenue (no adverts, no sales, no subscriptions).
>
> The stored data (user, marked collection, preferences) is kept in a private database (Firebase) and is accessible only to the user who created it; it is not shared with third parties nor used for commercial purposes.
>
> — All Pokémon rights belong to The Pokémon Company®

---

## 13. Auditoría de seguridad (pre-despliegue)

Realizada con el agente "Security Engineer" de Claude Code antes de desplegar a Vercel. Resultado: razonable, 4 issues bloqueantes, todos corregidos.

**Corregido:**
1. `firestore.rules` + `firebase.json` creados como archivos versionables en la raíz (antes las reglas solo existían documentadas aquí en el CLAUDE.md, lo cual causó el incidente de "denegar todo" en la Fase 5).
2. Cookie de sesión con atributo `Secure` añadido (login/registro).
3. Headers de seguridad en `next.config.mjs`: CSP (`default-src 'self'`, `img-src` restringido a `raw.githubusercontent.com`, `connect-src` cubriendo dominios de Firebase/Google), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`. Validado en el navegador que login/registro/marcar cartas/dashboard/cambio de avatar siguen funcionando con el CSP activo.
4. `.gitignore` ampliado para cubrir `.env`, `.env.production`, `.env.development` (antes solo `*.local`).

**No bloqueantes, pendientes de valorar más adelante:**
- Dominio del email sintético visible en el bundle del cliente (aceptable para 2-3 usuarios).
- Recomendación de actualizar a Next.js 15.x antes de producción (la versión actual, 14.2.35, ya incluye el parche de CVE-2025-29927).

**✅ Repositorio git**: inicializado, commiteado y subido a GitHub (`praisegaming/PokeRetoDex`, privado). Desplegado en Vercel con éxito, con las 6 variables de entorno de Firebase configuradas.

----
## 16. Versionado de la aplicación

### Constante APP_VERSION
Definida en **`src/lib/constants.ts`** y consumida desde `configuracion/page.tsx` (pie de página, junto al enlace de Aviso Legal). Para actualizar la versión en una release futura, solo hay que editar ese archivo.

### Convención: Semver estricto MAJOR.MINOR.PATCH
| Segmento | Cuándo incrementar |
|---|---|
| MAJOR | Cambios incompatibles (migración de datos, rediseño de auth, rotura de estructura Firestore) |
| MINOR | Funcionalidad nueva sin romper lo existente (nueva pantalla, nueva feature, i18n) |
| PATCH | Fixes y correcciones sin añadir funcionalidad |

### Historial de versiones
| Versión | Descripción |
|---|---|
| 1.0.0 | Release inicial: auth, Pokédex Grid, modal de detalle, Dashboard, Configuración, i18n ES/EN, Legal, auditoría de seguridad, deploy a Vercel |
| 1.0.1 | Fix post-release (correcciones menores) |
| 1.1.0 | Feature Bulk completa: pantalla `/bulk`, tabla de sobrantes, exportar/importar JSON, comparación con amigo |

----
## 15. Mejoras pendientes (backlog, no bloqueantes)

- **Timeout en "Verificando sesión..."**: si un usuario es borrado desde Firebase Console (Authentication) mientras tenía una sesión activa en el navegador, al intentar recargar/volver a entrar la app se queda colgada indefinidamente en el estado "Verificando sesión..." sin ninguna forma de salir de ahí. Fix propuesto: añadir un timeout (ej. 5-8 segundos) a la verificación de sesión en el componente de loading/guard de rutas protegidas; si se supera ese tiempo sin resolver, tratarlo como sesión inválida, limpiar la cookie/estado local, y redirigir a `/login` (idealmente con un mensaje tipo "Tu sesión ha expirado o ya no es válida, inicia sesión de nuevo").

- **Normalización de nombres de Pokémon en toda la app**: los slugs con formas compuestas (ej. `tauros-paldea-combat-breed`) se muestran actualmente tal cual, con guiones y sin capitalizar. Pendiente aplicar de forma transversal: reemplazar guiones por espacios + capitalizar cada palabra (ej. → "Tauros Paldea Combat Breed"). Afecta a: grid de Pokédex (tarjetas), modal de detalle, dashboard (cualquier nombre mostrado), y pantalla de Sobrantes (/bulk). Requiere una función utilitaria compartida tipo `formatPokemonName(slug: string): string` en `src/lib/utils.ts` o similar, para evitar duplicar lógica.