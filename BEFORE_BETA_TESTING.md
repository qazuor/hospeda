# Before Beta Testing

Checklist obligatorio antes de habilitar beta testing con clientes reales.
Cada item debe completarse y verificarse. No se abre beta hasta que todos
los bloqueantes (P0) estén resueltos.

## Estado actual

- SPEC-091 (Host Onboarding + Subscription Checkout): **implementado y commiteado**
- 225 tests pasando en código de SPEC-091
- Typecheck y lint limpio en código nuevo
- Estado de specs activas verificado contra código (2026-04-25)

## Specs ya completas (verificadas contra código)

Estas specs están 100% implementadas en código y NO requieren más trabajo.
El state.json fue actualizado para reflejarlo.

| Spec | Tareas | Estado |
|------|--------|--------|
| SPEC-026 (Security testing) | 16/16 | ✅ done |
| SPEC-034-GAPS (ISR Revalidation) | 28/28 | ✅ done |
| SPEC-036-gaps (Zod i18n) | 24/24 | ✅ done |
| SPEC-038 (Addon Entitlements) | 22/22 | ✅ done |
| SPEC-040 (Critical package coverage) | 35/35 | ✅ done |
| SPEC-041 (Admin integration tests) | 29/29 | ✅ done |
| SPEC-042-GAPS (CSP hardening) | 27/27 | ✅ done |
| SPEC-043-GAPS (Addon lifecycle) | 26/26 | ✅ done |
| SPEC-091 (Host onboarding + checkout) | 25/25 | ✅ done |

## Specs eliminadas o renombradas

- SPEC-029 (Web Homepage Redesign) — no existe en el repo
- SPEC-048 (Web2 Homepage Componentization) — no existe en el repo

---

## P0 — Bloqueantes técnicos (specs activas con gaps reales)

### 1. SPEC-088 — BaseCrudRead Pagination Strip Leak (CRÍTICO)

**Severidad: BLOCKER** — Causa HTTP 500 en endpoints públicos en
producción. Identificado tras incident del 2026-04-18.

Los keys `page`, `pageSize`, `sortBy`, `sortOrder` se filtran al WHERE
clause de la query. Endpoints afectados confirmados:

- `/api/v1/public/posts`
- `/api/v1/public/stats`
- `/api/v1/public/destinations`

Fix: strip de esos keys en `BaseCrudRead.search()` y `count()` antes
de invocar hooks. Ver `packages/service-core/src/base/base.crud.read.ts:305-332`.

Esfuerzo estimado: ~6h

- [ ] Implementar Option A del spec (strip en BaseCrudRead)
- [ ] Test de regresión que cubra los 3 endpoints
- [ ] Verificar manualmente que home page no rompe

### 2. SPEC-089 — Public Filter Alignment

**Severidad: BLOCKER** — Detail pages tiran error porque la API
rechaza filtros que la página manda.

Problemas:

- Accommodation detail `/[lang]/alojamientos/[slug].astro:55` llama
  `accommodationsApi.list({ ownerId, pageSize })` y la API rechaza
  el filtro `ownerId`
- Events detail tiene TODO sin resolver con `destinationId`
- Posts `destinationId` → ya resuelto inline a `relatedDestinationId`

Decisiones del spec:

- Endpoint nuevo `/api/v1/public/users/:id/accommodations` para listar
  propiedades por owner
- FK `destination_id` en `event_locations` para alinear filtro de events

Esfuerzo estimado: ~12h

- [ ] Crear endpoint público `/users/:id/accommodations`
- [ ] Migration agregando `destination_id` a `event_locations`
- [ ] Actualizar pages a usar nuevos endpoints
- [ ] Tests de regresión

### 3. SPEC-079 — Upload Rate Limiting

**Severidad: HIGH** — Sin rate limit, abuso de spam en uploads
puede agotar Cloudinary quota.

Spec define sliding-window por usuario. Middleware base existe en
`apps/api/src/middlewares/rate-limit.ts` pero no está claro si los
endpoints `/media/protected/upload` y `/media/admin/upload` están
cubiertos.

Esfuerzo estimado: ~8h

- [ ] Verificar cobertura actual de rate limit en endpoints media
- [ ] Implementar sliding-window per-user (in-memory + opcional Redis)
- [ ] Tests de límite (excede → 429, dentro → 200)

### 4. SPEC-064 — Billing Transaction Safety (gaps reales)

**Severidad: HIGH** — Procesamos dinero real con MP. 23 tasks de
verdad pendientes (state.json sincronizado a 47/70 tras verificación).

Tasks remanentes:

- T-036, T-037, T-038: Webhook signature verification middleware (NOT
  FOUND en código — riesgo crítico para producción)
- T-049, T-050: Rate limits en webhook endpoint (NOT FOUND)
- T-051: Audit log inserts en operaciones billing (NOT FOUND)
- T-044, T-045, T-046, T-047: Compensating events + soft-delete cascade
  (parcial)
- T-058 a T-070: ADR, runbook, JSDoc cleanup, meta tasks

Esfuerzo scoped: ~15h (solo críticos: webhook signature middleware, rate limits y audit log; resto post-beta).

- [ ] T-036/37/38: webhook signature middleware
- [ ] T-049/50: webhook rate limit
- [ ] T-051: audit log inserts en billing operations
- [ ] Tests de cada uno

### 5. SPEC-075 — Web App Complete Page Structure

**Severidad: MEDIUM** — 8/66 tasks done, 12% completado. Layouts
base implementados; faltan migrar 54 páginas al sistema nuevo.

Esfuerzo estimado: ~30h para llegar a ≥90%

- [ ] Priorizar las 20 páginas más visibles (home, listings, account)
- [ ] Migrar resto post-beta con tráfico real

### 6. SPEC-044 — Apply migration + decide gaps fate

**Severidad: LOW** — 1 task técnica + decisión sobre 49 gaps.

- [ ] T-021: Aplicar migración a dev DB (`pnpm db:migrate`)
- [ ] Decidir qué hacer con los 49 gaps de `gaps-state.json`:
  recomendación es triaje rápido y diferir la mayoría post-beta

### 7. SPEC-049 — Admin Filtering (2 gaps reales)

**Severidad: LOW** — Después de verificar, solo quedan 2 gaps:

- [ ] T-029: Tests de OR logic en `list.test.ts`
- [ ] T-068: Crear `service-error-code.test.ts` (file no existe)

Esfuerzo estimado: ~3h

---

## P0 — Validación end-to-end (sin código nuevo)

### 8. Smoke test manual de host onboarding en staging

- [ ] Levantar staging con DB reset + seed (`pnpm db:fresh-dev`)
- [ ] Crear cuenta nueva como propietario, verificar email vía Resend
- [ ] Recorrer `/publicar` → CTA → `/publicar/nueva`
- [ ] Llenar las 8 secciones del formulario completas
- [ ] Verificar autosave (status: idle → saving → saved)
- [ ] Verificar persistencia: cerrar pestaña, reabrir, ver banner "Continuar borrador"
- [ ] Subir 5 fotos a Cloudinary, verificar thumbnails
- [ ] Click "Publicar" → redirect a `/alojamientos/{slug}`
- [ ] Verificar en DB: rol HOST asignado, accommodation con `lifecycleState=ACTIVE`
- [ ] Visitar `/mi-cuenta/propiedades` y ver la propiedad con badge verde
- [ ] Editar desde `/mi-cuenta/propiedades/[id]/editar`, cambiar precio, ver PATCH

### 9. Ejecutar staging runbook MercadoPago

Seguir `.claude/specs/SPEC-091-mvp-blockers/staging-runbook.md`. No saltar pasos.

#### Preconditions

- [ ] App MP sandbox creada
- [ ] Variables de entorno seteadas en staging:
  - `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN`
  - `HOSPEDA_MERCADO_PAGO_PUBLIC_KEY`
  - `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET`
- [ ] Webhook URL registrada en MP: `https://staging.hospeda.com.ar/api/v1/webhooks/mercadopago`
- [ ] Planes seedeados

#### Scenarios

- [ ] Scenario 1: Approved con `5031 7557 3453 0604` cardholder `APRO`
- [ ] Scenario 2: Pending cardholder `CONT`
- [ ] Scenario 3: Rejected — verificar las 4 razones (`OTHE`, `FUND`, `CALL`, `SECU`)
- [ ] Scenario 4: Webhook idempotency — replay 3x, verificar 1 fila en `billing_webhook_events`
- [ ] Scenario 5: Unauthenticated → redirect a `/auth/signin?redirect=/suscriptores/planes`

### 10. Una transacción real pre-beta en producción

- [ ] Variables de entorno productivas seteadas
- [ ] Webhook URL prod registrada en MP
- [ ] Comprar plan más barato activo (~ARS $100) con tarjeta personal
- [ ] Verificar HMAC validation, idempotency key, subscription activation, success page
- [ ] Refund manual desde dashboard MP

### 11. Schema gaps menores

#### `location.city` no está en BaseLocationSchema

- [ ] Decidir: cambiar a `FullLocationFields` o aceptar limitación
- [ ] Si cambia: regenerar tipos y validar migrate

#### `amenityIds` no está en `AccommodationCreateInput`

- [ ] Verificar si la API persiste amenities desde el publish payload
- [ ] Si no: extender endpoint o crear `POST /accommodations/{id}/amenities`
- [ ] Test de regresión

### 12. Pricing page hardcoded vs billing config

Precios en pricing page (4990, 9990, 1990, 3990) NO coinciden con
`plans.config.ts` (centavos: 3500000, 7500000).

- [ ] Decidir fuente de verdad
- [ ] Si billing config: fetch server-side de planes activos
- [ ] Evitar gap legal de precio mostrado vs cobrado

---

## P1 — Importantes pero no bloqueantes (post-beta primer semana)

### 13. SPEC-080 — Service Integration Tests

Esfuerzo estimado: ~25h. Útil para confidence pero no bloquea beta.

### 14. Leaflet map para sección ubicación

- [ ] Instalar `leaflet` + `@types/leaflet`
- [ ] Implementar map con dynamic import en PropertyForm
- [ ] Pin draggable + lat/lng sync

### 15. Pre-existing typecheck errors en apps/api

Errores en `getBySlug.ts`, `similar.ts`, `status.ts`, varios test files.
No introducidos por SPEC-091 pero impiden CI estricto.

### 16. Pre-existing typecheck error en service-core

`packages/service-core/test/base/crud/getById.test.ts:379` con
`DrizzleClient | undefined`.

---

## P2 — Hardening recomendado (segundo sprint post-beta)

### 17. SPEC-077 — Accommodation Detail Page Rebuild

0/39 tasks. La página actual funciona — refactor es mejora UX no
bloqueante.

### 18. SPEC-085 — Guest-Owner Messaging

Feature compleja, post-MVP. 4 tablas, 3 servicios, inbox admin, crons.

### 19. SPEC-086 — Tag System Refactor

Breaking change schema. Desbloquea SPEC-085. Post-beta.

### 20. SPEC-064 — Billing Transaction Safety (resto)

Después de beta, completar T-058 a T-070 (docs, ADR, runbook, JSDoc).

---

## Definition of Done para beta

Beta se abre cuando:

1. Todos los items P0 (1-12) están con check
2. Mínimo 5 propietarios reales completaron host onboarding sin asistencia
3. Mínimo 1 transacción real procesada con éxito (incluido refund)
4. 0 incidentes críticos en Sentry durante 48h de QA con tráfico interno
5. Documentado el rollback procedure por si webhook falla en prod
6. SPEC-088 fix verificado en staging (HTTP 200 en endpoints afectados)
7. SPEC-089 detail pages cargan sin errores
8. SPEC-079 rate limiting aplicado a uploads

## Plan de ataque sugerido (1 sprint = 1 semana, 1 dev senior)

```text
Día 1 (8h):
  - SPEC-088 pagination strip fix (6h)
  - SPEC-049 T-029 + T-068 (2h)

Día 2 (8h):
  - SPEC-089 endpoint nuevo + migration events (8h)

Día 3 (8h):
  - SPEC-064 webhook signature middleware + rate limit + audit log (8h)

Día 4 (8h):
  - SPEC-079 rate limiting upload (8h)

Día 5 (8h):
  - SPEC-044 T-021 + decisión gaps (1h)
  - Schema gaps location.city + amenityIds + pricing alignment (4h)
  - Smoke test staging manual (3h)

Día 6-7:
  - Runbook MP staging completo
  - Transacción real producción
  - Buffer + fixes de smoke test
```

Total: ~40h de dev + ~16h de QA manual.

## Specs deferidas (decisión explícita)

- **SPEC-075**: Aceleramos a 90% si hay tiempo, sino se completa post-beta
  con tráfico real
- **SPEC-077**: Detail page actual funciona — rebuild post-beta
- **SPEC-080**: Service integration tests útiles pero no bloquean
- **SPEC-085, SPEC-086**: Features nuevas, post-MVP roadmap
- **SPEC-064 docs/ADR/runbook (T-058-T-070)**: Post-beta
- **SPEC-044 49 gaps**: Triaje rápido, mayoría diferida

## Owner

Qazuor — single decision-maker para abrir beta.

## Última actualización

2026-04-25
