# CLAUDE.md - Billing Package

> Main docs: See [README.md](./README.md)
> Project docs: See [root CLAUDE.md](../../CLAUDE.md)

## Overview

Billing and monetization logic for the Hospeda platform. Integrates with MercadoPago via the QZPay adapter for ARS payments. Handles plans, subscriptions, add-ons, promo codes, sponsorships, and customer management.

This package exports types/enums plus the plan **config** (`ALL_PLANS` / `PlanDefinition` in `src/config/`). After initial seeding, plans live in the qzpay `billing_plans` table (prices in `billing_prices`) and are edited at runtime from the admin panel via `PlanService` (`@repo/service-core`). Since SPEC-211 the seeder applies the **Model C** per-field policy on re-runs: capability-layer fields (limit key presence, `metadata.category`/`metadata.isDefault`) are propagated from config to the DB row; commercial-layer fields (prices, active flag, limit numeric values, displayName, entitlements, sort order, trial settings) are left as the operator set them. See the "Model C" section below, [ADR-020](../../docs/decisions/ADR-020-billing-plans-source-of-truth.md) (superseded), and the [Managing Billing Plans guide](../../docs/guides/managing-billing-plans.md).

`displayName`, `monthlyPriceArs`, and `annualPriceArs` are **typed `billing_plans` columns** (`display_name`, `monthly_price_ars`, `annual_price_ars` — HOS-39 T-001..T-003), promoted off what used to be `metadata.displayName`/`metadata.monthlyPriceArs`/`metadata.annualPriceArs` jsonb-only fields. `updatePlan()` in `plan.crud.ts` dual-writes both the typed column and the `metadata` mirror on every edit (the metadata copy is kept for the search `ILIKE` query at line 143 and for any other reader that still expects the jsonb shape) — if you read plan display fields, prefer the typed column.

## Key Files

```
src/
├── adapters/         # Payment processor adapters (MercadoPago)
├── config/           # Plan configs, add-on configs, pricing
├── services/         # Billing business logic services
├── types/            # TypeScript types and interfaces
└── webhooks/         # Webhook handlers for payment events
```

## Patterns

- All monetary values stored as integers (centavos), never float or numeric
- Default currency: ARS (Argentine Peso)
- Config names and descriptions always in English (UI localization handled by i18n)
- Plans use UUID for `id`
- Trial: 14 days, HOST role only
- AFIP invoicing deferred to v2 (manual via accountant)
- Dispute handling: manual in v1 (webhooks logged, resolved via dashboard)

## Entitlement & Limit Keys (SPEC-145)

### Counts and files

| Set | Count | Definition file |
|-----|-------|-----------------|
| `EntitlementKey` enum members | 48 | `src/types/entitlement.types.ts` |
| `LimitKey` enum members | 8 | `src/types/plan.types.ts` |
| Runtime guards | 2 (`isEntitlementKey`, `isLimitKey`) | `src/types/guards.ts` |

Guards use `Object.values(...)` to build `ReadonlySet` look-up tables at
module load time — no manual guard update needed when you add a new key.

### `LIMIT_METADATA` exhaustiveness gotcha

`packages/billing/src/config/limits.config.ts` declares:

```ts
export const LIMIT_METADATA: Record<LimitKey, { name: string; description: string }> = { ... };
```

Because it is a `Record<LimitKey, ...>`, TypeScript **requires an entry for
every `LimitKey`**. Adding a new `LimitKey` without adding a `LIMIT_METADATA`
entry is a compile error.

Similarly, `apps/api/src/utils/limit-check.ts` declares:

```ts
const RESOURCE_NAMES: Record<LimitKey, string> = { ... };
```

Adding a `LimitKey` without a `RESOURCE_NAMES` entry is also a compile error.
Both records must be updated together.

### Plan grants and DB sync

`plans.config.ts` (`ALL_PLANS`) is the **code-level config** that the seeder
reads. After initial seeding, the `billing_plans` table (QZPay) is the
**runtime source of truth**. For an existing environment, use the admin panel
or admin API to apply commercial-layer changes (prices, descriptions, active
flag). Capability-layer changes (entitlement grants, limit key presence) now
propagate automatically on the next seed run via the Model C policy — see the
section below. See `docs/billing/adding-an-entitlement.md` for the full flow.

`ENTITLEMENT_DEFINITIONS` (`src/config/entitlements.config.ts`) is the source
of truth for the `billing_entitlements` lookup table. The seeder
(`packages/seed/src/required/billingEntitlements.seed.ts`) reads it and
upserts rows — skip-by-key, never overwriting.

### Model C: capability vs commercial layer (SPEC-211, narrowed HOS-39)

SPEC-211 introduced a two-layer split that governs how `billing_plans` fields
are handled when config and the live DB diverge:

- **Capability layer** (config wins) — which `LimitKey`s are present in the
  limits map (`limitsKeysPresent`), plus the two truly structural metadata
  fields: `metadata.category` (drives entitlement-resolution fallbacks) and
  `metadata.isDefault` (which plan is the fallback for its tier). The seed
  sync propagates config values to existing DB rows on every deploy.

- **Commercial layer** (DB wins) — everything an operator can plausibly
  change from the SPEC-168 admin UI: `description`, `active`, `displayName`,
  `monthlyPriceArs`, `annualPriceArs`, `entitlements`, `metadata.sortOrder`,
  `metadata.hasTrial`, `metadata.trialDays`, and the numeric limit values
  (`limitsValues`). The seed logs a notice but never overwrites them.

HOS-39 (2026-07-02) reclassified `entitlements`, `metadata.sortOrder`,
`metadata.hasTrial`, and `metadata.trialDays` from `'capability'` to
`'commercial'`. Before this fix the classification table said config wins
for these four fields while the admin `PlanDialog.tsx` (SPEC-168) already
let operators edit them — so any operator edit was silently reverted by the
next seed run. `category` and `isDefault` are the only two fields that stay
`'capability'`; they were also removed from `UpdatePlanInput` entirely
(`packages/service-core/src/services/billing/plan/plan.types.ts`) since they
were never meant to be admin-editable in the first place.

The canonical classification table is
`packages/billing/src/config/model-c-field-split.ts` (`MODEL_C_FIELD_SPLIT`).
Every seed-controlled field is listed there with its layer. The seed's
fail-fast guard (`assertAllSeedFieldsClassified` in
`packages/seed/src/required/billingPlans.seed.ts`) throws at startup if any
field is missing from the table — preventing a new column from silently
bypassing the policy. The guard test
(`packages/billing/test/model-c-field-split.test.ts`, AC-2.3) validates
exhaustiveness on every CI run.

**Runtime guard on `PlanService.update()` (HOS-39 T-027)**: `updatePlan()` in
`plan.crud.ts` calls `findCapabilityFieldViolation(input)` before doing any
DB work, rejecting the call with `VALIDATION_ERROR` if any input key maps
(via `UPDATE_PLAN_INPUT_MODEL_C_KEYS`) to a `'capability'`-layer field. This
checks the runtime payload, not just the TypeScript type, so it also catches
a caller that bypasses `UpdatePlanInput` via an unsafe cast. This is the
structural fix for the HOS-39 bug class: `UpdatePlanInput`'s field names and
`MODEL_C_FIELD_SPLIT`'s classification keys are two independently maintained
lists, and this guard is what stops them from drifting apart silently again
for any future field.

**When you add a new column to `billing_plans` and teach the seed about it,
you MUST add it to `MODEL_C_FIELD_SPLIT` and classify it — or the seed will
refuse to start.** If that field is meant to be admin-editable, also add it
to `UPDATE_PLAN_INPUT_MODEL_C_KEYS` so the T-027 runtime guard covers it.

The `-1`→finite AI-limit fix in extras migration `014-spec211-ai-monetization.data.sql`
is the single explicit exception to "limit values are commercial": a stored
`-1` (unlimited sentinel) is a cost hole rather than a legitimate operator
value, so the migration replaces it with a finite cap only when the sentinel
is still present (scoped with `= '-1'`).

For existing rows on a live environment (staging, prod), the extras migration
`packages/db/src/migrations/extras/014-spec211-ai-monetization.data.sql`
performs a one-pass idempotent capability sync. New environments receive the
correct state from the seed directly.

## Common Gotchas

- `billing_subscription_addons` has no `livemode` or `deleted_at` columns
- `billing_plans.id` is UUID but `billing_subscriptions.plan_id` is varchar
- `billing_customers` uses `segment` column, not `category`
- `PaginationQuerySchema` uses `page`+`pageSize` (NOT `limit`) for admin routes
- Billing endpoints from qzpay-hono (`/api/v1/protected/billing/plans`, `/addons`) DO accept `limit` natively

## Related Documentation

- [Billing Documentation](../../docs/billing/README.md)
- [ADR-005: MercadoPago Payments](../../docs/decisions/ADR-005-mercadopago-payments.md)
- [ADR-006: Integer Monetary Values](../../docs/decisions/ADR-006-integer-monetary-values.md)
- [ADR-008: AFIP Deferred to v2](../../docs/decisions/ADR-008-afip-deferred-v2.md)
- [ADR-009: Trial Host-Only](../../docs/decisions/ADR-009-trial-host-only.md)
