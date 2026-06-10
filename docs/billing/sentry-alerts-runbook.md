# Sentry alerts + billing health dashboard runbook

> **Audience**: operator (qazuor) — applies the configurations below in the Sentry UI manually. Agent cannot reach Sentry's admin API from the worktree.
> **Scope**: four production alerts + one Discover dashboard, all wired to the existing tag conventions in `apps/api/src/lib/sentry.ts` and `apps/api/src/cron/bootstrap.ts`.
> **Status**: SPEC-143 T-143-47 / T-143-49 / T-143-50 / T-143-51, 2026-05-20.

---

## How this doc maps to SPEC-143 tasks

| Task | Section | Code prerequisite |
| ---- | ------- | ----------------- |
| T-143-47 | §1 (tag conventions, `expected_error:true` filter) | `lib/sentry.ts` `beforeSend` drop (commit `ca5b7f8f`) |
| T-143-49 | §2.1 (failed-payment) + §2.2 (signature) | `lib/sentry.ts` `captureWebhookError` (pre-existing) + `event-handler.ts:262` (pre-existing) |
| T-143-50 | §2.3 (cron generic) + §2.4 (dunning) | `cron/bootstrap.ts` Sentry capture (commit `62cc7ec0`) |
| T-143-51 | §3 (billing health dashboard) | Above + `cron_run_history` table + billing DB |

All four alerts can be created once the two code prerequisites are deployed. The dashboard pulls from the same event stream + a small set of DB queries.

---

## 1. Tag conventions

The API emits Sentry events with stable tags. The alert rules below filter by these tag combinations — they are part of the contract between the code and the runbook.

### Tags used by billing capture sites

| Tag | Set by | Values | Used for |
| --- | ------ | ------ | -------- |
| `module` | `lib/sentry.ts` capture helpers, `cron/bootstrap.ts` | `billing`, `cron`, `media`, … | Top-level scope filter for every billing alert. |
| `event_type` | per-capture-site | `webhook_failure`, `payment_failure`, `trial_expiration`, `cron_failure`, `dunning_failure` | Sub-event discrimination. |
| `webhook_provider` | `captureWebhookError` | `mercadopago` | Provider scope for webhook alerts. |
| `webhook_event` | `captureWebhookError` | MP event name (e.g. `payment.updated`, `subscription_preapproval.updated`, `chargebacks`) | Filters webhook alert by MP event class. |
| `job_name` | `cron/bootstrap.ts` | the cron job name (e.g. `dunning`, `exchange-rate-fetch`) | Filters cron alert by job. |
| `failure_reason` | `capturePaymentFailure` | MP status detail or our own classifier | Used by dashboards to rank failure modes. |
| `plan_id` | `setBillingContext`, `captureBillingError` | UUID of the plan involved | Lets dashboards segment by plan. |
| `billing_cycle` | same | `monthly`, `annual` | Same purpose. |
| `expected_error` | any capture site that wants to drop the event | `'true'` only | **Convention**: when set, the `beforeSend` hook drops the event before it reaches the quota or alert pipeline. Use for domain-expected errors (expired promo, etc.). |

### Why `expected_error` exists (T-143-47)

The original T-143-47 scope was to filter promo / sponsorship / customer-override noise out of the alert stream. Audit at SPEC-143 closure found:

- Promo errors today do **not** reach Sentry — the service layer returns `ServiceResult` with an error code instead of throwing.
- Sponsorship grant/revoke (T-143-39) and customer override apply/expire (T-143-40) are **obsolete**; those features were never implemented in v1.

The `expected_error:true` convention is therefore defensive infrastructure for capture sites that may emerge later. Today it is a no-op for the actual codebase; nothing in the current source sets the tag.

---

## 2. Alert configurations

All four alerts live in the **`hospeda-api` Sentry project** under **Alerts → Create Alert → Issue alert**. Notification target: `#hospeda-ops` Slack channel (production target) — adjust as needed for your team.

### 2.1 Failed payment webhook handler (T-143-49 alert A)

**Purpose**: page when MP payment webhooks land but fail processing on our side. Distinct from a payment being rejected by the user's bank (that's a `payment_failure` event from `capturePaymentFailure`, which is informational and does NOT alert).

**Issue stream filter**:

```
event.type:error
module:billing
event_type:webhook_failure
webhook_event:payment.updated OR webhook_event:authorized_payment
```

**Trigger condition**: an issue is created (existing issue does not re-trigger — Sentry dedupe is fine).

**Threshold**: any 1 event in 5 minutes.

**Notification target**: `#hospeda-ops` Slack + on-call PagerDuty escalation if unacknowledged for 15 min.

**Sentry UI setup** (step-by-step):

1. Sentry → `hospeda-api` project → Alerts → **Create Alert**.
2. **Issue alert**.
3. **When**: "A new issue is created" + "The issue's tags match X" → set tags as the filter block above.
4. **If**: "Number of events in an issue is more than" → 1 in 5 minutes.
5. **Then**: "Send a notification to" → Slack `#hospeda-ops` workspace integration.
6. **Name**: `Billing: failed payment webhook`.
7. **Save**.

**Runbook reference**: `docs/billing/billing-runbooks.md` §1 (failed webhook handler triage).

---

### 2.2 MP signature validation failure (T-143-49 alert B)

**Purpose**: page when MP webhook signature verification fails repeatedly. Two distinct causes: secret rotation (every legitimate MP webhook now 401s, urgent) vs rogue request (single 401 from a testing tool, ignorable).

**Issue stream filter**:

```
event.type:error
module:billing
event_type:webhook_failure
message:"signature*"
```

(The wildcard matches "Webhook signature verification failed" and "x-signature header missing" — both are existing error messages in `event-handler.ts` / `utils.ts`.)

**Trigger condition**: existing issue + frequency-based rule.

**Threshold**: **5 events in 10 minutes**. Single-event rogue requests are ignored; sustained failures (secret rotation) trip the alert.

**Notification target**: `#hospeda-ops` Slack + on-call PagerDuty (cause A is urgent — every paying user's webhook is failing until the secret rotates back).

**Sentry UI setup**:

1. Alerts → **Create Alert** → Issue alert.
2. **When**: "Number of events in an issue is more than" 5 in 10 minutes.
3. **If**: the tag filter above.
4. **Then**: Slack `#hospeda-ops` + PagerDuty integration.
5. **Name**: `Billing: MP signature validation failure (sustained)`.
6. **Save**.

**Runbook reference**: `docs/billing/billing-runbooks.md` §2 (MP signature validation failure) — secret rotation procedure documented there.

---

### 2.3 Generic cron failure (T-143-50 alert A)

**Purpose**: page when ANY billing cron job throws an unhandled error inside the handler. The cron bootstrap (commit `62cc7ec0`) emits Sentry events with `module:cron` + `job_name:<name>`.

**Issue stream filter**:

```
event.type:error
module:cron
event_type:cron_failure
```

(Note: `event_type:cron_failure` excludes the `dunning_failure` events which have their own alert in §2.4. The cron bootstrap sets `event_type=dunning_failure` for the dunning job specifically; everything else gets `cron_failure`.)

**Trigger condition**: any new issue.

**Threshold**: any 1 event in 5 minutes.

**Notification target**: `#hospeda-ops` Slack. PagerDuty only if the failing job is in the "Critical" tier of `billing-runbooks.md` §3 (trial-expiry, addon-expiry, apply-scheduled-plan-changes, exchange-rate-fetch, abandoned-pending-subs, webhook-retry). Non-critical (trial-pre-end-notif) → Slack only.

> Practical implementation: the simplest setup is one alert that sends to Slack always, and a second filtered alert that pages on the critical subset by chaining `job_name:trial-expiry OR job_name:addon-expiry OR …` in a separate rule. Or set up two rules and dedupe at the Slack side via the channel routing.

**Sentry UI setup**:

1. Alerts → **Create Alert** → Issue alert.
2. **When**: "A new issue is created".
3. **If**: the tag filter above.
4. **Then**: Slack `#hospeda-ops`.
5. **Name**: `Billing: cron job failure`.
6. **Save**.

**Runbook reference**: `docs/billing/billing-runbooks.md` §3 (cron failure recovery, general).

---

### 2.4 Dunning cron failure (T-143-50 alert B)

**Purpose**: page when the dunning cron specifically fails. Dunning is financial-correctness-critical — every failed run means past-due subs are not being retried, which delays user reactivation and increases churn.

**Issue stream filter**:

```
event.type:error
module:cron
event_type:dunning_failure
```

(The cron bootstrap special-cases the dunning job and sets `event_type=dunning_failure`. This filter excludes the generic `cron_failure` events from §2.3.)

**Trigger condition**: any new issue OR sustained pattern.

**Threshold**: 1 event in 5 minutes (page) OR 3+ events in 30 minutes (urgent escalation).

**Notification target**: `#hospeda-ops` Slack + on-call PagerDuty. Both tiers — dunning is always urgent.

**Sentry UI setup**:

1. Alerts → **Create Alert** → Issue alert.
2. **When**: "A new issue is created".
3. **If**: the tag filter above.
4. **Then**: Slack `#hospeda-ops` + PagerDuty.
5. **Name**: `Billing: dunning cron failure`.
6. Optional second rule: same tags + frequency "more than 3 in 30 minutes" → escalate to incident channel.
7. **Save**.

**Runbook reference**: `docs/billing/billing-runbooks.md` §4 (dunning cron stuck recovery).

---

## 3. Billing health dashboard (T-143-51)

A single Discover-based dashboard pinned to the `hospeda-api` project + a couple of saved DB queries from `hops psql` for the metrics that Sentry does not directly track (active subs, MRR, cron last-run timestamps).

### 3.1 Recommended layout

| Row | Widget | Source | Refresh |
| --- | ------ | ------ | ------- |
| 1 | Active subscriptions (gauge) | DB query, `hops psql --target=prod` | manual |
| 1 | MRR (gauge) | DB query | manual |
| 2 | Webhook error rate (24h) (line chart) | Sentry Discover | live |
| 2 | Signature failures (24h) (count) | Sentry Discover | live |
| 3 | Cron last-run timestamps (table) | DB query (`cron_run_history`) | manual |
| 3 | Top failure reasons (24h) (bar) | Sentry Discover, grouped by `failure_reason` tag | live |

The split between live (Sentry) and manual (DB) is intentional: Sentry doesn't have visibility into the canonical billing DB. The dashboard owner refreshes the DB widgets daily during morning standup, or scripts them via `hops` if the cadence justifies the tooling investment.

### 3.2 Sentry Discover queries

#### Webhook error rate (24h)

Visualization: line chart, 1-hour buckets, grouped by `webhook_event`.

```
query:
event.type:error module:billing event_type:webhook_failure
y-axis: count()
x-axis: time (1h buckets)
group by: webhook_event
date range: -24h
```

Save as **"Billing: webhook error rate (24h)"** in Discover, then add to the dashboard.

#### Signature failures (24h)

Visualization: big number widget.

```
query:
event.type:error module:billing event_type:webhook_failure message:"signature*"
y-axis: count()
date range: -24h
```

Save as **"Billing: signature failures (24h)"**.

#### Top failure reasons (24h)

Visualization: bar chart.

```
query:
event.type:error module:billing event_type:payment_failure
y-axis: count()
group by: failure_reason
limit: 10
date range: -24h
```

Save as **"Billing: top payment failure reasons (24h)"**.

### 3.3 DB-backed widgets

These are `hops psql --target=prod` queries the operator runs manually (or scripts into a daily refresh). They produce numbers that go into the dashboard's text/gauge widgets via Sentry Discover's "Add custom widget → Text" surface — Sentry doesn't query Postgres directly.

#### Active subscriptions

```sql
SELECT count(*) AS active_subs
FROM billing_subscriptions
WHERE status IN ('active', 'trialing')
  AND deleted_at IS NULL;
```

Display: gauge, target threshold = "N/A — informational".

#### MRR (active monthly + annual normalized)

```sql
SELECT
  sum(
    CASE
      WHEN billing_interval = 'month' THEN p.unit_amount
      WHEN billing_interval = 'year' THEN p.unit_amount / 12
      ELSE 0
    END
  ) / 100.0 AS mrr_ars
FROM billing_subscriptions s
JOIN billing_prices p ON p.id = s.price_id
WHERE s.status IN ('active', 'trialing')
  AND s.deleted_at IS NULL;
```

Display: gauge, ARS units.

#### Cron last-run timestamps

```sql
SELECT
  job_name,
  max(started_at) AS last_started,
  max(started_at) FILTER (WHERE status = 'success') AS last_success,
  max(started_at) FILTER (WHERE status = 'failed') AS last_failure
FROM cron_run_history
GROUP BY job_name
ORDER BY job_name;
```

Display: table widget. Highlight rows where `last_success` is older than the job's schedule interval (e.g., dunning every 30 min → red if `last_success < now() - interval '1 hour'`).

### 3.4 Setup steps

1. Sentry → `hospeda-api` project → **Dashboards** → **Create Dashboard**.
2. Name: `Billing health`.
3. **Add Widget** → Discover → paste each query from §3.2. Repeat for the 3 Sentry widgets.
4. **Add Widget** → Text → paste a placeholder for each DB widget with the SQL inline. The operator manually refreshes by running `hops psql` and updating the text.
5. **Save Dashboard**.
6. Pin to the team's default dashboard list.

If the manual-refresh ergonomics turn out poorly, future SPEC follow-up: wire a `hops dashboard-export` script that posts the DB numbers to a Slack thread daily.

---

## 4. Operator quick-start checklist

For the operator who applies all four alerts + the dashboard in one sitting:

- [ ] **Code preconditions deployed**: commits `62cc7ec0` (cron Sentry capture) and `ca5b7f8f` (expected_error filter) are live on `hospeda-api-prod`. Check the prod commit hash via `hops version --target=prod api` (or Coolify).
- [ ] **Slack integration configured**: the `hospeda-api` Sentry project has the Slack workspace integration installed and the `#hospeda-ops` channel approved.
- [ ] **PagerDuty integration configured** (only for the two urgent alerts in §2.2 + §2.4): the project has a PagerDuty service connected.
- [ ] **Alert 1 created** (§2.1 failed-payment webhook).
- [ ] **Alert 2 created** (§2.2 MP signature validation).
- [ ] **Alert 3 created** (§2.3 cron generic).
- [ ] **Alert 4 created** (§2.4 dunning specific).
- [ ] **Dashboard created** (§3) — 3 Sentry widgets + 3 DB text widgets.
- [ ] **Smoke test**: trigger one synthetic alert per rule to confirm Slack/PagerDuty receive it. For cron: temporarily push a `Sentry.captureException(new Error('test'), { tags: { module: 'cron', event_type: 'cron_failure', job_name: 'smoke-test' } })` from `hops exec` and confirm the alert fires + Slack notification arrives.
- [ ] **Document the smoke** in this file's "Changelog" below: date, who, what.

---

## 5. Cross-references

- [`docs/billing/billing-runbooks.md`](./billing-runbooks.md) — operational runbooks the alerts link to.
- [`apps/api/src/lib/sentry.ts`](../../apps/api/src/lib/sentry.ts) — capture helpers + beforeSend filter.
- [`apps/api/src/cron/bootstrap.ts`](../../apps/api/src/cron/bootstrap.ts) — cron handler Sentry capture.
- [`docs/billing/coverage-audit-2026.md`](./coverage-audit-2026.md) — coverage gaps that justify the cron alerts (3 unit-only crons).
- Engram topic `bug/no-sentry-on-start-paid-mp-errors` — known gap, refactor tracked in SPEC-149. Until SPEC-149 ships, start-paid errors do NOT reach Sentry and the §2.1 alert under-reports.
- Engram topic `bug/no-retry-policy-on-mp-errors` — same refactor in SPEC-149.

---

## 6. Changelog

- 2026-05-20: Initial runbook drafted (SPEC-143 T-143-47/49/50/51 bundle).
- _Smoke-test entry to be added by operator when alerts are first applied in prod._
