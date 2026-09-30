# Firebase PRE — Guía de conexión

Instrucciones reproducibles para conectar el proyecto a un Firebase distinto del de PROD. Sin valores reales — solo nombres de variables y comandos.

## Proyecto Firebase PRE

| Campo | Valor |
|---|---|
| Project ID | `pokeretodexpre` |
| Región Firestore | `eur3 (europe-west)` |
| Plan | Spark (gratuito) |
| Auth habilitado | Email/Password |

## Variables de entorno requeridas

Crear `.env.local` en la raíz del proyecto (nunca commitear este archivo — ya está en `.gitignore`):

```
NEXT_PUBLIC_FIREBASE_API_KEY=<valor de la consola Firebase → Configuración del proyecto>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=pokeretodexpre.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=pokeretodexpre
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=pokeretodexpre.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<valor de la consola Firebase>
NEXT_PUBLIC_FIREBASE_APP_ID=<valor de la consola Firebase>
```

Dónde encontrar los valores: Consola Firebase → seleccionar proyecto `pokeretodexpre` → ⚙️ Configuración del proyecto → pestaña "General" → sección "Tus apps" → app web.

> **Nota sobre `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`**: este valor también se usa internamente para construir el email sintético de autenticación (`username@<AUTH_DOMAIN>`). Es crítico que coincida exactamente con el dominio del proyecto Firebase que se está usando — no es solo un parámetro de OAuth.

## Desplegar reglas de Firestore

Las reglas están en `firestore.rules` en la raíz del repo. Para desplegarlas en el proyecto PRE:

```bash
# 1. Autenticarse (solo la primera vez por máquina)
npx firebase-tools login

# 2. Verificar acceso al proyecto
npx firebase-tools projects:list

# 3. Desplegar solo las reglas de Firestore
npx firebase-tools deploy --only firestore:rules --project pokeretodexpre
```

La salida esperada al finalizar: `✔  Deploy complete!`

## Smoke test (verificación manual)

Con `npm run dev` arrancado y `.env.local` configurado:

1. Registro: crear una cuenta nueva con username + contraseña → esperar redirección a `/pokedex`
2. Login: cerrar sesión, volver a entrar → flujo correcto
3. Marcar un Pokémon: abrir modal, seleccionar variante, guardar → sin errores en consola
4. Recargar: el Pokémon marcado persiste → confirma lectura de Firestore

Si algún paso falla con `Missing or insufficient permissions`, las reglas no están desplegadas. Ejecutar el paso 3 de "Desplegar reglas" arriba.

## Notas de seguridad

- El dominio del email sintético (`@pokeretodexpre.firebaseapp.com`) nunca se expone al usuario ni en la UI
- Las variables `NEXT_PUBLIC_*` son visibles en el bundle del cliente — es el comportamiento estándar de Firebase para apps web; no contienen secretos operacionales
- El `NEXT_PUBLIC_FIREBASE_APP_ID` identifica la app registrada en Firebase, no es una credencial de acceso

## CSP — pendiente para TCGdex (no aplicar todavía)

Cuando se integre el catálogo TCGdex, añadir en `next.config.mjs` la directiva `img-src`:

```js
"img-src 'self' data: blob: https://raw.githubusercontent.com https://assets.tcgdex.net",
```

No aplicar hasta que la feature de catálogo de cartas esté implementada.

## Diferencias PROD ↔ PRE

| | PROD | PRE |
|---|---|---|
| Project ID | `pokeretodex` | `pokeretodexpre` |
| Auth domain | `pokeretodex.firebaseapp.com` | `pokeretodexpre.firebaseapp.com` |
| Storage bucket | `pokeretodex.firebasestorage.app` | `pokeretodexpre.firebasestorage.app` |
| Repo git | `praisegaming/PokeRetoDex` (privado) | `BryGomezDev/PokeRetoDexPre` (público) |
| Remote git | `prod` (push bloqueado) | `origin` |
| Usuarios reales | Sí | No — solo para pruebas |
| Datos `/pokemon` | 1216 docs (script Python) | Vacío hasta poblar manualmente |
