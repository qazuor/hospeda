---
title: conversation-notification cron — move email dispatch outside the lock-holding transaction
linear: HOS-112
statusSource: linear
created: 2026-07-10
type: fix
areas:
  - api
---

# conversation-notification cron — move email dispatch outside the lock-holding transaction

## 1. Summary

Restructure `apps/api/src/cron/jobs/conversation-notification.job.ts` so that the
external email dispatch (`sendEmail`, an unbounded HTTP call to Brevo, run
sequentially for up to `MAX_BATCH_SIZE = 100` schedules) no longer executes
**inside** the single Postgres transaction that holds advisory lock `43020` and
a pooled DB connection. Move the batch to a two-phase shape — remote sends first,
short DB-write transaction second — mirroring the already-shipped fix in
`destination-weather-fetch.job.ts`, while strengthening the Redis idempotency
guard into an atomic claim so removing the whole-run serialization the advisory
lock currently provides does not introduce double-sends.

This is a scalability / correctness hardening, not a user-visible feature.

## 2. Problem

Today the entire job body runs inside one `withTransaction` callback
(`conversation-notification.job.ts:169-459`):

```
withTransaction(tx => {
  pg_try_advisory_xact_lock(43020)          // first statement
  findDue()                                  // DB read
  for (schedule of dueSchedules[0..100]) {   // sequential
    isAlreadyDispatched(scheduleId)          // Redis EXISTS
    ...DB reads (conversation, accommodation, messages, users)...
    await sendEmail(...)                      // ⚠ external HTTP, NO timeout
    markDispatched(scheduleId)               // Redis SET EX (no NX)
    advanceSchedule(...)                      // DB write
  }
})
```

Consequences:

- The advisory lock (transaction-scoped, auto-released on commit) plus a pooled
  DB connection are held open across **N sequential external HTTP calls**. Under
  email volume or a slow/unresponsive provider, a run can exceed the 5-minute
  cron cadence. The next tick then finds the lock held and logs the recurring
  `[CRON:conversation-notification] skipping — previous run holds advisory lock`
  WARN, and notifications fall behind.
- `sendEmail` has **no timeout** (`packages/email/src/send.ts:137` — raw `fetch`
  to `https://api.brevo.com/v3`, no `AbortSignal`). This is exactly the failure
  shape that already tripped `idle_in_transaction_session_timeout` (30s) in
  production for the weather job and crashed the process.
- It violates the established project rule
  (`packages/service-core/CLAUDE.md:969`): *"External API calls … MUST stay
  OUTSIDE the callback — they are not rollback-able. The established pattern is:
  external call first, then `withServiceTransaction` to persist the results."*

Root of the recurring WARN is **not** a lock leak — `pg_try_advisory_xact_lock`
is transaction-scoped and cannot leak across runs. The WARN is the lock working
as designed; the batch simply takes too long because it does I/O under the lock.

Reference: HOS-109 T-008 (spec/HOS-109-api-log-triage) log-triage findings.

## 3. Goals

- **G-1** — Email dispatch (`sendEmail`) executes with **no DB transaction open
  and no advisory lock held**.
- **G-2** — No double-send and no lost streak advance under concurrent/overlapping
  runs, verified by tests (Redis idempotency + streak-advance ordering).
- **G-3** — The recurring `skipping — previous run holds advisory lock` WARN stops
  being driven by batch/email duration (a run's lock-holding time becomes bounded
  by DB work only, independent of provider latency).
- **G-4** — Behavior stays functionally equivalent for the happy path: each due
  schedule still gets exactly one email and one streak advance (or cancellation
  at streak 3) per run, same 24h/72h cadence.

## 4. Non-goals

- **NG-1** — Not redesigning the notification/streak product logic
  (`advanceSchedule`, `MAX_STREAK = 3`, 24h/72h timings stay as-is).
- **NG-2** — Not adding a real distributed job queue / worker pool. This stays a
  cron job; the fix is a transaction-boundary + idempotency restructuring.
- **NG-3** — Not fixing the sibling `conversation-token-reminder.job.ts`
  anti-pattern in this spec (tracked separately — see OQ-4).
- **NG-4** — Not migrating away from the advisory-lock convention wholesale; ADR-019
  (transaction-scoped locks only, no session-scoped) still governs.

## 5. Current baseline

Key files and facts (verified 2026-07-10):

- **Job**: `apps/api/src/cron/jobs/conversation-notification.job.ts`
  - `ADVISORY_LOCK_ID = 43020` (line 52), `MAX_BATCH_SIZE = 100` (line 61),
    schedule `*/5 * * * *`, `timeoutMs = 120000`.
  - One `withTransaction` wraps lock + `findDue` + the whole per-schedule loop
    including `sendEmail` (lines 169–459).
  - Per-schedule ordering: Redis `isAlreadyDispatched` → DB reads → build
    template → `sendEmail` → on failure `continue` (no streak advance) → on
    success `markDispatched` (Redis) → `advanceSchedule` (DB).
- **Transaction helper**: `packages/db/src/client.ts:168-207` — `withTransaction`
  is a thin Drizzle `db.transaction` wrapper; it does **not** acquire the lock or
  set a statement timeout. The advisory lock is always issued by the caller as the
  first `sql` statement inside its own callback (repo-wide convention).
- **Email**: `packages/email/src/send.ts` — `sendEmail` renders a React Email
  template then `fetch`es Brevo's REST API. Never throws (returns
  `{ success: false, error }`). **No timeout / AbortSignal.**
- **Redis guard**: `apps/api/src/utils/redis.ts` + job.ts:93-127.
  - Key `conv:notif:{scheduleId}`, TTL 600s.
  - `isAlreadyDispatched` = `redis.exists(key) === 1`; fail-open on Redis error.
  - `markDispatched` = `redis.set(key, '1', 'EX', 600)` — **plain SET, no NX**;
    check and set are two separate round trips → not an atomic claim. Today the
    advisory lock (serializing whole runs) is what actually prevents double-send,
    not this guard.
  - `getRedisClient()` returns `undefined` if `HOSPEDA_REDIS_URL` unset / connect
    fails → both helpers fail open (job proceeds with dispatch).
- **Streak advance**: `packages/service-core/src/services/conversation/notification-schedule.service.ts:349-410`
  (`advanceSchedule`), table `conversation_notification_schedules`. Trusts the
  caller-supplied `currentStreakCount` (captured before the send); not re-verified
  against the row under a lock, so a double-run double-advances / cancels early,
  and a skipped run under-advances silently. `MAX_STREAK = 3`; cancels via
  `cancelledAt` at streak 3.
- **"Due" query**: `packages/db/src/models/conversation/conversationNotificationSchedule.model.ts:51-75`
  (`findDue`) — `pending_notification_at <= now AND cancelled_at IS NULL`, no
  `LIMIT` / `ORDER BY` / `FOR UPDATE SKIP LOCKED`; the 100-cap is a JS `.slice`.
- **Tests**: `apps/api/test/cron/conversation-notification.job.test.ts` mocks
  `withTransaction` as a passthrough and asserts only config, skip-on-lock,
  dry-run, empty-due, findDue-error, and unhandled-exception paths. **No test
  pins Redis-guard semantics, ordering, or the transaction boundary.** The
  restructuring has no regression tests to break — and none to reuse.
- **Precedent to mirror**: `apps/api/src/cron/jobs/destination-weather-fetch.job.ts`
  — its doc-comment (lines 14–54) is a post-mortem of this identical anti-pattern.
  Two-phase: Phase 1 `fetcher.fetchAll()` (HTTP, no tx); Phase 2
  `withTransaction` with `pg_try_advisory_xact_lock(43031)` as first statement,
  then only DB persistence, no I/O inside. It documents the accepted trade-off:
  the lock now guards only the write phase, so two overlapping runs both fetch and
  only one persists.
- **Stale registry**: `packages/db/docs/advisory-locks.md:20` lists lock `43020`
  against `conversation-notification-dispatch.job.ts`, a filename that no longer
  exists (actual: `conversation-notification.job.ts`). Needs correcting.

## 6. Proposed design

Adopt the `destination-weather-fetch.job.ts` two-phase shape, adapted for the fact
that **email is user-visible** (a double-send is a real defect, not just wasted
work), which the weather job did not have to worry about.

### Phase 0 — read due schedules (no lock, read-only)

Read the due batch (`findDue`, capped at `MAX_BATCH_SIZE`) and all per-schedule
read data (conversation, accommodation, recent messages, users) **outside any
write transaction / advisory lock**. Reads do not need the lock. (Reads may run in
their own short read transaction/connection or via the normal model reads; they
must not keep a connection open across the sends.)

### Phase 1 — dispatch emails (no lock, no open transaction)

For each due schedule, sequentially:

1. **Atomic claim** in Redis: `SET conv:notif:{scheduleId} 1 NX EX 600` (an atomic
   `SET … NX EX`, replacing the non-atomic `exists` + `set`). If the claim is **not**
   acquired (key already exists) → another run/tick already owns this schedule →
   skip. This is the mechanism that now prevents double-send in place of the
   whole-run advisory lock.
2. If claimed → `await sendEmail(...)` (the external HTTP call — now with no DB
   transaction open and no advisory lock held).
3. On send **failure** → **release the claim** (`DEL conv:notif:{scheduleId}`) so
   the schedule is retried on the next tick, and do **not** enqueue a streak
   advance. (Today failure just `continue`s; the claim would otherwise suppress the
   retry for 10 minutes.)
4. On send **success** → record the schedule (+ its captured `streakCount`) in an
   in-memory "to advance" list for Phase 2.

### Phase 2 — persist streak advances (short transaction, lock as first statement)

Open one short `withTransaction` whose **first statement** is
`pg_try_advisory_xact_lock(43020)` (unchanged lock id). Inside it, only DB writes:
for each successfully-sent schedule, `advanceSchedule(...)` (streak++ / cancel at
3). No I/O. The lock now serializes only the write phase; its hold time is bounded
by DB work, independent of provider latency (G-3).

### Delivery-semantics decision (the crux)

Moving the send out from under the whole-run lock changes what prevents
double-sends. Two sub-decisions, both flagged as Open Questions:

- **Idempotency claim placement** (OQ-1): claim `SET NX` **before** the send makes
  the flow *at-most-once per 10-min window* — a crash between claim and a
  successful send loses that notification until `pending_notification_at`
  re-qualifies AND the 10-min TTL expires. Claiming **after** a successful send
  keeps *at-least-once* (a crash between send and mark re-sends next tick =
  duplicate). The current code is effectively at-least-once. Recommendation:
  **claim before send but DEL on failure** (step 3), which restores retry-on-failure
  while closing the concurrent double-send window; accept the rare
  crash-mid-send lost-notification as the documented trade-off (same class of
  trade-off the weather job accepted). Owner should confirm at-most-once vs
  at-least-once is acceptable for this notification.
- **Role of the advisory lock after the change** (OQ-2): with a correct atomic
  Redis claim serializing per-schedule sends, the Phase-2 advisory lock is
  largely redundant for correctness (each run only advances schedules it uniquely
  claimed). Recommendation: **keep it** for Phase 2 anyway (cheap, matches the
  weather-job precedent, guards against a Redis-outage fail-open storm double-writing
  streaks). Document that Redis-claim is now primary and the lock is defense-in-depth.

### Redis-unavailable behavior

Both guard helpers fail open today. With the claim now load-bearing for
double-send prevention, a Redis outage means the claim can't serialize → risk of
duplicate sends across ticks. The Phase-2 advisory lock still prevents concurrent
*runs* from overlapping (a run holding the lock blocks the next tick), so the
practical exposure is limited to the single-run batch. Recommendation: keep
fail-open (a notification going out twice is less bad than not going out), but log
a WARN when the claim path runs without Redis so the degradation is visible.

## 7. Data model / contracts

- **No schema changes.** `conversation_notification_schedules` is unchanged;
  `advanceSchedule` signature is unchanged.
- **No new env vars.** Optionally (OQ-5) add an email-send timeout; if pursued as a
  send-level `AbortSignal` it needs no env var, or a configurable
  `HOSPEDA_EMAIL_TIMEOUT_MS` if made tunable (would then follow the full env-var
  registration workflow).
- **Redis contract change** (behavioral, not schema): `markDispatched` becomes an
  atomic `SET … NX EX` returning whether the claim was acquired; add a
  `releaseClaim`/`DEL` helper for the failure path. Key/TTL unchanged
  (`conv:notif:{scheduleId}`, 600s).

## 8. UX / UI behavior

None. Server-side cron only. The only externally observable change is the
*absence* of the recurring lock-skip WARN under load and timelier notifications;
the emails themselves are unchanged.

## 9. Acceptance criteria

- **AC-1** — In the restructured job, `sendEmail` is provably called with no open
  DB transaction and no advisory lock held (test asserts the boundary, not a
  passthrough mock).
- **AC-2** — The Redis idempotency guard is an atomic `SET … NX EX` claim; a second
  concurrent claim for the same `scheduleId` is rejected (test).
- **AC-3** — On send failure, the claim is released and no streak advance is
  enqueued; the schedule is eligible again next tick (test).
- **AC-4** — On send success, exactly one `advanceSchedule` runs in the Phase-2
  transaction; streak is not advanced for failed sends (test).
- **AC-5** — The advisory lock (`43020`) is acquired as the first statement of the
  Phase-2 transaction only, and the transaction contains no external HTTP call
  (test / code review).
- **AC-6** — Overlapping-run simulation: two runs over the same due set produce at
  most one email per schedule and at most one streak advance per schedule (test).
- **AC-7** — Existing behavior preserved: skip-on-lock, dry-run (no sends, no
  writes), empty-due, and error paths still pass.
- **AC-8** — `packages/db/docs/advisory-locks.md` entry for `43020` corrected to
  the real filename.

## 10. Risks

- **R-1** — *Double-send window.* Any restructuring that removes whole-run lock
  serialization risks duplicate emails if the Redis claim isn't truly atomic or
  Redis is down. Mitigation: atomic `SET NX`, keep Phase-2 lock, fail-open logging.
- **R-2** — *Lost notification.* Claim-before-send makes a crash-mid-send lose that
  notification for up to the TTL window. Mitigation: DEL-on-failure covers the
  common (provider-error) case; only a hard process crash between claim and
  send-return is exposed. Must be owner-accepted (OQ-1).
- **R-3** — *Streak double-advance / under-advance.* `advanceSchedule` trusts a
  pre-captured `currentStreakCount`. If Phase 2 re-runs for an already-advanced
  schedule (e.g. partial Phase-2 failure), it double-advances. Mitigation: only
  enqueue advances for schedules claimed+sent this run; consider re-reading the row
  inside Phase 2 before advancing (OQ-3).
- **R-4** — *No regression scaffold.* Current tests mock the transaction away, so
  they won't catch a boundary regression. Mitigation: new tests are part of scope,
  not optional.
- **R-5** — *Redis fail-open under outage* becomes more consequential than today.
  Accepted with visibility (WARN), per §6.

## 11. Open questions

- **OQ-1** — Delivery semantics: **at-most-once** (claim before send, accept rare
  crash-mid-send loss) vs **at-least-once** (claim after send, accept rare
  duplicate)? *Recommendation: at-most-once with DEL-on-failure.* Owner decision.
- **OQ-2** — Keep the Phase-2 advisory lock as defense-in-depth, or drop it now
  that the atomic Redis claim serializes sends? *Recommendation: keep it* (matches
  precedent, cheap insurance).
- **OQ-3** — Should Phase-2 `advanceSchedule` re-read the row and verify
  `streakCount` under the lock before advancing (fully idempotent), or is the
  claim-scoped enqueue sufficient? *Recommendation: re-read for safety; low cost.*
- **OQ-4** — `conversation-token-reminder.job.ts` has the identical anti-pattern.
  Fix it in this spec's scope, or file a companion HOS issue? *Recommendation:
  companion issue* (keep this spec focused; NG-3).
- **OQ-5** — Also add a `sendEmail` timeout/`AbortSignal` and/or lower
  `MAX_BATCH_SIZE` as complementary hardening, or defer? *Recommendation: add a
  send timeout in-scope* (cheap, directly reduces worst-case run duration); defer
  batch-size tuning.
- **OQ-6** — Should `findDue` gain `ORDER BY pending_notification_at` +
  `LIMIT`/`SKIP LOCKED` so the 100-cap is deterministic and backlog is FIFO,
  instead of the JS `.slice`? Out of strict scope but adjacent. *Recommendation:
  defer to a follow-up unless trivially cheap here.*

## 12. Implementation notes

- Mirror the structure and doc-comment style of `destination-weather-fetch.job.ts`
  (two-phase, lock as first statement of the write phase, no I/O inside the tx).
- Keep the dry-run path honoring "no sends, no writes" across both phases.
- Redis helper changes live in the job's local helpers (job.ts:93-127) or the
  shared `apps/api/src/utils/redis.ts` — prefer keeping the `conv:notif:` semantics
  co-located with the job unless another job needs the atomic-claim helper.
- New tests must stop mocking `withTransaction` as a transparent passthrough for
  the boundary assertions (AC-1/AC-5); a spy that records whether a "transaction is
  open" flag is set when `sendEmail` is invoked is the cleanest way to pin it.
- Correct `packages/db/docs/advisory-locks.md:20` in the same PR (AC-8).
- This is a billing-adjacent-free, MP-free change → local-first testing per
  SPEC-143; no staging smoke required beyond CI. Apply a
  `status-needs-smoke-*` label only if the owner wants prod cron-timing verified.

## 13. Linear

Canonical tracking:
HOS-112
