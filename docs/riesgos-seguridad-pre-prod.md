# Riesgos de seguridad pendientes — Pre-producción

Documento interno de trabajo. Registra los riesgos de seguridad identificados que **no se aplican en PRE** pero deben resolverse antes de la siguiente release de producción.

Fecha de identificación: 2026-10-11
Archivo afectado: `next.config.mjs`

---

## Riesgo 1 — `'unsafe-eval'` en la Content Security Policy

| Campo | Detalle |
|---|---|
| **Archivo / línea** | `next.config.mjs`, línea 5 |
| **Valor actual** | `"script-src 'self' 'unsafe-inline' 'unsafe-eval'"` |
| **Severidad** | Media |

### Descripción del problema

La directiva `'unsafe-eval'` permite que el navegador ejecute código generado dinámicamente mediante `eval()`, `new Function()` y `setTimeout(string)`. Los builds de producción de Next.js 14 **no necesitan esta directiva** — solo requieren `'unsafe-inline'` para la hidratación del lado cliente.

`'unsafe-eval'` fue probablemente añadida durante el desarrollo para silenciar un error que solo aparece en modo dev. En producción no tiene ningún propósito y debilita materialmente la CSP: si un atacante logra inyectar script (por ejemplo, a través de una entrada de usuario no validada en un futuro cambio), puede usar `eval()` para ejecutar código arbitrario dentro del contexto de la página, saltándose la protección que la CSP debería proporcionar.

### Impacto

Sin `'unsafe-eval'`, un XSS que inyecte `<script>eval(payload)</script>` es bloqueado por el navegador antes de ejecutarse. Con `'unsafe-eval'` activo, ese bloqueo no ocurre.

### Fix propuesto (antes de PROD)

Eliminar `'unsafe-eval'` de la cadena `script-src` en `next.config.mjs`:

```js
// Antes
"script-src 'self' 'unsafe-inline' 'unsafe-eval'",

// Después
"script-src 'self' 'unsafe-inline'",
```

Tras el cambio, ejecutar `npm run build` y verificar manualmente las funciones principales en el navegador (login, marcar carta como poseída, dashboard, cambio de avatar) para confirmar que ninguna librería de terceros cargada en runtime requiere `eval`.

### Por qué no se aplica en PRE

Necesitamos verificar primero si alguna dependencia instalada actualmente requiere `eval` en runtime antes de eliminarlo, para evitar romper la app silenciosamente en Vercel al desplegar. La eliminación es segura solo una vez confirmado que el build y las rutas principales funcionan sin el flag.

---

## Riesgo 2 — Headers de seguridad incompletos: faltan `Referrer-Policy` y `Permissions-Policy`

| Campo | Detalle |
|---|---|
| **Archivo / línea** | `next.config.mjs`, función `headers()` (líneas 25–36) |
| **Headers actuales** | `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` |
| **Severidad** | Baja |

### Descripción del problema

Los headers de seguridad actuales son correctos pero incompletos. Faltan dos headers estándar de defensa en profundidad:

**`Referrer-Policy`**
Sin este header, el navegador puede incluir la URL completa de la página de origen en la cabecera `Referer` al hacer peticiones cross-origin (a los dominios de Firebase, Google APIs o assets de TCGdex). Esto puede filtrar rutas internas o parámetros de URL a servicios externos sin necesidad de un atacante activo.

**`Permissions-Policy`**
Sin este header, el navegador no tiene instrucción explícita sobre qué APIs de dispositivo puede usar la página. Si ocurriera un XSS, el script inyectado podría intentar acceder a cámara, micrófono o geolocalización. Declarar explícitamente que la app no usa ninguna de estas APIs reduce la superficie de ataque disponible para un script malicioso.

Nota: `Strict-Transport-Security` (HSTS) está cubierto por Vercel a nivel de edge — no es necesario añadirlo aquí.

### Impacto

Bajo para esta app en su contexto actual (2 usuarios, datos no sensibles más allá de la colección personal). La ausencia de estos headers no es explotable por sí sola, pero es una omisión de práctica estándar que todo navegador moderno respeta sin coste adicional.

### Fix propuesto (antes de PROD)

Añadir los dos headers al array de la función `headers()` en `next.config.mjs`, junto a los existentes:

```js
{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
```

### Por qué no se aplica en PRE

No es bloqueante ni urgente. Se agrupa con el fix del Riesgo 1 para hacer un único cambio en `next.config.mjs` y un único deploy de verificación, evitando dos rondas de prueba manual en Vercel.

---

## Resumen de acciones antes del próximo deploy de producción

| # | Acción | Archivo | Prioridad |
|---|---|---|---|
| 1 | Eliminar `'unsafe-eval'` de `script-src` tras verificar que el build funciona sin él | `next.config.mjs` línea 5 | Media |
| 2 | Añadir `Referrer-Policy` y `Permissions-Policy` al array de headers | `next.config.mjs` líneas 29–33 | Baja |
