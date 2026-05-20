---
specId: SPEC-148
title: Billing defensive grace + plan lifecycle (cron-lag grace + plan disable)
type: feat
status: draft
complexity: medium
created: 2026-05-20T00:00:00Z
discoveredDuring: SPEC-143 T-143-63 reframe
tags: [billing, subscription, grace-period, plan-lifecycle, cron, infra-safety, admin]
effortEstimateHours: "12-24"
depends_on: [SPEC-143]
blocks: []
priority: medium
firstAllocatedViaEngramProtocol: true
---

# SPEC-148: Billing defensive grace + plan lifecycle

## Context

SPEC-143 T-143-63 was scoped to test two billing safety mechanisms:

1. **Cron-lag defensive grace** — "Subscription reaches `current_period_end` and renewal cron has not fired yet → entitlements remain active within N-hour grace window + Sentry alert if grace exceeded."
2. **Plan disable lifecycle** — "Admin disables a plan while customer subscriptions are active → existing subs keep entitlements until cycle end, no new signups on that plan, existing renewals follow migration policy."

During the reframe of T-143-63 (2026-05-20), code grep against `apps/api/src/middlewares/`, `packages/billing/`, and `packages/service-core/` confirmed that **neither mechanism is implemented**. What IS implemented is `pastDueGraceMiddleware` (`apps/api/src/middlewares/past-due-grace.middleware.ts`), which gates `status='past_due'` subs through a 3-day grace window — a different concept altogether.

The two original scopes are real production-safety gaps and warrant a dedicated implementation spec. T-143-63 has been reframed to test the existing past_due grace mechanism. The work captured in this spec is deferred and tracked here.

## Goals

1. Provide a defensive grace window when our renewal cron is late, so an active customer is not blocked by our infra failure.
2. Provide a clean lifecycle for admin-disabled plans: existing subscribers stay covered until the end of their current cycle, no new signups land on the disabled plan, and renewals follow a documented migration policy.
3. Wire observability (Sentry alerts) for grace exceedance and plan-disable migration events.

## Non-Goals

- Re-implementing past_due grace (already shipped in `pastDueGraceMiddleware`).
- Plan-migration matrix coverage (tracked separately in SPEC-143 T-143-61 / a future spec).
- Multi-currency selection (tracked separately in SPEC-143 T-143-62 / a future spec).
- Refund flow gaps (tracked in `bug/refund-flow-gaps` engram pin).

## Scope

### Part A — Cron-lag defensive grace

**Problem**: If the renewal cron is late or fails to run, a subscription with `currentPeriodEnd` in the past but `status='active'` is technically expired but not yet flipped to `past_due`. Today, the entitlement middleware passes such a request through silently. There is no signal that something is wrong.

**Proposed mechanism**:

- New middleware (or extension of `entitlementMiddleware`) detects `now > currentPeriodEnd && status='active'`.
- If `now - currentPeriodEnd <= GRACE_CRON_LAG_HOURS`: allow request, attach `X-Cron-Lag-Grace-Hours-Remaining` header, log warn.
- If `now - currentPeriodEnd > GRACE_CRON_LAG_HOURS`: open question — block with 503 (infra problem, retry later) OR allow + fire Sentry alert. Decision deferred to design phase.
- New constant `BILLING_CRON_LAG_GRACE_HOURS` in `@repo/billing` (suggested default: 6 hours, to absorb cron jitter without masking outages).
- Sentry alert: fires when grace window is exceeded for any subscription, with customer id + subscription id + hours overdue.

**Open questions for design phase**:

- Should cron-lag grace block (503) or pass through after window? Tradeoff: blocking punishes user for our infra; passing through silently hides outages.
- How does this interact with `past_due` flip? (e.g., MP webhook lands during grace window — must atomically advance period and clear grace state).
- Should grace state be persisted, or derived per-request from `currentPeriodEnd`?

### Part B — Plan disable lifecycle

**Problem**: Admins can flag a plan as inactive (current `billing_plans.active` field or equivalent). Today there is no documented enforcement of what happens to:

- Existing active subscriptions on that plan.
- New checkout attempts referencing the plan slug.
- The next renewal cron cycle for those subs.

**Proposed mechanism**:

- **Existing subs**: keep entitlements until `currentPeriodEnd`. On renewal, do NOT renew on the disabled plan. Follow documented migration policy (e.g. auto-migrate to the cheapest active tier of same family, OR cancel-at-period-end with notice email). Migration policy choice deferred to design phase.
- **New signups**: `start-paid` endpoint rejects with 410 `PLAN_DISABLED` if the plan is inactive at checkout time.
- **Existing subs UI**: surface a "your plan is being retired" banner with migration target + effective date.
- **Admin audit**: every plan-disable event captured in `billingNotificationLog` (or new `billing_plan_lifecycle_events` table) with admin actor, timestamp, affected sub count, migration policy applied.

**Open questions for design phase**:

- Migration policy: auto-migrate vs auto-cancel vs notify-only.
- Grace window for new signups (e.g., 24h between disable signal and rejection, to allow in-flight checkouts to complete)?
- Idempotency of the disable event (admin clicks twice).

## Acceptance criteria

1. Cron-lag grace middleware allows access within `BILLING_CRON_LAG_GRACE_HOURS` past `currentPeriodEnd` for `status='active'` subs.
2. Cron-lag grace middleware exceeded → Sentry alert fires with customer id + subscription id + hours overdue.
3. Cron-lag grace decision (block vs pass through after window) is documented and implemented.
4. Plan disable rejects new signups with 410 `PLAN_DISABLED`.
5. Plan disable preserves existing sub entitlements until `currentPeriodEnd`.
6. Plan disable migration policy is documented and exercised (auto-migrate OR auto-cancel-at-period-end OR notify-only — to be decided in design).
7. Plan-disable audit event recorded for every disable transition.
8. e2e tests cover all happy paths and at least one failure mode per part.
9. Runbook updates in `docs/billing/billing-runbooks.md` covering "cron-lag grace activation" and "plan disabled lifecycle" incident scenarios.

## Implementation strategy (draft)

Defer to design phase. High-level sequencing:

1. Design phase: lock open questions (block vs pass for cron-lag, migration policy for plan disable).
2. Add `BILLING_CRON_LAG_GRACE_HOURS` to `@repo/billing` config.
3. New middleware `cron-lag-grace.middleware.ts` (or extension of entitlement middleware).
4. New service layer for plan-disable enforcement.
5. Sentry alert configuration (likely as part of SPEC-143 T-143-47/49/50 if those land first).
6. e2e tests for both parts.
7. Runbook updates.

## Risks

- **Cron-lag grace masking outages**: if pass-through is chosen, the alert is the only signal; alert noise must be tuned (per-sub alert is too noisy at scale).
- **Plan-disable cascading effects**: existing renewals may already be in-flight when disable lands — race condition possible.
- **Migration policy ambiguity**: auto-migrate is opinionated and may surprise users; auto-cancel is harsh; notify-only requires user action and may lapse silently.

## Cross-references

- `[[spec/spec-148/scope-deferred-from-spec-143]]` — engram deferral note.
- SPEC-143 `T-143-63` — reframed to test past_due grace only.
- `apps/api/src/middlewares/past-due-grace.middleware.ts` — existing past_due grace (separate mechanism).
- `[[bug/refund-flow-gaps]]` — adjacent billing safety gap (pinned).
- SPEC-143 docs: `docs/billing/billing-runbooks.md`, `docs/billing/grace-period-source-of-truth.md`.

## Status

`draft`. Design phase not started. To be picked up after SPEC-143 closes.
