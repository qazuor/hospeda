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
parent: SPEC-193
---

# SPEC-148: Billing defensive grace + plan lifecycle

## Coordination (SPEC-193)

As a child of SPEC-193 "Billing Go-Live Readiness — Master", this spec coordinates as follows:

- **Cron-lag grace + active→past_due transition**: the cron-lag grace window (Part A) operates on subscriptions still in `active` status whose `currentPeriodEnd` has passed. The existing `pastDueGraceMiddleware` (`apps/api/src/middlewares/past-due-grace.middleware.ts`) handles the `active→past_due` transition grace — these are two distinct, non-overlapping mechanisms. SPEC-148 does not modify `pastDueGraceMiddleware`.
- **INV-4 (state-machine)**: all state transitions triggered by this spec (e.g., flipping a disabled plan's existing subs to cancel-at-period-end, or advancing a cron-lag-exceeded sub to `past_due`) must use the canonical state-machine defined by SPEC-194. Do not implement ad-hoc status flips.
- **Sentry alerting for grace exceedance**: the Sentry alert that fires when the cron-lag grace window is exceeded is wired in SPEC-149 (which owns all billing Sentry capture). SPEC-148 only defines the condition and constant (`BILLING_CRON_LAG_GRACE_HOURS`); it calls into a hook that SPEC-149 implements.

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

**Resolved (owner 2026-06-09)**:

- **Block vs pass-through → PASS-THROUGH + Sentry alert.** Within the window: pass silently (benign webhook jitter). Past the window: STILL grant access (never cut off a paying user for OUR infra failure — renewals are webhook-driven, so the lag is an MP webhook-delivery failure, realign finding 3) but fire a Sentry alert (customerId + subscriptionId + hours overdue). NEVER block with 503.
- **Grace state → derived per-request** from `currentPeriodEnd` (mirror `pastDueGraceMiddleware`'s stateless approach — no DB column). ⚠️ Realign caveat: the entitlement middleware has a 5-min `entitlementCache` that skips `loadEntitlements()` on hits — the cron-lag detection + `X-Cron-Lag-Grace-Hours-Remaining` header + Sentry alert would be absent on cached requests (alert delayed ≤5 min). Acceptable for the alert; design the check to read `currentPeriodEnd` at a point not gated by the entitlement cache, OR accept the ≤5-min delay (document it).
- **Interaction with `past_due` flip**: stateless → when the webhook lands and advances the period (or flips to past_due), the derived condition simply stops matching. No grace state to clear.

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

**Resolved (owner 2026-06-09)**:

- **Migration policy → AUTO-CANCEL at period end** (reuses SPEC-147 infra). On plan disable: set `cancelAtPeriodEnd=true` on all active subs of that plan; the already-shipped `finalize-cancelled-subs` cron closes them at `currentPeriodEnd` (revokes addons, clears cache, audit event). Subs keep access until period end + receive a "plan being retired" notice. NOT auto-migrate (opinionated, surprises users, needs new plan-selection + price-delta logic) and NOT notify-only (leaves an ambiguous state if the user doesn't act).
- **New-signup grace window → NONE** (immediate rejection). `start-paid` rejects with 410 `PLAN_DISABLED` as soon as the plan is inactive. The public `listPlans` already filters `active:true` so the plan is hidden from the catalog at the same moment; no 24h window needed.
- **Idempotency**: the toggle is a boolean DB flip (idempotent). The fan-out to existing subs queries `subs WHERE planId=X AND status active-ish AND cancelAtPeriodEnd=false` → re-running on an already-disabled plan is a no-op (no rows match). The audit event dedups per (plan, transition).

### Realign findings (2026-06-09, vs 2026-05-20 spec)

1. **No renewal cron exists** — renewals are 100% MP-webhook-driven (`processSubscriptionUpdated` in `webhooks/mercadopago/subscription-logic.ts`; `subscription-poll.job.ts` is the missed-webhook fallback but only polls checkout-time jobs). Part A's "cron-lag" is really **webhook-delivery lag**. Detection hook: `entitlement.ts:391-403` (today silently passes an active sub with past `currentPeriodEnd`).
2. **SPEC-147 reuse**: `cancelAtPeriodEnd` + `finalize-cancelled-subs` cron makes Part B auto-cancel ~incremental (set the flag + notify; the cron already does the rest incl. M2 past_due/trialing coverage). No new finalize logic.
3. **Plan toggle EXISTS** (`admin/plans.ts` PATCH `adminTogglePlanActiveRoute` → `planService.toggleActive`, behind `BILLING_MANAGE`; admin UI `billing-plans/`) but has ZERO downstream side effects — that's the whole Part B gap.
4. **start-paid has NO isActive check** (only the SPEC-147 soft-cancel guard at :248-261). `listPlans` public DOES filter `active:true`.
5. **No 410 ServiceErrorCode** — `PLAN_DISABLED` must be added to `@repo/schemas` ServiceErrorCode + mapped to 410 in BOTH `middlewares/response.ts` ERROR_CODE_TO_HTTP and `utils/response-helpers.ts` (SPEC-149 dual-map lesson).
6. **Audit**: reuse `billing_subscription_events` inline `db.insert` + new `BILLING_EVENT_TYPES` (`PLAN_DISABLED_MIGRATION` / similar) — no new table.
7. **Sentry**: `captureBillingError` (sentry.ts) is sufficient for the grace-exceedance alert — no new SPEC-149 work.
8. **State-machine**: `active→past_due` etc. valid; Part A is stateless (no transition); Part B fan-out sets a flag (cancelAtPeriodEnd), the finalize cron does the validated `→cancelled` transition.
9. **`apply-scheduled-plan-changes.ts` already anticipates SPEC-148** (PlanCatalogMissError comment) — decide: a disabled plan STAYS in the static billing catalog (so restriction/excess lookups still resolve) — only `isActive=false` gates new signups + triggers the fan-out. Do NOT remove it from the catalog.

## Revision History

| Date | Trigger | Changes | Result |
|------|---------|---------|--------|
| 2026-06-09 | spec-realign + owner decisions | Part A: pass-through + Sentry (never 503), stateless derived grace, BILLING_CRON_LAG_GRACE_HOURS; Part B: auto-cancel-at-period-end (reuse SPEC-147 finalize), immediate signup rejection (410 PLAN_DISABLED), idempotent fan-out; documented 9 drift findings (no renewal cron → webhook lag, SPEC-147 reuse, existing toggle has no side effects, 410 code needed, audit reuse, catalog-stays). | spec ready for atomization |

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
