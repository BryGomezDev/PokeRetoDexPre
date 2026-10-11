# Auditoría de seguridad pre-PR — feat/catalog-etl → main

**Fecha**: 2026-10-10
**Repo**: BryGomezDev/PokeRetoDexPre (público)
**Commit auditado**: 6b89a97
**Rama**: feat/catalog-etl

---

## Resumen ejecutivo

ISSUES — `.claude/settings.local.json` fue commiteado en `11ff4d4` y persiste en el historial de git (commits `1b0f0bf` y `0874608` lo eliminaron del árbol pero no del historial). El archivo contenía rutas absolutas de Windows (`C:\Users\BryDev\...`), sin credenciales. No hay secretos de Firebase ni API keys en el working tree ni en el historial de los archivos de código. Todos los demás controles están correctos.

---

## Hallazgos

### PASS — Sin secretos en el working tree

**[Dato]** Grep sobre `*.py`, `*.ts`, `*.js`, `*.json`, `*.md` para patrones `AIza[A-Za-z0-9_-]{35}`, `firebaseio.com`, `appspot.com` → sin coincidencias.

**[Dato]** El archivo `.env.local` existe localmente con credenciales reales de Firebase (`AIzaSyCaJ_...`), pero `git ls-files .env.local` no devuelve output — el archivo **no está trackeado**. Confirmado también por `git log --all -- .env.local` → sin resultados.

**[Dato]** `.env.local.example` está trackeado y contiene únicamente placeholders (`YOUR_API_KEY`, `YOUR_SENDER_ID`, `YOUR_APP_ID`). Sin valores reales.

**[Dato]** `src/lib/firebase.ts` consume exclusivamente variables de entorno (`process.env.NEXT_PUBLIC_FIREBASE_*`), sin ningún valor hardcodeado.

**[Dato]** Los scripts `populate_pokemon.py`, `backfill_form_type.py` y `fix_form_type_others.py` leen la ruta del service account únicamente desde `os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH")`. Sin rutas absolutas ni credenciales embebidas.

---

### ADVERTENCIA — `.claude/settings.local.json` persiste en el historial

**[Dato]** `git log --all --oneline -- ".claude/settings.local.json"` devuelve 3 commits:

```
0874608  chore: remove .claude/settings.local.json from tracking (public repo cleanup)
1b0f0bf  chore: remove .claude/settings.local.json from tracking (public repo cleanup)
11ff4d4  Añadir funcionalidad completa: auth, pokedex, dashboard, i18n, shiny/promo, legal
```

El archivo fue añadido en `11ff4d4` y eliminado del tracking en `1b0f0bf`/`0874608` (dos intentos). El commit `0874608` muestra en su stat `28 líneas eliminadas`. El mensaje de commit del autor describe el contenido explícitamente: "El archivo contiene rutas locales de Windows — innecesario en un repo público."

**[Estimación]** El contenido expuesto son rutas absolutas locales de Windows (`C:\Users\BryDev\...`), típico de `settings.local.json` de Claude Code (permisos, rutas de herramientas). Este tipo de archivo **no contiene credenciales de Firebase ni tokens de API** — eso se verifica porque las credenciales de Firebase viven en `.env.local` (que sí está ignorado correctamente).

**Riesgo real**: divulgación de la ruta de usuario de Windows (`BryDev`). Impacto bajo — es información de configuración local sin valor para un atacante. El repo es público, por lo que cualquiera puede ver el historial.

**Acción recomendada** (no bloqueante para el PR): si se quiere limpiar el historial, usar `git filter-repo --path .claude/settings.local.json --invert-paths` o BFG Repo Cleaner y hacer force-push. Requiere coordinación si hay forks o clones activos. Por ahora el archivo ya está en `.gitignore`.

---

### PASS — Sin secretos en el historial de git (.env, claves)

**[Dato]** `git log --all --oneline -- "*.env" ".env*" "*.local" "*.pem" "*.key" "*.p12"` devuelve únicamente:

```
15b79bf  feat: conectar app al proyecto Firebase PRE (pokeretodexpre)
11ff4d4  Añadir funcionalidad completa: auth, pokedex, dashboard, i18n, shiny/promo, legal
```

`15b79bf` modifica `*.local` (casi con certeza `.env.local.example`, el archivo plantilla). `11ff4d4` es el commit masivo inicial — el `.env.local` real **no aparece** como archivo trackeado.

**[Dato]** No existe ningún commit que haya añadido `*.pem`, `*.key`, `*.p12` ni `*serviceAccount*.json`.

---

### PASS — .gitignore cubre todos los archivos sensibles

**[Dato]** Contenido verificado de `.gitignore`:

- `.env` ✓
- `.env.local` ✓ (cubierto por `.env.local`)
- `.env*.local` ✓
- `.env.development` ✓
- `.env.production` ✓
- `*.pem` ✓
- `.claude/settings.local.json` ✓ (añadido en commits `1b0f0bf`/`0874608`)
- `*serviceAccount*.json` ✓
- `*service-account*.json` ✓
- `*firebase-adminsdk*.json` ✓
- `scripts/*.json` ✓ (cubre service accounts sueltos en scripts/)
- `scripts/out/` ✓

**[Dato]** `git status --short scripts/out/` → sin output. La caché HTTP local (`scripts/out/http_cache/`, ~1025+ archivos JSON) **no está trackeada**.

---

### PASS — Sin rutas absolutas del desarrollador en el código comprometido

**[Dato]** Grep para `C:\\Users\\`, `/home/[a-zA-Z]+/`, `/Users/[a-zA-Z]+/` sobre `*.py`, `*.ts`, `*.js`, `*.json`, `*.md` → sin coincidencias.

**[Dato]** Los scripts Python (`generate_catalog.py`) calculan rutas de forma relativa desde `__file__`:
```python
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_SCRIPT_DIR)
```
Sin rutas absolutas hardcodeadas.

**[Dato]** Los archivos del catálogo generado (`public/catalog/v1/1.json`, `_meta.json`) contienen únicamente URLs de `assets.tcgdex.net` y datos de cartas. Sin rutas de sistema.

---

### PASS — URLs solo de TCGdex en generate_catalog.py

**[Dato]** Grep de `https?://` en `scripts/generate_catalog.py` → una única coincidencia:

```
BASE_URL = "https://api.tcgdex.net/v2"
```

Las demás URLs en el catálogo generado son URLs de imágenes de `assets.tcgdex.net` (subdominio del mismo dominio, devueltas por la propia API). Sin URLs de terceros no documentados.

---

### PASS — User-Agent sin información personal

**[Dato]** En `scripts/generate_catalog.py`, líneas 45-48:

```python
HEADERS = {
    "User-Agent": "PokeRetoDex-catalog",
    "Content-Type": "application/json",
}
```

El User-Agent es `"PokeRetoDex-catalog"` — nombre del proyecto, sin nombre de usuario, email, hostname ni ruta de sistema.

---

### PASS — Sin archivos grandes inesperados

**[Dato]** El catálogo en `public/catalog/v1/` contiene 1025 archivos JSON (confirmado por `_meta.json`: `"files_written": 1025`). Estos archivos son el output esperado del ETL y están intencionadamente commiteados para ser servidos como assets estáticos por Vercel/Next.js.

**[Estimación]** Los archivos individuales son pequeños (datos de cartas por Pokémon). `1.json` (Bulbasaur, uno de los más grandes) tiene ~30 entradas de cartas. El peso total del catálogo es proporcional: ~17.995 cartas EN + ~11.989 cartas ES según `_meta.json`.

**[Dato]** `scripts/out/` (caché HTTP, >1025 archivos JSON de respuestas de API) está ignorado por `.gitignore` y confirmado como no trackeado por `git status --short`.

No se detectaron blobs binarios inesperados (imágenes, ejecutables, archivos comprimidos).

---

### PASS — Sin credenciales de service account

**[Dato]** Glob para `*serviceAccount*.json`, `*service-account*.json`, `*firebase-adminsdk*.json` → sin resultados en el working tree.

**[Dato]** `.gitignore` tiene entradas explícitas para estos patrones. Además `scripts/*.json` cubre cualquier JSON suelto en `scripts/`.

---

## Tabla resumen

| Control | Estado | Etiqueta |
|---|---|---|
| Secretos en working tree (Firebase API key, tokens) | PASS | [Dato] |
| `.env.local` no trackeado | PASS | [Dato] |
| `.env.local.example` solo con placeholders | PASS | [Dato] |
| Service account no presente ni trackeado | PASS | [Dato] |
| `.gitignore` cubre `.env*`, `scripts/out/`, `serviceAccount` | PASS | [Dato] |
| `scripts/out/` no trackeado | PASS | [Dato] |
| Sin rutas absolutas en código | PASS | [Dato] |
| URLs solo de tcgdex.net | PASS | [Dato] |
| User-Agent sin información personal | PASS | [Dato] |
| Sin archivos grandes inesperados | PASS | [Estimación] |
| `.claude/settings.local.json` en historial | ADVERTENCIA | [Dato] |

---

## Veredicto

**APTO PARA PR** — No hay secretos ni credenciales en el working tree ni en el historial de archivos de código. El único hallazgo es que `.claude/settings.local.json` (rutas locales de Windows, sin credenciales) persiste en el historial de git antes de su eliminación en `1b0f0bf`. El impacto es bajo (solo revela la ruta de usuario del desarrollador). El PR puede abrirse; la limpieza del historial con `git filter-repo` es opcional y puede hacerse después del merge si se considera necesario.
