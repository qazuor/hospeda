# SPEC-063 Gaps — Implementation Plan

> **Fuente**: `.claude/specs/specs-gaps-063.md` (47 gaps, 5 pasadas de auditoría)
> **Triage**: 2026-04-20 — tech-lead + usuario (qazuor)
> **Estado post-triage**: 37 gaps HACER · 9 DEFERRED/NEW SPEC · 1 FALSE POSITIVE

## Resumen de decisiones

| Categoría | Count | Gaps |
|---|---|---|
| HACER (autónomos) | 17 | 001, 002, 003, 004, 005, 008, 009, 011, 018, 020, 023, 024, 025, 033, 034, 038, 045 |
| HACER (confirmados por usuario) | 20 | 006, 007, 013, 015, 016, 017, 019, 022, 026, 027, 028, 029, 030, 036, 039, 040, 041, 042, 043, 044 |
| POSTERGADOS | 5 | 012, 031, 035, 047 (+ 010 tracked en SPEC-087) |
| NEW SPEC | 4 | 014, 021, 032, 037 |
| DESCARTADOS (false positive) | 1 | 046 |
| **Total HACER** | **37** | |

## PR Plan (11 PRs)

Orden recomendado de merge. Las dependencias explícitas están marcadas.

### PR 1 — Restore Semantics (CRITICAL, blocker)

**Bloquea**: PR 2, PR 7 (tests de restore dependen de este fix).
**Branch sugerido**: `fix/spec-063-gaps-restore-lifecycle-reset`

**Scope**:
- GAP-022: modificar `BaseModel.restore()` en `packages/db/src/base/base.model.ts` para que, si la tabla tiene columna `lifecycle_state` (check vía Drizzle column metadata), el UPDATE incluya `lifecycleState: 'ACTIVE'` además del `deletedAt: null + updatedAt`.
- 4 regression tests (una por entidad: OwnerPromotion, Sponsorship, AccommodationReview, DestinationReview) que creen record con `{ lifecycleState: 'ARCHIVED', deletedAt: NOW }` y verifiquen que `restore()` lo deja con `lifecycleState: 'ACTIVE'`.

**Criterio de aceptación**:
- Tests AAA en `packages/db/test/base/base.model.test.ts` pasando.
- Ningún otro test existente rompe (los que restauran ya ACTIVE siguen ACTIVE, sin regresión).

---

### PR 2 — Security Bundle (CRITICAL) + Schema Parity AccRev

**Depende de**: PR 1 (para que los tests de exclusión de records post-restore tengan sentido).
**Branch sugerido**: `security/spec-063-gaps-public-lifecycle-enforcement`

**Scope**:
- **GAP-001** — `packages/service-core/src/services/accommodationReview/accommodationReview.service.ts:501-526` — `listByAccommodation()` agrega `lifecycleState: LifecycleStatusEnum.ACTIVE` al filter + nuevo param opcional `includeAllStates?: boolean` (default false). Protected `/me/reviews` usa `true`.
- **GAP-002** — `packages/service-core/src/services/destinationReview/destinationReview.service.ts` — agregar método `listByDestination({ destinationId, page, pageSize })` con `lifecycleState = ACTIVE` force-filter. `apps/api/src/routes/destination/reviews/public/list.ts` update para llamar al nuevo método con `params.destinationId`. Nueva `DestinationReviewListByDestinationParamsSchema`.
- **GAP-003** — `destinationReview.service.ts:160-177` `_executeSearch` + `_executeCount` force-override `lifecycleState = ACTIVE`.
- **GAP-004** — `accommodationReview.service.ts:170-187` idem.
- **GAP-005** — `apps/api/src/routes/owner-promotion/public/getById.ts:27-34` — filtrar `null` si `lifecycleState !== 'ACTIVE'`, parsear con `OwnerPromotionPublicSchema` (cierre parcial de SPEC-087).
- **GAP-013** — `packages/schemas/src/entities/accommodationReview/accommodationReview.query.schema.ts` — agregar `lifecycleState: LifecycleStatusEnumSchema.optional()` a `AccommodationReviewFiltersSchema` + `AccommodationReviewSearchSchema`.
- **GAP-019** — `packages/schemas/test/entities/accommodationReview/` — agregar `describe('AccommodationReviewSchema — lifecycleState', ...)` con 4 tests (default ACTIVE, acepta DRAFT/ACTIVE/ARCHIVED, rechaza enum inválido, Public excluye).
- **GAP-011** — extender `apps/api/test/integration/cross-cutting/lifecycle-public-endpoints.test.ts` con 4-5 tests de **exclusión de records** (no solo strip de campo): DRAFT AccommodationReview no aparece en public list de su accommodation; ARCHIVED ídem; DRAFT DestinationReview de destino Y no aparece; DRAFT OwnerPromotion → getById retorna null.
- **GAP-020** — mismo archivo: test cross-entity "record con `lifecycleState=ACTIVE` AND `deletedAt=NOW` es excluido del public tier" con `it.each` sobre las 3 entidades.

**Criterio de aceptación**:
- Todos los tests nuevos pasando.
- `pnpm vitest run packages/schemas` verde.
- `pnpm vitest run apps/api/test/integration/cross-cutting/lifecycle-public-endpoints.test.ts` verde.

---

### PR 3 — DB Indexes (push-only, paralelizable)

**Independiente** (puede ir en paralelo con PR 2).
**Branch sugerido**: `feat/spec-063-gaps-db-lifecycle-indexes`

**Scope** — one-liners en Drizzle schemas, `pnpm db:fresh-dev` post-merge:
- **GAP-018** — `packages/db/src/schemas/accommodation/accommodation_review.dbschema.ts` → `accommodation_reviews_lifecycleState_idx`.
- **GAP-023** — mismo file → composite `accommodation_reviews_accommodationId_lifecycleState_idx`.
- **GAP-024** — `packages/db/src/schemas/destination/destination_review.dbschema.ts` → composite `destination_reviews_destinationId_lifecycleState_idx`.
- **GAP-025** — `packages/db/src/schemas/sponsorship/sponsorship.dbschema.ts` → composite `sponsorships_sponsorshipStatus_lifecycleState_idx`.
- **GAP-033** — `packages/db/src/schemas/owner-promotion/owner_promotion.dbschema.ts` → composite `ownerPromotions_lifecycleState_validUntil_idx` (dominante del cron).
- **GAP-034** — `packages/db/src/schemas/sponsorship/sponsorship.dbschema.ts` → composite `sponsorships_lifecycleState_endsAt_idx` (anticipatorio).

**Criterio de aceptación**:
- `pnpm db:fresh-dev` sin errores.
- Verificar índices creados con `\d accommodation_reviews` etc.
- `packages/db/docs/triggers-manifest.md` y cualquier referencia mantenida si aplica.

---

### PR 4 — Strict Mode + AC Rejection Tests

**Independiente** de PR 2-3 (distinto file family).
**Branch sugerido**: `fix/spec-063-gaps-update-schema-strict-mode`

**Scope**:
- **GAP-016** — agregar `.strict()` a:
  - `packages/schemas/src/entities/ownerPromotion/owner-promotion.schema.ts` `OwnerPromotionUpdateInputSchema`
  - `packages/schemas/src/entities/sponsorship/sponsorship.schema.ts` `SponsorshipUpdateInputSchema`
  - `packages/schemas/src/entities/accommodationReview/accommodationReview.crud.schema.ts` `AccommodationReviewUpdateInputSchema`
- **GAP-017** — integration tests en `apps/api/test/integration/admin/`:
  - AC-002-02: `PATCH /admin/owner-promotions/:id` con `{ isActive: false }` → 400 VALIDATION_ERROR.
  - AC-003-03: `PATCH /admin/sponsorships/:id` con `{ status: 'active' }` → 400.
  - Defense-in-depth: `PATCH /admin/accommodation-reviews/:id` con campos legacy → 400.

**Criterio de aceptación**:
- Los tests de schemas en `packages/schemas/test/` siguen pasando (ya usaban `.strict()` localmente; ahora también runtime).
- Integration tests nuevos verdes.

---

### PR 5 — Cron Hygiene Bundle

**Independiente**.
**Branch sugerido**: `fix/spec-063-gaps-cron-hygiene`

**Scope** — todo en `apps/api/src/cron/jobs/archive-expired-promotions.job.ts`:
- **GAP-027** — wrap `Sentry.captureException` en try-catch con `logger.warn` fallback. Evaluar extraer `safeReportToSentry()` helper si conviene reutilizar en otros cron jobs.
- **GAP-028** — validar shape de `lockResult.rows?.[0]`. Si `!lockRow || typeof lockRow.acquired !== 'boolean'` → log ERROR + Sentry + throw explícito. Si `!lockRow.acquired` → log INFO + `{ skipped: true }`.
- **GAP-038** — reemplazar `'ACTIVE'` / `'ARCHIVED'` literal strings por `LifecycleStatusEnum.ACTIVE` / `LifecycleStatusEnum.ARCHIVED` (import desde `@repo/schemas`).
- **GAP-045** — agregar `ids: expiredIds` al `logger.info('Archived expired promotions', {...})` (cierre parcial de GAP-012 postergado).

**Criterio de aceptación**:
- Test unit actualizado para el cron cubre: lock held, lock malformed (nuevo), lock acquired, Sentry success, Sentry-throws-caught.

---

### PR 6 — Admin Dashboard Cleanup

**Independiente**.
**Branch sugerido**: `fix/spec-063-gaps-admin-sponsorship-ui`

**Scope**:
- **GAP-006** — `apps/admin/src/features/sponsor-dashboard/hooks.ts:30` — rename path `status=active` → `sponsorshipStatus=active`.
- **GAP-007** — `apps/admin/src/features/sponsor-dashboard/types.ts:49-54` — rename `SponsorshipFilters.status?: string` → `sponsorshipStatus?: SponsorshipStatus`. Update consumidores (grep first).
- **GAP-026** — `apps/admin/src/features/sponsorships/components/SponsorshipsTab.tsx` — agregar columna `lifecycleState` al DataTable con badge (DRAFT gris / ACTIVE verde / ARCHIVED amber). Reusar `LifecycleBadge` existente o `ColumnType.BADGE` pattern.

**Criterio de aceptación**:
- Test smoke manual de admin dashboard: card "Active Sponsorships" carga con count > 0 en entorno seeded.
- Grid de Sponsorships muestra columna lifecycleState + filtro funciona.

---

### PR 7 — Integration Tests + Permission Boundaries + Review UPDATE Alignment

**Depende de**: PR 1 (restore semantics) + PR 2 (service filter fixes).
**Branch sugerido**: `security/spec-063-gaps-permission-boundaries`

**Scope**:
- **GAP-036** (Opt A — stricter):
  - `apps/api/src/routes/accommodation/reviews/admin/update.ts:31` — `requiredPermissions: [ACCOMMODATION_REVIEW_UPDATE, ACCOMMODATION_REVIEW_MODERATE]`.
  - `apps/api/src/routes/destination/reviews/admin/update.ts:30` — `requiredPermissions: [DESTINATION_REVIEW_UPDATE, DESTINATION_REVIEW_MODERATE]`.
- **GAP-029** — extender `apps/api/test/integration/sponsorship/admin-search-filters.test.ts` y equivalentes para OwnerPromotion, AccommodationReview, DestinationReview con tests AC-001/003-02 (seed DRAFT+ACTIVE+ARCHIVED; hit admin endpoint `?status=ARCHIVED`; assert subset correcto).
- **GAP-030** — en cada `packages/service-core/test/services/*/permissions.test.ts` agregar test boundary para `checkCanAdminList` (non-admin actor → FORBIDDEN throw).
- **GAP-044** — crear `apps/api/test/integration/{accommodation,destination}-reviews/permission-boundaries.test.ts` con 3 casos por entidad:
  1. Actor con `*_REVIEW_UPDATE` sin `*_REVIEW_MODERATE` → 403 al cambiar lifecycleState (valida también GAP-036 alignment a nivel route).
  2. Author user intentando setear lifecycleState vía protected update → rejected/ignored (clarificar comportamiento).
  3. Anonymous actor → 401/403 uniforme.

**Criterio de aceptación**:
- Los 403 de tests write-path ahora vienen del route layer (no del service throw).
- Coverage boundary + AC filters al día.

---

### PR 8 — Sponsorship Permission Split (GAP-015 Opt 1)

**Independiente**.
**Branch sugerido**: `feat/spec-063-gaps-sponsorship-status-permission`

**Scope**:
- `packages/service-core/src/services/sponsorship/sponsorship.permissions.ts` — agregar `checkCanManageSponsorshipStatus(actor, data)`: si `data.sponsorshipStatus !== undefined` → requerir `SPONSORSHIP_STATUS_MANAGE` además del `SPONSORSHIP_UPDATE`.
- `packages/service-core/src/services/sponsorship/sponsorship.service.ts._canUpdate` — llamar primero a `checkCanUpdate(actor, entity)` (existente) y luego a `checkCanManageSponsorshipStatus(actor, data)` (nuevo) cuando el payload incluya `sponsorshipStatus`.
- Tests unitarios en `packages/service-core/test/services/sponsorship/permissions.test.ts`:
  - Actor con `SPONSORSHIP_UPDATE` sin `SPONSORSHIP_STATUS_MANAGE`, payload `{ sponsorshipStatus: 'active' }` → FORBIDDEN.
  - Mismo actor, payload sin `sponsorshipStatus` → OK.
  - Actor con ambos permisos, cualquier payload → OK.

**Criterio de aceptación**:
- `SPONSORSHIP_STATUS_MANAGE` deja de ser unused.
- Spec.md Phase 3 step 15 (R6) queda implementado de facto.

---

### PR 9 — Schema Rename `limit` → `pageSize`

**Depende de**: PR 2 y PR 4 (los services relacionados ya estabilizados).
**Branch sugerido**: `refactor/spec-063-gaps-pagination-alignment`

**Scope**:
- **GAP-041** — rename en:
  - `packages/schemas/src/entities/sponsorship/sponsorship.schema.ts:136-137`
  - `packages/schemas/src/entities/sponsorship/sponsorship-level.schema.ts:105-106`
  - `packages/schemas/src/entities/sponsorship/sponsorship-package.schema.ts:98-99`
  - OwnerPromotion search schemas (buscar el patrón).
- Update `sponsorship.service.ts`, `ownerPromotion.service.ts` + admin-search variants — eliminar los casts `as Record<string, unknown>`.
- Update admin frontend hooks que consuman (`grep -r "limit=" apps/admin/src/features/{sponsorships,owner-promotions,sponsor-dashboard}/`).
- Sin backward-compat shim.

**Criterio de aceptación**:
- `pnpm typecheck` global verde.
- `pnpm test` verde.
- Admin grid de Sponsorships/OwnerPromotion sigue funcionando.

---

### PR 10 — Code Quality Refactor

**Depende de**: PR 2 (para no generar merge conflicts en los review services).
**Branch sugerido**: `refactor/spec-063-gaps-code-quality`

**Scope**:
- **GAP-039** — extraer `computeAccommodationReviewAverage(rating: unknown): number` a `accommodationReview.helpers.ts` (mirror del sibling). Eliminar el cast dishonesto.
- **GAP-040** — extraer método privado `_scheduleRevalidation(slug: string | undefined)` en cada review service; reducir 12 copias a 2 definiciones (una por service). `accommodationReview.service.ts` debe quedar bajo 500 LOC.
- **GAP-042** — eliminar `if (!actor) throw` dead guards en `checkCanViewAccommodationReview` y `checkCanViewDestinationReview`; reemplazar por body vacío + comentario `// Public — cualquier actor puede ver`.
- **GAP-043** — borrar `accommodationReview.normalizers.ts` y `destinationReview.normalizers.ts` (puros passthrough); desconectar wiring en los services. YAGNI.

**Criterio de aceptación**:
- Zero semantic change.
- `pnpm typecheck` + `pnpm vitest run packages/service-core/test/services/{accommodationReview,destinationReview}` verde.
- `wc -l packages/service-core/src/services/accommodationReview/accommodationReview.service.ts` < 500.

---

### PR 11 — Docs Cleanup

**Independiente**, trivial.
**Branch sugerido**: `docs/spec-063-gaps-stale-references`

**Scope**:
- **GAP-008** — `.claude/tasks/SPEC-063-lifecycle-state-standardization/TODOs.md:17-24`:
  - Marcar resuelto el item de "3 pre-existing schema test failures".
  - Marcar resuelto el item de "5 typecheck errors in destinationReview".
  - Marcar done el item de "delete T-029 SQL files".
  - Dejar abierto el item de SPEC-087 (real).
- **GAP-009** — `.claude/specs/SPEC-063-lifecycle-state-standardization/spec.md:318` — cambiar `pg_try_advisory_lock(43010)` → `pg_try_advisory_xact_lock(43010)` + parenthetical "(transaction-level per `packages/db/docs/advisory-locks.md` rule 1)".

**Criterio de aceptación**:
- Diff doc-only.
- Grep confirma que no quedan referencias a la versión stale del lock.

---

## New SPECs a crear (fuera de este plan)

| Gap | Spec propuesto | Scope |
|---|---|---|
| 014 | `SPEC-09X-i18n-pt-translation-audit` | Traducir `pt/validation.json` + audit paridad PT en todos los locale files |
| 021 | `SPEC-09X-lifecycle-state-phase-2-sponsorship-catalog` | SponsorshipLevel, SponsorshipPackage + entidades adyacentes con `isActive` |
| 032 | `SPEC-09X-cron-dispatcher-resilience` | Retry/backoff, dead-letter, observability metrics |
| 037 | `SPEC-09X-destination-reviews-admin-ui` | Feature admin completa (~800 LOC) |

## Postergados (tracking only)

- **GAP-010**: tracked en SPEC-087.
- **GAP-012**: cron audit trail persistente. Partial close via GAP-045 (log `ids`).
- **GAP-031**: auto-archived UI badge.
- **GAP-035**: composite index en `tags`.
- **GAP-047**: enum case normalization HTTP.

## Descartados (false positive)

- **GAP-046**: `_canPatch` ownership-bypass. Verificado: `BaseCrudService` no tiene método `patch()`. PATCH routes llaman a `update()` que hace ownership check correctamente.

## Dependency graph

```
PR 1 (Restore CRITICAL) ──┐
                          ├──> PR 2 (Security Bundle) ──┐
                          │                             ├──> PR 7 (Integration Tests + Perm)
PR 3 (DB Indexes) ────────┤                             │
PR 4 (Strict Mode) ───────┼─────────────────────────────┼──> PR 9 (Rename limit)
                          │                             │
PR 5 (Cron Hygiene) ──────┤                             └──> PR 10 (Code Quality)
PR 6 (Admin Cleanup) ─────┤
PR 8 (Sponsorship Perm) ──┤
PR 11 (Docs) ─────────────┘
```

## Métricas finales de triage

- 47 gaps totales
- 37 HACER (78%)
- 5 postergados (10%)
- 4 nuevas SPECs (9%)
- 1 descartado (2%)

## Verificación

Al completar todos los PRs:
- `pnpm typecheck` + `pnpm lint` + `pnpm test` globales verdes.
- Re-correr la auditoría (una 6ta pasada) para confirmar que las 37 decisiones HACER están implementadas.
- Regenerar progress report de SPEC-063 con todos los gaps cerrados.
- Eliminar la sección "Recommended fix order" del `specs-gaps-063.md` dejando solo el registro histórico + las decisiones de triage.
