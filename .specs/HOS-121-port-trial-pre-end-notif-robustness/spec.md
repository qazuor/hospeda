---
linear: HOS-121
statusSource: linear
title: Port trial-pre-end-notif robustness into notification-schedule, then delete the duplicate cron
created: 2026-07-10
type: refactor
area: [billing, api]
---

# HOS-121 — Port trial-pre-end-notif robustness into notification-schedule

## 1. Summary

Two crons were sending the same `TRIAL_ENDING_REMINDER` email. HOS-115
**soft-disabled** the newer duplicate (`trial-pre-end-notif.job.ts`, cron 1005)
and kept the older canonical sender (`notification-schedule.job.ts`, cron 1002).
But the duplicate carried **two genuine robustness advantages** the canonical
job lacks — disabling it left a temporary resilience gap (not a feature gap).

This follow-up **ports both properties** into `notification-schedule`'s
trial-reminder block, then **deletes** `trial-pre-end-notif.job.ts` and all its
registrations. The two properties turn out to be **coupled** (see §4.3): the
skip-tolerant window is only safe *because* the durable per-variant dedup
prevents the cross-window duplicates that today's exact-day match avoids by
construction.

> All line anchors in this spec were verified against `staging` on 2026-07-10
> (after HOS-114 + AC-7 merged). Re-verify before editing — anchors drift.

## 2. Background

- `notification-schedule.job.ts` (cron **1002**) predates the duplicate by ~3.5
  months (SPEC-064 vs SPEC-126 D5). It is **multi-purpose**: it owns
  `TRIAL_ENDING_REMINDER`, `RENEWAL_REMINDER` (7/3/1 days), and the
  notification-retry pipeline (Redis + DB fallback). It is `enabled: true`.
- `trial-pre-end-notif.job.ts` (cron **1005**, SPEC-126 D5) was a later,
  trial-only re-send of the same `NotificationType.TRIAL_ENDING_REMINDER`,
  causing duplicate emails. HOS-115 flipped it to `enabled: false`
  (`apps/api/src/cron/jobs/trial-pre-end-notif.job.ts:133`, disable rationale at
  `:116-132`) and removed its `schedules.manifest.ts` entry (the manifest now
  carries an explicit "intentionally omitted" note at
  `apps/api/src/cron/schedules.manifest.ts:229-232`). Its bad `upgradeUrl`
  (pointed at the dead `/cuenta/planes` route with `userId: null`) is **not**
  something to port — the canonical job already has the correct
  `buildTrialUpgradeUrl` (HOS-115 §5).

## 3. Current state (verified anchors)

### 3.1 Canonical sender — `notification-schedule.job.ts` (cron 1002, enabled)

- **Exact-day trial match.** It calls `trialService.findTrialsEndingSoon({ daysAhead })`
  twice: once with the configurable `trialReminderDays`
  (`billingSettings.trialExpiryReminderDays`, default 3) at `:240`, and once with
  `1` at `:332`. `findTrialsEndingSoon` (`apps/api/src/services/trial.service.ts:1206`)
  filters with **exact-day equality** — `daysRemaining === daysAhead` (`:1248`),
  with an explicit comment (`:1244-1247`) that the exact match is deliberate: a
  3-day query must NOT also pick up 1-day trials. **Consequence**: if the cron is
  skipped for a day (deploy, outage, pooled-connection hiccup), a trial that was
  exactly N days out that day never gets its reminder — the window has moved on
  by the next run.
- **Weak dedup.** `wasNotificationSent` / `markNotificationSent` (`:105-151`) use
  Redis with a 25h TTL (key `notif:sent:${type}:${customerId}:${YYYY-MM-DD}:d${daysAhead}`,
  `:86-94`), falling back to an **in-memory `Map`** (`sentNotificationsFallback`,
  `:43`) when Redis is unavailable. The in-memory fallback does **not** survive a
  process restart and is per-replica → a restart or a second replica inside the
  same day can re-send a reminder. **This dedup is SHARED with `RENEWAL_REMINDER`**
  (`:483-493`, `:574-577`) — any change here must not regress renewals.

### 3.2 Disabled duplicate — `trial-pre-end-notif.job.ts` (cron 1005, `enabled: false`)

- **Skip-tolerant window.** Queries a **range** `between(now+1d, now+3d)`
  (`:170-171`, `:188`), computes `daysRemaining` rounding **up** (`computeDaysRemaining`,
  `:53-56`), then `selectVariant` (`:66-70`) maps `daysRemaining >= 2 → 'D3'`
  (covers days **2 AND 3**) and `=== 1 → 'D1'`. A missed cron day does not drop
  the D-3 reminder because day-3 and day-2 both resolve to the same variant.
- **Durable per-variant dedup.** Dedups via permanent `billing_subscription_events`
  rows (`:212-226` check, `:275-285` insert), keyed by subscription + event type
  `BILLING_EVENT_TYPES.TRIAL_PRE_END_NOTIF_D3` / `_D1`
  (`packages/service-core/src/services/billing/constants.ts:68,74`). Survives
  process restarts and multi-replica races, and is **per-variant** so the wider
  window cannot double-send.
- Advisory lock **1005** (`:42`, acquired `:162-167`); the canonical job uses lock
  **1002** (`notification-schedule.job.ts:206`).

## 4. The two properties to port

### 4.1 Skip-tolerant window

Replace the trial block's exact-day match with a range/`>=` window so a missed
cron day does not silently drop the primary ("D-3") reminder.

### 4.2 Durable dedup

Back the trial reminders with `billing_subscription_events` rows (durable,
per-variant) instead of the Redis-TTL + in-memory-`Map` mechanism, so a restart
or a second replica cannot re-send.

### 4.3 Why they are coupled (critical)

Today's exact-day match is *how* the canonical job avoids cross-window
duplicates (the 3-day query and the 1-day query never overlap). The moment the
window becomes range-based (`>= 2`), a subscription can match on two consecutive
days — so the wider window is **only safe if** the dedup is durable and
per-variant. Porting the window WITHOUT the durable per-variant dedup would
reintroduce duplicate emails. They must land together.

## 5. Scope

### In scope

1. Port the skip-tolerant window + durable per-variant dedup into
   `notification-schedule.job.ts`'s trial-reminder block (the two `for` loops at
   `:255-327` and `:347-415`), preserving the correct `buildTrialUpgradeUrl`
   nudge (HOS-115).
2. Leave `RENEWAL_REMINDER` behavior and its dedup untouched.
3. Delete `apps/api/src/cron/jobs/trial-pre-end-notif.job.ts` and every
   registration:
   - `apps/api/src/cron/registry.ts:39,68`
   - `apps/api/src/cron/jobs/index.ts:48`
   - the test `apps/api/test/cron/trial-pre-end-notif.test.ts`
   - update/relax the "intentionally omitted" note in
     `apps/api/src/cron/schedules.manifest.ts:229-232` (the reason changes from
     "disabled duplicate" to "removed").
4. Confirm the schedules-manifest sync guard still passes after the delete.

### Out of scope / non-goals

- **NG-1**: Do NOT port `trial-pre-end-notif`'s `upgradeUrl` (`/cuenta/planes`,
  `userId: null`) — it is the dead-route bug HOS-115 already fixed. Keep the
  canonical `buildTrialUpgradeUrl` + `intendedInterval`.
- **NG-2**: Do NOT change `RENEWAL_REMINDER` cadence or dedup.
- **NG-3**: Do NOT change the cron schedule (`0 8 * * *`) or advisory lock 1002.
- **NG-4**: Do NOT delete the `TRIAL_PRE_END_NOTIF_D3/_D1` constants unless the
  port stops using them (see OQ-2) — audit rows already written in prod/staging
  reference those event-type strings.

## 6. Design decisions & open questions

- **OQ-1 — Dedup mechanism split.** The trial block moves to durable
  `billing_subscription_events` dedup, but `RENEWAL_REMINDER` in the same job
  keeps Redis-TTL + in-memory `Map`. Is a two-mechanism job acceptable, or should
  renewals also move to durable dedup (larger blast radius, more testing)?
  **Proposed**: trial block only, renewals untouched (matches the issue's
  "don't regress renewals" caution). Confirm.
- **OQ-2 — Variant model reconciliation.** `notification-schedule` distinguishes
  reminders by `daysAhead` (`trialReminderDays` vs `1`); `trial-pre-end` used
  `D3`/`D1` variants. `trialReminderDays` is **configurable** (could be 3, 5, 7…)
  while the skip-tolerant window in `trial-pre-end` was hard-coded to 2-3 days.
  Decide: does the primary reminder become a `[trialReminderDays-1, trialReminderDays]`
  window (config-aware), and do we reuse the `TRIAL_PRE_END_NOTIF_D3/_D1` event
  types or mint config-aware ones? **Proposed**: primary window =
  `daysRemaining >= trialReminderDays - 1 && <= trialReminderDays` (tolerates one
  skipped day), D1 stays `=== 1`, reuse the existing two event types. Confirm.
- **OQ-3 — Where the window lives.** Make `findTrialsEndingSoon` range-aware
  (adds a `mode`/range param, touches its exact-match comment at `:1244-1247`),
  or fetch all `trialing` subs once in the job and filter there (like
  `trial-pre-end` does)? **Proposed**: filter in the job to avoid changing the
  shared `findTrialsEndingSoon` contract used elsewhere. Confirm.
- **OQ-4 — Redis dedup coexistence.** Once trial dedup is durable, is the Redis
  key still written for trials (belt-and-suspenders), or dropped for trials?
  **Proposed**: drop the Redis/Map dedup for trials (the durable ledger is
  authoritative); keep it for renewals.

## 7. Implementation outline

- **T-01** Resolve OQ-1..OQ-4 (owner/tech-lead sign-off) — blocks the rest.
- **T-02** Introduce durable per-variant dedup in the trial block via
  `billing_subscription_events` (check-then-insert inside the existing
  `withTransaction`), preserving renewals' Redis/Map dedup.
- **T-03** Replace the exact-day trial match with the skip-tolerant window per
  OQ-2/OQ-3, keeping the D1 branch and `buildTrialUpgradeUrl`.
- **T-04** Regression tests (see §8).
- **T-05** Delete `trial-pre-end-notif.job.ts` + `registry.ts:39,68` +
  `jobs/index.ts:48` + `test/cron/trial-pre-end-notif.test.ts`; update
  `schedules.manifest.ts:229-232`.
- **T-06** Run the schedules-manifest sync guard + full API cron test suite.

## 8. Testing

- **Skip-a-day**: a trial exactly 3 days out that missed yesterday's run still
  gets its primary reminder today (would fail against the current exact-day match).
- **Restart no-dup**: sending the primary reminder, "restarting" (clear the
  in-memory `Map` / drop Redis), and re-running does NOT re-send — the durable
  `billing_subscription_events` row blocks it.
- **Cross-window no-dup**: a sub that matches both the primary window and later
  the D1 window gets exactly one email per variant, never two of the same.
- **Renewals unchanged**: `RENEWAL_REMINDER` 7/3/1 cadence + dedup behavior is
  byte-for-byte unaffected (regression guard).
- **Post-delete**: manifest sync guard green; no dangling import/registration of
  `trialPreEndNotifJob`.

## 9. Risks

- **R-1 — Renewal regression.** The dedup helpers are shared; a careless refactor
  could change renewal dedup keys. Mitigation: touch only the trial `for` loops;
  keep `wasNotificationSent`/`markNotificationSent` intact for renewals.
- **R-2 — Double-send during rollout.** If the window widens before the durable
  dedup is in place (partial deploy), duplicates return. Mitigation: land §4.1
  and §4.2 in the same change (they are coupled, §4.3).
- **R-3 — Event-type reuse across prod history.** Reusing `TRIAL_PRE_END_NOTIF_D3/_D1`
  means pre-existing audit rows are treated as "already sent" for matching subs —
  acceptable (idempotent), but note it so it is not read as a bug.
