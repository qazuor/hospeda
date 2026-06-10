# SPEC-093: Admin-Editable Billing Plans

> **Status**: draft
> **Priority**: P2 (post-beta enhancement)
> **Complexity**: L
> **Origin**: 2026-04-26 — BBT-12 audit revealed `PlanDialog.tsx` admin UI was zombie code calling nonexistent endpoints. ADR-020 froze plans as code-only as a stop-gap; this spec defines the path to make plans operationally editable.
> **Affected packages**: packages/db, packages/billing, packages/service-core, packages/schemas, apps/api, apps/admin, apps/web
> **Created**: 2026-04-26
> **Estimated effort**: ~30-40 hours (~1.5-2 weeks)
> **Depends on**: ADR-020 (single source of truth for plans), SPEC-058 (BaseModel interface alignment), SPEC-059 (service transactions), beta launch completed (validates real demand for runtime pricing changes)
> **Blocks**: future pricing experiments, region-specific pricing, A/B price tests, marketing-led promo launches
> **Related beta feedback**: [BETA-58](https://linear.app/hospeda-beta/issue/BETA-58) — "Reubicar configuracion de planes fuera de packages/billing/src/config". ⚠️ **This spec (SPEC-093) is deprecated / superseded by [SPEC-168](../SPEC-168-admin-plan-management/spec.md)** (admin-plan-management). BETA-58 is now tracked there; this reference is kept for trace only.

---

## Overview

Today billing plans live exclusively in `packages/billing/src/config/plans.config.ts` (per ADR-020).
Every consumer (web pricing pages, public/admin endpoints, addon checkout, entitlements,
limit recalculation) reads from this static config. Operational consequences:

- Marketing or finance cannot adjust pricing without engineering involvement.
- Promotional pricing windows require a deploy. Same for region-specific pricing or A/B tests.
- The `PlanDialog.tsx` admin UI is read-only and surfaces an alert pointing operators to the
  source file.
- `QZPayPlanStorage` (interface) and `createPlanStorage()` (HTTP adapter) exist as dormant seams.

This spec migrates plan storage to PostgreSQL, exposes admin CRUD, and rewires every reader to
go through a service. Cost is one-time engineering effort; benefit is operational autonomy and
unblocking pricing experiments.

---

## Goals

- Operators can create, edit, deactivate, and delete billing plans from the admin panel
  without engineering involvement.
- All existing consumers (checkout, entitlements, web pricing pages, listing endpoints) continue
  to behave identically against the new DB-backed source.
- Zero downtime migration: the existing `plans.config.ts` becomes the seed payload for the new
  table, and the cutover is a single deploy.
- Display vs charge invariant from ADR-020 is preserved: the admin write goes to the same
  store that checkout reads from.
- Audit log on every plan mutation (`actor.id`, before/after diff) so price history is
  recoverable independently of git.

### Success Metrics

- Operator changes a plan price in admin → web pricing page reflects within ≤ N seconds
  (N defined by chosen invalidation strategy: see Open Questions).
- Checkout against the modified plan charges the new price, verified by an end-to-end test.
- All 25+ existing tests that reference `ALL_PLANS` or `getPlanBySlug` pass against the new
  service layer with zero modifications to consumer code (only the import shape may change).
- Audit log shows mutation by `actor.id` with field-level diff for every save.

---

## Non-Goals

- **Versioning of plans**: this spec ships single-version plans. Historical pricing for
  already-billed subscriptions is preserved via `billing_subscriptions.plan_snapshot` JSONB
  (existing pattern), not via plan versions. A separate spec covers true plan versioning if
  needed.
- **A/B testing infrastructure**: the table will support multiple plans per category, but the
  experiment framework (cohort assignment, conversion tracking) is out of scope.
- **Region-specific pricing**: the schema may include a `region` column for forward
  compatibility but the routing/selection logic is out of scope.
- **QZPay sync**: see Open Questions. May or may not be in scope depending on how QZPay
  consumes plan IDs at checkout time.

---

## Scope

### Database (`packages/db`)

- New schema `packages/db/src/schemas/billing/billing_plans.dbschema.ts` matching the
  `PlanDefinition` shape: `id` (UUID PK), `slug` (unique), `name`, `description`, `category`,
  `monthly_price_ars`, `annual_price_ars`, `monthly_price_usd_ref`, `has_trial`, `trial_days`,
  `is_default`, `sort_order`, `is_active`, `entitlements` (JSONB array of strings),
  `limits` (JSONB array of `{key, value, name, description}`), `created_at`, `updated_at`,
  `deleted_at`, `created_by`, `updated_by`, `deleted_by`.
- Migration generated via `drizzle-kit generate` plus a manual migration in
  `packages/db/src/migrations/manual/` for the seed payload from `plans.config.ts`.
- Soft delete by default (consistent with the rest of the codebase).
- Indexes: `(category, is_active, sort_order)` for the most common read pattern;
  unique on `slug`.
- Update `packages/db/CLAUDE.md` "DB schema gotchas" section to reflect that plans now live
  in DB.

### Model (`packages/db`)

- `BillingPlanModel extends BaseModel<BillingPlan>` in
  `packages/db/src/models/billing/billingPlan.model.ts`.
- Standard CRUD methods plus `findActiveByCategory(category)` and `findBySlug(slug)`.

### Service (`packages/service-core`)

- `BillingPlanService extends BaseCrudService` in
  `packages/service-core/src/services/billing-plan/billing-plan.service.ts`.
- Permission hooks: `BILLING_PLAN_VIEW`, `BILLING_PLAN_CREATE`, `BILLING_PLAN_UPDATE`,
  `BILLING_PLAN_DELETE`, `BILLING_PLAN_HARD_DELETE`. Add to `PermissionEnum`.
- All write methods enlist in `withServiceTransaction` and emit audit log
  (`AuditEventType.BILLING_MUTATION`) with full before/after payload.
- Cache invalidation: see Open Questions. Likely a service-level in-memory cache with TTL,
  invalidated on every write via a tag system reusable by other services.

### Schemas (`packages/schemas`)

- `BillingPlanSchema`, `CreateBillingPlanSchema`, `UpdateBillingPlanSchema`,
  `BillingPlanSearchSchema` mirroring `PlanDefinition` with Zod runtime validation.
- Re-export from `@repo/schemas` and reference from API routes.

### API (`apps/api`)

- Public read endpoint `GET /api/v1/public/plans` reads from `BillingPlanService` instead of
  `ALL_PLANS`. Response shape unchanged (backwards compatible with web client).
- Admin endpoints in `apps/api/src/routes/billing/admin/plans.ts`:
  - `GET /` — list (already exists, switch source)
  - `GET /:id` — detail (already exists, switch source)
  - `POST /` — create (new)
  - `PUT /:id` — update (new)
  - `PATCH /:id` — partial update (new)
  - `DELETE /:id` — soft delete (new)
  - `POST /:id/restore` — restore (new)
  - `DELETE /:id/hard` — hard delete (new)
- All write endpoints: HMAC unaffected (no webhook), but apply rate limit
  (`createPerRouteRateLimitMiddleware(20, 60_000)` per admin user) and require the new
  `PermissionEnum.BILLING_PLAN_*` permissions.
- `getActorFromContext(c)` for `actor.id` on every audit log call (per pattern from SPEC-064).

### Service consumers migration

- Find every reader (already mapped: `addon.checkout.ts`, `addon-entitlement.service.ts`,
  `addon-plan-change.helpers.ts`, `addon-limit-recalculation.service.ts`,
  `apps/api/src/services/addon-plan-change.service.ts`, `apps/api/src/routes/billing/admin/plans.ts`,
  `apps/api/src/routes/billing/public/listPlans.ts`).
- Replace `import { ALL_PLANS, getPlanBySlug } from '@repo/billing'` with calls to
  `BillingPlanService` instances using the request `ctx`.
- `@repo/billing` continues to export `PlanDefinition` and other constants/enums for type usage.
  The constants `ALL_PLANS` and helper `getPlanBySlug` may be deprecated via JSDoc and
  eventually removed in a follow-up cleanup.

### Web (`apps/web`)

- Decision required: stay on SSG with build-time config import, switch to ISR with
  on-demand revalidation, or switch to SSR with cache. See Open Questions.
- Whichever path, the public endpoint `/api/v1/public/plans` becomes the data source again
  (replacing the direct `@repo/billing` import that ADR-020 introduced).

### Admin (`apps/admin`)

- Reactivate `PlanDialog.tsx`: enable form fields, hook submit to mutations.
- Re-enable `useCreatePlanMutation`, `useUpdatePlanMutation`, `useDeletePlanMutation`,
  `useTogglePlanActiveMutation`. Update endpoint paths if needed.
- Restore the "Create New" button in `PlansTable`.
- Revert i18n keys (`plans.title`, `description`, `apiRequired`, `apiUnavailable`) to
  edit-enabled verbiage. Keep noteLabel/apiUnavailable as a soft hint about audit log
  visibility instead of a hard "you cannot edit" message.
- Update `apps/admin/src/lib/billing-http-adapter/plan-price-promo-storage.ts` to point
  to the actual admin endpoints (which now exist).

### Tests

- Unit tests for `BillingPlanService` (CRUD, permission gating, audit log emission).
- Integration tests for admin endpoints (auth, validation, idempotent updates,
  soft-delete semantics).
- Integration test: change a price via admin → call `/public/plans` → verify new price
  appears in response.
- E2E test (Playwright or similar): operator edits a plan price, then a freshly-loaded
  pricing page shows the new price, then a new checkout charges the new price.
- Migration test: seeded plans match the previous `plans.config.ts` exactly (snapshot
  comparison).

### Documentation

- New `docs/guides/managing-billing-plans.md` for operators (how to edit plans from admin,
  audit log location, rollback procedure).
- Update `packages/billing/CLAUDE.md` to reflect that the package now exports types and
  enums only, not runtime plan data.
- Update ADR-020 status to `Superseded by SPEC-093` once this ships.
- Add ADR-021 documenting the migration approach and the cache invalidation strategy chosen.

---

## Out of Scope

- Plan versioning (separate spec if needed)
- A/B pricing experiments framework
- Region-specific pricing routing
- Marketing-managed promo codes UI (already exists separately)
- Migrating addons to DB (analogous problem; track as SPEC-094 if/when needed)
- Multi-tenant plan catalogs (one catalog per Hospeda deployment for now)

---

## Open Questions

These are intentionally not answered now. Each requires explicit decision before implementation
starts.

1. **Cache invalidation strategy for the web pricing page.** Options:
   - SSG with build-trigger webhook on save (cleanest, requires Vercel deploy hook integration).
   - ISR with `revalidate` set to 60-300s (simple, accepts brief inconsistency window).
   - SSR with HTTP cache (`Cache-Control: s-maxage=N, stale-while-revalidate`) and explicit
     purge on save.
   - Tradeoff matrix: latency to reflect change vs operational complexity vs deploy frequency.
2. **QZPay sync.** Does QZPay store its own copy of plan prices that need to be updated
   when the admin changes a price in Hospeda? Investigate `@qazuor/qzpay-core` plan storage
   semantics during checkout. If yes, define the sync contract (push on save? lazy on
   first checkout after change? best-effort with retry?).
3. **Backwards compatibility window for `ALL_PLANS` and `getPlanBySlug`.** Hard cut at the
   migration deploy, or leave deprecated exports for one release cycle to ease external code
   that might import them.
4. **Plan deletion semantics.** Hard delete is dangerous (active subscriptions reference plans).
   Default policy: soft-delete only; UI hides hard-delete unless no active subscription
   references the plan. Confirm with finance / product.
5. **Audit log retention.** Does the existing audit log table cover this volume? Plan
   mutations are infrequent so almost certainly yes; verify.

---

## Risks

- **Regression on the billing-critical path.** Every consumer migrated must be tested under
  load and against real QZPay/MercadoPago test scenarios. Mitigation: keep `ALL_PLANS` as a
  fallback for one release cycle, behind a feature flag if needed.
- **Cache staleness causing display vs charge mismatch.** This is the exact bug ADR-020 was
  written to prevent. Mitigation: the admin write and checkout MUST read from the same source
  with the same cache state; integration test specifically targets this.
- **Migration data integrity.** Seeding from `plans.config.ts` and then mutating in admin
  while old code still imports the constant would split the source of truth again.
  Mitigation: cutover deploy switches all readers in the same release.
- **Permission scope creep.** New `BILLING_PLAN_*` permissions need role assignment
  decisions (super-admin only? finance role?). Coordinate with `apps/admin` access feature.

---

## Implementation Phases

Numbered for dependency ordering. Phase 1 unblocks the rest; phases 2-6 can partially overlap.

1. **Schema + migration + seed.** Create table, generate migration, write seed payload
   from `plans.config.ts`, validate snapshot equivalence in test.
2. **Model + service + permissions.** Implement `BillingPlanModel`, `BillingPlanService`, add
   `PermissionEnum.BILLING_PLAN_*`, write unit tests.
3. **API admin CRUD endpoints + integration tests.**
4. **Migrate consumers.** Replace every `ALL_PLANS` / `getPlanBySlug` import with service
   calls. Run full billing test suite after each consumer.
5. **Web pricing page strategy.** Implement chosen cache strategy from Open Questions #1.
6. **Admin UI reactivation.** Enable PlanDialog, restore mutations, update i18n, full E2E
   verification.
7. **Documentation + ADR-020 supersedence + cleanup of deprecated exports.**

---

## References

- ADR-020: Billing Plans — Single Source of Truth in Source Code
- BBT-12 audit (2026-04-26)
- `packages/billing/src/config/plans.config.ts` (current source)
- `apps/admin/src/features/billing-plans/components/PlanDialog.tsx` (zombie UI to revive)
- `apps/admin/src/lib/billing-http-adapter/plan-price-promo-storage.ts` (HTTP adapter to wire)
- SPEC-064: Billing Transaction Safety (audit log pattern reference)
- SPEC-058: BaseModel Interface Alignment (model contract)
- SPEC-059: Service-Layer Transaction Support (transaction propagation)
