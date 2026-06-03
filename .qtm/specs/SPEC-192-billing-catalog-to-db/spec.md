---
specId: SPEC-192
title: Billing Catalog to DB — complete SPEC-168 by making the addon catalog & residual plan/promo reads DB-backed, and document the code-level structural boundary
slug: billing-catalog-to-db
type: refactor
status: draft
complexity: high
owner: qazuor
created: 2026-06-02
base: staging
branch: spec/SPEC-192-billing-catalog-to-db
worktree: /home/qazuor/projects/WEBS/hospeda-spec-192-billing-catalog-to-db
linearIssues:
  - BETA-58
tags:
  - billing
  - catalog
  - addons
  - plans
  - promo-codes
  - entitlements
  - refactor
  - adr
  - migration
---

# SPEC-192 — Billing Catalog to DB

> Skeleton note: this is the formalized functional spec. Tasks and `index.json`
> updates are produced by the caller after this file lands — do not generate them here.

## 1. Origin & problem statement

### The BETA-58 reframing (read this first)

This spec **supersedes Linear BETA-58** ("move plans config out of
`packages/billing/src/config` to the repo root"). BETA-58's premise was that the billing
config under `packages/billing/src/config/*` is **seed-only** data and could therefore be
relocated to the repo root for visibility/editing. **That premise was proven wrong during
verification (see §2): the config is consumed at RUNTIME**, not just by the seeder, and
`@repo/billing` ships to production as a tsup-built `dist/` (the repo root is NOT present in
the Docker image). So the config files literally **cannot** live at the repo root — the
runtime imports would break in production. BETA-58 as written is infeasible.

The real, owner-approved goal that BETA-58 was reaching for is to **complete SPEC-168**.
SPEC-168 moved billing **PLANS** to the DB (`billing_plans` as the editable source of truth,
config as the one-time seed). SPEC-192 finishes that job for the rest of the billing catalog:

1. Make the **addon catalog** DB-backed (the bulk of this spec): the `billing_addons` table
   already exists and is already seeded from config, but the catalog **read service and admin
   routes still read from config** — redirect them to the DB, exactly as SPEC-168 did for
   plans.
2. Eliminate the **residual plan reads** that still hit config (`ALL_PLANS` / `getPlanBySlug`)
   even though SPEC-168 made the DB the source of truth — so plans are read from ONE place
   (DB) everywhere.
3. Make the **promo defaults** DB/seed-only (SPEC-143 already gave promos a DB table + admin
   CRUD; remove the residual config-defaults runtime read).
4. **Keep the structural definitions in code** (NOT DB): `ENTITLEMENT_DEFINITIONS`,
   `LIMIT_METADATA`, `getDefaultEntitlements`, `getUnlimitedEntitlements` are coupled to
   compile-time enums (`EntitlementKey`, `LimitKey`); moving them to DB would create code↔DB
   drift. This spec only improves their visibility and **documents the boundary** in an ADR
   (what is DB-backed catalog vs code-level structural definition, and why).

> Net: after SPEC-192, the billing **catalog** (plans, prices, addons, promo codes) is read
> from the DB everywhere; the billing **structural definitions** (entitlement/limit keys and
> their metadata, plus default/unlimited entitlement maps) stay in code by design and are
> documented as such. Config files remain in `packages/billing/src/config/*` as the **seed
> source** only — they are no longer read at runtime for catalog lookups.

### Current-state matrix (verified this session — §2 has the evidence)

| Config file (`packages/billing/src/config/`) | Exported symbols | Runtime consumers TODAY | Target after SPEC-192 |
|---|---|---|---|
| `addons.config.ts` | `ALL_ADDONS`, `getAddonBySlug`, the `*_ADDON` defs | ~17 sites: service-core `addon.catalog.ts` + `addon-user-addons.ts` + `addon-limit-recalculation.service.ts`; `apps/api` addon.checkout / addon.admin / addon.user-addons / addon-entitlement / addon-lifecycle.service / addon-lifecycle-cancellation / addon-plan-change.service / cron `addon-expiry.job` / webhook `payment-logic` / admin route `addons.ts` / `qzpay-admin-hooks.ts` | **DB** (`billing_addons` via new `AddonCatalogService`); config becomes seed-only |
| `plans.config.ts` | `ALL_PLANS`, `getPlanBySlug`, `LimitKey`, plan defs | residual reads: `apps/web` `fetch-plans.ts`; `apps/api` public `listPlans.ts` / protected `subscription.ts` / `stats.ts` / `middlewares/entitlement.ts` / `addon-plan-change.service.ts` / `addon-entitlement.service.ts` / `addon.checkout.ts`; `apps/admin` `billing-subscriptions/utils.ts`; service-core `addon-plan-change.helpers.ts` / `addon-limit-recalculation.service.ts` | **DB** (`PlanService` / `billing_plans`); config becomes seed-only |
| `promo-codes.config.ts` + `promo-code-defaults.ts` (a separate local const) | `DEFAULT_PROMO_CODES` | `promo-code-defaults.ts` (`ensureDefaultPromoCodes` at API startup); config-validator (dev) | **seed/startup-only** (already DB-backed via `PromoCodeService`); no runtime *catalog* read remains |
| `entitlements.config.ts` | `ENTITLEMENT_DEFINITIONS`, `getDefaultEntitlements`, `getUnlimitedEntitlements` | `apps/api` `middlewares/entitlement.ts`; `apps/web` `billing-i18n.ts`; `apps/admin` `plan-entitlement-groups.ts` | **STAYS IN CODE** (enum-coupled). Visibility/naming improved + documented in ADR. NO DB move |
| `limits.config.ts` | `LIMIT_METADATA`, `LimitKey` metadata | `apps/api` `usage-tracking.service.ts`; `apps/web` `billing-i18n.ts`; `apps/admin` `plan-entitlement-groups.ts` | **STAYS IN CODE** (enum-coupled). Documented in ADR. NO DB move |

> Genuinely seed-only / dev-tool (untouched as runtime): `packages/seed/src/required/billing*.seed.ts`,
> `packages/billing/src/utils/config-drift-check.ts`, `packages/billing/src/validation/config-validator.ts`.

## 2. Current architecture (verified facts)

| Concern | Location | State today (verified) |
|---|---|---|
| Billing core tables | `@qazuor/qzpay-drizzle` (re-exported by `packages/db/src/billing/schemas.ts` → `index.ts`) | `billing_plans`, `billing_prices`, `billing_subscriptions`, `billing_customers`, `billing_addons`, `billing_subscription_addons`, `billing_entitlements`, `billing_customer_entitlements`, `billing_limits`, `billing_customer_limits`, `billing_promo_codes`, `billing_promo_code_usage`, invoices/payments/refunds/webhooks/etc. **All defined in the external qzpay package, NOT in `@repo/db` Drizzle source.** |
| Hospeda-owned billing tables | `packages/db/src/schemas/billing/*.dbschema.ts` | `billing_addon_purchase`, `billing_dunning_attempt`, `billing_notification_log`, `billing_settings`, `billing_subscription_event` (Hospeda extensions, not the catalog) |
| **Addon catalog table** | `billing_addons` (qzpay) | **EXISTS and is ALREADY SEEDED** from `ALL_ADDONS` by `packages/seed/src/required/billingAddons.seed.ts` (idempotent skip-by-`name`; slug stored in `metadata.slug`, entitlements/limits/targetCategories/durationDays/sortOrder packed into columns + `metadata`). The catalog table is NOT missing — the gap is that the runtime READ path ignores it. |
| Addon catalog **read service** | `packages/service-core/src/services/billing/addon/addon.catalog.ts` | `listAvailableAddons` / `getAddonCatalogEntry` read **`ALL_ADDONS` / `getAddonBySlug` from config**, NOT from `billing_addons`. This is the central thing to flip. |
| Addon admin routes | `apps/api/src/routes/billing/admin/addons.ts` | `GET /admin/billing/addons` and `/:slug` are **read-only and read from config** (`ALL_ADDONS`). No create/update/toggle/delete (no admin CRUD parity with plans). |
| Plan source of truth (SPEC-168) | `billing_plans` table; `packages/service-core/src/services/billing/plan/{plan.service,plan.crud,plan.audit,plan.types}.ts`; admin routes `apps/api/src/routes/billing/admin/plans.ts` | `PlanService` (class facade) over `plan.crud.ts` reads/writes `billing_plans` (Hospeda catalog fields live in `metadata` JSONB: `slug`/`displayName`/`category`/`sortOrder`/`isDefault`/`hasTrial`/`trialDays`/price refs). Full admin CRUD + lifecycle (create/get/list/update/toggle/softDelete/restore/hardDelete), audit log, pricing-page revalidation hook. **This is the PATTERN to replicate for addons.** |
| Plan seeder (SPEC-168 pattern) | `packages/seed/src/required/billingPlans.seed.ts` | Idempotent: lookup by `name`(=slug); insert if missing; **divergence-detect-but-never-overwrite** (logs diverged fields, leaves DB intact so admin edits aren't clobbered). One-time config→DB transfer; day-to-day edits go through admin. |
| Residual plan reads | `ALL_PLANS` / `getPlanBySlug` in the consumers listed in §1 matrix | Still read plans from config even though SPEC-168 made DB the source of truth → two sources of truth for plan data. |
| Promo codes | `billing_promo_codes` table + `PromoCodeService` (SPEC-143) + admin CRUD | DB-backed already. The only config residue is `DEFAULT_PROMO_CODES` (a local const in `promo-code-defaults.ts`) seeded at startup via `ensureDefaultPromoCodes` (idempotent skip-by-code). |
| Structural defs | `entitlements.config.ts` (`ENTITLEMENT_DEFINITIONS`, `getDefaultEntitlements`, `getUnlimitedEntitlements`), `limits.config.ts` (`LIMIT_METADATA`) | Keyed by the compile-time enums `EntitlementKey` / `LimitKey`. Consumed by the entitlement middleware, usage-tracking, web i18n labels, admin grouping. Enum-coupled → must stay in code. |
| Packaging | `packages/billing` builds `src/index.ts → dist/` via tsup; consumed through the `exports` field | In production (Docker) **only `dist/` ships, not the repo root**. This is why BETA-58's "move config to repo root" is infeasible — runtime imports would break. |
| Schemas | `packages/schemas/src/api/billing/addon.schema.ts` (`AddonResponseSchema`, `ListAddonsQuerySchema`), `billing-plan.schema.ts` (plan CRUD schemas) | `@repo/schemas` is the single source of truth for types; addon CRUD schemas must be added/extended for FR-3. |

### FINDING A — the addon catalog table ALREADY EXISTS and is ALREADY SEEDED

Unlike the initial framing ("likely no addon catalog table exists"), verification shows
`billing_addons` (a qzpay table) is real and `billingAddons.seed.ts` already populates it from
`ALL_ADDONS`. **The missing piece is not the table — it is that the runtime read path
(`addon.catalog.ts`, admin `addons.ts`, and ~15 downstream consumers via `getAddonBySlug`)
still reads the config, not the table.** This makes FR-1 a **read-path cutover + admin CRUD
build**, not a "create a new table" task — and aligns it precisely with SPEC-168's plan work
(SPEC-168 likewise used the pre-existing qzpay `billing_plans` table rather than creating one).

### FINDING B — SPEC-168's PlanService is the exact replication template

`PlanService` (class facade) wraps `plan.crud.ts` functions returning `Result<T>`-style
service results; reads/writes `billing_plans`; packs Hospeda catalog fields into the `metadata`
JSONB; has audit logging (`plan.audit.ts`) and a best-effort pricing-page revalidation hook;
the admin routes expose full CRUD + lifecycle gated by `BILLING_READ_ALL` (read) /
`BILLING_MANAGE` (write). The seeder is idempotent (skip-by-slug) with a divergence-detect
policy that never overwrites operator edits. SPEC-192 replicates this shape for addons:
`AddonCatalogService` over the existing `billing_addons` table, admin CRUD with the same
permission split, and the existing idempotent `billingAddons.seed.ts` kept as the one-time
transfer.

### FINDING C — promos are already DB-backed; only a startup default remains

SPEC-143 already gave promo codes a DB table (`billing_promo_codes`) and a `PromoCodeService`
with admin CRUD. The only config residue is `DEFAULT_PROMO_CODES` (a hard-coded const in
`promo-code-defaults.ts`, not even the `promo-codes.config.ts` export) used by
`ensureDefaultPromoCodes` at API startup. FR-5 makes this seed/startup-only and removes any
runtime *catalog* read of promo config, so the DB is the single read source.

### FINDING D — structural defs are enum-coupled and must NOT move to DB

`ENTITLEMENT_DEFINITIONS` and `LIMIT_METADATA` are keyed by `EntitlementKey` / `LimitKey`
TypeScript enums. The entitlement middleware (`getDefaultEntitlements`,
`getUnlimitedEntitlements`) and usage-tracking depend on the compile-time enum values. Moving
this metadata to DB would split the source of truth across code (enum) and DB (metadata),
creating drift that the type system could no longer catch. FR-6 therefore keeps them in code
and only documents/improves their access — explicitly NOT a DB move (this is a non-goal).

### Project rules that constrain this work

- **This is billing CORE.** Per the project rule (CLAUDE.md "Billing testing"), any PR touching
  the billing surface (checkout, webhooks, cron, admin billing ops, entitlements) requires the
  manual **MercadoPago staging smoke**, and billing-CORE changes also require the **prod smoke**,
  in addition to CI. The vitest e2e suite uses an MP stub and cannot catch stub-vs-real-MP
  divergences — the staging smoke against the real MP sandbox is the gate. Cite
  `.qtm/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md` and
  `prod-smoke-checklist.md`.
- **DB work uses the SPEC-178 versioned migration carril**: structural changes go through
  `pnpm db:generate` → commit the migration under `packages/db/src/migrations/` → `pnpm db:migrate`;
  the drift guard blocks CI on uncommitted schema drift; **NEVER `db:push`** (dev-only, unsafe on
  staging/prod). On the VPS use `hops db-migrate --target=staging|prod`.
- Business logic lives in `@repo/service-core` services returning `Result<T>`; routes are thin.
- Zod schemas in `@repo/schemas` are the single source of truth for types.
- Permission checks use `PermissionEnum` only (never roles directly): read = `BILLING_READ_ALL`,
  write/lifecycle = `BILLING_MANAGE` (the SPEC-168 split).
- Money is integer centavos. ARS is the only billed currency.
- Admin pagination uses `page`+`pageSize` (NOT `limit`); `createAdminListRoute` rejects unknown
  params.

## 3. Goals & non-goals

### Goals

1. **Addon catalog → DB read path + admin CRUD.** Build an `AddonCatalogService` /
   model in `@repo/service-core` that reads the addon catalog from the existing
   `billing_addons` table (mirroring `PlanService`), redirect ALL ~17 runtime consumers from
   `getAddonBySlug` / `ALL_ADDONS` (config) to the service (behavior-preserving), and add admin
   CRUD for addons with SPEC-168 parity as a clearly **separable final phase**.
2. **Plan reader residuals → DB.** Redirect every consumer still reading `ALL_PLANS` /
   `getPlanBySlug` from config to `PlanService` / `billing_plans`, so plans are read from ONE
   source (DB) everywhere.
3. **Promo defaults → seed/startup-only.** Complete the DB move of `DEFAULT_PROMO_CODES`: keep
   it as the idempotent startup/seed source (`ensureDefaultPromoCodes`) but remove any runtime
   *catalog* read of promo config; reads go through `PromoCodeService` / `billing_promo_codes`.
4. **Structural defs stay in code + ADR.** Keep `ENTITLEMENT_DEFINITIONS`, `LIMIT_METADATA`,
   `getDefaultEntitlements`, `getUnlimitedEntitlements` in `@repo/billing` (enum-coupled);
   evaluate a clearer in-package location/naming WITHOUT moving them out of the package; write
   an ADR documenting the boundary (DB-backed catalog vs code-level structural definitions, and
   why).
5. **Keep the seed idempotent + add backfill.** The existing skip-by-slug idempotent seeders
   stay the one-time config→DB transfer; provide a data migration/backfill so existing
   staging/prod envs have the addon catalog populated in `billing_addons` before the read-path
   cutover.
6. **Honor the billing risk gate.** Run the MercadoPago staging smoke and prod smoke per the
   SPEC-143 checklists before merge.

### Non-goals (explicitly out of scope)

1. **D-N1 — Moving the billing config to the repo root is REJECTED** (BETA-58's premise). The
   config is runtime, and `@repo/billing` ships only `dist/` to production — the repo root is
   not in the image. Config files stay under `packages/billing/src/config/*` as the seed source.
2. **D-N2 — Moving `ENTITLEMENT_DEFINITIONS` / `LIMIT_METADATA` / `getDefaultEntitlements` /
   `getUnlimitedEntitlements` to DB is REJECTED.** They are enum-coupled (`EntitlementKey` /
   `LimitKey`); a DB move would create code↔DB drift the type system cannot catch. They stay in
   code; only visibility/docs improve.
3. **D-N3 — No change to the MercadoPago / QZPay adapter integration.** The qzpay storage
   adapter, MP checkout/webhook integration, and the qzpay table shapes are untouched. This spec
   only changes where Hospeda READS the catalog from (config → the existing DB tables) and adds
   admin write paths over them.
4. **D-N4 — No change to how entitlements are assigned per plan.** Plan→entitlement assignment
   already lives in `billing_plans.entitlements` (SPEC-168). This spec does not re-model that.
5. **D-N5 — No new billing tables.** `billing_addons` / `billing_plans` / `billing_promo_codes`
   already exist (qzpay). The only DB DDL this spec may add is a backfill/data migration (and any
   small column the addon admin CRUD provably needs — flagged, not assumed).
6. **D-N6 — No web/admin pricing UI redesign.** Admin addon CRUD UI is parity-with-plans, not a
   new design; the public pricing surface is unchanged beyond reading addons from the DB.
7. **D-N7 — No promo-code feature changes.** SPEC-143 owns promo CRUD; FR-5 only removes the
   residual config read, it does not add promo features.

## 4. Functional requirements & acceptance criteria

### FR-1 — Addon catalog DB read service (over the existing `billing_addons` table) (BETA-58)

Build a DB-backed addon catalog read path mirroring `PlanService`, reading from the **existing,
already-seeded** `billing_addons` table (NOT a new table — finding A).

- New service in `@repo/service-core` (e.g.
  `packages/service-core/src/services/billing/addon/addon-catalog.service.ts` +
  model/queries module), returning service results, that:
  - lists addons from `billing_addons` with filters equivalent to the current config filters
    (`billingType`, `targetCategory`, `active`), sorted by `sortOrder` (read from `metadata`);
  - gets one addon by `slug` (stored in `metadata.slug`), returning NOT_FOUND when absent;
  - maps the stored row (columns + `metadata`) back to the `AddonDefinition`-shaped result the
    existing consumers expect (slug, name, description, billingType, priceArs, durationDays,
    affectsLimitKey, limitIncrease, grantsEntitlement, targetCategories, isActive, sortOrder),
    so the cutover (FR-2) is behavior-preserving.
- The existing `addon.catalog.ts` (`listAvailableAddons` / `getAddonCatalogEntry`) is rewritten
  to delegate to this service instead of `ALL_ADDONS` / `getAddonBySlug`.

```
Given the billing_addons table is seeded with the 5 addon definitions
  When AddonCatalogService.list() is called with no filters
  Then it returns all active addons mapped to the AddonDefinition shape, sorted by sortOrder ascending
  And the result is field-for-field equal to the previous config-backed listAvailableAddons() output for the same data

Given an addon slug stored in billing_addons.metadata.slug
  When AddonCatalogService.getBySlug('visibility-boost-7d') is called
  Then it returns that addon mapped to the AddonDefinition shape

Given a slug that is not present in billing_addons
  When AddonCatalogService.getBySlug is called
  Then it returns a NOT_FOUND service error (parity with the previous getAddonCatalogEntry behavior)

Given a billingType / targetCategory / active filter
  When AddonCatalogService.list(filter) is called
  Then the DB query applies the equivalent filter and the result matches the old config-filtered output
```

### FR-2 — Cutover ALL addon runtime consumers to the DB service (behavior-preserving) (BETA-58)

Redirect every runtime consumer of `getAddonBySlug` / `ALL_ADDONS` from config to the new
DB-backed read path. The consumer set (verified — ~17 sites, the genuinely seed/dev-tool ones
excluded):

- **service-core**: `addon-user-addons.ts`, `addon-limit-recalculation.service.ts`
  (`addon.catalog.ts` itself is rewritten in FR-1).
- **apps/api services**: `addon.checkout.ts`, `addon.admin.ts`, `addon.user-addons.ts`,
  `addon-entitlement.service.ts`, `addon-lifecycle.service.ts`,
  `addon-lifecycle-cancellation.service.ts`, `addon-plan-change.service.ts`.
- **apps/api cron**: `cron/jobs/addon-expiry.job.ts`.
- **apps/api webhooks**: `routes/webhooks/mercadopago/payment-logic.ts`.
- **apps/api admin routes/hooks**: `routes/billing/admin/addons.ts`, `qzpay-admin-hooks.ts`.

This is the **highest-risk FR** — the webhook, cron, and checkout sites handle real money. Each
cutover must be behavior-preserving: the addon resolved from the DB must equal the addon
previously resolved from config for the same slug.

```
Given the MercadoPago payment-logic webhook resolves an addon by slug
  When it is cut over from getAddonBySlug(config) to AddonCatalogService.getBySlug(DB)
  Then for any seeded slug it resolves the identical addon definition (same entitlement, limit, price, duration)
  And the webhook's downstream behavior (entitlement grant, limit increase) is unchanged

Given the addon-expiry cron job iterates addon definitions
  When it reads the catalog from the DB service instead of ALL_ADDONS
  Then it processes the same set of addons it did before (no addon dropped or added)

Given the addon checkout flow
  When it resolves the purchased addon from the DB service
  Then the price (centavos), billingType, and grants are identical to the config-backed resolution

Given a regression test per cutover site
  When the test runs against a seeded billing_addons table
  Then the DB-resolved addon equals the config-resolved addon for every seeded slug (parity pinned, not one-time)
```

### FR-3 — Admin addon CRUD (parity with SPEC-168 plans) — SEPARABLE final phase (BETA-58)

Add full admin CRUD over `billing_addons`, mirroring the plan admin surface, as a clearly
separable phase that can ship independently of FR-1/FR-2.

- `@repo/schemas`: extend/add addon CRUD schemas (create/update/search/response) alongside the
  existing `AddonResponseSchema` / `ListAddonsQuerySchema` in
  `packages/schemas/src/api/billing/addon.schema.ts` (mirror the plan schemas in
  `billing-plan.schema.ts`).
- `@repo/service-core`: extend `AddonCatalogService` (or an `AddonAdminService`) with
  create/update/toggleActive/softDelete/restore/hardDelete over `billing_addons`, returning
  service results, with audit logging (mirror `plan.audit.ts`). Hard-delete must be blocked when
  a `billing_subscription_addons` row references the addon (parity with the plan hard-delete
  guard against `billing_subscriptions`).
- `apps/api`: convert `routes/billing/admin/addons.ts` from read-only-config to DB-backed CRUD,
  permissions split `BILLING_READ_ALL` (read) / `BILLING_MANAGE` (write), error-code→HTTP
  mapping (VALIDATION_ERROR→422, NOT_FOUND→404, ALREADY_EXISTS→409) as in `plans.ts`.
- `apps/admin`: an admin addon management UI with parity to the plan management UI (list +
  create/edit form via TanStack Form + Zod). This UI is the most separable slice and may be its
  own commit/PR.

```
Given an admin with BILLING_MANAGE creates an addon via POST /admin/billing/addons
  When the request is valid
  Then a billing_addons row is created, an audit entry is written, and the addon appears in the catalog list

Given an admin updates an addon's price/active state
  When the write succeeds
  Then the billing_addons row reflects the change and subsequent catalog reads (FR-1) return the new values

Given an admin attempts to hard-delete an addon referenced by a billing_subscription_addons row
  When the request is processed
  Then it is rejected (ALREADY_EXISTS / 409) and the addon is not deleted (parity with plan hard-delete guard)

Given a user WITHOUT BILLING_MANAGE
  When they attempt any addon write endpoint
  Then the request is rejected by the permission check (403), read endpoints still allowed with BILLING_READ_ALL

Given the admin addon list endpoint
  When paginated
  Then it uses page+pageSize (not limit) and createAdminListRoute does not reject the declared params
```

### FR-4 — Plan reader residuals → PlanService / DB (BETA-58)

Redirect every consumer still reading `ALL_PLANS` / `getPlanBySlug` from config to
`PlanService` / `billing_plans`, so plans have ONE read source. Verified residual consumers:

- **apps/web**: `lib/billing/fetch-plans.ts` (reads through the API; ensure the public endpoint
  it calls is DB-backed).
- **apps/api**: public `routes/billing/public/listPlans.ts`; protected
  `routes/user/protected/subscription.ts` and `stats.ts`; `middlewares/entitlement.ts` (plan
  lookup portion only — NOT the entitlement defaults, which stay in code per FR-6);
  `services/addon-plan-change.service.ts`; `services/addon-entitlement.service.ts`;
  `services/addon.checkout.ts`.
- **apps/admin**: `features/billing-subscriptions/utils.ts`.
- **service-core**: `addon-plan-change.helpers.ts`; `addon-limit-recalculation.service.ts`.

Behavior-preserving: the plan resolved from the DB must equal the plan previously resolved from
config for the same slug. (SPEC-168 already proved a residual-read bug class — e.g. checkout's
`resolvePlanBySlug` matches `billing_plans.name === slug` — so the seed stores the slug as
`name`. Reuse that resolution.)

```
Given the public listPlans endpoint
  When it is cut over to read from billing_plans (PlanService) instead of ALL_PLANS
  Then it returns the same plans (slug, prices, entitlements, limits) as the seeded DB, and the web pricing page renders unchanged

Given the protected subscription/stats endpoints resolve the user's plan
  When they read the plan from the DB instead of getPlanBySlug(config)
  Then the resolved plan data is identical for the user's current plan slug

Given the addon checkout / addon-plan-change resolves the target plan
  When it reads from PlanService instead of config
  Then the plan's limits/entitlements used for the addon calculation are the DB values (single source of truth)

Given a regression test for each plan-reader cutover
  When run against a seeded billing_plans table
  Then the DB-resolved plan equals the config-resolved plan for every seeded slug
```

### FR-5 — Promo defaults → seed/startup-only (no runtime catalog read) (BETA-58)

Promos are already DB-backed (SPEC-143). Complete the move so no runtime *catalog* read of
promo config remains:

- `DEFAULT_PROMO_CODES` stays as the **idempotent startup/seed source** consumed by
  `ensureDefaultPromoCodes` (skip-by-code), and/or move it into the seed package so it is
  unambiguously seed-only. No code path reads promo config to *answer a request* — promo lookups
  go through `PromoCodeService` / `billing_promo_codes`.
- The `config-validator` / `config-drift-check` dev tools may continue to reference it (dev-only,
  not runtime).

```
Given the API startup
  When ensureDefaultPromoCodes runs
  Then HOSPEDA_FREE is created in billing_promo_codes if missing and skipped if present (idempotent)

Given any runtime promo lookup (validation, application at checkout)
  When a promo code is resolved
  Then it is read from billing_promo_codes via PromoCodeService, never from promo config at request time

Given the promo config residue
  When the codebase is inspected
  Then DEFAULT_PROMO_CODES is referenced only by the startup/seed path and dev tools, not by any request handler
```

### FR-6 — Structural-defs visibility + boundary ADR (NO DB move) (BETA-58)

Keep `ENTITLEMENT_DEFINITIONS`, `LIMIT_METADATA`, `getDefaultEntitlements`,
`getUnlimitedEntitlements` in `@repo/billing` (enum-coupled — finding D). The work here is
visibility + documentation, NOT a move:

- Evaluate a clearer in-package location/naming (e.g. a dedicated `structural/` or
  `definitions/` sub-path) WITHOUT moving them out of the package or breaking the barrel exports.
  If a rename/relocation is done it is mechanical and behavior-preserving.
- Write an ADR under `docs/decisions/` (numbered per the existing sequence) that documents the
  **boundary**: what is **DB-backed catalog** (plans, prices, addons, promo codes — editable at
  runtime, seeded once from config) vs what is **code-level structural definition** (entitlement
  & limit keys + their metadata, default/unlimited entitlement maps — enum-coupled, must stay in
  code), and WHY (type-safety / drift avoidance / packaging constraints — the BETA-58 reframing).
- The ADR also records the BETA-58 supersession and links SPEC-168.

```
Given the ADR is added under docs/decisions/
  When a reviewer reads it
  Then it states the catalog-vs-structural boundary, lists which billing data is DB-backed and which stays in code, gives the rationale, and records that BETA-58's repo-root move was rejected (packaging) and SPEC-168 is the lineage

Given ENTITLEMENT_DEFINITIONS / LIMIT_METADATA / getDefaultEntitlements / getUnlimitedEntitlements
  When the spec completes
  Then they remain in @repo/billing (no DB table created for them) and are still consumed by the entitlement middleware / usage-tracking / web i18n / admin grouping unchanged

Given the ADR is referenced from docs/decisions/README.md
  When the docs lint/build runs
  Then there is no broken link and the ADR appears in the index
```

### FR-7 — Seed stays idempotent skip-by-slug (BETA-58)

The existing `billingAddons.seed.ts` / `billingPlans.seed.ts` remain the one-time config→DB
transfer and stay idempotent: lookup by `name`(=slug), insert if missing, skip if present
(plans additionally divergence-detect-but-never-overwrite). No seeder is made to overwrite
operator/admin edits.

```
Given billing_addons is already seeded
  When the seeder runs again
  Then every addon is skipped (no duplicate rows, no overwrite of admin edits)

Given a fresh DB
  When the seeder runs
  Then all 5 addons are inserted into billing_addons from ALL_ADDONS with slug in metadata.slug
```

### FR-8 — Data migration / backfill for existing envs (BETA-58)

Ensure existing staging/prod envs have the addon catalog populated in `billing_addons` BEFORE
the FR-2 read-path cutover (otherwise a cutover against an unseeded env would resolve an empty
catalog).

- If the addon backfill is purely data (rows from `ALL_ADDONS`), implement it via the idempotent
  seeder run on the target env (`hops db-seed` / equivalent), NOT a schema migration.
- If FR-3's admin CRUD provably needs a new column on `billing_addons` (flagged, not assumed —
  the qzpay shape may already suffice via `metadata`), that DDL goes through the **SPEC-178
  versioned carril**: `pnpm db:generate` → commit the migration under
  `packages/db/src/migrations/` → `pnpm db:migrate`; drift guard enforced; **NEVER `db:push`**;
  on the VPS `hops db-migrate --target=staging|prod`.
- The backfill/migration must be ordered BEFORE the cutover deploy and verified (row count ==
  `ALL_ADDONS.length`) on each env.

```
Given a staging/prod env whose billing_addons is empty or partial
  When the idempotent addon seed/backfill is run
  Then billing_addons contains one row per ALL_ADDONS entry and re-running is a no-op

Given the read-path cutover (FR-2) is deployed
  When it runs against the backfilled env
  Then the DB catalog is non-empty and resolves every slug the config previously resolved

Given any new column the addon admin CRUD requires
  When it is added
  Then it is generated via pnpm db:generate, the migration is committed under packages/db/src/migrations, the drift guard passes, and db:push is never used
```

## 5. Phased implementation plan

Ordered low-risk-first, with the DB migration (if any) isolated and the admin CRUD last and
separable. Each phase is a natural pause point.

### Phase 1 — Addon catalog DB read service (FR-1) — read-path parity, no cutover yet

1. Build `AddonCatalogService` + model/queries in `@repo/service-core` reading from
   `billing_addons` (list with filters + sort, getBySlug, map row→`AddonDefinition` shape).
2. Unit tests (against a seeded `billing_addons`) asserting field-for-field parity with the
   current config-backed `listAvailableAddons` / `getAddonCatalogEntry` for the same data.
3. Rewrite `addon.catalog.ts` to delegate to the service (its public API unchanged).

**Pause point:** the DB-backed catalog read path exists and is proven equal to config; no
downstream consumer has been moved yet (they still go through the unchanged `addon.catalog.ts`
API, now DB-backed under the hood).

### Phase 2 — Addon backfill for existing envs (FR-8 data part)

4. Confirm/repair the idempotent `billingAddons.seed.ts` and run the backfill on local + define
   the staging/prod backfill runbook (seed run, verify row count). DDL only if FR-3 proves a
   column is needed — and only via the SPEC-178 versioned carril.

**Pause point:** every target env's `billing_addons` is fully populated; the cutover (Phase 3)
will never hit an empty catalog.

### Phase 3 — Cut over addon runtime consumers to the service (FR-2) — HIGHEST RISK

5. Cut over the **non-money** consumers first (service-core helpers, admin read route) with
   parity tests.
6. Cut over the **money-handling** consumers last and one at a time, each its own commit, each
   with a parity regression test: addon.checkout → addon-plan-change → addon-lifecycle(+cancel)
   → cron `addon-expiry.job` → webhook `payment-logic`.

**Pause point:** all addon catalog reads resolve from the DB; config is no longer read at
runtime for addons. (Billing-CORE — staging smoke required before this lands.)

### Phase 4 — Plan reader residuals → DB (FR-4)

7. Cut over the residual plan readers to `PlanService` / DB, public endpoint first
   (`listPlans`), then protected (`subscription`, `stats`), then the addon-coupled services, then
   admin/web utils. Parity test per site.

**Pause point:** plans are read from ONE source (DB) everywhere.

### Phase 5 — Promo defaults → seed/startup-only (FR-5)

8. Move/confirm `DEFAULT_PROMO_CODES` as seed/startup-only; remove any runtime catalog read of
   promo config; tests asserting startup idempotency and request-time DB reads.

**Pause point:** no runtime promo catalog read remains.

### Phase 6 — Structural-defs visibility + ADR (FR-6) + seed idempotency confirm (FR-7)

9. Optional mechanical relocation/naming of the structural defs within `@repo/billing` (no DB
   move, no export break); write the boundary ADR; link it from the ADR index; confirm seeders
   stay idempotent skip-by-slug.

**Pause point:** the boundary is documented; structural defs remain in code.

### Phase 7 — Admin addon CRUD (FR-3) — SEPARABLE

10. Add addon CRUD schemas (`@repo/schemas`), service write methods + audit
    (`@repo/service-core`), DB-backed admin routes (`apps/api`, permission split, error mapping,
    hard-delete guard), and the admin management UI (`apps/admin`, TanStack Form + Zod). This is
    independently shippable.

**Pause point:** admins can manage the addon catalog from the DB with plan parity.

### Phase 8 — Closeout + billing smokes

11. Flip spec + task index to completed. Run the **MercadoPago staging smoke** (checkout,
    addon purchase, webhook, cron-touched flows) AND the **prod smoke** (billing-CORE gate) per
    the SPEC-143 checklists; file the sign-offs; reference them in the PR.

> Reorder note: Phases 2 and 3 may merge if the backfill is trivially the seed run; the
> money-handling cutover (Phase 3 step 6) must never precede the backfill (Phase 2).

## 6. Risk and rollback

| Risk | Mitigation / rollback |
|------|------------------------|
| **Webhook / cron / checkout behavior change (highest — real money)** — a DB-resolved addon/plan differs from the config-resolved one, mis-granting entitlements, mis-charging, or dropping an expiry | FR-2/FR-4 are behavior-preserving with a **parity regression test per cutover site** (DB-resolved == config-resolved for every seeded slug); money-handling sites cut over **last, one commit each**; **MercadoPago staging smoke + prod smoke** gate the merge (the stub can't catch MP divergences); rollback = revert the single cutover commit (the config path still exists until the spec is fully landed) |
| **Cutover against an unseeded env → empty catalog** | FR-8 backfills `billing_addons` on every env BEFORE the Phase-3 cutover deploy, verified by row count == `ALL_ADDONS.length`; the cutover deploy is ordered after the backfill |
| **DB migration on prod billing tables** (only if FR-3 needs a column) | SPEC-178 versioned carril (`pnpm db:generate` → commit → `pnpm db:migrate`); drift guard blocks uncommitted drift; **NEVER `db:push`**; isolated; on VPS `hops db-migrate --target=...`; rollback = down-migration / revert before cutover |
| **Drift between config seed and DB after cutover** — config edited but DB stale, or admin edits clobbered by a re-seed | Seeders stay idempotent skip-by-slug and (for plans) divergence-detect-but-never-overwrite (FR-7); config becomes seed-only and the ADR documents it; admin CRUD (FR-3) is the runtime edit path, the seed is one-time |
| **Stub-vs-real-MP divergence** — the vitest billing e2e uses an MP stub | Mandatory manual MercadoPago **staging** smoke (real MP sandbox) for any billing-surface PR, and **prod** smoke for billing-CORE changes, per SPEC-143 checklists — this is the gate, not CI |
| **Incorrectly moving structural defs to DB** (would create code↔DB drift) | D-N2 non-goal; FR-6 keeps them in code; reviewer checks no DB table was added for entitlement/limit metadata |
| **Permission regression on new addon write routes** | Reuse the SPEC-168 `BILLING_READ_ALL` / `BILLING_MANAGE` split; acceptance tests for unauthorized writes (403) |

## 7. Testing strategy

Per Test-Informed Development (Vitest, AAA, ≥90% coverage) **plus** the mandatory manual
MercadoPago smokes (this is billing CORE):

- **Pure logic — tests first:** `AddonCatalogService` list/getBySlug/row-mapping (filters, sort,
  NOT_FOUND, field-for-field parity with the config output); plan-reader resolution parity;
  promo startup idempotency.
- **Cutover parity — tests alongside (the core safety net):** one regression test per FR-2 and
  FR-4 cutover site asserting **DB-resolved == config-resolved** for every seeded slug
  (entitlement, limit, price-centavos, duration, billingType). These pin the cutovers as
  permanent invariants, not one-time checks.
- **Admin CRUD — tests alongside (FR-3):** create/update/toggle/softDelete/restore + the
  hard-delete-blocked-when-referenced guard; permission split (read vs manage); error-code→HTTP
  mapping; admin list pagination (`page`+`pageSize`).
- **Schema — tests first:** the new/extended addon CRUD Zod schemas in `@repo/schemas` (valid /
  invalid / boundary).
- **DB migration (only if FR-3 adds a column):** the generated migration applies cleanly,
  round-trips a value, drift guard passes (no uncommitted drift), per SPEC-178 patterns.
- **The billing e2e stub suite:** runs as usual but is explicitly **insufficient** for the
  money-handling cutovers — it cannot catch MP divergences.
- **Mandatory manual MercadoPago STAGING smoke (gate):** run the relevant sections of
  `.qtm/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md` against
  `https://staging.hospeda.com.ar` with MP sandbox credentials — addon checkout/purchase,
  subscription checkout, webhook signature path, cron-touched addon expiry, admin addon ops. File
  the sign-off in the checklist and reference it in the PR.
- **Mandatory manual MercadoPago PROD smoke (billing-CORE gate):** because FR-2/FR-3/FR-4 touch
  the start-paid route, webhook handlers, crons, and admin billing ops, run the prod smoke
  (`prod-smoke-checklist.md`) as the production go-live gate.
- **Regression:** any bug found during a cutover gets a reproducing test before the fix.
- **No committed PNGs** (project policy); assertions over service results / DB rows / parsed
  responses.

## 8. Out-of-scope / future work

- Moving billing config to the repo root (BETA-58 premise — rejected, D-N1; packaging makes it
  infeasible).
- Moving `ENTITLEMENT_DEFINITIONS` / `LIMIT_METADATA` / `getDefaultEntitlements` /
  `getUnlimitedEntitlements` to DB (rejected, D-N2; enum-coupled drift).
- Changes to the MercadoPago / QZPay adapter integration or the qzpay table shapes (D-N3).
- Re-modeling per-plan entitlement assignment (already in `billing_plans`, D-N4).
- New promo-code features (SPEC-143 owns promos; D-N7).
- Any new billing UI design beyond admin addon CRUD parity-with-plans (D-N6).
- Making the structural defs runtime-editable in any form (deliberately excluded — they are
  enum-coupled by design).

## 9. Key file pointers

| File | Relevance |
|------|-----------|
| `packages/db/src/billing/schemas.ts` + `index.ts` | qzpay table re-exports incl. `billingAddons`, `billingPlans`, `billingPrices`, `billingPromoCodes`, `billingSubscriptionAddons` (the catalog tables live in the external `@qazuor/qzpay-drizzle`) |
| `packages/service-core/src/services/billing/addon/addon.catalog.ts` | FR-1 — rewrite to delegate to the new DB-backed `AddonCatalogService` |
| `packages/service-core/src/services/billing/addon/` (new `addon-catalog.service.ts` + model/queries) | FR-1/FR-3 — new DB-backed addon catalog read service + admin write methods + audit |
| `packages/service-core/src/services/billing/plan/{plan.service,plan.crud,plan.audit,plan.types}.ts` | The SPEC-168 PATTERN to replicate for addons (finding B) |
| `apps/api/src/routes/billing/admin/addons.ts` | FR-2 (read cutover) + FR-3 (convert read-only-config → DB-backed CRUD, BILLING_READ_ALL/BILLING_MANAGE split) |
| `apps/api/src/routes/billing/admin/plans.ts` | FR-3 reference — admin CRUD + lifecycle + error mapping pattern |
| `apps/api/src/services/{addon.checkout,addon.admin,addon.user-addons,addon-entitlement.service,addon-lifecycle.service,addon-lifecycle-cancellation.service,addon-plan-change.service}.ts` | FR-2 — addon consumer cutover (money-handling: checkout/lifecycle/plan-change) |
| `apps/api/src/cron/jobs/addon-expiry.job.ts` | FR-2 — cron consumer cutover (highest risk) |
| `apps/api/src/routes/webhooks/mercadopago/payment-logic.ts` | FR-2 — webhook consumer cutover (highest risk, real money) |
| `apps/api/src/routes/billing/admin/qzpay-admin-hooks.ts` | FR-2 — addon consumer cutover |
| `packages/service-core/src/services/billing/addon/{addon-user-addons,addon-limit-recalculation.service,addon-plan-change.helpers}.ts` | FR-2/FR-4 — addon + plan consumer cutover |
| `apps/web/src/lib/billing/fetch-plans.ts` | FR-4 — ensure the public endpoint it calls is DB-backed |
| `apps/api/src/routes/billing/public/listPlans.ts` | FR-4 — public plan-reader cutover → DB |
| `apps/api/src/routes/user/protected/{subscription,stats}.ts` | FR-4 — protected plan-reader cutover → DB |
| `apps/api/src/middlewares/entitlement.ts` | FR-4 — cut over the plan-lookup portion to DB; FR-6 — KEEP `getDefaultEntitlements`/`getUnlimitedEntitlements` in code |
| `apps/admin/src/features/billing-subscriptions/utils.ts` | FR-4 — admin plan-reader cutover |
| `packages/service-core/src/services/billing/promo-code/promo-code-defaults.ts` | FR-5 — `DEFAULT_PROMO_CODES` → seed/startup-only |
| `packages/billing/src/config/{addons,plans,promo-codes,entitlements,limits}.config.ts` | The seed source; FR-6 — structural defs (`ENTITLEMENT_DEFINITIONS`, `LIMIT_METADATA`, default/unlimited maps) STAY here, documented |
| `apps/api/src/services/usage-tracking.service.ts` | Consumes `LIMIT_METADATA` (FR-6 — stays in code) |
| `packages/schemas/src/api/billing/addon.schema.ts` | FR-3 — extend with addon CRUD schemas (mirror `billing-plan.schema.ts`) |
| `packages/seed/src/required/{billingAddons,billingPlans,billingPromoCodes}.seed.ts` | FR-7/FR-8 — idempotent skip-by-slug seeders kept as one-time transfer + backfill |
| `packages/db/src/migrations/` | FR-8 — only if FR-3 needs a column (SPEC-178 versioned carril; commit the migration; never `db:push`) |
| `apps/admin/src/features/billing-plans/**` | FR-3 reference — admin plan management UI to mirror for addons |
| `docs/decisions/` (+ `docs/decisions/README.md`) | FR-6 — boundary ADR + index link |
| `.qtm/specs/SPEC-143-billing-testing-coverage/docs/{staging-smoke-checklist,prod-smoke-checklist,mp-test-cards-reference}.md` | The mandatory MercadoPago smoke gate (§7, Phase 8) |

## 10. Design decisions (locked)

1. **D-1 — Complete SPEC-168, do NOT relocate config.** BETA-58 is superseded; its repo-root
   move is rejected (config is runtime; `@repo/billing` ships only `dist/`). The real goal is to
   make the rest of the billing catalog DB-backed.
2. **D-2 — The addon catalog table is the EXISTING `billing_addons` (qzpay), not a new table**
   (finding A). SPEC-192 builds the DB READ path + admin CRUD over it, exactly as SPEC-168 used
   the pre-existing `billing_plans`.
3. **D-3 — `AddonCatalogService` mirrors `PlanService`** (finding B): service over the table,
   Hospeda catalog fields in `metadata`, audit logging, `BILLING_READ_ALL`/`BILLING_MANAGE`
   permission split, hard-delete guard against `billing_subscription_addons`.
4. **D-4 — All addon runtime consumers (~17) are cut over to the DB service, behavior-preserving**
   (FR-2), money-handling sites last and one-commit-each, each pinned by a DB-vs-config parity
   regression test.
5. **D-5 — Plan reads are unified on the DB** (FR-4): every residual `ALL_PLANS`/`getPlanBySlug`
   consumer cut over to `PlanService`/`billing_plans`; slug resolves via `billing_plans.name`
   (the SPEC-168 convention).
6. **D-6 — Promos are DB-backed already; `DEFAULT_PROMO_CODES` becomes seed/startup-only** (FR-5).
   No runtime promo catalog read remains.
7. **D-7 — Structural defs stay in code** (FR-6, D-N2): `ENTITLEMENT_DEFINITIONS`,
   `LIMIT_METADATA`, `getDefaultEntitlements`, `getUnlimitedEntitlements` are enum-coupled
   (`EntitlementKey`/`LimitKey`); a DB move would create code↔DB drift. Only visibility/naming
   improves; a boundary ADR documents what is DB-backed vs code-level and why.
8. **D-8 — Config files remain the seed source** under `packages/billing/src/config/*`; the
   idempotent skip-by-slug seeders are the one-time config→DB transfer; admin CRUD is the runtime
   edit path (FR-7). The seed never overwrites operator/admin edits (plans additionally
   divergence-detect-but-never-overwrite).
9. **D-9 — DB DDL (only if FR-3 needs a column) uses the SPEC-178 versioned carril**
   (`pnpm db:generate` → commit migration → `pnpm db:migrate`; drift guard; NEVER `db:push`;
   VPS via `hops db-migrate`). Existing-env addon backfill is a data seed run, ordered BEFORE the
   cutover deploy (FR-8).
10. **D-10 — Billing-CORE risk gate.** FR-2/FR-3/FR-4 touch checkout/webhook/cron/admin billing
    ops, so the MercadoPago **staging smoke** AND **prod smoke** (SPEC-143 checklists) are
    mandatory merge gates; the vitest MP-stub e2e suite is necessary but insufficient.
11. **D-11 — Admin addon CRUD is the SEPARABLE final phase** (Phase 7) and may ship as its own
    PR after the read-path cutovers are green and smoked.
