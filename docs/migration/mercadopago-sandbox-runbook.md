# MercadoPago Sandbox Ops Runbook

> **Scope framing note.** The original SPEC-128 / SPEC-122 text described a
> standalone 10-smoke verification model. That model is **superseded**. As of
> SPEC-193, MP-dependent staging smokes are **batched**: every merged billing
> PR defers its MP-specific sections to a single pre-promotion run tracked in
> [`.qtm/specs/SPEC-193-billing-go-live-readiness-master/docs/pending-staging-smoke.md`](../../.qtm/specs/SPEC-193-billing-go-live-readiness-master/docs/pending-staging-smoke.md).
> This runbook documents **how to operate the MP sandbox** during those batched
> runs and incident response. It does NOT re-author the smoke flows or card tables
> that already exist in SPEC-143.

## 1. Reference documents (read these first)

| What you need | Where it lives |
|---|---|
| Actual smoke flows to execute | [SPEC-143 staging smoke checklist](../../.qtm/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md) |
| Which sections are deferred to the SPEC-193 batch | [SPEC-193 pending-staging-smoke](../../.qtm/specs/SPEC-193-billing-go-live-readiness-master/docs/pending-staging-smoke.md) |
| Test card numbers and outcome codes | [SPEC-143 mp-test-cards-reference](../../.qtm/specs/SPEC-143-billing-testing-coverage/docs/mp-test-cards-reference.md) |
| Production go-live gate (post-staging promotion) | [SPEC-143 prod-smoke-checklist](../../.qtm/specs/SPEC-143-billing-testing-coverage/docs/prod-smoke-checklist.md) |
| Incident response for a live billing failure | [docs/billing/billing-runbooks.md](../billing/billing-runbooks.md) |
| Grace period mechanics (dunning / cron-lag / soft-cancel) | [docs/billing/grace-period-source-of-truth.md](../billing/grace-period-source-of-truth.md) |

---

## 2. MP Developer Dashboard: initial configuration

URL: **<https://www.mercadopago.com.ar/developers/panel>**

### 2.1 Credential sets

MP maintains two separate credential sets per application:

| Mode | Access token prefix | Use for |
|---|---|---|
| Test (sandbox) | `TEST-` | Staging smokes, local dev |
| Production | `APP_USR-` | Production only |

The staging environment (`hospeda-api-staging`) uses the **Test** credentials.
Never copy production credentials to staging or vice versa.

To find your credentials: Dashboard → Your Integrations → select your app →
Credentials → Test credentials.

> Note: some MP sandbox-mode tokens start with `APP_USR-` (not `TEST-`) —
> the adapter accepts both prefixes; what matters is that `HOSPEDA_MERCADO_PAGO_SANDBOX`
> is `true` in the staging env.

### 2.2 Webhook URL configuration

For the staging environment, the webhook must be registered so MP delivers events
to the staging API:

1. Dashboard → Your Integrations → your app → Webhooks.
2. Set the webhook URL to: `https://staging-api.hospeda.com.ar/api/v1/webhooks/mercadopago`
3. Enable event types (at minimum):
   - `payment.created`
   - `payment.updated`
   - `subscription_preapproval.created`
   - `subscription_preapproval.updated`
   - `subscription_authorized_payment.created`
   - `subscription_authorized_payment.updated`
4. Copy the **Webhook signing secret** MP shows. Set it in Coolify for
   `hospeda-api-staging` as `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET`.

For local development (webhook-less flows), only `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN`
is required. Signature verification is skipped if the secret is absent in sandbox
mode (a warning is logged).

### 2.3 Sandbox vs production toggle

The adapter reads `HOSPEDA_MERCADO_PAGO_SANDBOX` (default `true`). Ensure this is
set correctly per environment:

| Coolify resource | `HOSPEDA_MERCADO_PAGO_SANDBOX` | `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` |
|---|---|---|
| `hospeda-api-staging` | `true` | Test-prefixed token |
| `hospeda-api-prod` | `false` | Production APP_USR- token |

### 2.4 Env vars summary (staging)

```bash
HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN=TEST-<your-test-token>
HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET=<secret-from-mp-dashboard>
HOSPEDA_MERCADO_PAGO_SANDBOX=true
# Optional; defaults shown:
HOSPEDA_MERCADO_PAGO_TIMEOUT=5000
```

Set via Coolify UI or `hops env-set staging KEY VALUE` from the VPS.
After setting, redeploy: `hops redeploy staging`.

---

## 3. Creating MP sandbox test users

MP's sandbox requires **separate test accounts** for buyer and seller (the
platform account). These are distinct from the Hospeda application test users
created by `pnpm db:fresh-dev`.

### 3.1 Create sandbox test users via MP API

```bash
# Replace TEST-XXX with your sandbox access token
curl -X POST \
  https://api.mercadopago.com/users/test \
  -H "Authorization: Bearer TEST-XXX" \
  -H "Content-Type: application/json" \
  -d '{"site_id":"MLA"}'
```

The response contains `id`, `nickname`, `password`, `site_status`, and
`email`. Record these — the test user credentials are only shown once.

Create at least two:

| Role | Description |
|---|---|
| **Seller** | The platform account (maps to the `hospeda-api-staging` MP credentials) |
| **Buyer** | Used to approve payments in the MP sandbox checkout UI |

### 3.2 Using the buyer account in smoke flows

When a smoke flow reaches the MP checkout page (after `/start-paid` redirects):

1. Log into the MP sandbox checkout using the **buyer** test account credentials.
2. Enter a test card from the [SPEC-143 cards reference](../../.qtm/specs/SPEC-143-billing-testing-coverage/docs/mp-test-cards-reference.md).
3. Set the cardholder name to the outcome code you want (`APRO`, `OTHE`, `CONT`, etc.).
4. **Use a card the buyer has not used before.** If MP offers a saved card, decline
   it and enter a different number — see §3.3, which is the single most expensive
   failure mode in this whole document.

See the [SPEC-143 staging checklist](../../.qtm/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md)
section "Pre-flight: MP test buyer browser session" for the full pre-condition steps
required before any flow that authorizes a payment.

### 3.3 A saved card makes every subscription checkout fail (2026-08-28)

**Symptom.** The MP checkout ends on *"No pudimos procesar tu pago"*. On our side the
row stays `pending_provider` forever and no `mp_subscription_id` is ever linked. In
MercadoPago the preapproval **is created and then cancelled under a second**, with
`payment_method_id: null` and no `card_id`:

```
12:42:49.796  preapproval created
12:42:49      $0 validation payment → approved / accredited
12:42:50.555  preapproval cancelled     ← 0.76s later
              payment_method_id: null · card_id: null · external_reference: null
```

The $0 validation charge being **approved** while the subscription dies anyway is the
signature. It is what makes this so hard to diagnose: every card-level check passes.

**Cause.** Once the test buyer has any saved card, MP's subscription checkout takes the
saved-card path instead of asking for the number. It tokenises with **ESC** (the stored,
encrypted security code) rather than a freshly entered CVV, and that path raises an
**authentication challenge** that never completes in the sandbox. MP approves the $0
validation, the challenge hangs, and MP aborts the subscription.

Visible in the browser console on the MP checkout page:

```json
"review_context_flow": "subscription_saved_card",
"tokenization_info": { "has_esc": true, "tokenization_type": "with_esc", "has_cvv": false,
                       "tokenization_card_id": "9813074735" }
"Challenge display processing"
"Challenge processing via step next"
```

`review_context_flow: subscription_saved_card` and `has_cvv: false` are the tell. A
healthy attempt does not show them.

**Fix.** Use a card number the buyer has never used, so MP asks for the CVV and skips
the ESC path entirely. The [cards reference](../../.qtm/specs/SPEC-143-billing-testing-coverage/docs/mp-test-cards-reference.md)
lists five; rotate to one that is not saved yet. Verified on 2026-08-28: seven consecutive
failures on the saved Mastercard `…0604`, then an immediate `authorized` on a fresh Visa
(`card_id 9834888704`), local row `trialing`, whole webhook chain intact.

**What this is NOT.** Ruled out by measurement on 2026-08-28 before finding the cause —
do not spend time re-testing any of these:

| Suspected | Verdict |
|---|---|
| Card number / brand / cardholder code | ✗ the $0 validation is approved |
| Amount, or MP's ARS 15 floor | ✗ $15, $100 and $18.000 all fail the same way, all succeed via API |
| Daily vs monthly cadence | ✗ both fail through the checkout, both work via API |
| A specific plan, or its config in MP | ✗ 4 different plans, identical failure; plans are byte-identical bar cadence |
| The buyer already having a live subscription | ✗ a preapproval created via API succeeded while two were live |
| A previous failed attempt poisoning the next | ✗ the first-ever attempt on a brand-new plan failed too |
| Our code, qzpay, or a recent deploy | ✗ 86 commits reviewed; qzpay pinned to releases predating a known-good run |

**Why the API is immune.** `POST /v1/card_tokens` + `POST /preapproval` always carries an
explicit CVV and never enters the saved-card flow, so it works even when the checkout does
not. That is also the escape hatch when you need a live subscription and the browser
refuses to cooperate — see §3.4.

### 3.4 Creating a subscription without the browser (API-only)

Useful when the checkout is fighting you (§3.3), or when you need a preapproval with a
cadence the hosted checkout will not produce.

```bash
# 1. tokenise a card (tokens are single-use)
curl -sS -X POST https://api.mercadopago.com/v1/card_tokens \
  -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"card_number":"5031755734530604","expiration_month":11,"expiration_year":2030,
       "security_code":"123",
       "cardholder":{"name":"APRO","identification":{"type":"DNI","number":"12345678"}}}'

# 2. create the subscription, already authorized
curl -sS -X POST https://api.mercadopago.com/preapproval \
  -H "Authorization: Bearer $MP_ACCESS_TOKEN" -H 'Content-Type: application/json' \
  -d '{"reason":"<what this is for>","external_reference":"<your ref>",
       "payer_email":"<test buyer email>","card_token_id":"<token from step 1>",
       "status":"authorized","back_url":"https://staging.hospeda.com.ar/",
       "auto_recurring":{"frequency":1,"frequency_type":"days",
                         "transaction_amount":100,"currency_id":"ARS"}}'
```

Pass `preapproval_plan_id` instead of `auto_recurring` to attach it to an existing plan.
Confirm success by reading back `payment_method_id` and `card_id` — both non-null means the
card really attached. **Always cancel these when done**; a daily preapproval keeps charging.

---

## 4. Inspecting webhook delivery and objects in the MP dashboard

### 4.1 Webhook delivery log

Dashboard → Your Integrations → your app → Webhooks → Deliveries.

Each delivery shows:

- Event type and action
- HTTP response code from `hospeda-api-staging`
- Payload body (expandable)
- Timestamp

If a delivery failed (non-2xx), click "Resend" to replay it. This is MP's own
retry — it is separate from the internal `webhook-retry.job.ts` cron.

### 4.2 Finding a payment object

Dashboard → Activities → search by payment ID or external reference.

In Hospeda, the `external_reference` on MP preferences is the QZPay session
UUID (set by `qzpay-hono` during checkout initiation). You can also query the
staging DB directly:

```bash
hops psql --target=staging -c "
SELECT id, status, mp_subscription_id, current_period_end
FROM billing_subscriptions
WHERE customer_id = '<billing-customer-id>'
ORDER BY created_at DESC LIMIT 5;"
```

The `mp_subscription_id` column stores the MP preapproval ID (for monthly
recurring subscriptions) or is `NULL` for annual one-time charges.

### 4.3 Finding a preapproval (monthly subscription) object

Dashboard → Subscriptions → search by preapproval ID.

The preapproval ID is the value stored in `billing_subscriptions.mp_subscription_id`.
Key fields to verify during a smoke:

| Field | Expected value |
|---|---|
| `status` | `authorized` (active), `paused` (soft-cancelled), `cancelled` |
| `summarized.charged_quantity` | Increments on each successful renewal |
| `back_url` | Should match the Hospeda staging return URL |

---

## 5. Rollback procedures for sandbox incidents

The sandbox is shared. A mis-fired smoke (wrong plan activated, wrong user
state set) should be rolled back to avoid polluting subsequent test runs.

### 5.1 Cancel an accidentally-activated subscription (staging)

```bash
# 1. Find the subscription
hops psql --target=staging -c "
SELECT id, status, mp_subscription_id, customer_id
FROM billing_subscriptions
WHERE status = 'active'
ORDER BY created_at DESC LIMIT 10;"

# 2. Cancel via the cancel route (as the account owner via curl, or via admin UI)
# This sets cancelAtPeriodEnd=true. If you need immediate cancellation:
hops psql --target=staging -c "
UPDATE billing_subscriptions
SET status = 'cancelled',
    cancelled_at = now(),
    updated_at = now()
WHERE id = '<sub-id>';"

# 3. Clear entitlement cache
hops cron-trigger --target=staging clear-entitlement-cache --customer-id=<billing-customer-id>
```

### 5.2 Pause/cancel the MP preapproval (monthly)

If the subscription has an `mp_subscription_id`, the corresponding MP
preapproval is still active and will attempt renewal. Pause or cancel it
via the MP sandbox dashboard (Subscriptions → find by ID → pause/cancel),
or via the MP API:

```bash
# Pause preapproval
curl -X PUT \
  https://api.mercadopago.com/preapproval/<preapproval-id> \
  -H "Authorization: Bearer TEST-XXX" \
  -H "Content-Type: application/json" \
  -d '{"status":"paused"}'
```

### 5.3 Reset a test user's billing state (staging)

For a clean-slate re-run of a smoke section involving the same user:

```bash
# 1. Cancel all active subs
hops psql --target=staging -c "
UPDATE billing_subscriptions
SET status = 'cancelled', cancelled_at = now(), updated_at = now()
WHERE customer_id = '<billing-customer-id>' AND status = 'active';"

# 2. Expire addon purchases
hops psql --target=staging -c "
UPDATE billing_addon_purchases
SET status = 'expired', expires_at = now() - interval '1 second', updated_at = now()
WHERE customer_id = '<billing-customer-id>' AND status = 'active';"

# 3. Clear entitlement cache
hops cron-trigger --target=staging clear-entitlement-cache --customer-id=<billing-customer-id>
```

Then cancel any open MP preapprovals for that test buyer (step 5.2).

### 5.4 Webhook replay after a mis-configured endpoint

If the webhook URL was wrong when MP delivered events (e.g., staging was down,
URL typo), replay the missed deliveries:

1. MP Dashboard → Webhooks → Deliveries → filter by date and event type.
2. For each missed delivery: click "Resend".

Alternatively, trigger the internal retry cron immediately:

```bash
hops cron-trigger --target=staging webhook-retry
```

---

## 6. Pre-prod-toggle checklist (go-live gate)

Before promoting `staging` → `main` (the production go-live), the entire SPEC-193
deferred batch must pass, followed by the production smoke. The production smoke
gate is documented in:

[`.qtm/specs/SPEC-143-billing-testing-coverage/docs/prod-smoke-checklist.md`](../../.qtm/specs/SPEC-143-billing-testing-coverage/docs/prod-smoke-checklist.md)

That document covers: production env var verification, DNS/Cloudflare readiness,
Flows 1–3 (annual checkout, monthly checkout, addon purchase) against real MP
credentials, and the rollback plan if a prod smoke fails.

Do not merge `staging` → `main` without a signed prod smoke log entry.

---

## 7. Quick-reference: env vars by environment

| Variable | Staging value | Production value |
|---|---|---|
| `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` | `TEST-…` (test creds) | `APP_USR-…` (prod creds) |
| `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` | webhook secret from MP dashboard | webhook secret from MP dashboard |
| `HOSPEDA_MERCADO_PAGO_SANDBOX` | `true` | `false` |
| `HOSPEDA_USER_CANCEL_ENABLED` | `true` (for SPEC-147 smokes) | Owner controls |

All env vars are set and managed via Coolify (`hospeda-api-staging`,
`hospeda-api-prod`) or `hops env-set <target> KEY VALUE` from the VPS.
See [docs/guides/env-management.md](../guides/env-management.md) for the
full workflow.
