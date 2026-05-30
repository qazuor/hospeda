---
id: SPEC-168
slug: admin-plan-management
title: Admin Plan Management — runtime-editable plans on the DB
status: draft
priority: P2
complexity: large
created: 2026-05-28
consolidatedFrom: SPEC-093
consolidatedAt: 2026-05-29
relatedSpecs: [SPEC-143, SPEC-164]
supersedes: [ADR-020 (on ship)]
worktree: null
branch: null
---

# SPEC-168 — Admin Plan Management (runtime-editable plans on the DB)

> **Consolidation note (2026-05-29)**: This spec is the canonical replacement for
> **SPEC-093 "Admin-Editable Billing Plans"** (2026-04-26), which has been archived as
> `superseded-by-SPEC-168`. SPEC-093 had the right *goal* (runtime-editable plans, audit,
> web cache strategy, operator docs, ADR-020 supersedence) but an **obsolete architecture**:
> it assumed we must create a brand-new `billing_plans` table + `BillingPlanModel extends
> BaseModel` in `packages/db`. That premise no longer holds — see "Current state" below.
> SPEC-168 keeps the correct qzpay-backed architecture and absorbs the broader scope that
> SPEC-093 carried.

## Origin

Discovered during the SPEC-143 billing local smoke (admin write-ops, Chrome).
Trying to create a promo code with plan restrictions surfaced that the admin
plan management is non-functional: the plans list query 502s and the page
falls back to source-code config; the Editar/Eliminar/Desactivar buttons call
backend endpoints that do not exist.

## Product decision (locked by user)

Plans — and their limits and entitlements — **MUST be editable via the DB at
runtime**. The `@repo/billing` config (`ALL_PLANS` / `PlanDefinition`) is read
**only once to seed the DB**. After seeding, the **DB is the source of truth**
and everything is editable from the admin. This mirrors the billing-settings
model (config = initial values, DB = runtime).

Consequences:
- The page header "Los planes se gestionan desde el código fuente" is WRONG and
  must be corrected.
- The Editar / Eliminar / Desactivar / Crear buttons SHOULD work (write to DB).
- ADR-020 ("plans are code-only single source of truth") becomes `Superseded by
  SPEC-168` once this ships.

## Current state (what exists today — verified 2026-05-29)

- **DB**: the `billing_plans` table **already exists** — it is provided by the
  external dependency `@qazuor/qzpay-drizzle`, re-exported in
  `packages/db/src/billing/schemas.ts:14` (and `index.ts:119` exports `billingPlans`,
  `QZPayBillingPlan`, `QZPayBillingPlanInsert`). Column shape (NOT the flat shape
  SPEC-093 assumed):
  - `id` UUID (PK), `name` varchar (**stores the plan slug**), `description`,
    `active` boolean, `entitlements` JSON array of strings, `limits` JSON object
    (`Record<string, number>`), `livemode` boolean, `metadata` JSON
    (slug, displayName, category, isDefault, sortOrder, trialDays, hasTrial,
    monthlyPriceArs, annualPriceArs, monthlyPriceUsdRef).
  - **Prices live in a separate qzpay table `billing_prices`** (monthly always,
    annual only when `annualPriceArs > 0`), seeded alongside the plan.
  - `billing_subscriptions.plan_id` is **varchar** while `billing_plans.id` is UUID
    (the CLAUDE.md gotcha). What `plan_id` actually stores (slug vs UUID-as-string)
    is an **open question** — see Open Questions #1, it gates edit/delete referential
    integrity.
- **Seed**: `packages/seed/src/required/billingPlans.seed.ts` (`seedBillingPlans()`)
  reads `ALL_PLANS` from `@repo/billing` and inserts into `billing_plans` +
  `billing_prices`. Idempotent by `billingPlans.name === plan.slug` (skip if exists).
  This is already "config → DB seed", exactly the model we want.
- **Storage adapter**: `createBillingAdapter()` in
  `packages/db/src/billing/drizzle-adapter.ts` delegates to qzpay's
  `createQZPayDrizzleAdapter()` and exposes `storage.plans.{list,get,update}` (used in
  `migrate-addon-purchases.ts`). There is **no** local `PlanModel extends BaseModel`,
  and there should not be — CRUD goes through the qzpay storage adapter.
- **API** `apps/api/src/routes/billing/admin/plans.ts`: READ-ONLY. Serves from
  `ALL_PLANS` (config), NOT the DB. Only `GET /` (list) + `GET /{id}` (by slug).
  Returns a flat config shape (slug, category, prices, isActive, entitlements,
  limits) with **no DB `id`, no timestamps**. There are **NO** POST/PUT/DELETE
  plan routes anywhere in the backend.
- **Public API** `apps/api/src/routes/billing/public/listPlans.ts`: `GET /api/v1/public/plans`
  exists, cached 3600s, reads `ALL_PLANS` filtered to `isActive`. **Web does not even
  call it** — `apps/web/.../suscriptores/planes/index.astro` imports `ALL_PLANS` directly
  at SSG build time (`prerender = true`).
- **Front** `apps/admin/src/features/billing-plans/`:
  - `hooks.ts` has `usePlansQuery` + `useCreatePlanMutation` / `useUpdatePlanMutation`
    / `useDeletePlanMutation` / `useTogglePlanActiveMutation` calling
    `POST/PUT/DELETE /api/v1/admin/billing/plans[/:id]` — **endpoints that do not exist**
    (would 404 if invoked).
  - `transformPlanRecord` validates each record against `QZPayPlanRecordSchema`
    requiring `id` / `active` / `metadata{…}` / `createdAt` / `updatedAt`. The
    config flat shape fails this → throws ApiError 502 → `usePlansQuery` errors →
    page shows the error banner + config fallback.
  - `PlanDialog` form is **functional/complete** (not a zombie) — fields, entitlement
    checkboxes, limit inputs, isDefault/isActive switches all wired; submit calls a
    callback that would hit the (missing) mutations. `columns.tsx` exists.
  - The "Create New" button was intentionally removed from `plans.tsx` (comment:
    "plans are read-only"); `handleCreateNew/handleEdit/handleSubmit` show an
    `apiRequired` alert.
  - HTTP adapter `apps/admin/src/lib/billing-http-adapter/index.ts` returns
    `createThrowingStorage('plans')` — plan storage throws on any call.
- **i18n** `packages/i18n/.../admin-billing.json` `plans.*` keys explicitly say
  "Read-only… managed in source code… Coming next: SPEC to enable in-panel editing."
- **Permissions**: only generic `BILLING_*` permissions exist (`BILLING_READ_ALL`,
  `BILLING_MANAGE`, `BILLING_SETTINGS_VIEW/WRITE`, etc.). There are **no**
  `BILLING_PLAN_VIEW/CREATE/UPDATE/DELETE` permissions — see Open Questions #2.

## Goals

- Operators can create, edit, deactivate, and delete billing plans from the admin
  panel without engineering involvement.
- All existing consumers (checkout, entitlements, web pricing pages, listing endpoints)
  continue to behave identically against the DB-backed source.
- Config → DB seed remains the bootstrap; **runtime edits are never overwritten by a
  re-seed** (idempotent seed already skips existing slugs — confirm and harden).
- Display-vs-charge invariant from ADR-020 is preserved: the admin write goes to the
  same store (qzpay `billing_plans` + `billing_prices`) that checkout reads from.
- Audit log on every plan mutation (`actor.id`, before/after diff) so price history is
  recoverable independently of git.

### Success Metrics

- Operator changes a plan price in admin → web pricing page reflects within ≤ N seconds
  (N defined by the chosen invalidation strategy — Open Questions #3).
- Checkout against the modified plan charges the new price, verified end-to-end.
- The admin plans list stops 502-ing: `transformPlanRecord` parses the DB response
  (with `id` + timestamps + metadata) with zero errors.
- Audit log shows mutation by `actor.id` with field-level diff for every save.

## Non-Goals

- **Plan versioning**: ship single-version plans. Historical pricing for already-billed
  subscriptions is preserved via the existing snapshot pattern, not via plan versions.
- **A/B pricing experiments framework** (cohort assignment, conversion tracking).
- **Region-specific pricing routing** (a `region`/metadata field may exist for forward
  compatibility, but selection logic is out of scope).
- **Marketing-managed promo codes UI** (already exists separately).
- **Migrating addons to a DB catalog** (analogous problem; separate spec if needed).

## Scope (what to build)

1. **service-core** — `PlanService` (new, or extend existing billing service) with full
   CRUD over the qzpay `billing_plans` table **via the storage adapter**
   (`storage.plans.*`), NOT a hand-rolled `BaseModel`. Methods:
   create / update / delete (soft = `active:false` / hard) / list / getById / toggleActive.
   Must map `PlanDefinition`-style input ↔ qzpay DB row including `metadata`, the
   `entitlements` array, the `limits` object, **and the related `billing_prices` row(s)**
   (monthly/annual). Return rows WITH `id` + timestamps. All write methods enlist in
   the billing transaction wrapper and emit an audit log entry (before/after payload).

2. **API** `apps/api/src/routes/billing/admin/plans.ts` — rewrite to read+write the DB:
   - `GET /` (list) and `GET /{id}` read from DB (response includes `id` + timestamps).
   - Add `POST /` (create), `PUT /{id}` (update), a `PATCH`/toggle for active status,
     `DELETE /{id}` (soft), and optionally `POST /{id}/restore` + `DELETE /{id}/hard`.
   - Apply per-route admin rate limit and the chosen permission model (Open Q #2).
   - `getActorFromContext(c)` for `actor.id` on every audit call.
   - Keep the public read endpoint (`routes/billing/public/listPlans.ts`) working;
     switch its source to the DB/service so public and admin agree.

3. **@repo/schemas** — plan request/response schemas (`Create/Update/Response`,
   `Search`) as the **SSOT** (NOT loose schemas in apps/api — per the rule applied in
   the SPEC-143 promo-code fix). Mirror the qzpay row shape, not the SPEC-093 flat shape.
   Decide on `id` (DB uuid) vs `slug` as the mutation identifier (Open Q #1).

4. **Front** `apps/admin/src/features/billing-plans/` — align `transformPlanRecord` /
   types to the DB response shape (with `id` + `metadata` + timestamps), wire the form
   (`PlanDialog`) to the real CRUD, restore the "Create New" button, replace the
   `createThrowingStorage('plans')` adapter with a real one, and **fix the page header +
   i18n text** (drop "managed in source code", keep an audit-log hint).

5. **Web** `apps/web` — decide whether the pricing pages stay on SSG (build-time
   `ALL_PLANS` import) or move to the public `/api/v1/public/plans` endpoint with a cache
   strategy so operator edits surface without a redeploy (Open Q #3). Whichever path,
   the display-vs-charge invariant must hold.

6. **Seed** — confirm config → DB seed runs once and is idempotent by slug; ensure
   runtime edits are not clobbered by a re-seed (decide the merge/skip policy explicitly).

7. **Audit + docs** — emit `AuditEventType.BILLING_*` on every plan mutation with
   before/after diff; add `docs/guides/managing-billing-plans.md` for operators
   (how to edit, audit log location, rollback); update `packages/billing/CLAUDE.md`
   and the `packages/db/CLAUDE.md` plans gotcha; flip ADR-020 → `Superseded by SPEC-168`.

8. **Tests** — schema parse; service CRUD (incl. entitlements/limits/prices relations);
   route auth/validation/soft-delete; a **regression for the dead-endpoint 502 bug**;
   integration test: change a price via admin → `/public/plans` returns the new price;
   e2e: operator edits price → fresh pricing page shows it → checkout charges it.

## Out of Scope

- Plan versioning, A/B experiments framework, region routing, promo-codes UI,
  addon DB catalog, multi-tenant plan catalogs.

## Open Questions

These must be answered before implementation starts.

1. **Mutation identifier & referential integrity (CRITICAL).** Is the edit/delete
   identifier the DB `id` (uuid) or the `slug`? `billing_subscriptions.plan_id` is
   varchar — and the evidence conflicts: `resolvePlanId()` in the seed looks up by
   `name === slug` and stores the returned **UUID** in `plan_id`
   (`testUsers.seed.ts`), yet other readers treat `plan_id` as a slug. **Verify against
   real DB rows** what subscriptions actually store before allowing slug edits or plan
   deletes (renaming/deleting a referenced plan could orphan subscriptions).
2. **Permission model.** Reuse the existing generic `BILLING_*` permissions
   (`BILLING_MANAGE` for writes, `BILLING_READ_ALL` for reads) — simpler, matches the
   rest of admin billing and SPEC-164 (admin-billing super-only) — OR introduce
   dedicated `BILLING_PLAN_VIEW/CREATE/UPDATE/DELETE/HARD_DELETE` for finer control?
   Coordinate with SPEC-164.
3. **Web pricing-page freshness.** Options: stay SSG + build-trigger on save; move to
   the public endpoint with `Cache-Control: s-maxage + stale-while-revalidate` and
   explicit purge on save; or ISR-style revalidate window. Tradeoff: latency-to-reflect
   vs operational complexity vs deploy frequency.
4. **QZPay sync semantics.** When admin updates a price, does qzpay need any extra step
   beyond writing `billing_plans`/`billing_prices` (e.g. does checkout read a cached
   plan, or re-read storage each time)? Confirm `storage.plans.update` + price update is
   sufficient and seen by checkout immediately.
5. **Delete semantics.** Soft-delete (`active:false`) by default; hard-delete only when
   no active subscription references the plan. Confirm with product/finance.
6. **Seed re-run policy.** On a re-seed after runtime edits, skip-existing (current) is
   safe but drifts DB from config silently. Is silent skip acceptable, or do we want a
   warning/report of config-vs-DB divergence?
7. **Limits/entitlements editing granularity.** Inline with the plan (smoke decision
   implies yes) vs separate sub-resources.

## Risks

- **Regression on the billing-critical path.** Every migrated consumer must be tested
  against real QZPay/MercadoPago sandbox scenarios. Mitigation: keep `ALL_PLANS` as a
  read fallback for one release if needed; staging smoke is the gate (per SPEC-143
  billing smoke rule in CLAUDE.md).
- **Cache staleness → display-vs-charge mismatch.** The exact bug ADR-020 guarded
  against. Mitigation: admin write and checkout read the same store; integration test
  targets this specifically.
- **Referential integrity on edit/delete.** See Open Q #1 — resolve before shipping
  write/delete.
- **Seed clobbering runtime edits.** Mitigation: idempotent skip-by-slug + explicit
  policy (Open Q #6).

## Implementation Phases

1. **Resolve Open Questions #1 + #2 + #3** (identifier, permissions, web strategy) — these
   gate the schema and routes.
2. **schemas SSOT** — Create/Update/Response/Search mirroring the qzpay row shape.
3. **service-core PlanService** — CRUD over `storage.plans.*` + `billing_prices`, audit
   log, transaction wrapper, unit tests.
4. **API admin CRUD + public read switch** — rewrite `plans.ts`, wire permissions +
   rate limit, integration tests incl. the 502 regression.
5. **Front admin** — fix `transformPlanRecord`, wire `PlanDialog` + mutations + real
   storage adapter, restore Create button, fix header/i18n.
6. **Web pricing strategy** — implement the chosen freshness approach.
7. **Docs + ADR-020 supersedence + CLAUDE.md gotcha updates + e2e + staging smoke.**

## References

- **SPEC-093** (archived, superseded-by-SPEC-168): `.claude/specs/SPEC-093-admin-editable-billing-plans/spec.md`
  — original goal/scope, obsolete create-the-table architecture.
- **ADR-020**: `docs/decisions/ADR-020-billing-plans-source-of-truth.md` (Accepted; to be Superseded).
- Engram: `spec-143/f-admin-plans` (discovery), `spec-143/f-admin-promo-create` (SSOT-schema pattern to mirror).
- SPEC-143 promo-code consolidation = reference implementation for the contract/SSOT approach.
- SPEC-164 (admin-billing super-only) — coordinate permission model (Open Q #2).
- Key code: `packages/db/src/billing/schemas.ts:14`, `packages/db/src/billing/drizzle-adapter.ts`,
  `packages/seed/src/required/billingPlans.seed.ts`, `apps/api/src/routes/billing/admin/plans.ts`,
  `apps/api/src/routes/billing/public/listPlans.ts`,
  `apps/admin/src/features/billing-plans/{hooks.ts,components/PlanDialog.tsx,columns.tsx}`,
  `apps/web/src/pages/[lang]/suscriptores/planes/index.astro`.
