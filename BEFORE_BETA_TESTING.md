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

### 1. SPEC-088 — BaseCrudRead Pagination Strip Leak (CRÍTICO) ✅ DONE (2026-04-26)

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

- [x] Implementar Option A del spec (strip en BaseCrudRead) — commit `2107ab95`
- [x] Test de regresión que cubra los 3 endpoints — `pagination-strip.test.ts` (9 tests)
- [ ] Verificar manualmente que home page no rompe — pendiente del smoke test E2E item 8

### 2. SPEC-089 — Public Filter Alignment ✅ DONE (2026-04-27)

**Severidad: BLOCKER** — Detail pages tiraban error porque la API
rechazaba filtros que la página mandaba.

- [x] Crear endpoint público `/api/v1/public/users/:id/accommodations`
  (10 tests integración) — commit `4eaf7316b`
- [x] FK `destination_id` en `event_locations` ya cubierto por SPEC-095;
  agregado `destinationId` a `EventSearchHttpSchema` y resolver
  service-side via subquery con strip de `filterParams` para no leakear
  al WHERE clause (7 tests service-core + 6 tests api)
- [x] Pages migradas: `alojamientos/[slug].astro:61` usa
  `accommodationsApi.listByOwner`; `destinos/[slug]/eventos/index.astro`
  reescrita de TODO placeholder a SSR list con paginación y empty state
- [x] Posts `destinationId` ya estaba resuelto inline (2026-04-18)

### 3. SPEC-079 — Upload Rate Limiting ✅ DONE (2026-04-27)

**Severidad: HIGH** — Sin rate limit, abuso de spam en uploads
puede agotar Cloudinary quota.

Spec define sliding-window por usuario. Middleware base existe en
`apps/api/src/middlewares/rate-limit.ts` pero no está claro si los
endpoints `/media/protected/upload` y `/media/admin/upload` están
cubiertos.

Esfuerzo estimado: ~8h

- [x] Verificar cobertura actual de rate limit en endpoints media
- [x] Implementar sliding-window per-user (in-memory + Redis backend) — commits `108f330a`, `20ae6581`
- [x] Tests de límite (excede → 429, dentro → 200) — 33 tests (16 sliding-window + 17 redis-store)
- [x] Env var `HOSPEDA_RATE_LIMIT_BACKEND=memory|redis` con fail-open

### 4. SPEC-064 — Billing Transaction Safety (gaps reales) ✅ DONE 70/70 (2026-04-26)

**Severidad: HIGH** — Procesamos dinero real con MP. State.json
sincronizado a 70/70 completed. Auditoría confirmó que muchas tasks
"pendientes" ya estaban implementadas; lo que faltaba era cobertura
de tests y documentación.

Tasks cerradas:

- [x] T-036/37/38: webhook signature middleware (verificado + tests, commit `a8143c8b`)
- [x] T-049/50: rate limits webhook + admin-billing (commit `a8143c8b`)
- [x] T-051: audit log inserts en billing addons + plan-change + promo-codes (commits `a8143c8b`, `363236e3`)
- [x] T-044/45/46/47: cascade soft-delete + compensating events `ADDON_REVOCATION_FAILED` (commit `76c46fad`)
- [x] T-058 a T-070: ADR-019 ya cubría T-058; runbook advisory locks creado; cleanups (commit `98a59d03`)
- [x] State.json synced to 70/70 (commit `3f92700e`)

### 5. SPEC-075 — Web App Complete Page Structure ✅ DEFERRED POST-BETA

**Severidad: MEDIUM** — 8/66 tasks done. Layouts base implementados;
las 54 páginas restantes no son bloqueantes para abrir beta. Owner
decidió completar post-beta con tráfico real informando prioridades.

- [x] Decisión: deferred-post-beta (2026-04-27)
- [ ] Migrar resto post-beta con tráfico real

### 6. SPEC-044 — Apply migration + decide gaps fate ✅ DONE 21/21 (2026-04-27)

**Severidad: LOW** — 1 task técnica + decisión sobre 49 gaps.

- [x] T-021: Aplicar migración a dev DB — verificado live: `canceled_at` y
  `deleted_at` columns nullable, no British `cancelled_at`, 0 filas con
  status='cancelled'. Bajo push-only policy aplica vía `drizzle-kit push`.
- [x] Decidir qué hacer con los 49 gaps de `gaps-state.json`: triage doc
  creado en `.qtm/tasks/SPEC-044-addon-purchase-schema-cleanup/triage-decision.md`.
  - Phase 3 race conditions (4 tasks): VERIFIED DONE — ya implementadas
    en código y cubiertas por tests existentes (commits `a912bba3`).
  - 45 tasks restantes: deferred-post-beta con justificación phase-by-phase.
  - Commits: `4b17f145`, `94eaa6c4`, `a912bba3`.

### 7. SPEC-049 — Admin Filtering (2 gaps reales) ✅ DONE 68/68 (2026-04-27)

**Severidad: LOW** — Después de verificar, solo quedan 2 gaps:

- [x] T-029: Tests de OR logic en `list.test.ts` — 5 tests nuevos, commit `994b7fda`
- [x] T-068: Crear schema test files (CONFIGURATION_ERROR + tag/admin-search +
  accommodationReview/admin-search) — 49 tests nuevos, commit `c7c413ab`

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

Seguir `.qtm/specs/SPEC-091-mvp-blockers/staging-runbook.md`. No saltar pasos.

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

#### `location.city` ✅ SUPERSEDED by SPEC-095 (2026-04-27)

- [x] El hotfix inicial (commit `7d19f59c`) que agregó `city` opcional a
  `BaseLocationSchema` fue revertido como parte de SPEC-095
  (Destination Relationship Cleanup). La solución estructural reemplaza el
  string libre por una FK a un destino del portal de tipo `CITY`, con
  validación service-level y proyección `cityDestination` en el response.
- [x] Los cards y JSON-LD ahora leen city de `cityDestination.name` (derivado
  vía transforms en el web app), no de `location.city`.
- Track de implementación: `.qtm/specs/SPEC-095-destination-relationship-cleanup/spec.md`

#### `amenityIds` no está en `AccommodationCreateInput` (post-beta)

Confirmado: el payload del frontend (`PropertyForm.client.tsx`) envía
`amenityIds: selectedAmenityIds` en el PATCH a
`/api/v1/protected/accommodations/:id`, pero `AccommodationUpdateSchema` no
incluye ese campo y el API lo descarta silenciosamente. El servicio sí tiene
`addAmenityToAccommodation` y `removeAmenityFromAccommodation`, pero no hay
ningún endpoint que los exponga. Implementarlo requiere:

- [ ] Crear endpoint `PUT /api/v1/protected/accommodations/{id}/amenities`
  con body `{ amenityIds: string[] }` (diff sync: borra los no incluidos,
  agrega los nuevos).
- [ ] Frontend: hacer la llamada después del PATCH, con el set selectedAmenityIds.
- [ ] Test de regresión cubriendo create + update.

Diferido post-beta: el alojamiento se publica sin amenities asociadas hasta
que se cierre este gap. Tracker:
`.qtm/specs/SPEC-094-accommodation-amenities-sync/spec.md` (status: draft,
sin tasks generadas — se atomizan cuando arranque la ventana post-beta).

### 12. Pricing page hardcoded vs billing config ✅ DONE (2026-04-26)

Precios en pricing page (4990, 9990, 1990, 3990) NO coinciden con
`plans.config.ts` (centavos: 3500000, 7500000).

- [x] Decidir fuente de verdad — `packages/billing/src/config/plans.config.ts`
  como single source of truth. Ver `docs/decisions/ADR-020-billing-plans-source-of-truth.md`.
- [x] Web pricing pages reescritas a SSG con import directo de `@repo/billing`
  (commit `98ecd05f`). Admin PlanDialog convertido a read-only.
- [x] Spec post-beta `SPEC-093-admin-editable-billing-plans` creado para
  cuando haya tracción real para pricing dinámico.

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

~~Después de beta, completar T-058 a T-070 (docs, ADR, runbook, JSDoc).~~
✅ Cerrado al 100% antes de beta (ver item 4). Esta entrada queda como
nota histórica.

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

2026-04-27 — **Todos los P0 técnicos cerrados.** Items 1-7, 11a, 12 con
check; item 5 (SPEC-075) deferido post-beta por decisión del owner.
SPEC-089 cerró el último bloqueante de código (commit `4eaf7316b`).
Quedan abiertos solo los items 8-10 de validación E2E manual (smoke
test host onboarding, runbook MP staging, transacción real prod) y el
item 11b (`amenityIds` → SPEC-094 a crear, deferred-post-beta).
