# Staging Smoke Findings — 2026-05-21

Running log of every finding, gap, deviation, or follow-up surfaced
during the SPEC-143 staging smoke session executed on **2026-05-21**.

This doc is the **session-level record** — granular notes per smoke
item. The aggregated outcomes get filed into the main checklist's
`Run log` tables at session close.

## Session context

- **Date**: 2026-05-21
- **Worktree**: `/home/qazuor/projects/WEBS/hospeda-spec-143-billing-testing-coverage`
- **Branch**: `fix/billing-smoke-findings`
- **Staging deploy commit**: `734ae1178` (PR #1215 merged 2026-05-21 06:20:34Z)
- **Pre-smoke DB state**: full reset + `pnpm db:seed --required --example` against staging DB
- **MP credentials**: sandbox (`HOSPEDA_MERCADO_PAGO_SANDBOX=true`, `APP_USR-` test-credentials token)
- **Executor**: qazuor
- **Test user (clean-state)**: `qazuor+test@gmail.com`

## Sign-off summary

| Item | Status | Notes |
|------|--------|-------|
| 1.1 Annual checkout happy path | SKIPPED | UI does not support annual interval today — see Finding #1 |
| 1.2 Monthly checkout happy path | PARTIAL PASS | Root cause was test-buyer email format (Finding #5 update). `/start-paid` returns 201 with valid checkoutUrl; MP receives correct payload; user can authorize. BUT webhook does NOT arrive at hospeda (Finding #7), so sub stays `incomplete`. Also redirects to 404 page (Finding #8). |
| 1.3 Free plan signup | SKIPPED (pre-session) | Validated on localhost smoke, no staging-specific risk |
| 1.4 Plan upgrade | PENDING | — |
| 1.5 Plan downgrade | PENDING | — |
| 1.6 Downgrade cron | PENDING | — |
| 1.7 Addon purchase | PENDING | — |
| 1.8 Webhook idempotency | PENDING | — |
| 1.9 Webhook signature | PENDING | — |
| 1.10 Failed payment past_due | PENDING | — |
| 1.11 Webhook concurrency | PENDING | — |
| 1.12 API idempotency | PENDING | — |
| 1.13 Subscription activation (annual) | PENDING | Likely SKIPPED — same root cause as 1.1 |
| 1.14 Entitlement load post-activation | PENDING | — |

## Findings

### #1 — Pricing UI does not expose annual interval (gap, not bug)

**Severity**: Documentation gap — checklist mismatch with implementation.

**Where**: `apps/web/src/components/billing/PlanPurchaseButton.client.tsx:195-200`

**What**: `billingInterval` is hardcoded to `'monthly'` on every plan
checkout call from the pricing page. There is no UI toggle to choose
annual.

```ts
// The pricing grid currently only renders monthly prices; annual is
// gated on a future interval-selector (see ui-audit-2026.md §3).
const result = await billingApi.createCheckout({
    planSlug,
    billingInterval: 'monthly'
});
```

The `PricingCardsGrid.astro` displays `plan.monthlyPriceArs` only;
`periodLabel` defaults to `/mes` and there is no annual variant on
the card layout.

**Why it matters**: The staging smoke checklist 1.1 ("Annual checkout
happy path") cannot be executed via the user-facing UI today. The
backend `POST /api/v1/protected/billing/subscriptions/start-paid` DOES
accept `billingInterval: 'annual'`, and the e2e CI suite covers it
(`apps/api/test/e2e/flows/billing/annual-checkout.test.ts`). The gap
is UI-only.

**Decision (this session)**: SKIP 1.1 for this run. Annual has
Workstream A coverage; no real user can hit the annual flow until
the UI toggle ships, so a smoke against a non-shipped flow has
diminishing returns.

**Follow-up**: Worth a dedicated SPEC for the interval-selector UI.
Tracked under "future interval-selector (see ui-audit-2026.md §3)"
comment. When the SPEC is allocated, link it here.

**Engram pin**: TBD — save when session closes.

---

### #2 — Monthly checkout `/start-paid` returns 500 INTERNAL_ERROR (opaque)

**Severity**: BLOCKER for 1.2 — until diagnosed, no monthly checkout can complete.

**Where**: `POST https://staging-api.hospeda.com.ar/api/v1/protected/billing/subscriptions/start-paid`

**What**: First attempt at 1.2 from the pricing UI returned HTTP 500
with a generic error envelope:

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to start paid subscription. Please try again."
  },
  "metadata": {
    "timestamp": "2026-05-21T07:28:50.294Z",
    "requestId": "5117350a-be13-4fbb-bbd9-077982c501b0"
  }
}
```

The UI rendered "No pudimos iniciar el pago. Intentá de nuevo." (the
i18n string the PlanPurchaseButton shows on `result.ok === false`).

**Context**:
- Test user: `qazuor+test@gmail.com`
- Plan clicked: TBD (need to confirm from logs which planSlug was sent)
- DB state: freshly reset + `pnpm db:seed --required --example` against staging DB pre-session
- Staging deploy: commit `734ae1178`
- MP creds: sandbox (`HOSPEDA_MERCADO_PAGO_SANDBOX=true`)

**Possible root causes (to triage from logs)**:

1. **MP preapproval API rejection** — qzpay → MP `POST /preapprovals` returned non-2xx. MP sandbox test-credentials have edge cases (e.g. `/v1/customers` blocked, see engram `gotcha/mercadopago-test-credentials-architecture`); preapprovals may have analogous limits.
2. **billing_prices missing monthly row for the plan** — if the seed's `ensurePrice` step failed silently for this plan, the lookup at checkout time blows up.
3. **mp_customer_id null on billing_customer** — qzpay may require a synced MP customer before creating preapproval; test creds prevent the sync (`providerSyncErrorStrategy='log'` accepts the gap but a downstream call may need the id).
4. **back_url / notification_url config mismatch** — MP rejects preapprovals with mismatched URLs in some sandbox configs.
5. **Plan slug mismatch** — even after the `fd025b93c` fix, if a different code path still resolves by display name, this would surface as plan not found.

**Diagnostic action**: pull staging API logs for `requestId=5117350a-be13-4fbb-bbd9-077982c501b0` and the 30s preceding the error, then identify the real exception. Pending.

**Update** (after pulling logs): the error pattern is **broader than the INSERT** — every query against `billing_subscriptions` is failing, including:

- Entitlement load middleware: `SELECT ... FROM billing_subscriptions WHERE customer_id = $1 ...` (failing repeatedly for 5+ minutes pre-incident)
- Past-due-grace middleware: same shape, falls back to "allowing request" via try/catch
- `start-paid` handler: the `INSERT INTO billing_subscriptions` shown above
- Cron `apply-scheduled-plan-changes`: `SELECT ... WHERE scheduled_plan_change IS NOT NULL ...`

This rules out H1 (FK violation on `customer_id`) and H2 (UUID type error on `promo_code_id`) — those would only affect the INSERT, not the SELECTs.

**Revised hypothesis H3** (strong): `billing_subscriptions` table schema desync after the DB reset + seed. Most likely cause: `drizzle-kit push` did not apply a column the codebase expects, OR `apply-postgres-extras.sh` was not run after the reset and a missing trigger/constraint is causing every query to fail.

The structured logs DO NOT include the native Postgres error message (only the wrapper query string). Need `hops psql` direct inspection: `\d billing_subscriptions` to compare columns against `qzpay/packages/drizzle/src/schema/subscriptions.schema.ts`.

Pending diagnostic queries; awaiting operator output.

**RESOLVED — root cause identified**:

The staging DB's `billing_subscriptions` table has **29 columns**; the deployed code's schema (`qzpay/packages/drizzle/src/schema/subscriptions.schema.ts`) defines **30** — the missing column is `scheduled_plan_change` (jsonb, nullable). Also missing: the partial index `idx_subscriptions_pending_plan_change` defined at schema lines 92-95.

Since every query against `billing_subscriptions` SELECT-enumerates all columns explicitly (including `scheduled_plan_change`), Postgres rejects every query with `column "scheduled_plan_change" does not exist`. That cascades to:
- Entitlement load middleware → swallows error, falls back to free-plan defaults silently
- Past-due-grace middleware → "allowing request" fallback
- `start-paid` INSERT → same column listed, same error, no fallback → 500 to client
- Cron `apply-scheduled-plan-changes` → query refers to `scheduled_plan_change` IS NOT NULL, fails

**Hotfix applied** (manual SQL on staging DB):

```sql
ALTER TABLE billing_subscriptions ADD COLUMN scheduled_plan_change JSONB;

CREATE INDEX idx_subscriptions_pending_plan_change
  ON billing_subscriptions (scheduled_plan_change)
  WHERE scheduled_plan_change IS NOT NULL
    AND (scheduled_plan_change->>'status') = 'pending';
```

**Operational gap (the real bug)**: the reset workflow this session was:
1. Drop + recreate staging DB
2. `pnpm db:seed --required --example`

This left the schema incomplete. The hypothesis-A explanation: `drizzle-kit push` did not run, or ran against a stale qzpay schema version. The hypothesis-B explanation: `apply-postgres-extras.sh` was meant to handle this column but it's actually qzpay-side, so `apply-postgres-extras.sh` (which is hospeda-side only) wouldn't help.

This is a documented gotcha in CLAUDE.md but the gotcha covers hospeda-side extras (triggers, search_index, JSONB CHECK on billing_addon_purchases). qzpay-side schema drift after a reset is a separate gap — needs a follow-up:

1. Verify the qzpay-drizzle version compiled into staging deploy vs the schema source used by `drizzle-kit push`.
2. Document the reset procedure to include qzpay-side schema sync, OR fold it into a single chained command so resets always converge to a known state.
3. Add a startup check in the API that runs `\d billing_subscriptions` (or equivalent introspection) at boot and refuses to start if columns are missing — this would have surfaced the issue immediately instead of silently failing every billing request.

**Engram pin**: TBD on close — `gotcha/staging-db-schema-drift-scheduled-plan-change`.

---

### #3 — Reset workflow does not converge to schema parity with deployed code

**Severity**: Operational — process gap that produced Finding #2's root cause.

**Where**: Reset procedure used today on staging:
```
DB drop + recreate → pnpm db:seed --required --example
```

**What**: This reset did NOT include a `drizzle-kit push` step that would have created the `scheduled_plan_change` column (and its partial index). The seed alone does not create the table schema — it INSERTs data assuming the schema exists. Either drizzle-kit push happened against a stale schema, or it didn't happen at all.

**Why it matters**: For the next time someone resets staging (or, much worse, has to recover prod), the documented "right way" needs to be in writing and chain all steps including qzpay-side schema sync. Today, an operator following CLAUDE.md gets the hospeda-side `apply-postgres-extras.sh` but nothing tells them to also push qzpay-drizzle's tables.

**Fix path (proposed)**:

1. Document the canonical reset procedure for non-prod targets — including the qzpay-drizzle push step.
2. Wrap the steps into a single `pnpm db:fresh-staging` (or `hops db-reset --target=staging`) so a single command does the right thing.
3. Add API startup self-check: introspect `billing_subscriptions` columns and refuse to boot if `scheduled_plan_change` (or any code-required column) is missing.
4. Consider whether qzpay-drizzle should ship its own apply-extras-style script for non-trivial schema (the partial index here is a good example — drizzle-kit might not emit it correctly).

**Engram pin**: TBD on close — `process/staging-reset-schema-drift-2026-05-21`.

---

### #4 — qzpay-core requires `providerCustomerId` but never uses it for MP preapproval

**Severity**: Architectural bug in qzpay-core — blocks `start-paid` in any environment where the provider-side customer sync fails (notably MP sandbox with test credentials).

**Where**:
- Validation throws at `qzpay/packages/core/src/billing.ts:1284-1290`:
  ```ts
  const providerCustomerId = customer.providerCustomerIds?.[paymentAdapter.provider];
  if (!providerCustomerId) {
      throw new QZPayValidationError(
          `Customer ${input.customerId} has no provider customer ID for '${paymentAdapter.provider}'`,
          'customerId'
      );
  }
  ```
- MP adapter `buildCreateBody` at `qzpay/packages/mercadopago/src/adapters/subscription.adapter.ts:160-192` — the function that constructs the preapproval call to MP does NOT reference `providerCustomerId`. The MP body uses `payer_email`, `payer.first_name`, `payer.last_name`, `external_reference`, `reason`, `auto_recurring`. Nothing else.

**What**: qzpay-core blocks the `subscriptions.create` flow if the customer has no `providerCustomerIds[provider]` value, but the MP preapproval API never uses that value. The validation is therefore safety theater — it gates a happy path that does not require what it asks for.

**Why it surfaces today**: In MP sandbox, test credentials cannot call `/v1/customers` (engram `gotcha/mercadopago-test-credentials-architecture`). So the signup-time sync via `providerSyncErrorStrategy='log'` writes a local `billing_customers` row but leaves `mp_customer_id` NULL. Every subsequent `start-paid` for that customer then fails the validation above, even though the actual MP call would have succeeded.

**Effect**: In any sandbox environment (or any prod incident where customer sync fails after signup), users are locked out of paid checkout permanently — there is no recovery path through the UI.

**Workaround (this session)**:

```sql
UPDATE billing_customers
SET mp_customer_id = 'sandbox-bypass-' || id::text
WHERE id = 'e0e60ac1-00c3-42a3-92c1-f811874fa5fc';
```

Any non-NULL string lets the validation pass. MP never sees it.

**Fix path (proper, post-smoke)**:

Two viable strategies:

1. **Remove the validation** from `billing.ts:1284-1290`. The adapter has its own guarantees (email, plan, price are populated). The validation as written gates an invariant that downstream code does not enforce.
2. **Lazy-create the provider customer** at `start-paid` time: if `providerCustomerId` is missing, attempt to create it inline; if that fails AND the adapter does not need it for the create call, proceed; if it fails AND the adapter does need it (e.g. one-shot checkout that requires customer attachment), surface a structured error to the UI.

Strategy 1 is the minimal change. Strategy 2 is more conservative but requires per-adapter introspection.

**Recommend**: capture as a new spec (SPEC-XXX upstream against qzpay). Either qzpay-side fix or, if qzpay is treated as third-party, a hospeda-side wrapper that ensures `mp_customer_id` is always populated post-signup (re-trying the sync, falling back to a known-bypass value when test creds are detected, etc).

**Engram pin**: TBD on close — `bug/qzpay-validation-requires-unused-provider-customer-id`.

---

**Engram pin**: TBD on close — `gotcha/mp-sandbox-preapproval-requires-test-buyer-email`.

**Update (post-investigation)**: hypothesis disproved. Switching to a verified MP test buyer email (`TESTUSER5529635850066455346@testuser.com`) did NOT change MP behaviour — still HTTP 500 with `Internal server error`. The actual root cause is documented under Finding #6 (unit conversion bug). This finding remains useful as a documented possibility / future check, but is not the cause of this specific smoke failure.

---

### #6 — qzpay-mercadopago sends `transaction_amount` in CENTAVOS to MP, which expects PESOS (off by 100×)

**Severity**: BLOCKER for any non-trivial-price plan in MP sandbox. Likely also breaks prod for high-price plans (MP would silently charge 100× expected).

**Where**:
- Adapter call: `qzpay/packages/mercadopago/src/adapters/subscription.adapter.ts:177`
  ```ts
  auto_recurring: {
      frequency: intervalFrequency,
      frequency_type: intervalType,
      transaction_amount: providerInput.price.amount,  // ← passes unitAmount as-is (CENTAVOS)
      currency_id: providerInput.price.currency,
      ...
  }
  ```
- `providerInput.price.amount` is sourced from `price.unitAmount` at `qzpay/packages/core/src/billing.ts:1303`.
- `unitAmount` is documented as **cents** across `addon.types.ts:26`, `usage.types.ts:111`, `checkout.types.ts:39` ("smallest currency unit (e.g. cents)").
- BUT `subscription.types.ts:177` for **update**-flow comments: "New recurring charge amount in MAJOR currency units (e.g. ARS, not centavos)". So the package's own type docs already document the convention inconsistency.
- The MP Preapprovals API expects `transaction_amount` as a decimal in MAJOR units (pesos). Per the Go SDK reference: `TransactionAmount float64` — float, not integer; and MP examples use `"transaction_amount": 10` for $10 ARS.

**Effect**: A plan with `unit_amount = 1500000` (= $15,000.00 ARS stored as 1,500,000 centavos) is sent to MP as `1500000`, which MP interprets as **$1,500,000 ARS** = 1.5 million pesos per cycle. MP rejects with HTTP 500 (presumably due to amount > sandbox max, or fraud-detection tripwire on amounts in the millions). The qzpay error-mapper falls through to the generic `'message' in error` branch and surfaces `Internal server error` to the caller without the underlying MP response context.

**Why this slipped past CI**: SPEC-143's annual-checkout / monthly-checkout / addon-purchase e2e tests use a MercadoPago stub. The stub does not validate the magnitude of `transaction_amount` — it accepts any positive number and returns a synthetic init_point. This divergence between stub-acceptance and real-MP-rejection is exactly the gap SPEC-143's manual staging smoke is meant to surface (per the spec rationale).

**Workaround applied (this session, W1)**:

```sql
-- Backup
SELECT id, unit_amount FROM billing_prices
WHERE plan_id = (SELECT id FROM billing_plans WHERE name = 'owner-basico')
  AND billing_interval = 'month';

-- Apply temp value: 100 cents in qzpay's mental model -> MP receives "100" -> reads as $100 ARS
UPDATE billing_prices SET unit_amount = 100
WHERE plan_id = (SELECT id FROM billing_plans WHERE name = 'owner-basico')
  AND billing_interval = 'month';
```

Restore the original `unit_amount = 1500000` after the smoke completes (or after the W2 permanent fix lands).

**Fix path (W2, permanent, for new SPEC)**:

1. In `qzpay/packages/mercadopago/src/adapters/subscription.adapter.ts`, divide `transaction_amount` by 100 before sending to MP:
   ```ts
   transaction_amount: providerInput.price.amount / 100,
   ```
2. Audit the rest of the MP adapter (`payment.adapter.ts`, others) for the same bug — any other place that forwards `unitAmount`-derived numbers to MP without `/100` is broken the same way.
3. Add a real-MP integration test that the stub doesn't replace — at minimum, a contract test that asserts the value sent to MP matches the expected pesos representation for a known cents input.
4. Audit any other payment adapter (stripe, etc.) for the symmetric question: do they accept cents or major units? Document the per-adapter convention in qzpay-core types.

**Engram pin**: TBD on close — `bug/qzpay-mp-transaction-amount-cents-vs-pesos`.

---

### #5b — REAL ROOT CAUSE of /preapproval 500: test-buyer email format

**Severity**: BLOCKER for smoke (resolved by procedural change), informative for documentation.

**What we initially blamed**: MP sandbox preapproval rejecting non-test-buyer emails (Finding #5 original) and qzpay cents-vs-pesos unit bug (Finding #6).

**What was actually happening**: MP test buyer email format was wrong.

- MP test buyer dashboard UI shows: `TESTUSER5529635850066455346` (uppercase, no separator)
- The actual email of that test buyer is: `test_user_5529635850066455346@testuser.com` (lowercase + underscore)

We had been passing `TESTUSER5529635850066455346@testuser.com` (matching the UI display verbatim). MP rejected it with HTTP 500 "Internal server error" — no field-level validation message, just generic 500. That sent us down two false-trail hypotheses (#5 = "test buyer needed", #6 = "amount unit bug").

**Direct evidence** (curl directly against MP, bypassing qzpay):

- `payer_email: "TESTUSER5529635850066455346@testuser.com"` → HTTP 500
- `payer_email: "test_user_5529635850066455346@testuser.com"` → **HTTP 201** with valid `init_point`

The MP `/users/me` response surfaces the email format used by MP internally (`email: "test_user_2569604670431151445@testuser.com"` for the seller). The buyer follows the same convention. The UI nickname (`TESTUSER...`) is the display handle, NOT the email.

**Re-classification**:

- **Finding #5 original** (MP test buyer required): partially correct — test buyer IS required (real-email payers also fail with the same opaque 500), but the actual hypothesis that "TESTUSER format is valid" was wrong.
- **Finding #6** (cents vs pesos): **likely false alarm**. We have not yet confirmed by curling MP with `transaction_amount: 1500000` + correct email. Pending verification. The UI even displayed "100" correctly when we lowered the amount via SQL, but that doesn't prove MP would reject 1500000.

**Fix path (procedural)**:

1. Document the test-buyer-email convention in `mp-test-cards-reference.md`: "When MP UI shows a buyer nickname like `TESTUSERnnnnnn`, the email to use as `payer_email` is `test_user_nnnnnn@testuser.com` (lowercase, with underscore — NOT the UI display verbatim)."
2. Consider a hardening pass on `qzpay/packages/mercadopago/src/utils/error-mapper.ts` that logs the raw MP response body when the 500 carries no `cause` array. The 6 hours of dead-end debugging here were caused by MP's opaque 500 + qzpay's error swallow stacking together.

**Engram pin** (revised): `gotcha/mp-test-buyer-email-format-lowercase`.

---

### #7 — MP webhook never reaches hospeda-api → subscription stays `incomplete` after MP-side authorize

**Severity**: BLOCKER for any flow that relies on webhook-driven state transitions (monthly checkout activation, dunning, pause/resume, addon expiry, plan migrations, refunds).

**Where**:
- Webhook destination: `https://staging-api.hospeda.com.ar/api/v1/webhooks/mercadopago` (built by `apps/api/src/routes/billing/start-paid.ts:61 buildNotificationUrl()`).
- Expected handler: `apps/api/src/routes/webhook/mercadopago.ts` (or wherever the qzpay webhook router is mounted).
- Local state expected on receive: `billing_subscriptions.status = 'active'` + `billing_payments` row created.

**What**:

After the smoke session completed an authorize on MP (test buyer logged into MP browser session, APRO card, $100 ARS preapproval, MP reports `summarized.charged_quantity: 1` and `last_charged_amount: 100`):

- `billing_subscriptions.status` for the most recent sub: **`incomplete`** (expected: `active` after webhook).
- `billing_payments` for the customer: **0 rows** (expected: 1 row with `status='approved'` matching the MP payment).
- `mp_subscription_id` IS populated on the sub (from the `start-paid` response).

This proves the gap is webhook **arrival**, not webhook **processing**:
- If processing failed, we'd see logs of failed webhook processing (none in `hops logs`).
- If `notification_url` was malformed, MP wouldn't have attempted delivery, but the URL is well-formed and resolves to a hostname that responds to other API requests (admin tier returns 403 etc.).

**Possible root causes**:

1. **Cloudflare blocks** MP's webhook IP range from reaching `staging-api.hospeda.com.ar`. MP webhooks come from a specific set of IPs (documented in MP's webhook docs). If Cloudflare's bot management or rate limit blocks them, MP retries N times and gives up.
2. **The route `/api/v1/webhooks/mercadopago` does not exist** at the deployed commit (HEAD `734ae1178`). Possible if the route was added in a later commit not yet deployed, or if it was tested-deleted.
3. **MP retried but all attempts ended in non-2xx** (so MP eventually stopped). MP retries on 5xx; if hospeda returns 4xx or 5xx repeatedly, MP gives up.
4. **Webhook signature validation rejects MP's signature** because the staging webhook secret env var (`HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET`) doesn't match what's configured on the MP app dashboard.

**Diagnostic actions (pending)**:

1. Verify the webhook route exists at the deployed commit:
   ```bash
   curl -i -X POST 'https://staging-api.hospeda.com.ar/api/v1/webhooks/mercadopago' -H 'Content-Type: application/json' -d '{"type":"test","data":{}}'
   ```
   - If 404: route missing or moved.
   - If 401/403: route exists, signature validation rejecting.
   - If 200/202: route exists and accepts unsigned requests (signature validation is permissive or missing).

2. Check MP webhook delivery logs in the MP dashboard for the application — if MP shows delivery attempts with non-2xx responses, we have direct evidence of why MP gave up.

3. Verify Cloudflare allows MP IP ranges for staging-api.

4. Confirm the staging webhook secret in Coolify env matches what's configured in MP dashboard.

**Effect on smoke coverage**: Without webhook delivery, EVERY post-checkout state transition (1.2 sub activation, 1.10 past_due, 2.x lifecycle, 2.4 dunning, 2.7 refund webhooks, 2.8 chargeback, 3.9 cancel-from-MP) cannot be validated end-to-end. Workstream A (CI e2e) tests these via webhook fixtures fired directly into the API — those PASS. Workstream B (real MP → real webhook → real hospeda processing) is what surfaces the gap.

**Engram pin**: `bug/staging-mp-webhook-not-arriving`.

---

### #8 — back_url redirect lands on /es/return/ (404) — confirms `back-url-orphan-billing-return` bug in the wild

**Severity**: MEDIUM — does not break the payment itself, but the user lands on a 404 after authorizing. Breaks UX. Confirmation of an engram-pinned known issue.

**Where**:
- `apps/api/src/routes/billing/start-paid.ts:52` constructs `back_url = ${HOSPEDA_SITE_URL}/billing/return`.
- For staging that resolves to `https://staging.hospeda.com.ar/billing/return`.
- After MP authorize, the browser lands on `https://staging.hospeda.com.ar/es/return/` — which 404s.

The redirect URL the user lands on is NOT identical to the `back_url` MP was given:

- Sent to MP: `/billing/return`
- Received by browser: `/es/return/` (has `/es/` i18n prefix + lost the `/billing/` segment)

**Reproduction**: confirmed in smoke session 2026-05-21 with PR #1215 deploy. The engram entry `bug/back-url-orphan-billing-return` already documented this bug; this finding confirms it happens in flow 1.2 (Monthly checkout) too — not just 3.9 (D1/D2/D3 redirect flows).

**Possible root causes**:

1. **Astro middleware on hospeda-web** rewrites/redirects `/billing/*` paths because they don't match any registered route (the actual pages live under `/{lang}/suscriptores/checkout/{success,failure,pending}`). The middleware may detect "/billing" as non-i18n-prefixed and redirect to `/{detected-lang}/{stripped-billing}/` heuristically.
2. **MP itself does NOT modify the back_url** — what we send is what MP redirects to (we confirmed it stores `back_url` verbatim in the preapproval response). So the rewrite is happening on the hospeda-web side.

**Fix paths**:

1. **Quick fix**: in `start-paid.ts:52`, build the back_url pointing at the actual page that exists: `${env.HOSPEDA_SITE_URL}/es/suscriptores/checkout/success` (or similar). This wires it to a page that won't 404.
2. **Proper fix (already tracked)**: build the back_url with a proper localized path AND let the page route handle the post-authorize confirmation flow (read query params, look up the local sub, show approved/pending/failure state). This is what the existing pages were designed for but not wired.

**Engram pin**: `bug/back-url-orphan-billing-return` (already exists, this finding adds the 2026-05-21 1.2 confirmation).

---

### #9 — Operator smoke procedure must include MP test-buyer login before authorize

**Severity**: PROCEDURAL — without this step, the operator authorizes with their personal MP account and risks real charges (or at least real-card simulation that requires refund afterward).

**What**: In this session, the operator authorized the preapproval while logged into MP with their personal account. The browser MP authorize flow uses the session of the logged-in MP user, NOT the `payer_email` in the preapproval. Even though the preapproval was created against `test_user_5529635850066455346@testuser.com`, the actual authorize page renders the operator's real cards if their personal MP session is active.

**Consequence in this session**: operator authorized with the APRO test card (no real funds at risk since APRO is a sandbox test card), but MP returned `live_mode: true` on the payment and `summarized.charged_amount: 100` on the preapproval. Refund was attempted via API and rejected with `401 "Unauthorized use of live credentials"` (which confirmed test creds, see Finding #5b cross-reference). MP-side preapproval was cancelled successfully via API to prevent future cycles.

**Fix path (procedural)**:

Update `staging-smoke-checklist.md` "Prerequisites" section with explicit step:

> **Pre-flight: MP test-buyer browser session**
>
> Before any smoke that involves checkout authorize (1.1, 1.2, 1.4, 1.7, etc.):
>
> 1. Open a fresh incognito window.
> 2. Log into `https://www.mercadopago.com.ar/login` with the MP test buyer credentials (username from MP dashboard test users, e.g. `TESTUSERnnnnn` + password). DO NOT use your real MP account.
> 3. In the same incognito window, log into `https://staging.hospeda.com.ar` with the corresponding hospeda test user. The hospeda user's `billing_customers.email` must be set to `test_user_<nnnnn>@testuser.com` (matching the MP test buyer email format — see Finding #5b).
> 4. Proceed with the smoke flow. When MP redirects to authorize, it will use the test-buyer session.

**Recommend**: capture this as a hard pre-condition in section 1 of `staging-smoke-checklist.md` so future smokes don't repeat this mistake.

**Engram pin**: `process/smoke-mp-test-buyer-login-pre-flight`.

---

(More findings get appended below as the smoke progresses.)

---

## Session continuation 2026-05-21 (post-sleep) — fixes implemented

Following the live triage in this doc, work landed across two repos on
two short-lived branches.

### Branch state

**hospeda** — `fix/billing-smoke-followups-2026-05-21` (off `staging`)

- `2e3e14f35` — `fix(billing): point MP back_url at existing locale-prefixed checkout pages`
  - Resolves Finding #8.
  - `apps/api/src/routes/billing/start-paid.ts` + `plan-change.ts`
  - Adds `RETURN_URL_LOCALE` constant centralising the locale choice.
  - Both flows now point at `/<lang>/suscriptores/checkout/{success,failure}/`.
  - Pending URL is documented inline as a follow-up (service interface
    only accepts success+cancel today).

**qzpay** — `fix/transaction-amount-cents-to-pesos` (off `main`)

- `80f08ae` — `fix(mercadopago): convert price.amount and unitAmount from cents to MP decimal`
  - Resolves Finding #6.
  - Divides by 100 at the MP boundary in `subscription.adapter.ts` and
    `checkout.adapter.ts` (one-shot path). Documents the cents
    convention in `QZPayProviderCreateSubscriptionInput.price.amount`
    and `QZPayProviderCreateCheckoutInput.resolvedLineItems.unitAmount`
    JSDoc.
  - Adjusts existing tests to pass cents as input (they were passing
    decimals, which masked the bug).
  - Adds REGRESSION tests pinning the conversion at realistic plan-price
    magnitudes (1500000 cents → 15000 decimal).
- `66f8d68` — `test(mercadopago): align mixed-line-items checkout test to cents convention`
  - Follow-up alignment for one assert that was missed in the main fix.
- `9e6d1d9` — `fix(core): remove unused providerCustomerId validation in subscription create`
  - Resolves Finding #4.
  - Removes the validation in `billing.ts` that required
    `customer.providerCustomerIds[provider]` to be populated before
    calling the subscription adapter. The MP `/preapproval` flow does
    not reference the value; adapters that need it (Stripe-style) must
    validate at the adapter boundary.
  - Marks `QZPayProviderCreateSubscriptionInput.providerCustomerId` as
    optional with a JSDoc note explaining the convention.
  - Updates `billing.test.ts` to assert the new behaviour (missing
    providerCustomerId now passes through to the adapter as undefined).
  - Test counts unchanged: 1500 passing.

### Test status

- qzpay `@qazuor/qzpay-mercadopago`: 393 tests, 1 skipped, 0 failing (was
  1 failing pre-this-session — fixed by the test-alignment commit).
- qzpay `@qazuor/qzpay-core`: 1501 tests, 0 failing (was 1 failing
  pre-this-session — the obsolete validation test was rewritten to
  match the new behaviour).
- hospeda `hospeda-api`: typecheck still reports the 4 pre-existing
  baseline errors documented in engram from sessions before this one
  (`accommodation/protected/getById.ts`, `quick-amenity-resolver.ts`,
  `conversations/protected/list.ts`, `profile.test.ts`). NONE of them
  reference the files this session edited.

### Findings status after this session

| # | Finding | Status |
|---|---------|--------|
| 1 | Pricing UI does not expose annual interval | OPEN (UI feature gap, not a bug — separate scope). |
| 2 | `scheduled_plan_change` column missing on reset | OPEN — root cause not identified. Recreate local DB to investigate when next session resumes. |
| 3 | Reset workflow does not converge | OPEN — depends on #2 root cause. |
| 4 | `providerCustomerId` validation blocks valid flows | **RESOLVED** in qzpay `9e6d1d9`. |
| 5b | MP test buyer email format (`test_user_<id>@testuser.com`) | RESOLVED procedurally — documented in `staging-smoke-checklist.md` pre-flight as part of Finding #9. |
| 6 | qzpay sends `transaction_amount` in cents to MP | **RESOLVED** in qzpay `80f08ae`. |
| 7 | MP webhook never reaches hospeda-api | OPEN — needs MP dashboard inspection. See action plan below. |
| 8 | back_url redirects to 404 | **RESOLVED** in hospeda `2e3e14f35`. |
| 9 | Smoke pre-flight: MP test-buyer browser login | OPEN procedural — to be folded into `staging-smoke-checklist.md` prerequisites section. |

### #7b — prod-api rejects MP webhook deliveries with 403 (signature mismatch)

**Severity**: BLOCKER for prod go-live, not for staging smoke.

**Observed**: while diagnosing #7, we found that the MP dashboard's webhook URL was set to the **prod** endpoint (`https://api.hospeda.com.ar/api/v1/webhooks/mercadopago`) when it should have been pointing at staging. Operator changed it to staging. While checking the prod logs, we saw MP HAD attempted to deliver 5 webhook events to prod-api during the smoke window — all 5 returned **403** with `webhook-signature` middleware-level rejection.

**Confirmed by operator (2026-05-21)**: staging and prod use **different** `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` values. That is the right setup architecturally — they are isolated environments. But it means each environment's secret MUST match what the MP dashboard signs with **for that environment's URL**. When MP delivered staging-flow webhooks to prod-api by mistake, prod-api's secret didn't match the staging-app signature, hence 403 across the board.

The setup is consistent if and only if:

- Staging env `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` matches the secret configured for the MP dashboard's "test" notification URL.
- Prod env `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` matches the secret configured for the MP dashboard's "production" notification URL.

For staging, the upcoming smoke retry will verify this implicitly: if MP delivery shows up in `hospeda-api-staging` logs with 200 (not 403), the staging secret is correct. Pending.

For **prod**, the secret pairing must be verified **before go-live** — otherwise the first real subscription will mute itself (sub stuck `incomplete` because prod-api rejects every MP webhook with 403). Verification steps:

1. Pull prod env secret prefix: `hops exec api --target=prod printenv HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET | head -c 20`
2. Open MP dashboard for the prod app (or the prod section of the shared app — depends on the MP account setup) and read the webhook secret configured there.
3. If the prefixes do not match, fix one or the other:
   - If the env value is "the source of truth" (e.g. set by tooling), update the MP dashboard secret to match.
   - If the dashboard value is "the source of truth", update the prod env in Coolify and redeploy.

**Engram pin**: TBD on close — `bug/prod-webhook-secret-pairing-needs-verification`.

---

### Finding #7 (webhook) — diagnostic action plan for next session

Code-side investigation completed: `apps/api/src/routes/webhooks/mercadopago/router.ts` mounts a `createWebhookRouter` from `@qazuor/qzpay-hono` with handlers for the full set of MP events needed (`payment.created/updated`, `subscription_preapproval.created/updated`, `subscription_authorized_payment.created/updated`, `chargebacks`, `payment.dispute`). The endpoint responds `401 Missing webhook signature` when posted without a signature, confirming both that it is mounted and that signature verification is in front of the handler. `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` is populated on staging (74-char value). So the hospeda side is wired correctly; the gap is between MP and hospeda.

To narrow it down, do this in order:

1. Open the MP application's developer panel at `https://www.mercadopago.com.ar/developers/panel/app/<app-id>/notifications` (or wherever the current dashboard surfaces webhooks).
2. Confirm a Notification URL is set; it should be `https://staging-api.hospeda.com.ar/api/v1/webhooks/mercadopago`. If empty, set it. If pointed elsewhere, that's the bug.
3. Confirm the events subscribed include AT LEAST: `subscription_preapproval`, `subscription_authorized_payment`, `payment`. (`chargebacks` and `payment.dispute` are nice-to-have for SPEC-143 phase 2 smokes.)
4. Confirm the dashboard's webhook secret matches `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` in Coolify (`41cb3400...`). If they differ, MP signs with one secret and hospeda validates with another, MP retries get 401, and after retry exhaustion MP gives up.
5. Open the dashboard's delivery log for the cancelled preapproval `d9ef9cb730184c588c77357e9386f281` from this session — if MP attempted delivery and got non-2xx, the log shows it. If the log is empty, MP did NOT attempt delivery and the URL config in step 2 is the cause.
6. If steps 1-5 all look fine and MP still does not deliver, GET the cancelled preapproval directly from MP API to verify the `notification_url` field MP stored is what we passed:
   ```bash
   curl -sS 'https://api.mercadopago.com/preapproval/d9ef9cb730184c588c77357e9386f281' \
     -H "Authorization: Bearer $MP_TOKEN" | python3 -c 'import sys,json; r=json.load(sys.stdin); print("notification_url:", r.get("notification_url"))'
   ```

Once the cause is identified, the fix is either (a) config in MP dashboard (no code change), or (b) a hospeda-side adjustment to how `notification_url` is set in the preapproval body. Right now we cannot tell which without dashboard visibility.

### Operator state cleanup at session close

These local SQL operations were applied to the staging DB during the smoke session. Restore as part of the next session's pre-checks:

- `billing_prices` for `owner-basico` monthly: `unit_amount` was temporarily lowered from `1500000` to `100`. **Restore to `1500000`** (the qzpay fix means the original value is correct end-to-end now):
  ```bash
  hops psql --target=staging "UPDATE billing_prices SET unit_amount = 1500000 WHERE plan_id = (SELECT id FROM billing_plans WHERE name = 'owner-basico') AND billing_interval = 'month';"
  ```
- `billing_customers.email` for `qazuor+test@gmail.com` was changed to the test buyer email `test_user_5529635850066455346@testuser.com`. Decide whether to (a) leave it for future smokes (recommended — the user is permanently bound to that MP test buyer now), or (b) restore the original gmail. Default: leave it.
- `billing_customers.mp_customer_id`: was set to `sandbox-bypass-<uuid>`. With the Finding #4 fix the bypass is no longer needed, but having a placeholder doesn't hurt either. Restore to NULL if you want to verify the new behaviour:
  ```bash
  hops psql --target=staging "UPDATE billing_customers SET mp_customer_id = NULL WHERE id = 'e0e60ac1-00c3-42a3-92c1-f811874fa5fc';"
  ```
- 3 `billing_subscriptions` rows were soft-deleted at session end. Leave them; they're cancelled in MP too.
- 3 MP preapprovals were cancelled via API: `d9ef9cb730184c588c77357e9386f281`, `161f8421973143e484cbb72ae36bdf14`, `822fc36377644db8a5123681da42da73`.
- 1 MP payment (`160334091032`, $100 ARS, status `approved`) had a refund attempt rejected with `401 Unauthorized use of live credentials`. The payment used the APRO test card (`4509...3704`), so MP simulated the charge without moving real money — verify with bank statement to confirm.

### Pre-flight for resume

1. Apply the cleanup SQL above.
2. Pull both branches: hospeda `fix/billing-smoke-followups-2026-05-21` and qzpay `fix/transaction-amount-cents-to-pesos`.
3. Deploy hospeda branch to staging (Coolify, manual trigger per policy).
4. The qzpay branch is workspace-linked into hospeda; the hospeda deploy picks up the qzpay code from the local workspace at build time. Verify the deploy log includes the qzpay changes.
5. In MP dashboard, work through the Finding #7 plan above.
6. Resume smoke at 1.2 from the staging-smoke-checklist:
   - Open fresh incognito window
   - Login MP as `TESTUSER5529635850066455346` / `ycaZ63mvQt`
   - In same incognito, login `staging.hospeda.com.ar` as `qazuor+test@gmail.com`
   - Pricing → owner-basico monthly → Suscribirme
   - Expected: `/start-paid` → 201 with `checkoutUrl`. Redirect to MP works, authorize with `APRO` card, redirect to `/es/suscriptores/checkout/success/?status=...`, webhook fires, sub flips to `active`.

---

## Session continuation 2026-05-21 (smoke resumed, late-evening)

After the fixes above merged and staging was reseeded, we resumed smoke 1.1 from zero. Four more findings surfaced. Two are now fixed in code, two are tracked as billing-bug follow-ups.

### #10 — `dbReset` hardcoded table list never included billing tables (FIXED)

**Severity**: SETUP BUG — silently undermines `hops db-seed --target=staging --reset` for the billing surface; previous session's manual `UPDATE billing_prices SET unit_amount = 100` workaround survived reseeds and re-polluted state.

**What**: `packages/seed/src/utils/dbReset.ts` maintained a hardcoded `allTables[]` of 28 tables enumerating the entities to wipe before reseed. The ~30 `billing_*` tables (added later via the qzpay-drizzle integration) were never added to that list, so the reset silently skipped all billing data. Manual customisations and stale rows accumulated across reseeds.

**Symptoms in this session**:

- Ran `hops db-seed --target=staging --pull --yes` post-merge.
- `SELECT unit_amount FROM billing_prices WHERE plan_id=(owner-basico) AND billing_interval='month'` still returned `100` (the previous session's workaround), not the expected `1500000`.
- Confirmed by inspecting `allTables[]`: every other entity in the codebase was listed, billing was completely absent.

**Fix**: rewrite `dbReset.ts` to use runtime introspection of `pg_tables` (public schema) plus a single `TRUNCATE TABLE … RESTART IDENTITY CASCADE`. The set of tables to reset is now the live truth from Postgres, not a parallel declaration that has to be kept in sync by hand. Tables added by any future package will be reset automatically.

Also fixed two pre-existing test failures in `billingPlans.seed.test.ts` left over from the earlier `plan.slug` rename (commit `fd025b93c`): the seed now stores `billing_plans.name = plan.slug`, but the tests still expected `plan.name`.

**PR**: #1220 — branch `fix/seed-db-reset-introspect-tables` off `staging`. 2 files changed, 96 +/117 −.

---

### #11 — MP checkout shows plan slug as the human description (UX, pending fix)

**Severity**: UX — payment screen shows `owner-basico` to the user where it should show something like "Hospeda — Basic (Annual)". Reflects badly on the brand but does not block any flow.

**What**: When the preference is created via `start-paid.ts`, the `description` and `additional_info.items[0].title` fields are populated with the plan slug (`owner-basico`). MP renders that string in both the checkout screen and the post-payment confirmation page. The MP test buyer sees a bare slug instead of a polished label.

Confirmed by querying `https://api.mercadopago.com/v1/payments/160428694188`:

```json
"description": "owner-basico (Annual)",
"additional_info": {
    "items": [
        {
            "title": "owner-basico (Annual)",
            ...
        }
    ]
}
```

**Fix path**: the plan config (`packages/billing/src/config/plans.config.ts`) already carries a human label (`name: 'Basic'`). The preference creation code in `start-paid.ts` (or the subscription-checkout service it delegates to) needs to pass `plan.name` instead of `plan.slug` for these two MP fields. The slug should still travel in metadata/external_reference for traceability.

**Tracked as**: billing-bug to be addressed alongside other billing UX fixes. Not a separate spec.

---

### #12 — Same MP app shared across environments creates webhook secret/URL mismatch

**Severity**: ARCHITECTURAL — blocks all webhook-dependent smoke flows on staging until either (A) workaround applied, or (B) staging gets its own MP app.

**What**: Hospeda uses a single MP app whose webhook config has two sections — "Producción" and "Pruebas" — each with its own URL but, in this account, **the same secret**. The "Producción" URL points at `api.hospeda.com.ar`, the "Pruebas" URL at `staging-api.hospeda.com.ar`.

The gotcha (engram `mp-preapproval-no-sandbox-variant`): MP test users always report `live_mode: true` on payment objects regardless of how the test is set up. When MP needs to send a webhook for a `live_mode: true` event, it picks the **"Producción"** section's URL — which on staging is the wrong one (it points at `api.hospeda.com.ar`, not `staging-api.hospeda.com.ar`). The notification_url embedded in the preference is honoured for the destination, so the webhook still arrives at staging, but the signature was computed for the production webhook URL configuration; whether it lands signed or unsigned depends on whether MP considers the registered URL matches.

**Symptoms**:

- Payment APRO succeeds, frontend lands on success page, but `billing_subscriptions.status` stays `pending_provider`.
- API log: `Webhook request missing x-signature header — rejecting` → 401.
- Repro stable: every paid checkout fails the same way.

**Workaround applied in this session (Option 1, ugly-but-fast)**:

- In MP dashboard → Webhooks → **"Producción"** section, temporarily change the URL to `https://staging-api.hospeda.com.ar/api/v1/webhooks/mercadopago` (same URL as the "Pruebas" section).
- Since prod is pre-beta and not receiving real traffic yet, this has no operational cost.
- Operator note: revert the URL to `api.hospeda.com.ar` BEFORE beta cutover.

**Definitive fix (Option 2, post-smoke)**:

- Create a second MP app dedicated to staging.
- Configure that app's "Producción" webhook with `staging-api.hospeda.com.ar` + its own secret.
- Update `HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN` and `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` in the staging env to use the new app's credentials.
- Create a new MP test buyer in the new app (test users are scoped per app).
- Update `billing_customers.email` UPDATE in the smoke procedure to use the new test buyer's email.
- Production stays on the existing MP app, untouched.

**Tracked as**: billing-bug — schedule alongside the prod cutover work.

---

### #13 — `originVerificationMiddleware` blocks ALL webhook endpoints by Origin header

**Severity**: BUG — silent blocker for any external webhook integration (MP, Brevo, etc). Applies to every POST/PUT/PATCH/DELETE in the API.

**What**: `apps/api/src/middlewares/security.ts:136-219` defines `originVerificationMiddleware` which rejects with 403 any mutating request whose `Origin` header does not match `API_CORS_ORIGINS`. The middleware is mounted globally in `apps/api/src/utils/create-app.ts:126` via `.use(originVerificationMiddleware)`, meaning it intercepts the webhook endpoint too.

MP webhooks arrive with `Origin: https://mercadopago.com.ar`. The header is set by MP server-side, not by a browser. Since `mercadopago.com.ar` is not in the hospeda CORS whitelist (and should never be — it is not a hospeda surface), every webhook hits this middleware first and gets 403'd before reaching the signature verification layer.

The webhook endpoint already has its own authentication mechanism (HMAC-SHA256 signature via `webhook-signature.ts`). Origin verification is a CSRF defense for browser-driven flows and is semantically wrong for server-to-server webhooks.

**Symptoms in this session**:

- After Finding #12 workaround applied, retried the smoke. MP webhook now reaches the endpoint (URL correct, signature should pass).
- API log: `Origin verification failed`, `origin: https://mercadopago.com.ar`, `allowedOrigins: [staging.hospeda.com.ar, staging-admin.hospeda.com.ar]` → 403.
- Reproduces for both `payment` and `topic_merchant_order_wh` webhook types.

**Workaround applied (temporary, env-level)**:

- Added MP origins to staging's `API_CORS_ORIGINS`:
  ```
  hops env-set api --target=staging API_CORS_ORIGINS \
      "https://staging.hospeda.com.ar,https://staging-admin.hospeda.com.ar,https://mercadopago.com.ar,https://www.mercadopago.com.ar,https://api.mercadopago.com"
  hops redeploy api --target=staging
  ```
- This whitelists MP at the CORS level so the request passes the origin check; signature verification then validates legitimacy.
- Side effect: `mercadopago.com.ar` becomes a valid CORS origin for the entire API, not just the webhook path. Acceptable on staging but ugly architecturally.

**Definitive fix (code, billing-bug followup)**:

Modify `originVerificationMiddleware` (security.ts:136) to skip paths under `/api/v1/webhooks/`:

```ts
export const originVerificationMiddleware = async (c, next) => {
    if (c.req.path.startsWith('/api/v1/webhooks/')) {
        await next();
        return;
    }
    // … existing logic unchanged …
};
```

Webhook endpoints are server-to-server, already protected by HMAC signature verification, and have no business hitting CSRF/origin defenses meant for browser flows. After the fix, revert the staging `API_CORS_ORIGINS` to only hospeda surfaces.

**Tracked as**: billing-bug — pair with #12 in the next billing bug-fix pass.

---

## Status summary after late-evening continuation

| Finding | Status |
|---|---|
| #1 (annual UI toggle missing) | Fixed (PR #1217) |
| #2 (`/start-paid` 500) | Fixed (qzpay PR #27) |
| #3 (reset doesn't sync schema) | Fixed (hops PR #1217) |
| #4 (qzpay providerCustomerId validation) | Fixed (qzpay PR #27) |
| #5/5b (MP test buyer email format) | Documented in checklist (#1217) |
| #6 (cents → MP decimal conversion) | Fixed (qzpay PR #27) |
| #7 (webhook never reached hospeda) | Fixed operator-side (URL in MP dashboard) |
| #7b (prod webhook secret pairing) | Documented for pre-go-live verification |
| #8 (back_url 404) | Fixed (PR #1217) |
| #9 (smoke pre-flight procedure) | Fixed in checklist (#1217) |
| **#10 (dbReset hardcoded list)** | **Fixed (PR #1220)** |
| **#11 (MP shows slug as description)** | **Fixed (PR #1221) — annual + upgrade titles now use `plan.metadata.displayName` with slug fallback** |
| **#12 (MP app shared cross-env)** | **Workaround applied; definitive = separate MP app (operational, not code)** |
| **#13 (originVerificationMiddleware blocks webhooks)** | **Fixed (PR #1221) — middleware skips `/api/v1/webhooks/` paths; reverted CORS env after deploy** |
| **#14 (webhook-signature manifest uses `ts` instead of `x-request-id`)** | **Fixed (PR #1221) — manifest now uses `x-request-id` header; `data.id` extracted from query (preferred) or body; lowercased for HMAC** |

---

### #14 — `webhook-signature.ts` constructs HMAC manifest with wrong template (BUG)

**Severity**: CRITICAL — every MP webhook with body+signature fails verification on staging (and would fail in prod too). Subscriptions stuck in `pending_provider`, no `active` flip after payment.

**What**: The MercadoPago webhook signing template per [MP docs](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks#editor_5) is:

```
id:[data.id_url];request-id:[x-request-id_header];ts:[ts_header];
```

Where:

- `data.id_url` is the `data.id` query parameter (lowercased)
- `x-request-id_header` is the HTTP header `x-request-id`
- `ts_header` is the `ts=` component of the `x-signature` header

Hospeda's implementation in `apps/api/src/middlewares/webhook-signature.ts:145` instead constructs:

```ts
const signedPayload = `id:${dataId};request-id:${ts};ts:${ts};`;
```

Note `request-id:${ts}` — the timestamp is being reused for `request-id` instead of reading the `x-request-id` header. The middleware never reads `x-request-id` anywhere.

This produces an HMAC over the wrong manifest, so MP's signature and hospeda's expected signature never match. Every signed webhook gets `Webhook signature mismatch — rejecting` → 401.

Compounding bug: 3 test files use the same incorrect template, so the test suite passes against the buggy code and no one caught it:

- `apps/api/test/middlewares/webhook-signature-prod-guard.test.ts`
- `apps/api/test/integration/webhooks/webhook-signature.test.ts`
- `apps/api/test/e2e/flows/billing/webhook-signature.test.ts`

**Symptoms in this session**:

- After the CORS workaround (Finding #13), webhooks passed origin check.
- Log: `Webhook signature mismatch — rejecting`, `dataId: "160445417222"`, `ts: 1779403859` → 401.
- Reproduces deterministically for every MP webhook with a body.

**Fix path (definitive)**:

In `webhook-signature.ts:218-344` (middleware factory):

1. Extract the `x-request-id` header:
   ```ts
   const requestId = c.req.header('x-request-id');
   if (!requestId) {
       apiLogger.warn({ path: c.req.path }, 'Webhook request missing x-request-id header — rejecting');
       throw new HTTPException(401, { message: 'Missing x-request-id header' });
   }
   ```
2. Pass it through to `computeExpectedSignature`:
   ```ts
   const expectedSignature = computeExpectedSignature({ dataId, requestId, ts, secret });
   ```
3. Update `computeExpectedSignature` (line 136) to take `requestId` and build:
   ```ts
   const signedPayload = `id:${dataId};request-id:${requestId};ts:${ts};`;
   ```
4. Update JSDoc references on lines 12-14 and 196 to reflect the correct template.

Secondary consideration: the docs also say `data.id_url` is lowercased — investigate whether MP sometimes uppercases alphanumeric data IDs (e.g. `ORD01JQ...`) and whether we should `.toLowerCase()` before passing to HMAC. For numeric payment IDs this is a no-op, but if subscription preapprovals use alphanumeric IDs it could matter.

Update all 3 test files with the corrected template + use a realistic `x-request-id` UUID in fixtures.

**Tracked as**: billing-bug — same bucket as #11, #13. This is the most critical of the three because it breaks the whole webhook flow.

**Workaround during this session** (temporary, env-level): if `NODE_ENV` on staging is not `production`, vaciar `HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET` triggers the warn-and-pass branch in the middleware (line 232-247) so signature check is skipped. Smoke can continue. Revert at session close. If `NODE_ENV=production` on staging, this workaround is not available and the definitive fix must ship first.

---

## Session continuation 2026-05-22 to 2026-05-23 — webhook signature + IPN dichotomy + polling fallback

After 24+ hours of debugging the webhook signature mismatch and discovering that MercadoPago's TEST credentials behave differently from PROD credentials across multiple endpoints, this session shipped the definitive fix set across qzpay + Hospeda and validated end-to-end on staging. Smoke 1.2 (monthly checkout) now passes.

### Finding #15 — Webhook signature mismatch traced to qzpay-mercadopago, not Hospeda

**Original symptom**: Every signed MP webhook returned 401 with HMAC mismatch even after applying the Finding #14 fix to Hospeda's `webhook-signature.ts` middleware.

**Root cause**: Hospeda had **two** signature verifiers running:
1. The custom Hospeda middleware (the one Finding #14 documented and fixed).
2. The qzpay-mercadopago internal verifier, which was buggy in the SAME way (`request-id:${ts}` instead of `request-id:${xRequestIdHeader}`) at `qzpay-mercadopago/webhook.adapter.ts:152`.

The Hospeda middleware was redundant — the canonical place to verify is inside qzpay so consumers can opt in to a single, audited implementation. The fix was both:
- Fix the bug inside qzpay-mercadopago (PR qzpay#30) — passing the proper `x-request-id` header through to the manifest, plus making lowercase dataId mandatory for alphanumeric IDs.
- Remove the duplicate Hospeda middleware (PR hospeda#1226) — wire qzpay's own verifier via `createMercadoPagoAdapter({ logger })`.

**Status**: ✅ Resolved. qzpay-mercadopago 2.0.0 ships the fix. Hospeda 1226 mergeado.

**Lesson**: when a third-party library wraps a security primitive, do not implement the same primitive locally. Either trust the library or fork it — not both.

### Finding #16 — IPN vs Webhooks v2 dichotomy doubles every event delivery

**Symptom**: For every payment MP fires two webhook posts to our URL — one new Webhooks v2 format (with `x-signature` header + `?data.id=…&type=payment` URL), one legacy IPN format (no signature, `?id=…&topic=payment` URL). The IPN posts always fail signature verification because they have no signature header.

**Root cause**: MP keeps backwards compatibility for legacy IPN integrations and fires both channels when an app is configured for both. The standard MP recommendation is to filter via the `?source_news=webhooks` URL marker — MP only adds that marker on Webhooks v2 deliveries.

**Fix**: PR hospeda#1230 added middleware that drops MP posts whose URL does not contain `?source_news=webhooks`. The marker has to be configured on the MP dashboard webhook URL (one-time op per app).

**Status**: ✅ Resolved. PR #1230 mergeado. Operator config done on Test Seller app.

### Finding #17 — `subscription_preapproval.*` webhook delivery is unreliable

**Symptom**: After applying Findings #15 + #16 fixes, `payment.created` events arrived and verified successfully but the local subscription never transitioned to `active` because `subscription_preapproval.created` never arrived. Confirmed across multiple smoke runs with PROD creds + Test Seller creds + correctly subscribed events in the dashboard.

**Root cause analysis**:
1. We initially suspected an event-subscription misconfiguration in the dashboard. Operator triple-checked — events were subscribed.
2. We then suspected the multi-app webhook URL footgun (multiple MP apps posting to staging-api with different secrets). Cleanup down to one app didn't make `subscription_preapproval.*` arrive.
3. We finally observed on 2026-05-23 that with monthly checkout the events DID arrive — but the dispatcher reported "no registered handler" because qzpay-mercadopago maps `subscription_preapproval.created` → qzpay event type `subscription.created`, while Hospeda only registers `subscription_preapproval.updated`. **The webhook arrived; the handler dispatcher had no route for that event type.** See Finding #20 for follow-up.

Regardless of the dispatcher gap, the design assumption that "webhook is the only path" is fragile against future MP delivery changes.

**Fix (resilience)**: PR hospeda#1231 + qzpay#36 ship the polling fallback. After `start-paid` creates the preapproval, a cron job polls `paymentAdapter.subscriptions.retrieve(id)` every minute until MP reports `authorized`, then flips the local sub to `active` via the same `processSubscriptionUpdated` function the webhook would have called. Both paths converge on the same terminal state via status idempotency.

**Validation 2026-05-23 14:33**: Smoke 1.2 monthly with TEST creds, polling fallback enabled. Subscription `e4f5f09a` transitioned from `incomplete` → `active` at 14:33:01 via the cron path, polling job `5cc9b813` succeeded on attempt 1.

**Status**: ✅ Mitigated via polling. The underlying MP delivery question is separate from Hospeda's robustness now.

### Finding #18 — TEST credentials behave asymmetrically (no `/v1/customers`, payer-email-only preapproval)

**Symptom**: With TEST credentials, `POST /v1/customers` returns HTTP 401 error 300 "Unauthorized use of live credentials" regardless of body. MP's error wording is misleading: credentials ARE test, but the endpoint is blocked for test-tier tokens.

**Root cause**: documented MP behavior since the `APP_USR-` prefix unification. The `/v1/customers` endpoint is reserved for live merchant accounts (KYC verified). For test, MP expects callers to pass payer info inline on each operation rather than persisting a MP customer record.

**Effect on qzpay**: when Hospeda's signup flow calls `billing.customers.create()` qzpay tries to sync with MP via `/v1/customers`. The 401 propagates as `Provider sync failed during customer creation`. Under `providerSyncErrorStrategy: 'throw'` this rolls back the local customer; under `'log'` it keeps the local record but `mp_customer_id` stays null.

**Workaround**: set `HOSPEDA_MERCADO_PAGO_SANDBOX=true`. The flag is consumed in `packages/billing/src/adapters/mercadopago.ts:81-82`:

```ts
const sandbox = env.HOSPEDA_MERCADO_PAGO_SANDBOX;
const livemode = !sandbox;
```

`livemode=false` propagates to the storage adapter AND the qzpay-billing instance, telling qzpay to skip the `/v1/customers` sync entirely. Signup completes; subsequent preapproval / payment calls pass payer email inline (already the qzpay-mercadopago default).

**Status**: ✅ Documented as the canonical test-environment recipe in `docs/billing/test-environment.md`. PROD creds are immune (the endpoint works).

### Finding #19 — Customer auto-soft-delete is a side-effect of Finding #18, not a separate bug

**Symptom**: Customers created during signup were being soft-deleted ~470ms after creation. We initially suspected a buggy sync service in the `billing-customer-sync-service` flow.

**Root cause**: When `HOSPEDA_MERCADO_PAGO_SANDBOX=false` and qzpay attempted `/v1/customers` sync, MP returned 401 (Finding #18). qzpay's transaction rollback / soft-delete kicked in to maintain consistency. Once `SANDBOX=true` was set, no MP sync was attempted and customers persisted normally.

**Status**: ✅ Not a separate bug. Closed as duplicate of Finding #18.

### Finding #20 — Dispatcher missing handler for `subscription.created`

**Symptom (new)**: During smoke 1.2 on 2026-05-23, the `subscription_preapproval.created` webhook DID arrive and signature-verified, but the dispatcher logged "Webhook event has no registered handler" because qzpay-mercadopago maps that MP event to qzpay event type `subscription.created`, while Hospeda's dispatcher only registers `subscription_preapproval.updated`.

**Impact**: low. The polling fallback (#17) covers this gap — the cron transitions the sub even when the webhook is dropped on the dispatcher floor. The handler should still be registered for defense-in-depth.

**Fix path**: in the webhook event registry, add `subscription.created` → invoke `processSubscriptionUpdated` (the existing handler logic works for both create and update because it queries the current MP state regardless of the event verb). One commit, no test changes required because the handler is identical.

**Status**: 🟡 Tracked. Polling covers the gap so this is not urgent.

### Finding #21 — Annual checkout flow never activates via webhook (two bugs in cascade)

**Symptom**: Smoke 1.3 on 2026-05-23 16:00 with annual flow. MP authorization succeeded (APRO + test buyer), 4 webhooks arrived from MP — ALL without the `?source_news=webhooks` marker, so the filter from PR #1230 dropped them all as legacy IPN duplicates. Sub stayed `incomplete` forever. Manual `UPDATE billing_subscriptions SET status='active'` was the only way to validate post-transition stack worked.

**Root cause (two bugs)**:
1. MercadoPago Preferences API (used for annual one-time payments) only delivers via legacy IPN. There is no Webhooks v2 channel for `payment.*` events triggered by a Preference. PR #1230's marker filter is correct for monthly preapproval (where it drops IPN duplicates of v2 events) but inadvertently kills annual entirely because no v2 marker ever arrives.
2. Even if a webhook DID reach the handler, `qzpay-mercadopago/checkout.adapter.ts` was hard-coding `body.metadata = {qzpay_mode, qzpay_customer_id}` and silently discarding `input.metadata` — so the `annualSubscriptionId` Hospeda embeds in the preference metadata was never propagated to MP and never appeared on the payment webhook. `confirmAnnualSubscription` reads `metadata.annualSubscriptionId` to route the activation, so even with IPN passing through, the handler would have no-op'd. The annual flow has effectively never been validated against real webhooks in either staging or prod.

**Resolution**:
- **qzpay-mercadopago 2.1.0** fixes the metadata-forwarding bug: `input.metadata` now merges with the qzpay diagnostic keys instead of being overwritten. Released via qzpay PR #38.
- **qzpay-core 1.10.0 + qzpay-drizzle 1.9.0**: introduce `QZPayPollingResourceType = 'subscription' | 'one_time_payment'`. The polling-jobs schema gets a `resource_type` column. Optional `payment.search()` method on the payment adapter interface.
- **qzpay-mercadopago 2.1.0** implements `payment.search({externalReference})` using the SDK's typed filter (with passthrough support for the untyped `preference_id` MP REST param).
- **Hospeda PR #1234** extends the annual flow to schedule a polling job with `resource_type='one_time_payment'` and `providerResourceId` = local checkout-session id (which qzpay-core sets as MP `external_reference`). The `subscription-poll` cron searches MP payments by external_reference once per minute and routes any approved payment through the same idempotent `confirmAnnualSubscription` helper the webhook handler uses. Webhook and polling can race for the same payment without risk — both go through the idempotency guards.

**Status**: 🟢 Resolved on staging (pending smoke 1.3 re-run with new versions deployed). The webhook handler now ALSO works because the metadata-forwarding fix lets `payment.metadata.annualSubscriptionId` reach the dispatcher; polling is defense-in-depth for the IPN-only delivery channel.

### Smoke 1.2 monthly — final result

**Validated end-to-end**: signup → checkout → MP authorization (APRO + test buyer) → `payment.created` webhook processed → polling cron transitions sub to active within 60 seconds. DB row:

```
sub_id   e4f5f09a-ad83-45ca-8470-ceaa307324b0
status   active
plan     owner-basico (monthly)
job_status   succeeded (1 attempt, completed in ~50s)
provider_status   active
```

### Side observations for follow-up

These are not findings (no behavior bug in the smoke-critical path) but UX / docs gaps worth tracking:

- **`/mi-cuenta` shows `plan_id` UUID instead of plan name**. Frontend reads the raw subscription record without joining/looking up the plan. (task #25)
- **MP preapproval renders plan slug in lowercase, untranslated**. qzpay builds the `reason` field as `${plan.name} - ${interval}` and passes raw `plan.name` which is the slug `owner-basico`. Should pass a display name. (task #26)
- **`Ver factura` button errors out**. Hospeda has no real invoice yet (AFIP deferred to v2). Either hide the button or show a generic receipt. (task #27)
- **`hops db-seed` does not run `pnpm install`**. After git pull on the VPS host, the host's node_modules can be stale relative to the lockfile, so `db:push` reads an old schema. Should add an install step. (task #23)
- **`docs/billing/test-environment.md` overclaims that `payment.*` events only arrive via IPN with TEST creds**. Smoke 1.2 disproved this — with single-app + marker URL + correct subscriptions, payment.* events arrive on v2 normally. Doc to be corrected. (task #28)

