# Production Smoke Checklist (SPEC-143 Workstream C)

Production smoke procedures for the billing surface. Executed against
the **real MercadoPago account** on `https://hospeda.com.ar` /
`https://api.hospeda.com.ar` only at:

1. **Go-live**: before flipping the billing system from sandbox to prod.
2. **Major releases**: after any change that touches the billing core
   (checkout, webhooks, cron, refund flow, admin ops).

This file is the **Workstream C** artifact. Workstream B
(`staging-smoke-checklist.md`) covers the full surface against MP
sandbox; Workstream C covers only the **3 highest-risk flows** against
real money with explicit **rollback procedures** per flow.

Authored as part of **T-143-22**. Companion to
`staging-smoke-checklist.md` (T-143-20, T-143-36, T-143-45).

## When to run this checklist

| Scenario | Run this? |
|----------|-----------|
| Routine PR merge | NO — staging smoke is enough |
| Billing-touching PR merge | NO — staging smoke + CI is enough |
| Quarterly billing review | YES — minimal 3-flow run |
| Major billing release (checkout / webhook / cron rewrite) | YES — full 3-flow run |
| Go-live transition (sandbox → prod) | YES — full 3-flow run + extended monitoring |
| Suspected production incident | YES — after the incident resolves |

**Default**: if you're not sure whether to run it, ask. Real money is
involved and unnecessary smokes burn real charges (even if refunded).

## Prerequisites

Before starting:

- **Rollback authority**: confirmed access to the admin panel with
  refund/cancel permissions. If you don't have it, do NOT start —
  having a failed smoke without rollback authority is the bad case.
- **MP production credentials**: confirmed
  `HOSPEDA_MERCADO_PAGO_*` env vars are set to the **production**
  values on `hospeda-api-prod` (verify with `hops env-list prod | grep
  MERCADO_PAGO`). The presence of an `APP_USR-` token alone is not
  enough — the token must come from the production credentials section
  of the MP dashboard, not the test credentials section (the prefix is
  identical, see engram `gotcha/mercadopago-credentials`).
- **Small test charges**: agreed budget for the run (typical: USD 1-5
  per flow, refunded immediately). Document the budget in the run log
  and stop if you'd exceed it.
- **Test user identity**: a real (not test) user account dedicated to
  smoke. Use a real card YOU own (never a customer's card). Capture
  the user's UUID and email up front.
- **Communication channel ready**: pre-announce the smoke window in
  the team channel so a real customer's report doesn't get mistaken for
  a smoke artifact.
- **Sentry + Coolify logs open**: real-time visibility for any error
  spike during the run.

## Risk + go / no-go criteria

A smoke run is GO if and only if:

- Staging smoke for the same change is GREEN (every relevant section
  signed off in `staging-smoke-checklist.md`).
- CI is GREEN on the merged commit.
- No active high-severity Sentry alerts on billing.
- Rollback authority confirmed (above).

If any of those is RED, the smoke is **no-go**. Either fix the gap or
delay the prod smoke until the next window.

---

## Flow 1 — Annual checkout (production)

Workstream A reference: `annual-checkout.test.ts` (CI)
Workstream B reference: `staging-smoke-checklist.md` 1.1

**Pre-conditions**: prod test user identified, real card available,
budget ≥ price of the cheapest annual plan.

### Steps

1. Sign in to `https://hospeda.com.ar` as the prod test user.
2. Navigate to `/suscriptores/planes/`.
3. Select the cheapest plan with annual billing toggled.
4. Click "Suscribirme". Inspect the network call to
   `POST /api/v1/protected/billing/subscriptions/start-paid`:
   - Status: 201.
   - Response: `checkoutUrl`, `localSubscriptionId`, `expiresAt`
     populated.
   - Capture `localSubscriptionId` to the run log NOW (you need it
     for rollback).
5. Follow the MP checkout URL.
6. Pay with the real card.
7. After redirect, capture the URL the browser actually lands on
   (engram `bug/back-url-orphan-billing-return` is still open at the
   time of this write — record what you see, do NOT panic if it 404s
   while the bug is open).
8. Wait for the MP webhook to land (~5-30s observed in staging; allow
   up to 2 min in prod). Confirm in `hops psql prod`:
   ```sql
   SELECT id, status, current_period_end, mp_subscription_id
   FROM billing_subscriptions
   WHERE id = '<localSubscriptionId>';
   ```
   Expected: `status='active'`, `current_period_end ≈ now() + 1 year`,
   `mp_subscription_id` populated.
9. Reload `/mi-cuenta/`. Confirm entitlements active.
10. Verify Sentry has NO unexpected error events tied to this
    subscriptionId or the test user's id.

### Expected outcome

- Charge appears on the real card.
- Sub active in DB.
- Entitlements live.
- No Sentry errors.

### Rollback procedure

Execute **immediately after the smoke completes**, regardless of pass
or fail (we do not keep a real charge on a smoke account).

1. **Cancel + refund**, in this order:

   a. From `/admin/billing/subscriptions/<localSubscriptionId>`,
      click "Cancel subscription". Confirm 200 response and DB row
      flipped to `canceled` / `cancelled`.

   b. From the payment list for the sub, identify the MP payment id.
      Click "Refund (full)". Confirm 200 response.

   c. **KNOWN GAP** (engram `bug/refund-flow-gaps`): the current
      refund handler does NOT call the MP refund API today. Until
      that bug is fixed, you must ALSO log into the MP merchant
      dashboard and trigger the refund there manually. Document the
      MP-side refund operation id in the run log.

2. **Verify refund**:
   - MP dashboard shows the payment refunded.
   - Real card receives the refund (may take 1-7 business days
     depending on the card issuer).
3. **Clear entitlements**:
   - `hops psql prod` → confirm sub status is the terminal cancelled
     state.
   - Force entitlement cache clear:
     ```bash
     curl -X POST https://api.hospeda.com.ar/api/v1/admin/billing/cache/clear \
       -H "Cookie: <admin-session>" -d '{"customerId": "<UUID>"}'
     ```
   - Confirm `/mi-cuenta/` shows free-plan entitlements.

### Run log

| Date | Executor | Release | Test user | Card last4 | Charge $ | Result | Refund verified | Notes |
|------|----------|---------|-----------|------------|----------|--------|-----------------|-------|
|      |          |         |           |            |          |        |                 |       |

---

## Flow 2 — Monthly checkout (production)

Workstream A reference: `monthly-checkout.test.ts` (CI)
Workstream B reference: `staging-smoke-checklist.md` 1.2

**Pre-conditions**: prod test user with no active sub (clear from Flow
1 rollback before starting). Budget ≥ first monthly charge for the
cheapest plan.

### Steps

1. Sign in, navigate to `/suscriptores/planes/`, toggle monthly.
2. Click "Suscribirme" on the cheapest monthly plan.
3. Verify 201 from `start-paid` with `checkoutUrl` pointing at the
   MP preapproval-authorization page.
4. Capture `localSubscriptionId`.
5. Follow the MP URL, authorize the recurring charge with the real
   card.
6. After redirect, wait for the `subscription_preapproval.updated`
   webhook (~5-30s in staging, up to 2 min in prod).
7. Confirm local sub flipped from `incomplete` to `active`:
   ```sql
   SELECT status, mp_subscription_id, current_period_end
   FROM billing_subscriptions WHERE id = '<localSubscriptionId>';
   ```
8. Reload `/mi-cuenta/`. Confirm entitlements.
9. Verify Sentry clean.

### Expected outcome

- First monthly charge processed on the card.
- Sub active in DB with `mp_subscription_id` populated.
- Entitlements live.

### Rollback procedure

Monthly subs are more dangerous than annual because they continue
charging silently. Cancel **before** refunding.

1. **Cancel the preapproval**:
   - `/admin/billing/subscriptions/<id>/cancel`.
   - Confirm 200 and sub flipped to `cancelled` / `canceled` (engram
     `cancel-spelling-drift` — UK on the audit row, US on the live
     status column).
   - **Verify in MP dashboard** that the preapproval is also
     cancelled on the provider side — if hospeda's cancel handler did
     not propagate to MP (T-143-27 documents the MP-side gap), MP
     would charge again on the next cycle.
2. **Refund the first charge** (same procedure as Flow 1 rollback
   step 1.b + 1.c, including the manual MP-dashboard refund per
   `bug/refund-flow-gaps`).
3. **Verify no future charges**: check the MP merchant dashboard's
   subscription page for the cancelled preapproval status.

### Run log

| Date | Executor | Release | Test user | Card last4 | Charge $ | Result | MP-side cancel verified | Refund verified | Notes |
|------|----------|---------|-----------|------------|----------|--------|-------------------------|-----------------|-------|
|      |          |         |           |            |          |        |                         |                 |       |

---

## Flow 3 — Addon purchase (production)

Workstream A reference: `addon-purchase.test.ts` (CI)
Workstream B reference: `staging-smoke-checklist.md` 1.7

**Pre-conditions**: prod test user with an active sub on a plan that
supports the addon being tested. Run Flow 1 or Flow 2 first if needed.
Budget ≥ addon price.

### Steps

1. From `/mi-cuenta/`, navigate to the addon catalog (or wherever the
   addon purchase entry point lives in prod UI).
2. Select an active addon priced low enough for the smoke budget.
3. Click "Comprar". Inspect the network call:
   - If the addon is a one-time charge: `POST /admin/billing/customer-addons`
     (or the protected variant per implementation).
   - Response 201 with the addon purchase id.
4. If a checkout URL is returned, follow it and complete payment.
5. Capture the addon purchase id from the response.
6. Confirm in `hops psql prod`:
   ```sql
   SELECT id, addon_id, status, source_id, expires_at
   FROM billing_addon_purchases
   WHERE customer_id = '<CUSTOMER_UUID>'
   ORDER BY created_at DESC LIMIT 1;
   ```
7. Reload `/mi-cuenta/`. Confirm the addon entitlement override is
   reflected (limit increase, feature unlock, etc.).
8. Verify Sentry clean.

### Expected outcome

- Addon charge processed on the card.
- `billing_addon_purchases` row created.
- Entitlements reflect the override.

### Rollback procedure

1. **Cancel + recalc**:
   - `/admin/billing/customer-addons/<id>` → "Cancel".
   - Confirm 200 and addon row removed (or marked cancelled per
     implementation).
   - **KNOWN GAP** (engram `bug/addon-limit-recalc-removebysource-global`):
     `removeBySource` does NOT filter by customer_id or limit_key,
     which means cancelling an addon for one customer can silently
     clean up aggregated limits for OTHER customers in the same row.
     For the prod smoke this is unlikely to matter (single test
     account), but document the run if you see cross-customer
     drift.
2. **Refund the addon charge** (same procedure as Flow 1, including
   manual MP-dashboard refund per `bug/refund-flow-gaps`).
3. **Verify entitlements reverted**: reload `/mi-cuenta/` and confirm
   the addon override is gone.

### Run log

| Date | Executor | Release | Test user | Card last4 | Addon | Charge $ | Result | Refund verified | Notes |
|------|----------|---------|-----------|------------|-------|----------|--------|-----------------|-------|
|      |          |         |           |            |       |          |        |                 |       |

---

## General rollback toolkit

If a smoke flow fails partway and the standard rollback is not enough,
escalate using this toolkit.

### Force-clear a stuck subscription

```sql
-- hops psql prod
UPDATE billing_subscriptions
SET status = 'cancelled',
    canceled_at = now(),
    current_period_end = now()
WHERE id = '<localSubscriptionId>';
```

Then in MP dashboard, manually cancel the corresponding preapproval
(use the `mp_subscription_id` from the same row to look it up).

### Force-clear entitlement cache

```bash
curl -X POST https://api.hospeda.com.ar/api/v1/admin/billing/cache/clear \
  -H "Cookie: <admin-session>" \
  -d '{"customerId": "<UUID>"}'
```

Or, if the admin endpoint fails (engram
`bug/admin-billing-endpoints-broken`), restart the API to drop the
in-memory cache wholesale:

```bash
hops app-restart prod hospeda-api-prod
```

### Refund via MP dashboard directly

When hospeda's refund endpoint does not propagate to MP
(`bug/refund-flow-gaps`):

1. Open `https://www.mercadopago.com.ar/activities`.
2. Locate the payment by id (captured in the run log).
3. Click "Refund" (full or partial).
4. Confirm. Wait for the refund confirmation email.
5. Update the hospeda payment row's `refunded_amount` manually if the
   admin endpoint did not stamp it:
   ```sql
   UPDATE payments SET refunded_amount = <amount_in_cents>
   WHERE provider_payment_id = '<mp_payment_id>';
   ```

### Disable a broken cron mid-run

If the `dunning` or `exchange-rate-fetch` cron is firing during the
smoke and causing noise:

```bash
hops cron-list prod
# Disable the offending job temporarily via the admin panel:
# /admin/cron → toggle the job off, run the smoke, toggle back on.
```

### Page the on-call

If the rollback toolkit cannot recover the state:

1. Page on-call via the documented channel.
2. Provide: `localSubscriptionId`, customer UUID, MP payment id,
   what was attempted, current DB row state (SELECT output).
3. Do NOT attempt further `UPDATE`s on prod without on-call sign-off.

---

## Sign-off block

Each prod smoke session generates one sign-off entry capturing all
three flows:

```text
Prod smoke sign-off — <reason> (release / quarterly / incident)
- Date: YYYY-MM-DD
- Executor: <name>
- Prod commit: <sha>
- Test user: <email>
- Flows executed: [1 annual / 2 monthly / 3 addon] — [PASS / PASS w/ notes / FAIL]
- Total charges: $<X>
- Total refunds: $<X> (must equal charges)
- Refund verification window: <date when card reconciliation is expected>
- Rollback notes: <gaps observed, manual MP-dashboard interventions, etc.>
- Sentry events during smoke: <count + ids if any>
- Follow-ups created: <task ids or engram entries>
```

A smoke session is COMPLETE only when total refunds equal total charges
AND every flow has been signed off (PASS, PASS w/ notes, or FAIL with
escalation path documented).

---

## Cross-references

- Spec: `.claude/specs/SPEC-143-billing-testing-coverage/spec.md`
- Task state: `.claude/tasks/SPEC-143-billing-testing-coverage/state.json`
- Staging smoke (full surface, sandbox): `staging-smoke-checklist.md`
  (T-143-20, T-143-36, T-143-45)
- MP test cards reference (sandbox-only): `mp-test-cards-reference.md`
  (T-143-54, Phase 4 polish)
- Billing runbooks (incident response): `billing-runbooks.md`
  (T-143-49, Phase 4 polish)
- Bug engram entries relevant to rollback:
  - `bug/refund-flow-gaps` — hospeda refund does not call MP API
  - `bug/addon-limit-recalc-removebysource-global` — addon cancel cross-customer scope
  - `bug/admin-billing-endpoints-broken` — admin endpoints with crashes
  - `bug/back-url-orphan-billing-return` — MP return page does not exist
  - `cancel-spelling-drift` — UK vs US cancel spelling across layers
