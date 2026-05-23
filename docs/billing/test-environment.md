# Billing test environment setup

A permanent recipe for running the full billing stack (signup, checkout,
webhooks, subscription lifecycle) against MercadoPago **TEST**
credentials in staging or local dev. Captures the workarounds discovered
during the SPEC-143 staging smoke saga (2026-05-22 to 2026-05-23) so
future developers do not repeat the same 24 hours of debugging.

> If you came here from a fresh smoke retry: jump straight to
> [Quick start](#quick-start) and skip the rationale.

## TL;DR

MercadoPago's TEST credentials behave differently from PROD credentials
in three load-bearing ways:

1. `/v1/customers` returns HTTP 401 error 300 ("Unauthorized use of
   live credentials") regardless of which TEST token is used. The error
   wording is misleading: the creds **are** test, but the endpoint is
   blocked for test-tier tokens. Documented behavior of MP since the
   `APP_USR-` prefix unification.
2. `subscription_preapproval.*` webhooks are not delivered reliably in
   TEST mode (Finding #17 — observed missing across all SPEC-143
   smoke runs even with events explicitly subscribed in the MP
   dashboard).
3. `payment.*` events deliver only via legacy IPN when the buyer is a
   MP test user; they do **not** arrive on the Webhooks v2 channel,
   which means the `?source_news=webhooks` IPN filter (PR #1230) drops
   them. With PROD creds + a real buyer the v2 channel works fine.

To run a smoke against this asymmetric reality, three workarounds are
combined:

- **`HOSPEDA_MERCADO_PAGO_SANDBOX=true`** → qzpay propagates
  `livemode=false` to the storage and skips MP customer sync, so
  signup completes despite the `/v1/customers` blocker.
- **`HOSPEDA_BILLING_POLLING_ENABLED=true`** (default) → the
  `subscription-poll` cron polls MP `/preapproval/{id}` and flips the
  local sub to `active` when the missing webhook would have done so.
- **Webhook URL marker `?source_news=webhooks`** → keeps the IPN/v2
  dichotomy clean. Configured in the MP dashboard once per app.

## Quick start

### Staging

1. Set the env vars on the API target via `hops env-set`:

   ```bash
   hops env-set api --target=staging HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN "APP_USR-<test-token>" --secret
   hops env-set api --target=staging HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET "<test-webhook-secret>" --secret
   hops env-set api --target=staging HOSPEDA_MERCADO_PAGO_SANDBOX true
   # HOSPEDA_BILLING_POLLING_ENABLED defaults to true, no action needed
   hops redeploy api --target=staging
   ```

2. In MP dashboard for **a single** test app (see
   [Single-app rule](#single-app-rule)):

   - Set the Webhooks v2 URL to:
     `https://staging-api.hospeda.com.ar/api/v1/webhooks/mercadopago?source_news=webhooks`
   - Subscribe at minimum: **Pagos**, **Planes y suscripciones**,
     **Órdenes comerciales**. Save and reload to confirm the
     checkboxes persisted.

3. Smoke flow (incognito browser on staging.hospeda.com.ar):

   1. Sign up with a fresh email (e.g. `qazuor+billtest@gmail.com`).
   2. UPDATE the local customer's email to the MP test buyer:

      ```sql
      UPDATE billing_customers
         SET email = 'test_user_5529635850066455346@testuser.com',
             updated_at = NOW()
       WHERE external_id = '<the-new-user-id>'
         AND deleted_at IS NULL
      RETURNING id, email;
      ```

   3. Pay an owner-básico monthly checkout with APRO + the MP test
      buyer session.
   4. Watch the API logs:
      - `Paid subscription initiated` should land 201.
      - `Scheduled subscription polling fallback` shows the polling job
        enqueued.
      - Within ~60 s the `subscription-poll` cron logs
        `subscription transitioned to active` and the local sub is
        `active`.
   5. Verify in DB:

      ```sql
      SELECT id, status FROM billing_subscriptions
       WHERE customer_id = '<customer-id>'
       ORDER BY created_at DESC LIMIT 1;
      ```

      Expected: `status = 'active'`.

### Local development

Local dev should mirror the staging recipe to avoid divergent test
configurations:

1. In `apps/api/.env.local`:

   ```bash
   HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN=APP_USR-<test-token>
   HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET=<test-webhook-secret>
   HOSPEDA_MERCADO_PAGO_SANDBOX=true
   # HOSPEDA_BILLING_POLLING_ENABLED=true (default)
   ```

2. Apply the schema once: `pnpm db:push` (the
   `billing_subscription_polling_jobs` table ships with qzpay-drizzle).

3. Expose your local API via `cloudflared tunnel` (or similar) so MP
   can post webhooks; configure that URL in the MP dashboard with the
   `?source_news=webhooks` marker.

## Single-app rule

The MP dashboard allows multiple apps to share the same webhook URL.
This is **not safe** because each app signs notifications with its own
secret. If two apps post to the same URL, the API receives a mix of
signatures and only the one matching the configured
`HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` verifies. The rest get rejected
with HTTP 401 even though they are legitimate.

For the smoke flow, configure the URL in **exactly one** app. The
others must either point at a discard endpoint
(e.g. `https://webhook.site/<id>`) or have the URL cleared. This bit us
during the 2026-05-22 saga — three apps were posting to staging and the
signature verifier was unable to distinguish them.

## Why each workaround exists

### `HOSPEDA_MERCADO_PAGO_SANDBOX=true`

`packages/billing/src/adapters/mercadopago.ts` derives `livemode` from
this flag (`livemode = !sandbox`) and passes it to both the storage
adapter and the qzpay-billing instance. When `livemode=false`:

- qzpay-billing's `customers.create()` skips the MP `/v1/customers`
  sync (or treats the failure as soft), so signup creates a local
  billing customer without hitting the 401 error 300 wall.
- The webhook secret check downgrades from hard error to warn so a
  briefly-misconfigured staging does not refuse to boot.

The flag is intentionally independent from `NODE_ENV` so we can run
staging with `NODE_ENV=production` + `SANDBOX=true` while still
processing real test buyers.

### `HOSPEDA_BILLING_POLLING_ENABLED=true`

Gates the `subscription-poll` cron (SPEC-143 polling fallback). When
enabled, `start-paid` enqueues a job in
`billing_subscription_polling_jobs` after creating the MP preapproval,
and the cron flips the local sub to `active` once MP reports
`authorized`, even if the `subscription_preapproval.created` webhook
never arrives. Default is `true`; set to `false` only as a kill switch
if the cron itself misbehaves in production.

### Webhook URL marker `?source_news=webhooks`

PR #1230 introduced a middleware that drops MP webhook posts whose URL
does not contain this marker. The reason: MP legacy IPN delivers the
same `payment.created` event twice — once on the new Webhooks v2
channel and once on the old IPN channel. The IPN channel does not
include signature headers, so its events always fail HMAC
verification. Filtering them out at the URL level keeps the logs clean.
Configure the marker on the Webhooks v2 URL in the MP dashboard;
nothing else in the system needs to change.

## Limitations you should know about

- `billing_customers.mp_customer_id` stays NULL in TEST mode because
  the sync was skipped. Tests that exercise "look up the customer in
  MP" must use PROD creds or stub MP.
- Refund flow against MP TEST creds is partially blocked by the same
  `/v1/customers` issue if the refund path looks up the customer.
  Mock or use PROD creds for refund testing.
- The `subscription-poll` cron checks the **provider** status. If MP
  rejects the test buyer's card mid-authorization (e.g. CONT card), the
  preapproval ends up in `cancelled` and the cron transitions the sub
  to `incomplete_expired` instead of `active`. That is correct
  behavior; just remember to test happy-path APRO if you want to see
  the activation flow.

## Cleanup between smoke runs

When iterating on the billing layer it's common to want a clean slate.
Use the dedicated `hops` SQL block from
`docs/billing/test-data-reset.md` (or its inline equivalent in the
smoke checklist) which:

1. `TRUNCATE` all transactional billing tables (`billing_customers`,
   `billing_subscriptions`, `billing_payments`, etc.) — preserves
   seed tables (`billing_plans`, `billing_prices`, `billing_addons`).
2. `DELETE` from `users` for the test user(s) involved, which cascades
   to Better Auth `accounts` and `sessions`.

Do **not** TRUNCATE `billing_plans` or `billing_prices` — they ship
from the seed and the system breaks without them.

## Related documents

- [`polling-fallback-design.md`](../../.claude/specs/SPEC-143-billing-testing-coverage/docs/polling-fallback-design.md)
  — Architecture for the polling cron + rationale for the storage
  primitives in qzpay-core/drizzle.
- [`staging-smoke-checklist.md`](../../.claude/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md)
  — Section-by-section smoke runbook.
- [`staging-smoke-2026-05-21-findings.md`](../../.claude/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-2026-05-21-findings.md)
  — Findings ledger; Findings #15-#19 narrate the saga that produced
  this workaround set.
