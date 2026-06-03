# SPEC-192: Billing Catalog to DB

## Progress: 17/37 tasks (46%)

**Average Complexity:** 2.3/3 (max)
**Critical Path:** T-001 → T-002 → T-003 → T-004 → T-007 → T-008 → T-009 → T-010 → T-011 → T-012 → T-013 → T-014 → T-015 → T-016 → T-017 → T-020 → T-022 → T-023 → T-024 → T-025 → T-026 → T-027 → T-028 → T-029 → T-030 → T-031 → T-032 → T-033 → T-034 → T-035 → T-036 → T-037 (32 sequential steps)
**Parallel Tracks:** 3 tracks identified (FR-3 CRUD track runs in parallel with FR-4 plan cutover track after T-004 completes)

> **BILLING CORE WARNING:** FR-2/FR-3/FR-4 touch checkout, webhook, cron, and admin billing ops.
> MercadoPago STAGING smoke AND PROD smoke (SPEC-143 checklists) are mandatory merge gates.
>
> **SPEC-127 ORDERING:** `addon.checkout.ts` is intentionally excluded from FR-2 cutover.
> It must be cut over AFTER SPEC-127 (qzpay migration). See T-037.

---

### Setup Phase

- [x] **T-001** (complexity: 2) — Add addon CRUD Zod schemas to @repo/schemas
  - Extend `packages/schemas/src/api/billing/addon.schema.ts` with CreateAddonSchema, UpdateAddonSchema, AdminAddonListQuerySchema, AdminAddonResponseSchema mirroring billing-plan.schema.ts
  - Blocked by: none
  - Blocks: T-002, T-010, T-018

---

### Core Phase

- [x] **T-002** (complexity: 3) — Build AddonCatalogService list() and getBySlug() methods (DB-backed)
  - New `packages/service-core/src/services/billing/addon/addon-catalog.service.ts` reading billing_addons with filters, sort, getBySlug via metadata.slug, returning Result<T>
  - Blocked by: T-001
  - Blocks: T-003, T-004

- [x] **T-003** (complexity: 3) — Build AddonCatalogService row-to-AddonDefinition mapper with field-for-field parity test
  - `mapRowToAddonDefinition(row)` unpacking billing_addons columns + metadata JSONB; parity test asserting field-for-field equality against ALL_ADDONS config for every seeded slug
  - Blocked by: T-002
  - Blocks: T-005, T-006

- [x] **T-004** (complexity: 2) — Rewrite addon.catalog.ts to delegate to AddonCatalogService
  - `packages/service-core/src/services/billing/addon/addon.catalog.ts` delegating to AddonCatalogService; public API unchanged (behavior-preserving)
  - Blocked by: T-002, T-003
  - Blocks: T-007 through T-017 (all FR-2 addon cutovers), T-018 (FR-3 write methods)

- [x] **T-005** (complexity: 2) — Confirm billingAddons.seed.ts idempotency and verify row schema match
  - Inspect `packages/seed/src/required/billingAddons.seed.ts`; confirm skip-by-name + metadata.slug write; run pnpm db:fresh-dev; count == 5; idempotency test
  - Blocked by: T-003
  - Blocks: T-006

- [x] **T-006** (complexity: 1) — Write billing_addons backfill runbook and verify env row count
  - `.qtm/specs/SPEC-192-billing-catalog-to-db/docs/backfill-runbook.md`; hops db-seed commands; pre-cutover row-count verification
  - Blocked by: T-005
  - Blocks: T-007

---

### Integration Phase

#### FR-2 Addon Consumer Cutovers (non-money first, money-handling last — each its own commit)

- [x] **T-007** (complexity: 3) — Cut over addon-user-addons.ts (service-core) from getAddonBySlug to AddonCatalogService
  - `packages/service-core/src/services/billing/addon/addon-user-addons.ts` + parity regression test
  - Blocked by: T-004, T-006
  - Blocks: T-008

- [x] **T-008** (complexity: 3) — Cut over addon-limit-recalculation.service.ts from config to AddonCatalogService
  - `packages/service-core/src/services/billing/addon/addon-limit-recalculation.service.ts` + parity regression test
  - Blocked by: T-007
  - Blocks: T-009

- [x] **T-009** (complexity: 2) — Cut over addon-admin.ts (api/services) from config to AddonCatalogService
  - `apps/api/src/services/addon.admin.ts` + parity regression test
  - Blocked by: T-008
  - Blocks: T-011

- [x] **T-010** (complexity: 2) — Cut over admin addons.ts route (api) from config read to DB-backed AddonCatalogService
  - `apps/api/src/routes/billing/admin/addons.ts` GET endpoints; keep BILLING_READ_ALL gate; no write endpoints yet
  - Blocked by: T-001, T-009
  - Blocks: T-011

- [x] **T-011** (complexity: 2) — Cut over addon-user-addons.ts (api/services) from config to AddonCatalogService
  - `apps/api/src/services/addon.user-addons.ts` + parity regression test
  - Blocked by: T-009, T-010
  - Blocks: T-012

- [x] **T-012** (complexity: 2) — Cut over addon-entitlement.service.ts (api/services) from config to AddonCatalogService
  - `apps/api/src/services/addon-entitlement.service.ts` (addon reads only; plan bug fixed in T-025) + parity test
  - Blocked by: T-011
  - Blocks: T-013

- [x] **T-013** (complexity: 2) — Cut over addon-plan-change.service.ts (api/services) from config to AddonCatalogService
  - `apps/api/src/services/addon-plan-change.service.ts` + parity regression test
  - Blocked by: T-012
  - Blocks: T-014

- [x] **T-014** (complexity: 3) — Cut over addon-lifecycle.service.ts and addon-lifecycle-cancellation.service.ts from config
  - Both lifecycle files; parity regression test; MONEY-HANDLING
  - Blocked by: T-013
  - Blocks: T-015

- [x] **T-015** (complexity: 3) — Cut over addon-expiry.job.ts (cron) from config to AddonCatalogService
  - `apps/api/src/cron/jobs/addon-expiry.job.ts`; DB-resolved list equals config list; MONEY-HANDLING / HIGH RISK
  - Blocked by: T-014
  - Blocks: T-016

- [x] **T-016** (complexity: 3) — Cut over payment-logic.ts webhook from config to AddonCatalogService
  - `apps/api/src/routes/webhooks/mercadopago/payment-logic.ts`; HIGHEST RISK — real money; staging smoke required before merge
  - Blocked by: T-015
  - Blocks: T-017

- [x] **T-017** (complexity: 2) — Cut over qzpay-admin-hooks.ts from config to AddonCatalogService
  - `apps/api/src/routes/billing/admin/qzpay-admin-hooks.ts`; documents addon.checkout.ts exclusion (SPEC-127 dependency)
  - Blocked by: T-016
  - Blocks: T-020

#### FR-3 Admin Addon CRUD (separable track, runs parallel to FR-4 after T-004)

- [ ] **T-018** (complexity: 3) — Add addon CRUD write methods and audit logging to AddonCatalogService (FR-3)
  - create/update/toggleActive/softDelete/restore/hardDelete + hardDelete guard against billing_subscription_addons; audit logging (mirror plan.audit.ts)
  - Blocked by: T-001, T-004
  - Blocks: T-019

- [ ] **T-019** (complexity: 3) — Convert admin addons.ts route to full CRUD (FR-3)
  - POST/PATCH/DELETE/restore endpoints; BILLING_READ_ALL/BILLING_MANAGE split; 422/404/409 error mapping; createAdminListRoute with page+pageSize
  - Blocked by: T-018
  - Blocks: T-021

- [ ] **T-021** (complexity: 3) — Build admin addon management UI (TanStack Form + Zod) in apps/admin (FR-3)
  - `apps/admin/src/features/billing-addons/` list + create/edit form; mirrors billing-plans UI; TanStack Form + Zod
  - Blocked by: T-019
  - Blocks: T-036

#### FR-4 Plan Reader Cutover (runs sequentially after T-017/T-020)

- [ ] **T-020** (complexity: 2) — Add getBySlug/getByName method to PlanService (enables FR-4 plan cutover)
  - Add `getBySlug(slug)` to PlanService querying billing_plans.name; return Result<PlanRow>; unit tests
  - Blocked by: T-017
  - Blocks: T-022, T-023, T-024, T-025

- [ ] **T-022** (complexity: 2) — Cut over public listPlans.ts route from ALL_PLANS config to PlanService (FR-4)
  - `apps/api/src/routes/billing/public/listPlans.ts` → PlanService.list(); parity regression test
  - Blocked by: T-020
  - Blocks: T-023

- [ ] **T-023** (complexity: 2) — Cut over protected subscription.ts and stats.ts routes from getPlanBySlug to PlanService (FR-4)
  - Both protected routes; parity regression test
  - Blocked by: T-022
  - Blocks: T-024

- [ ] **T-024** (complexity: 3) — Cut over entitlement.ts middleware plan lookup from getPlanBySlug to PlanService (FR-4)
  - Only the plan-lookup portion; keep getDefaultEntitlements/getUnlimitedEntitlements in code; parity test
  - Blocked by: T-023
  - Blocks: T-025

- [ ] **T-025** (complexity: 3) — Fix addon-entitlement.service.ts:160 bug (ALL_PLANS.find by UUID instead of slug) (FR-4)
  - HIGH PRIORITY BUG: `ALL_PLANS.find(p => p.slug === activeSubscription.planId)` fails post-SPEC-168 (planId is UUID). Fix: PlanService.getById(UUID). Regression test first.
  - Blocked by: T-024
  - Blocks: T-026

- [ ] **T-026** (complexity: 2) — Cut over addon-plan-change.helpers.ts (service-core) and addon-plan-change.service.ts (api) plan reads to PlanService (FR-4)
  - Both files; parity regression test
  - Blocked by: T-025
  - Blocks: T-027

- [ ] **T-027** (complexity: 2) — Cut over billing-subscriptions/utils.ts (admin) and addon-limit-recalculation.service.ts plan reads to PlanService (FR-4)
  - Both files; parity regression test
  - Blocked by: T-026
  - Blocks: T-028

- [ ] **T-028** (complexity: 2) — Verify fetch-plans.ts (web) calls DB-backed endpoint and add parity assertion (FR-4)
  - `apps/web/src/lib/billing/fetch-plans.ts`; verify it calls the now-DB-backed public plans endpoint; remove any config fallback
  - Blocked by: T-027
  - Blocks: T-029

#### FR-5 Promo Defaults

- [ ] **T-029** (complexity: 2) — Relocate DEFAULT_PROMO_CODES to seed-only scope (FR-5)
  - `promo-code-defaults.ts`; audit references; redirect any request-time read to PromoCodeService; startup idempotency test
  - Blocked by: T-028
  - Blocks: T-030

#### FR-6 Structural Defs

- [ ] **T-030** (complexity: 2) — Evaluate structural-defs visibility and rename/relocate within @repo/billing if beneficial (FR-6)
  - entitlements.config.ts and limits.config.ts; optional mechanical relocation; barrel exports updated; no DB move
  - Blocked by: T-029
  - Blocks: T-031

---

### Docs Phase

- [ ] **T-031** (complexity: 2) — Write boundary ADR (ADR-030) for billing catalog vs structural definitions (FR-6)
  - `docs/decisions/ADR-030-billing-catalog-vs-structural-definitions.md`; catalog-vs-structural boundary; BETA-58 supersession; SPEC-168 lineage; link from README.md
  - Blocked by: T-030
  - Blocks: T-032

- [ ] **T-036** (complexity: 1) — Document MercadoPago staging smoke and prod smoke sign-off requirement in PR template
  - `.qtm/specs/SPEC-192-billing-catalog-to-db/docs/smoke-signoff-checklist.md`; references SPEC-143 checklists
  - Blocked by: T-021, T-035
  - Blocks: T-037

- [ ] **T-037** (complexity: 1) — Document deferred addon.checkout.ts cutover (blocked on SPEC-127) as a follow-up task
  - `.qtm/specs/SPEC-192-billing-catalog-to-db/docs/deferred-checkout-cutover.md`; ordering constraint: SPEC-127 must land first
  - Blocked by: T-036
  - Blocks: none

---

### Testing Phase

- [ ] **T-032** (complexity: 3) — Write cross-cutting integration tests for addon catalog read path end-to-end (FR-1/FR-2 testing phase)
  - Full read path integration test: billing_addons → AddonCatalogService → addon.catalog.ts; list, getBySlug, filter, NOT_FOUND
  - Blocked by: T-031
  - Blocks: T-033

- [ ] **T-033** (complexity: 3) — Write cross-cutting integration tests for plan reader cutover end-to-end (FR-4 testing phase)
  - PlanService.getBySlug() for each seeded slug against config baseline; includes T-025 bug regression (UUID lookup)
  - Blocked by: T-032
  - Blocks: T-034

- [ ] **T-034** (complexity: 3) — Write integration tests for admin addon CRUD routes end-to-end (FR-3 testing phase)
  - Full CRUD lifecycle; hard-delete blocked (409); permission split (403); pagination
  - Blocked by: T-033
  - Blocks: T-035

- [ ] **T-035** (complexity: 2) — Write promo defaults and structural defs integration tests (FR-5/FR-6 testing phase)
  - ensureDefaultPromoCodes idempotency; no runtime promo config read; structural defs exported correctly
  - Blocked by: T-034
  - Blocks: T-036

---

## Dependency Graph

```
Level 0:  T-001
Level 1:  T-002
Level 2:  T-003
Level 3:  T-004, T-005
Level 4:  T-006, T-018 (FR-3 write — parallel track A)
Level 5:  T-007, T-019 (FR-3 routes — parallel track A)
Level 6:  T-008, T-021 (FR-3 UI — parallel track A)
Level 7:  T-009
Level 8:  T-010, T-011 (T-010 also needs T-001)
Level 9:  T-011 (needs T-009 + T-010)
Level 10: T-012
Level 11: T-013
Level 12: T-014
Level 13: T-015
Level 14: T-016
Level 15: T-017
Level 16: T-020
Level 17: T-022
Level 18: T-023
Level 19: T-024
Level 20: T-025 [HIGH PRIORITY BUG FIX]
Level 21: T-026
Level 22: T-027
Level 23: T-028
Level 24: T-029
Level 25: T-030
Level 26: T-031
Level 27: T-032
Level 28: T-033
Level 29: T-034
Level 30: T-035
Level 31: T-036 (also needs T-021)
Level 32: T-037
```

## Parallel Tracks

**Track A (FR-3 Admin CRUD — separable):** After T-004 completes, T-018 → T-019 → T-021 can proceed in parallel with the FR-2 addon cutover chain. T-021 rejoins the main chain at T-036.

**Track B (FR-2 → FR-4 main chain):** T-001 → T-002 → T-003 → T-004 → T-007 → ... → T-017 → T-020 → T-022 → ... → T-028 → T-029 → T-030 → T-031 → T-032 → ... → T-037.

**Track C (FR-7/FR-8 seed track):** T-003 → T-005 → T-006 (feeds into T-007, joining Track B).

## Key Constraints

1. **FR-2 addon.checkout.ts excluded** — must run AFTER SPEC-127. See T-037.
2. **Backfill before cutover** — T-006 (backfill runbook) must complete before T-007 (first consumer cutover).
3. **Money-handling order** — non-money consumers first (T-007–T-011), then money-handling (T-012–T-016), then webhook last (T-016).
4. **T-025 is a production bug** — basePlanLimit falls to 0 post-SPEC-168. High priority, write regression test first (TDD).
5. **Staging + prod smoke required** — before merging any PR containing T-014–T-017 or T-019 or T-025 (SPEC-143 gate).

## Suggested Start

Begin with **T-001** (complexity: 2) — no dependencies, unblocks the entire chain.

After T-001: immediately start **T-002** (the AddonCatalogService core), and in parallel start **T-005** (seed idempotency confirm, depends on T-003 which depends on T-002).

High-priority parallel: once T-004 is done, start **T-018** (FR-3 write methods) in parallel with T-007 (first FR-2 cutover) — they are independent.

**T-025** (addon-entitlement bug fix) should be treated as urgently as the FR-2 cutovers — it is a silent production bug causing basePlanLimit=0.
