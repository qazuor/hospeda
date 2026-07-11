---
title: conversation-token-reminder cron — move email dispatch outside the lock-holding transaction
linear: HOS-129
statusSource: linear
created: 2026-07-11
type: fix
areas:
  - api
---

# conversation-token-reminder cron — move email dispatch outside the lock-holding transaction

## 1. Summary

Restructure `apps/api/src/cron/jobs/conversation-token-reminder.job.ts` so the
external email dispatch (`sendEmail`, an HTTP call to Brevo, run sequentially for
up to `MAX_BATCH_SIZE = 200` tokens across two reminder windows) no longer
executes **inside** the Postgres transaction that holds advisory lock `43021`.

This is the direct sibling of **HOS-112** (`conversation-notification.job.ts`),
which shipped the same fix for its cron. This spec applies HOS-112's settled
"Option A" shape to the token-reminder job — but the fix is **simpler and safer
here**, because this job's dedup is a **durable DB column**
(`*_reminder_sent_at`), not a Redis TTL claim, so HOS-112's central
"duplicate-after-TTL" hazard mostly does not apply.

Scalability / correctness hardening, not a user-visible feature.

## 2. Problem

The entire job body runs inside one `withTransaction` callback
(`conversation-token-reminder.job.ts:109-402`) whose first statement is
`pg_try_advisory_xact_lock(43021)`. Inside it, for each due token in the day-15
and day-25 batches, `sendEmail` (external HTTP, now with the 10s
`AbortSignal.timeout` inherited from HOS-112) runs sequentially, followed by
`AccessTokenService.markReminderSent` (a DB write).

Consequences (identical class to HOS-112):

- The advisory lock (transaction-scoped) plus a pooled DB connection are held
  open across **N sequential external HTTP calls** — the same
  `idle_in_transaction_session_timeout` / connection-hostage risk documented on
  `destination-weather-fetch.job.ts`, especially costly under PgBouncer
  transaction pooling.
- It violates the established project rule
  (`packages/service-core/CLAUDE.md`): *external API calls MUST stay OUTSIDE the
  transaction callback — they are not rollback-able.*

Unlike HOS-112, the cadence is **daily** (`0 9 * * *`), not every 5 minutes, so
an over-cadence run causing the recurring lock-skip WARN is far less likely — but
the connection-pool anti-pattern is the same and worth removing for consistency
and safety.

## 3. Goals

- **G-1** — `sendEmail` executes with **no DB transaction open and no advisory
  lock held**.
- **G-2** — No double-send and no lost reminder-sent stamp under
  concurrent/overlapping runs, verified by tests.
- **G-3** — The connection-pool anti-pattern (DB connection held across N HTTP
  calls) is eliminated.
- **G-4** — Behavior stays functionally equivalent: each due token still gets at
  most one day-15 and one day-25 reminder, gated by the `*_reminder_sent_at`
  columns.

## 4. Non-goals

- **NG-1** — Not changing the reminder product logic (the two windows
  day-15 `[now+14d, now+16d]` / day-25 `[now+4d, now+6d]`, the 30-day token
  expiry, the templates).
- **NG-2** — Not adding a job queue / worker pool. Stays a cron job.
- **NG-3** — Not making `findDueReminders` deterministic (`ORDER BY` + SQL
  `LIMIT`/`SKIP LOCKED`) — tracked separately as **HOS-133** (shared with the
  HOS-112 job). The JS `.slice(0, 200)` stays for now.
- **NG-4** — Not adding a tunable email-timeout env var; the hardcoded 10s from
  HOS-112 is inherited as-is.

## 5. Current baseline (verified 2026-07-11)

- **Job**: `apps/api/src/cron/jobs/conversation-token-reminder.job.ts`
  - `ADVISORY_LOCK_ID = 43021` (line 41), `MAX_BATCH_SIZE = 200` (line 44),
    schedule `0 9 * * *`, `timeoutMs = 120000`.
  - One `withTransaction` wraps lock + both `findDueReminders` calls + both
    per-token loops including `sendEmail` (lines 109-402).
  - Per-token ordering (each window): resolve context (`resolveTokenContext`,
    an inline helper: conversation + anonymousEmail + accommodation reads) →
    build template → `sendEmail` → on failure `continue` (no stamp) → on success
    `markReminderSent` (DB) → count.
- **Dedup is a durable DB column, not Redis.**
  `AccessTokenService.markReminderSent(actor, { tokenId, reminderType })` stamps
  `*_reminder_sent_at`; `findDueReminders` excludes already-stamped rows. There
  is **no Redis idempotency key** in this job. This is the key difference from
  HOS-112 and what makes the fix lower-risk (see §6).
- **Email**: `sendEmail` (`packages/email/src/send.ts`) now has a 10s
  `AbortSignal.timeout` (added in HOS-112) and never throws. Inherited for free.
- **Precedent**: `apps/api/src/cron/jobs/conversation-notification.job.ts` +
  `conversation-notification.resolve.ts` as shipped in HOS-112 (impl PR #2259).
- **Tests**: `apps/api/test/cron/conversation-token-reminder.job.test.ts` (if
  present) mocks `withTransaction` as a passthrough and asserts config/skip/
  dry-run paths only — no boundary or idempotency pinning. Mirror HOS-112's new
  test scaffold.
- **Lock registry**: `packages/db/docs/advisory-locks.md:21` lists `43021`
  against this job (with `pg_try_advisory_xact_lock`).

## 6. Proposed design (HOS-112 "Option A", adapted)

Adopt HOS-112's final two-phase, per-item-persist shape:

### Phase 1 — resolve + dispatch (no lock, no open transaction)

For each due token (day-15 then day-25), sequentially:

1. Resolve context via `resolveTokenContext` (read-only: conversation +
   `anonymousEmail` + accommodation). A token that cannot be resolved
   (conversation deleted, no anonymous email, accommodation missing) is counted
   as an error and skipped, exactly as today. Consider extracting
   `resolveTokenContext` into a sibling `conversation-token-reminder.resolve.ts`
   module (mirroring `conversation-notification.resolve.ts`) if the job file
   would otherwise exceed the 500-line cap after restructuring; otherwise keep it
   inline.
2. `await sendEmail(...)` — no transaction open, no advisory lock held.
3. On send **failure** → count as error, `continue` (no stamp; the token stays
   eligible for the next daily run). There is no Redis claim to release.

### Phase 2 — persist the reminder-sent stamp (per-item short transaction)

On each **successful** send, immediately persist that one token's stamp in its
**own short `withTransaction`**:

```ts
const markResult = await withTransaction((tx) =>
    accessTokenSvc.markReminderSent(
        SYSTEM_ACTOR,
        { tokenId: token.id, reminderType },
        { tx }
    )
);
```

No batched write phase, **no advisory lock**. Remove `ADVISORY_LOCK_ID`,
`CronTransactionResult`, the batched `withTransaction`, and the `skipped` return
path — mirroring the HOS-112 job. Remove the now-unused `sql` import if nothing
else uses it.

### Why the advisory lock is removable here

The `*_reminder_sent_at` DB column is a **durable dedup marker** written inside
the per-item transaction. Two overlapping runs that both send the same token's
reminder is the only exposure, and it is bounded: `markReminderSent` /
`findDueReminders` already gate on the column, so once either run stamps it the
other run's next `findDueReminders` excludes it. Unlike HOS-112 there is no TTL
window — a dropped stamp simply re-sends on the next **daily** run. The lock adds
serialization overhead without closing a correctness gap, exactly as in HOS-112.

### Delivery semantics (inherited decision)

At-least-once, gated by the durable DB stamp. A hard process crash between a
successful `sendEmail` and its `markReminderSent` commit orphans exactly that ONE
token → it re-sends on the next daily run (one duplicate). Accepted (owner
decision mirrored from HOS-112 OQ-1: a rare duplicate here is fine; no retry
queue — NG-2). Daily cadence + durable marker make the exposure minimal.

## 7. Data model / contracts

- **No schema changes.** `*_reminder_sent_at` columns and
  `markReminderSent` / `findDueReminders` signatures are unchanged. If
  `markReminderSent` does not already accept a trailing `ctx?: ServiceContext`,
  add it following the SPEC-059 `ctx.tx` propagation contract (thread `ctx?.tx`
  to the underlying model write) so the per-item transaction can enlist it.
- **No new env vars.**

## 8. UX / UI behavior

None. Server-side cron only.

## 9. Acceptance criteria

- **AC-1** — `sendEmail` is provably called with no open DB transaction and no
  advisory lock held (test asserts the boundary, not a passthrough mock).
- **AC-2** — On a successful send, exactly one `markReminderSent` runs for that
  token, in its own short transaction; a failed send does not stamp.
- **AC-3** — No `pg_try_advisory_xact_lock` / `pg_advisory_xact_lock` is executed
  anywhere in the job (test / code review); `43021` is no longer acquired.
- **AC-4** — A `markReminderSent` failure after a successful send is counted +
  logged and does not throw; the token remains eligible next run.
- **AC-5** — Existing behavior preserved: dry-run (no sends, no stamps),
  empty-due, and findDueReminders-error paths still pass; both day-15 and day-25
  windows still processed.
- **AC-6** — `resolveTokenContext`'s skip branches (conversation deleted, no
  anonymous email, accommodation missing) are covered by tests.
- **AC-7** — `packages/db/docs/advisory-locks.md` entry for `43021` marked
  RETIRED (id reserved, not reused), mirroring the `43020` entry.

## 10. Risks

- **R-1** — *Double-send.* Bounded by the durable DB stamp; no TTL window.
  Mitigation: per-item stamp immediately after send; accept the rare
  crash-mid-persist next-day duplicate (R-2).
- **R-2** — *Lost stamp on crash* → next-day duplicate. Accepted (daily cadence,
  durable marker). No retry queue (NG-2).
- **R-3** — *No regression scaffold* if the existing test mocks the transaction
  away. Mitigation: new boundary + per-item tests are in scope (mirror HOS-112).

## 11. Open questions

All settled by mirroring HOS-112 — none open.

- **OQ-1** — Delivery semantics → at-least-once gated by the durable DB stamp
  (simpler than HOS-112's Redis-claim model; no claim placement question).
- **OQ-2** — Advisory lock → **remove** (redundant given the DB-column dedup).
- **OQ-3** — Send timeout → inherited from HOS-112 (10s hardcoded), no new work.
- **OQ-4** — Deterministic `findDueReminders` → **deferred to HOS-133**.

## 12. Implementation notes

- Mirror `conversation-notification.job.ts` (+ `.resolve.ts`) structure and
  doc-comment style as shipped in HOS-112.
- Keep the dry-run path honoring "no sends, no writes" across both phases and
  both windows.
- New tests mirror `apps/api/test/cron/conversation-notification.job.test.ts`
  (boundary via a `txOpen` flag recorded from the `withTransaction`/`sendEmail`
  mocks and asserted after the handler resolves; per-item stamp; stamp-fails-
  after-send; dry-run/empty/error) and
  `conversation-notification.resolve.test.ts` for the resolve branches.
- Correct `packages/db/docs/advisory-locks.md:21` (43021 → RETIRED) in the same
  PR (AC-7).
- MP-free / billing-free change → local-first per SPEC-143; no staging smoke
  required beyond CI.

## 13. Linear

Canonical tracking: HOS-129. Related: HOS-112 (precedent, shipped), HOS-133
(deferred `findDue` determinism).
