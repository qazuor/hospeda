# Billing operational runbooks

> **Audience**: oncall, ops, anyone responding to a billing incident in production.
> **Scope**: seven recurring failure scenarios with symptoms, investigation steps, resolution, and verification. NOT a feature reference — see [`packages/billing/docs/`](../../packages/billing/docs/) for that.
> **Companion docs**: [staging smoke](./../../.claude/specs/SPEC-143-billing-testing-coverage/docs/staging-smoke-checklist.md), [prod smoke + rollback](./../../.claude/specs/SPEC-143-billing-testing-coverage/docs/prod-smoke-checklist.md), [dispute handling v1](./dispute-handling-v1.md), [grace period source-of-truth](./grace-period-source-of-truth.md).
> **Status**: SPEC-143 T-143-48, 2026-05-20.

---

## How to use this document

When a billing alert fires (or a user reports a billing-related issue):

1. **Identify the scenario** — match the symptoms in §1–§7 against what you're seeing. Each section opens with a SYMPTOMS block; if none match exactly, prefer the closest scenario and escalate after the first investigation step if it doesn't fit.
2. **Follow the investigation steps in order**. They are designed to be cheap-first: read-only queries and log scans before any state mutation.
3. **Resolve via the documented commands**. Every `hops` command shown is target-aware — `--target=prod` for production, `--target=staging` for staging. Default is `prod` — explicit is safer when you're under pressure.
4. **Verify**. Every section closes with a verification block. Do not declare resolved until those checks pass.
5. **Write a postmortem entry** (or attach to an existing engram bug topic) for anything not already documented here. The bug topics at the bottom of this file are the canonical list.

Read these before responding under load. The first time you run any of these procedures should NOT be in the middle of an incident.

---

## Tools and access you need

Before any procedure below works, confirm you have:

- **SSH access to the VPS** (port 2222). The `hops` CLI lives in `~/server-tools/` on the VPS — every command in this doc is invoked from there. `ssh qazuor@216.238.103.219 -p 2222`.
- **Coolify access** at `https://coolify.hospeda.com.ar` — only for env var edits and manual redeploy fallback. Routine restart is `hops app-restart api`.
- **MercadoPago dashboard access** at `https://www.mercadopago.com.ar/developers/panel`. Required for refund/dispute scenarios (§5, §6).
- **Sentry access** (`hospeda-api` project). Required for triage in every scenario.
- **DB read access**. `hops db-counts <target>` for summary stats; `hops psql <target>` for ad-hoc queries.

If you don't have one of these, escalate before continuing.

---

## 1. Failed webhook handler triage

### Symptoms

- Sentry alert: `webhook-handler-failure` (project `hospeda-api`, tag `subsystem:billing-webhooks`).
- `billing_webhook_events` rows with `status = 'failed'` accumulating.
- User reports: "I paid but my subscription is not active" within minutes of a checkout completion.

### Investigation

Read-only first.

```bash
# 1. Confirm the alert. Count failures in the last hour.
hops psql --target=prod -c "SELECT type, action, count(*) FROM billing_webhook_events WHERE status = 'failed' AND created_at > now() - interval '1 hour' GROUP BY 1, 2 ORDER BY 3 DESC;"

# 2. Inspect the most recent failure to learn WHY.
hops psql --target=prod -c "SELECT id, type, action, error_message, retry_count, created_at FROM billing_webhook_events WHERE status = 'failed' ORDER BY created_at DESC LIMIT 5;"

# 3. Pull API logs around the failure timestamp.
hops logs api --since=10m | grep -iE 'webhook|mercadopago' | head -200
```

### Triage by error class

The `error_message` column maps to one of four classes. Treat each differently.

| Error pattern | Class | Action |
|---|---|---|
| `signature verification failed` | invalid signature | Go to §2 — different procedure. |
| `payment not found` / `subscription not found` | upstream MP race | Wait — see "Retries" below. |
| `Database error` / `withTransaction failed` | DB / migration | Check `hops health api`. If DB is healthy, escalate — likely code bug. |
| `Failed query: select ... from billing_plans` | schema preflight or db disconnect | See §3 (cron-style recovery applies). |

### Retries

The webhook router auto-retries via `apps/api/src/cron/jobs/webhook-retry.job.ts`. Default cadence: every 5 minutes, max 10 attempts with exponential backoff (`retry_count` column tracks position). If `retry_count = 10` and `status = 'failed'`, the event is DEAD-LETTERED and will not retry without manual intervention.

To replay a dead-lettered event:

```bash
# Find the event id from step 2 above, then:
hops cron-trigger --target=prod webhook-retry --event-id=<UUID>
```

The dead-letter admin route at `apps/api/src/routes/webhooks/admin/dead-letter.ts` exposes a programmatic surface but the cron-trigger path is preferred for one-off replays — it logs to Sentry with the correct subsystem tag and writes the audit row.

### Resolution

- **Transient MP race**: do nothing; retry job will succeed on next attempt. Verify the event flips to `status = 'processed'` within 15 minutes.
- **Signature failure**: go to §2.
- **DB error**: investigate root cause, fix forward, then replay dead-lettered events.
- **Unknown / code bug**: capture the full error + Sentry issue id, escalate, do NOT replay until the bug is fixed (replay will fail the same way).

### Verification

```bash
# After resolution, no new failures in the last 10 minutes.
hops psql --target=prod -c "SELECT count(*) FROM billing_webhook_events WHERE status = 'failed' AND created_at > now() - interval '10 minutes';"
# Expected: 0
```

Open the affected user's subscription to confirm activation. `hops psql --target=prod -c "SELECT id, status, current_period_end FROM billing_subscriptions WHERE customer_id = (SELECT id FROM billing_customers WHERE email = '<user-email>');"`.

---

## 2. MP signature validation failure

### Symptoms

- Sentry alert: `mp-signature-invalid` (subsystem `billing-webhooks`, action `verify-signature`).
- `billing_webhook_events.error_message` contains "signature verification failed" or "x-signature header missing".
- MP dashboard's webhook delivery log shows 401 responses from our endpoint.

### Investigation

Two distinct root causes — distinguish before resolving.

```bash
# Cause A: webhook secret rotated on MP side but not in Coolify env.
# Symptoms: ALL recent webhooks failing signature, MP dashboard shows them as delivered with our endpoint returning 401.
hops env-list --target=prod | grep HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET
# Compare against MP dashboard → Notifications → Webhooks → secret.

# Cause B: a single rogue request (testing tool, mistargeted curl).
# Symptoms: 1-2 failures in a sea of successes.
hops logs api --since=30m | grep -i 'signature' | head -20
```

### Resolution

**Cause A (secret rotation)**:

1. Get the new secret from the MP dashboard (Notifications → Webhooks → "Mostrar firma").
2. Update Coolify:

   ```bash
   hops env-set --target=prod --secret HOSPEDA_MERCADO_PAGO_WEBHOOK_SECRET '<new-secret>'
   hops redeploy --target=prod api
   ```

3. Replay any events that failed during the gap (§1 replay procedure).

NEVER edit the secret in code or commit it. Coolify is the source of truth for prod secrets per the env-management policy in [`docs/guides/env-management.md`](../guides/env-management.md).

**Cause B (rogue request)**:

Confirm via Sentry that the request did NOT come from MP's IP ranges (MP includes the `x-request-id` UUID in delivery logs — match against your `billing_webhook_events.id`). If it's not from MP, ignore it. The 401 is correct behavior.

### Verification

After secret rotation, the next legitimate MP webhook must succeed. Force one by triggering a `payment.created` event from MP's dashboard test tool, then:

```bash
hops psql --target=prod -c "SELECT id, status, created_at FROM billing_webhook_events ORDER BY created_at DESC LIMIT 1;"
# Expected: status = 'processed'
```

---

## 3. Cron failure recovery (general)

This section applies to ALL cron jobs in `apps/api/src/cron/jobs/`. Job-specific recovery for dunning is §4.

### Symptoms

- Sentry alert: `cron-job-failure` (subsystem `cron`, tag `job-name:<name>`).
- `cron_run_history` shows the latest run with `status = 'failed'` and a non-null `error_message`.
- Time-sensitive side effects not happening: trial expiries not flipping subs to `cancelled`, addons not expiring, exchange rates stale, etc.

### Investigation

```bash
# 1. List recent cron runs across all jobs.
hops cron-list --target=prod

# 2. Inspect the failed run's error message.
hops psql --target=prod -c "SELECT job_name, status, error_message, started_at, finished_at FROM cron_run_history WHERE status = 'failed' ORDER BY started_at DESC LIMIT 10;"

# 3. Pull the API logs for the run window.
hops logs api --since=2h | grep -iE 'cron|<job-name>'
```

### Triage by job

| Job | When it runs | What it does | Critical? |
|---|---|---|---|
| `dunning` | every 30 min | retries failed-payment subs, cancels after N attempts | YES — §4 |
| `trial-pre-end-notif` | daily 09:00 | sends "trial ending" emails | NO |
| `trial-expiry` | hourly | flips expired trials to `cancelled` | YES |
| `addon-expiry` | hourly | revokes expired addon entitlements | YES |
| `apply-scheduled-plan-changes` | hourly | applies downgrades scheduled for now | YES |
| `exchange-rate-fetch` | daily 03:00 | refreshes ARS/USD/BRL rates | YES (prices drift) |
| `abandoned-pending-subs` | daily 02:00 | flips `pending_provider` stuck >24h to `incomplete` | YES |
| `webhook-retry` | every 5 min | replays failed webhook events | YES |

"Critical?" = downstream billing correctness depends on it. Non-critical can wait for the next scheduled run; critical needs immediate manual trigger.

### Resolution

**Transient error** (network blip, DB connection hiccup):

```bash
# Trigger the job manually NOW.
hops cron-trigger --target=prod <job-name>
# Watch logs for completion.
hops logs api --since=2m | grep -i '<job-name>'
```

**Persistent error** (code bug, schema mismatch):

1. Inspect the `error_message` for a stack trace. If wrapped, look in Sentry for the unwrapped form.
2. If the bug is known: link the Sentry issue to the relevant engram bug topic (see §8 list). Do NOT trigger the job again — it will fail the same way and pollute `cron_run_history`.
3. If unknown: capture the error, escalate, file a SPEC follow-up. Use `hops cron-trigger --dry-run` to confirm a fix without committing side effects:

   ```bash
   hops cron-trigger --target=staging <job-name> --dry-run
   ```

### Verification

```bash
# After a manual trigger, the next run row should be 'success'.
hops psql --target=prod -c "SELECT job_name, status, started_at, finished_at FROM cron_run_history WHERE job_name = '<job-name>' ORDER BY started_at DESC LIMIT 3;"
```

Confirm the downstream side effect happened. For example, after a `trial-expiry` rescue:

```bash
hops psql --target=prod -c "SELECT count(*) FROM billing_subscriptions WHERE status = 'trialing' AND trial_end < now();"
# Expected: 0 — every expired trial should have flipped.
```

---

## 4. Dunning cron stuck recovery

### Symptoms

- Sentry alert: `dunning-cron-failure` or `dunning-stuck`.
- `billing_subscriptions` with `status = 'past_due'` count growing over multiple runs.
- A specific customer reports "I paid yesterday, my card was charged, but my account is still inactive".

### Investigation

```bash
# 1. Count past_due subs by age.
hops psql --target=prod -c "SELECT
  CASE
    WHEN now() - updated_at < interval '1 day' THEN '<1d'
    WHEN now() - updated_at < interval '3 days' THEN '1-3d'
    WHEN now() - updated_at < interval '7 days' THEN '3-7d'
    ELSE '>7d'
  END AS age_bucket,
  count(*)
FROM billing_subscriptions
WHERE status = 'past_due'
GROUP BY 1
ORDER BY 1;"

# 2. Inspect retry history for a specific stuck sub.
hops psql --target=prod -c "SELECT sub_id, attempt_number, attempted_at, result, error_message FROM billing_dunning_attempts WHERE sub_id = '<sub-uuid>' ORDER BY attempted_at;"

# 3. Verify dunning cron is running on schedule.
hops cron-list --target=prod | grep dunning
```

### Triage

**Bucket distribution tells the story**:

- All in `<1d`: dunning is processing them; this is normal load. No action.
- Pile in `1-3d` AND dunning cron NOT failing: dunning is succeeding but MP returns "no payment method" or "preapproval cancelled". Each requires per-customer outreach (§7).
- Pile in `>7d`: dunning is supposed to give up at attempt N (see `HOSPEDA_DUNNING_MAX_ATTEMPTS` env, default 5) and flip to `cancelled`. If it isn't, the cron has a bug. Check Sentry for `dunning` errors AND the `billing_dunning_attempts` table for a row with `attempt_number = MAX + 1` that succeeded.
- Pile in `3-7d` with dunning cron failing in §3: cron is broken. Fix per §3, then run manually:

  ```bash
  hops cron-trigger --target=prod dunning
  ```

### Resolution

**Cron broken**: see §3.

**Per-customer rescue** (MP card declined repeatedly, user updated card via portal but dunning hasn't picked it up yet):

```bash
# 1. Confirm MP shows the new card / authorized preapproval.
# (manual via MP dashboard → Customer → search by email)

# 2. Manually retry the failed charge by triggering dunning for just this sub.
hops psql --target=prod -c "SELECT id, status FROM billing_subscriptions WHERE customer_id = '<customer-id>' AND status = 'past_due';"

# 3. If the sub is recoverable, trigger dunning. The cron iterates ALL
#    past_due subs; there is no per-sub flag, but a manual run picks it up.
hops cron-trigger --target=prod dunning
```

**Bypass to manual rescue** (the dunning cron will not work for this case, e.g., card permanently declined but customer wants to keep the subscription):

See §7 — Manual Subscription Rescue.

### Verification

```bash
# After running dunning, the recovered sub should flip to 'active'.
hops psql --target=prod -c "SELECT id, status, updated_at FROM billing_subscriptions WHERE id = '<sub-uuid>';"

# Entitlement cache is per-process; the cache will refresh on next request.
# Confirm via the user's account (they reload the app).
```

---

## 5. Refund procedure

### Symptoms

- Inbound request: customer asks for refund (email, chat, support ticket).
- Internal request: chargeback dispute that we elected to refund instead of contest (§6).
- Admin escalation: incorrect charge (wrong plan, duplicate charge).

### Pre-requisites

Before refunding ANYTHING:

1. **Confirm the charge exists in MP**. `hops psql --target=prod -c "SELECT * FROM billing_payments WHERE id = '<payment-uuid>';"` — note the `mp_payment_id`. Search MP dashboard by that id to confirm the original transaction.
2. **Confirm refund scope**: full or partial? Match the amount in centavos.
3. **Confirm the customer is whom they say they are** — email match, account-level confirmation, NOT just a name match.

### The refund-flow-gaps bug topic

This procedure works around `bug/refund-flow-gaps` (engram), which has 5 sub-gaps in the in-app refund flow. Until those gaps are closed, ALL refunds go through the MP dashboard manually, NOT via our admin UI. See [`prod-smoke-checklist.md`](./../../.claude/specs/SPEC-143-billing-testing-coverage/docs/prod-smoke-checklist.md) rollback section for context.

### Resolution

**Manual refund via MP dashboard** (canonical):

1. Open MP dashboard → Pagos → search by `mp_payment_id`.
2. Click "Reembolsar". Choose Total or Parcial. Enter amount if partial.
3. Confirm. MP processes refund within 5-10 business days (varies by card issuer).

**Record the refund in our DB** (required for reconciliation):

```bash
hops psql --target=prod -c "
INSERT INTO billing_refunds (id, payment_id, amount_cents, currency, reason, status, mp_refund_id, created_at)
VALUES (gen_random_uuid(), '<payment-uuid>', <amount-centavos>, 'ARS', '<reason>', 'pending', '<mp-refund-id>', now());"
```

The MP webhook `payment.refunded` will arrive within minutes and flip `status` to `succeeded`. If it doesn't arrive, the webhook may be failing (§1).

**Subscription cancellation alongside refund** (if applicable):

```bash
# If the user is also cancelling, cancel the subscription FIRST so the
# refund triggers no further charges.
hops psql --target=prod -c "
UPDATE billing_subscriptions
SET status = 'cancelled', cancelled_at = now(), updated_at = now()
WHERE id = '<sub-uuid>';"

# Then clear their entitlement cache. The cache singleton is per API
# process and 5-minute TTL, but explicit invalidation on cancel is the
# documented path:
hops exec --target=prod api node -e "
require('./dist/middlewares/entitlement').clearEntitlementCache('<billing-customer-id>');"
```

### Verification

```bash
# Refund row exists and webhook arrived.
hops psql --target=prod -c "SELECT id, status, mp_refund_id, created_at FROM billing_refunds WHERE payment_id = '<payment-uuid>';"
# Expected: status = 'succeeded'

# Customer's MP dashboard view shows the refund.
# (verify via MP dashboard manually)

# Subscription state matches the rescue path:
hops psql --target=prod -c "SELECT status, cancelled_at FROM billing_subscriptions WHERE id = '<sub-uuid>';"
```

Email the customer with the MP refund id and expected timeline (5-10 business days). Do NOT promise faster — that's outside our control.

---

## 6. Dispute procedure

### Symptoms

- Sentry alert: `chargeback-received` (subsystem `billing-webhooks`, type `chargebacks`).
- MP dashboard shows a new "Contracargo" entry.
- Customer's bank initiates a dispute that bypasses our refund flow.

### v1 disclaimer

Dispute handling is currently manual via the MP dashboard — see [`docs/billing/dispute-handling-v1.md`](./dispute-handling-v1.md) for the full rationale. There is NO in-app dispute resolution flow in v1. The webhook handler in `apps/api/src/routes/webhooks/mercadopago/dispute-handler.ts` logs the event and notifies but does not auto-respond.

### Decision: contest or refund

Read [`dispute-handling-v1.md`](./dispute-handling-v1.md) section "Decision framework" for the criteria. In short:

- **Contest** when you have evidence the service was delivered (e.g., the user actively used premium features during the period in dispute).
- **Refund** when the customer's complaint is legitimate or evidence is weak — contesting a losing case adds MP fees and hurts the merchant standing.

### Investigation (both paths)

```bash
# 1. Get the chargeback details from the webhook event.
hops psql --target=prod -c "
SELECT id, type, action, payload, created_at
FROM billing_webhook_events
WHERE type = 'chargebacks'
ORDER BY created_at DESC LIMIT 5;"

# 2. Pull the user's recent activity for evidence.
hops psql --target=prod -c "
SELECT u.id, u.email, u.created_at, s.status AS sub_status, s.current_period_start, s.current_period_end
FROM users u
LEFT JOIN billing_customers c ON c.external_id = u.id
LEFT JOIN billing_subscriptions s ON s.customer_id = c.id
WHERE c.id = '<billing-customer-id>';"

# 3. Activity log (for "service was used" evidence in contest path).
hops psql --target=prod -c "
SELECT action, resource, created_at
FROM audit_log
WHERE actor_id = '<user-id>'
ORDER BY created_at DESC LIMIT 50;"
```

### Resolution

**Contest** (via MP dashboard):

1. Open MP dashboard → Disputes → select the dispute.
2. Click "Presentar evidencia". Upload: usage logs (export from audit_log), subscription history, any user communications.
3. Submit. MP forwards to the issuing bank. Outcome arrives in 7-30 days.
4. Update the dispute tracking row:

   ```bash
   hops psql --target=prod -c "
   INSERT INTO billing_disputes (id, payment_id, mp_dispute_id, status, contested_at, evidence_summary, created_at)
   VALUES (gen_random_uuid(), '<payment-uuid>', '<mp-dispute-id>', 'contested', now(), '<short-description>', now());"
   ```

**Refund** (concede):

1. Follow §5 refund procedure.
2. ALSO mark the dispute as conceded in our tracking:

   ```bash
   hops psql --target=prod -c "
   INSERT INTO billing_disputes (id, payment_id, mp_dispute_id, status, conceded_at, created_at)
   VALUES (gen_random_uuid(), '<payment-uuid>', '<mp-dispute-id>', 'conceded', now(), now());"
   ```

### Verification

```bash
# Dispute is recorded.
hops psql --target=prod -c "SELECT id, status, contested_at, conceded_at FROM billing_disputes WHERE mp_dispute_id = '<mp-dispute-id>';"

# MP dashboard reflects the same status.
# (verify manually)
```

For contested disputes, set a calendar reminder for 30 days to check the MP dashboard outcome. There is no automated outcome notification in v1.

---

## 7. Manual subscription rescue

Use this when none of the automated paths apply: dunning gave up, the customer wants their account back, MP has confirmed a new payment outside the usual webhook flow, or a refund created an orphan state.

### Symptoms

- Customer report: "I was a paying user and now my account doesn't work".
- DB state: `billing_subscriptions.status` in `cancelled`, `past_due` exhausted, or `incomplete` AND user has paid through MP (confirmed via dashboard).
- Edge: a refund was processed but the subscription wasn't cancelled, and the user is still showing as active.

### Pre-requisites

Before manually mutating a subscription:

1. **Document the reason**. Every manual rescue should leave an audit trail. Note the customer id, sub id, MP transaction id (if applicable), and one-line reason.
2. **Confirm via MP**. Don't take the user's word for "I paid" — check MP dashboard for the underlying transaction.
3. **Pair if possible**. Manual DB mutations on prod are eyes-on-glass; ask a second person to review the query before executing.

### Procedure

#### Case A: reactivate a cancelled sub after manual payment

```bash
# 1. Find the customer's most-recent subscription.
hops psql --target=prod -c "
SELECT id, plan_id, status, current_period_start, current_period_end, cancelled_at
FROM billing_subscriptions
WHERE customer_id = '<billing-customer-id>'
ORDER BY created_at DESC LIMIT 5;"

# 2. Create a fresh active subscription pointing at the same plan. Do NOT
#    update the cancelled one — keep it as historical record.
hops psql --target=prod -c "
INSERT INTO billing_subscriptions (
  id, customer_id, plan_id, billing_interval, interval_count,
  status, current_period_start, current_period_end,
  mp_subscription_id, livemode, metadata, created_at, updated_at
)
VALUES (
  gen_random_uuid(), '<billing-customer-id>', '<plan-id>', 'month', 1,
  'active', now(), now() + interval '1 month',
  '<mp-preapproval-id-if-recurring-else-null>', true,
  '{\"source\":\"manual-rescue\",\"reason\":\"<short-description>\"}'::jsonb,
  now(), now()
);"

# 3. Clear entitlement cache.
hops exec --target=prod api node -e "
require('./dist/middlewares/entitlement').clearEntitlementCache('<billing-customer-id>');"
```

#### Case B: cancel an active sub that should have been cancelled (e.g., post-refund orphan)

```bash
hops psql --target=prod -c "
UPDATE billing_subscriptions
SET status = 'cancelled',
    cancelled_at = now(),
    updated_at = now(),
    metadata = jsonb_set(coalesce(metadata, '{}'), '{cancelReason}', '\"manual-rescue\"')
WHERE id = '<sub-uuid>';"

hops exec --target=prod api node -e "
require('./dist/middlewares/entitlement').clearEntitlementCache('<billing-customer-id>');"
```

#### Case C: fix a sub stuck in `pending_provider` after a recovered MP webhook race

```bash
# Confirm MP shows the preapproval as authorized.
# (manual via MP dashboard → search by mp_subscription_id)

# Then flip our row to active.
hops psql --target=prod -c "
UPDATE billing_subscriptions
SET status = 'active', updated_at = now()
WHERE id = '<sub-uuid>'
AND status = 'pending_provider'
AND mp_subscription_id IS NOT NULL;"
```

### Verification

```bash
# Subscription is in the intended state.
hops psql --target=prod -c "SELECT id, status, current_period_end FROM billing_subscriptions WHERE id = '<sub-uuid>';"

# Customer's entitlements load correctly. Ask them to reload the app, OR:
hops psql --target=prod -c "SELECT count(*) FROM billing_customer_entitlements WHERE customer_id = '<billing-customer-id>';"
```

If the user reports their account still doesn't work after a manual rescue, the entitlement cache may have been re-populated stale before your clear. Wait 5 minutes (TTL) and re-test, or restart the API process to force-clear:

```bash
hops app-restart --target=prod api
```

This is a hammer — every authenticated user pays the cache-miss cost on next request. Only do it when other paths fail.

---

## 8. Engram bug topics to know about

These are documented production gaps. They show up in real incidents — knowing they exist saves debugging time.

| Topic | Surface | Status |
|---|---|---|
| `bug/back-url-orphan-billing-return` | `/billing/return` 404s after MP redirect | open, 3 sub-bugs |
| `bug/refund-flow-gaps` | in-app refund missing 5 paths | open, manual via MP dashboard (§5) |
| `bug/promo-validate-route-shadow` | dead promo validate route on hospeda side | open, hospeda promo is dead code |
| `bug/admin-billing-endpoints-broken` | 3 admin billing endpoints broken | open, restart fallback in prod-smoke rollback |
| `bug/addon-limit-recalc-removebysource-global` | `removeBySource` deletes cross-customer | open, affects addon cancellation paths |
| `bug/qzpay-drizzle-payments-create-loses-provider-ids` | `mp_payment_id` lost on insert | open, hospeda workaround on reconciliation |
| `bug/sponsorship-task-notes-misalignment` | sponsorship flow not implemented | T-143-39 obsolete |
| `bug/customer-override-task-misalignment` | customer override system not implemented | T-143-40 obsolete |
| `bug/tourist-free-fallback-not-applied` | SHIPPED FIX — was no auto-grant of free entitlements | resolved 2026-05-20 (commit 228c2534b) |
| `bug/db-withTransaction-httpexception-wrap` | SHIPPED FIX — HTTPException lost through tx rollback | resolved (commit e44556961) |
| `cancel-spelling-drift` | `cancelled` (hospeda, UK) vs `canceled` (qzpay, US) | open, layer-specific assert convention |

Reference these in PR descriptions when a rescue procedure routes around a known gap so the next responder finds the same context.

---

## 9. Useful queries

Drop-in queries for the most common questions during an incident.

### "Is billing healthy right now?"

```bash
hops health api --target=prod
hops db-counts --target=prod | grep billing_
```

### "How many subs in each state?"

```bash
hops psql --target=prod -c "
SELECT status, count(*)
FROM billing_subscriptions
GROUP BY 1 ORDER BY 2 DESC;"
```

### "Have any webhooks failed in the last hour?"

```bash
hops psql --target=prod -c "
SELECT status, count(*)
FROM billing_webhook_events
WHERE created_at > now() - interval '1 hour'
GROUP BY 1;"
```

### "Has each cron run successfully in its expected window?"

```bash
hops cron-list --target=prod
# Cross-reference against the schedule table in §3.
```

### "Show me the recent payment failures for one customer"

```bash
hops psql --target=prod -c "
SELECT p.id, p.status, p.amount_cents, p.created_at, p.error_message
FROM billing_payments p
JOIN billing_customers c ON c.id = p.customer_id
WHERE c.email = '<email>'
AND p.status IN ('failed', 'pending')
ORDER BY p.created_at DESC LIMIT 20;"
```

---

## 10. When to update this doc

After every billing incident you respond to:

1. If the scenario already exists, refine the steps with what you learned. Replace vague language with the exact command you ended up running.
2. If the scenario is NEW, draft a new section here. Keep the structure: Symptoms → Investigation → Resolution → Verification.
3. If you discover a NEW production bug, file it as an engram entry under `bug/<short-name>` and link it from §8.

Outdated runbooks are worse than missing ones — they waste time during incidents. Edit aggressively.
