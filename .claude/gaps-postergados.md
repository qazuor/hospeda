# Gaps Postergados - SPEC-021

Decisiones tomadas en sesión de revisión del 2026-03-08.

## GAP-5TH-08: Addon entitlements modifican plan global de QZPay

- **Severidad:** CRITICAL (P0)
- **Razón de postergación:** Requiere cambio arquitectónico en dos repos (Hospeda + QZPay). Se creó SPEC-038-addon-entitlements-architecture dedicada.
- **SPEC dedicada:** `.claude/specs/SPEC-038-addon-entitlements-architecture/spec.md`
- **Hallazgo de verificación:** Confirmado que `plans.update()` en QZPay modifica el plan GLOBAL en tabla `billing_plans`. Las suscripciones solo tienen FK `planId`. Sin embargo, QZPay ya tiene tablas `billing_customer_entitlements` y `billing_customer_limits` per-cliente que NO se usan.
- **Solución:** Cambiar de `plans.update()` a usar sistema de customer entitlements/limits de QZPay.
- **Fecha:** 2026-03-08

## Gaps delegados a SPEC separada de BaseModel/DB

Los siguientes gaps requieren una spec separada por impacto transversal en todos los modelos:

### GAP-NEW-10: findWithRelations() en BaseModel ignora parámetro relations

- **Severidad:** HIGH
- **Razón:** Bug crítico en base que afecta todos los modelos. `findWithRelations()` recibe `relations` pero ejecuta query sin joins.

### GAP-5TH-DB-05: BaseModel no filtra soft-delete por defecto

- **Severidad:** HIGH
- **Razón:** `findAll()`, `count()`, `findById()`, `findOne()` no agregan `deletedAt IS NULL`. Afecta todos los modelos.

### GAP-6TH-DB-01: findAllWithRelations count() inconsistente con soft-deletes

- **Severidad:** HIGH
- **Razón:** Query y count usan construcciones WHERE diferentes, causando totales de paginación incorrectos.

### GAP-23: AccommodationModel.search() sin soft-delete filter

- **Severidad:** LOW
- **Razón:** Se resuelve como parte del fix general de soft-delete en BaseModel.

**Estado:** Pendiente de crear spec formal.
**Fecha:** 2026-03-08

---

## SPEC-023 Gaps Postergados (sesión 2026-03-09)

### GAP-023-DEBT-01: Alinear @types/react a una sola versión en el monorepo

- **Severidad:** MEDIUM
- **Origen:** Gap #23 de SPEC-023
- **Situación actual:** `apps/admin` usa `@types/react@19.1.10` (fija), `apps/web` usa `@types/react@19.2.14` (fija), el resto usa rangos `^19.x`. Esto causaba 8 errores de typecheck por conflicto csstype.
- **Workaround aplicado:** `pnpm.overrides` para `csstype`, `@types/react` y `@types/react-dom` forzando versión `19.1.10`/`19.1.7`.
- **Deuda:** Eliminar los overrides y alinear las versiones directamente en cada `package.json`. Evaluar si se puede subir todo a `@types/react@19.2.x` sin breaking changes.
- **Fecha:** 2026-03-09

---

## SPEC-031 Gaps Postergados (sesion 2026-03-09)

### GAP-031-09: Sin virus/malware scanning de archivos adjuntos

- **Severidad:** BAJA
- **Razón de postergación:** Riesgo bajo para beta con testers de confianza. Solo imágenes validadas por tipo, van a Linear, hay rate limiting.
- **Evaluar:** Post-beta, considerar integración ClamAV o VirusTotal.
- **Fecha:** 2026-03-09

---

## SPEC-037 Gaps Postergados (sesion 2026-03-09)

### GAP-037-27: CSP headers con unsafe-inline y unsafe-eval

- **Severidad:** MEDIUM
- **Origen:** GAP-037-27 de SPEC-037
- **Problema:** CSP Report-Only con `unsafe-inline` + `unsafe-eval` en `apps/web/vercel.json` y `apps/admin/vercel.json` = proteccion XSS cero efectiva.
- **Razon de postergacion:** Requiere investigacion de compatibilidad con Astro y Vite para CSP basado en nonces. Estimado 4-8 horas de investigacion + implementacion.
- **SPEC dedicada:** SPEC-040: CSP Nonce Integration (por crear)
- **Fecha:** 2026-03-09

---

## SPEC-026 Gaps Postergados (sesion 2026-03-10)

### GAP-026-013: CSP sin soporte de nonce para scripts dinamicos

- **Severidad:** MEDIA (P2)
- **Razon de postergacion:** Ya cubierto por SPEC-040 (CSP Nonce Integration). No duplicar trabajo.
- **SPEC dedicada:** SPEC-040
- **Fecha:** 2026-03-10

---

## SPEC-038 Gaps Postergados (sesión 2026-03-16)

### GAP-038-25: UserAddon.status American vs British spelling — silent comparison failure

- **Severidad:** HIGH
- **Origen:** GAP-038-25 de SPEC-038
- **Problema:** `addon.types.ts` usa `'canceled'` (American), DB column es `cancelled_at` (British), servicio escribe `'cancelled'` (British). Comparaciones de status fallan silenciosamente.
- **Razón de postergación:** El fix elegido (estandarizar en American `canceled`) requiere migración de DB column `cancelled_at` → `canceled_at`, lo cual es invasivo. El workaround inmediato es que el servicio ya escribe `'cancelled'` consistente con la DB, y el type mismatch solo afectaría a consumidores nuevos del tipo UserAddon.
- **Solución futura:** Migración de DB + estandarizar todo en American spelling.
- **Fecha:** 2026-03-16

---

## SPEC-042 Gaps Postergados (sesión 2026-03-17)

### Bloqueados por SPEC-045 (Vite 7 + TanStack upgrade)

| Gap | Severidad | Descripción |
|-----|-----------|-------------|
| GAP-042-01 | CRITICAL | Nonce generado pero NO inyectado en scripts SSR (Admin) |
| GAP-042-18 | HIGH | router.tsx NO implementa getCspNonce via createIsomorphicFn |
| GAP-042-19 | HIGH | TanStack Start 1.131.26 < mínimo requerido (1.133.12) |
| GAP-042-21 | MEDIUM | start.ts usa registerGlobalMiddleware() en vez de createStart() |
| GAP-042-13 | CRITICAL | Admin CSP middleware no cubre SSR inicial (solución real) |

### Bloqueados por dominios de producción no definidos

| Gap | Severidad | Descripción |
|-----|-----------|-------------|
| GAP-042-27 | HIGH | img-src https: wildcard excesivamente permisivo |
| GAP-042-31 | MEDIUM | Web connect-src no incluye dominio explícito del API |
| GAP-042-38 | MEDIUM | Wildcard *.vercel.app en connect-src permite exfiltración |

### Bloqueados por deploy/infraestructura

| Gap | Severidad | Descripción |
|-----|-----------|-------------|
| GAP-042-12 | HIGH | SPEC-046 en draft, bloquea transición a Phase 2 |
| GAP-042-15 | HIGH | Sin staging environment (SPEC-025 pendiente) |
| GAP-042-07 | MEDIUM | Sin monitoreo/alerting de CSP violations en Sentry |
| GAP-042-43 | MEDIUM | Sentry CSP violation collection no verificada E2E |

### Bloqueados por verificación empírica

| Gap | Severidad | Descripción |
|-----|-----------|-------------|
| GAP-042-04 | HIGH | unsafe-eval en admin CSP (verificar si MercadoPago security.js se carga) |

### Phase 2 prerequisites

| Gap | Severidad | Descripción |
|-----|-----------|-------------|
| GAP-042-05 | MEDIUM | unsafe-inline en web script-src (migrar is:inline a ES modules) |
| GAP-042-14 | MEDIUM | is:inline scripts no reciben hashes de Astro |
| GAP-042-10 | LOW | Solo report-uri (deprecated), falta report-to |

### Phase 3 / Deuda técnica

| Gap | Severidad | Descripción |
|-----|-----------|-------------|
| GAP-042-28 | MEDIUM | Falta directiva Trusted-Types |
| GAP-042-45 | MEDIUM | Admin 14+ instancias de style={{}} dinámico |
| GAP-042-25 | LOW | Inline styles dinámicos en web (refactoring CSS) |
| GAP-042-34 | LOW | Sentry DSN expuesto en report-uri (riesgo aceptado) |
| GAP-042-33 | LOW | Web falta frame-src 'none' explícito (default-src cubre) |

---

## SPEC-036 Gaps Postergados (sesión 2026-03-10)

---

## SPEC-057 Gaps Postergados (sesión 2026-03-31)

### GAP-057-006: Sponsorship Has No Non-List Admin Routes

- **Severidad:** MEDIUM (P3)
- **Origen:** GAP-057-006 de SPEC-057
- **Problema:** Sponsorship es la única entidad de las 16 con admin list route pero sin otras rutas admin CRUD (getById, create, update, delete, etc.).
- **Razón de postergación:** Requiere decisión de producto sobre si admins necesitan gestionar sponsorships directamente o si el flujo protected es suficiente.
- **Fecha:** 2026-03-31

---

### GAP-036-021: EN/PT translations son 100% placeholders

- **Severidad:** HIGH
- **Origen:** GAP-036-021 de SPEC-036
- **Problema:** ~2,732 líneas en EN y PT validation.json son texto en español con prefijos `[EN]`/`[PT]`. 1,134 claves sin traducir en cada locale.
- **Razón de postergación:** Mercado actual es Argentina (español). Fue non-goal intencional del Phase 1 de SPEC-036. Traducir cuando se expanda a mercados no-hispanos.
- **Fecha:** 2026-03-10

---

## SPEC-054 Gaps Postergados (sesión 2026-04-05)

### GAP-054-019: activeFilters memo depends on entire searchParams object

- **Severidad:** Very Low (P4)
- **Origen:** GAP-054-019 de SPEC-054
- **Problema:** `useFilterState.ts:112-115` memoiza activeFilters con `[searchParams, filterBarConfig]`. Cualquier cambio a cualquier param invalida y recalcula.
- **Razón de postergación:** Impacto negligible con 3-5 filtros por entidad. Optimización prematura.
- **Fecha:** 2026-04-05

### GAP-054-038: Props types use `interface` instead of spec's `type` keyword

- **Severidad:** Very Low (P4)
- **Origen:** GAP-054-038 de SPEC-054
- **Problema:** Spec define props como `type` pero implementación usa `export interface`. Sin impacto funcional.
- **Razón de postergación:** Nit cosmético, no vale el churn.
- **Fecha:** 2026-04-05
