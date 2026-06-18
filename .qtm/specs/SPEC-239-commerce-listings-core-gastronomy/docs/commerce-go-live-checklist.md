# SPEC-239 — Commerce Listings Go-Live / Coolify Ops Checklist

Operational steps required to turn on the **commerce-with-subscription + Gastronomía**
feature on a deployed environment (staging, then prod). The code is merged to
`staging`; these are the **owner/ops actions** that are NOT code and must be done
on the VPS / Coolify before the feature works end-to-end.

Run the steps **in order**. Do staging first, validate, then repeat for prod.

---

## 1. Apply DB migrations + extras (adds `product_domain`)

The commerce billing isolation relies on two **extras-carril** columns:
`billing_plans.product_domain` and `billing_subscriptions.product_domain`
(extras migration `017-billing-plans-product-domain.column.sql`). They are NOT in
the Drizzle/QZPay TS schema, so a plain `db:migrate` does **not** add them.

On the VPS:

```bash
hops db-migrate --target=staging   # runs drizzle migrate + db:apply-extras (incl. extras 017)
# validate, then:
hops db-migrate --target=prod
```

`hops db-migrate` runs migrations **and** `db:apply-extras`, so extras 017 is applied
automatically. Without it: the required **Commerce Plan** seed fails
(`UPDATE billing_plans SET product_domain ...`) and the commerce
`start-subscription` flow cannot isolate the subscription.

## 2. Ensure the commerce plan row exists

The single commerce plan (`COMMERCE_LISTING_PLAN`, slug **`commerce-listing`**) is
created by the **required** seed `commercePlan.seed.ts` (it is intentionally
excluded from `ALL_PLANS`, so the normal plan list/grant-matrix stay
accommodation-only). On an environment that has already been seeded, confirm the
row exists:

```sql
SELECT name, product_domain, active FROM billing_plans WHERE name = 'commerce-listing';
-- expect: commerce-listing | commerce | true
```

If missing, run the required seed for the commerce plan (it is idempotent and only
inserts/re-stamps `product_domain`; it does NOT touch other data).

## 3. Set `HOSPEDA_COMMERCE_PLAN_ID` in Coolify

This var tells the `start-subscription` route which plan to provision. **It is the
plan SLUG (`billing_plans.name`), NOT a UUID.**

- **Value:** `commerce-listing`
- **Apps:** `hospeda-api-staging`, then `hospeda-api-prod`

On the VPS (preferred):

```bash
hops env-set api HOSPEDA_COMMERCE_PLAN_ID commerce-listing --target=staging
hops redeploy api --target=staging
# validate, then prod:
hops env-set api HOSPEDA_COMMERCE_PLAN_ID commerce-listing --target=prod
hops redeploy api --target=prod
```

Or via the Coolify UI: `hospeda-api-{staging,prod}` → Environment Variables → add
`HOSPEDA_COMMERCE_PLAN_ID = commerce-listing` → Save → Redeploy.

Without it the admin commerce `start-subscription` route returns **404**
(`"Commerce subscriptions are not configured (HOSPEDA_COMMERCE_PLAN_ID unset)"`).

> The var is already registered in `packages/config/src/env-registry.hospeda.ts`
> and Zod-validated in `apps/api/src/utils/env.ts` (`required: false`, defaults to
> `''`). Setting it here is the only remaining action.

## 4. Confirm the commerce plan price

The seed ships a **placeholder** price: **ARS 5.000,00 / month**
(`monthlyPriceArs: 500000` centavos, annual = none, USD ref = 5). It is marked
"owner to confirm via admin UI" in `plans.config.ts`.

- Log into the admin panel → Billing → Plans → **Commerce Listing**.
- Confirm or change the monthly price.
- Per **Model C** (SPEC-211), price is a **commercial-layer** field: the DB row
  wins and future seed runs will NOT overwrite an operator-set price.

## 5. Staging MP smoke (T-061 — binding billing gate)

Before promoting `staging → main`, run the SPEC-143 staging smoke for the commerce
subscription surface against the **MP sandbox**:

- start-subscription → `init_point` reachable → pay with a sandbox card →
  `active` webhook arrives → the linked gastronomy flips **PUBLIC/ACTIVE** and shows
  on `/gastronomia`.
- cancel/expire → the listing flips **hidden** (public detail 404s, data preserved).

File the sign-off in the relevant SPEC-143 staging-smoke section and reference it in
the promotion PR. This is the **binding gate** for the billing surface — do not
promote without it.

---

## Quick recap (prod)

| # | Action | Command / where | Why |
|---|--------|-----------------|-----|
| 1 | Migrate + extras | `hops db-migrate --target=prod` | adds `product_domain` (extras 017) |
| 2 | Commerce plan row | required seed / verify SQL | `commerce-listing` plan must exist |
| 3 | Env var | `hops env-set api HOSPEDA_COMMERCE_PLAN_ID commerce-listing --target=prod` + `hops redeploy api --target=prod` | else start-subscription 404s |
| 4 | Confirm price | admin panel → Plans → Commerce Listing | placeholder ARS 5.000, operator-owned |
| 5 | MP smoke | SPEC-143 staging-smoke (sandbox) | binding billing gate (T-061) |

## References

- Env registry entry: `packages/config/src/env-registry.hospeda.ts` (`HOSPEDA_COMMERCE_PLAN_ID`)
- Plan config: `packages/billing/src/config/plans.config.ts` (`COMMERCE_LISTING_PLAN`)
- Required seed: `packages/seed/src/required/commercePlan.seed.ts`
- Extras migration: `packages/db/src/migrations/extras/017-billing-plans-product-domain.column.sql`
- Route: `apps/api/src/routes/commerce/admin/start-subscription.ts`
- ADR: [`docs/decisions/ADR-035-commerce-core-gastronomy-separation.md`](../../../../docs/decisions/ADR-035-commerce-core-gastronomy-separation.md)
- Env workflow: [`docs/guides/env-management.md`](../../../../docs/guides/env-management.md)
- Migrations carriles: [`docs/guides/migrations.md`](../../../../docs/guides/migrations.md)
