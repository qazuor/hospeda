# HOS-1999 — Resumable nightly sweep cycle

Supporting detail for [`../spec.md`](../spec.md) §6.5. Owner decisions of
2026-11-02: the daily reconciliation sweep runs as several short slices across
the night (OQ-4), and progress is a per-row `last_swept_at` (OQ-8). The spec
section holds the rationale; this file holds the columns and the algorithm.

## 1. Terms

- **Cycle**: one pass over the sweep inventory plus the post-loop passes.
  Identified by `cycle_id` (slice 0's run id), dated by `cycle_date` (market
  time zone) and anchored at `cycle_started_at`. A day normally has one cycle;
  the manual trigger with `?newCycle=true` opens another.
- **Slice**: one cron execution of `billing-reconciliation-sweep`; one
  `reconciliation_sweep_run` row.
- **Slots**: `10 2,3,4 * * *`, `America/Argentina/Buenos_Aires`. Timeout 50 min
  (safety net), own budget 45 min.
- **Unswept row**: an inventory row with `last_swept_at IS NULL OR last_swept_at
  < cycle_started_at`.

## 2. Schema (expand-only)

| Table.column | Type | Meaning |
|---|---|---|
| `subscription.last_swept_at` | timestamptz null | when the sweep last finished this row; `NULL` = never |
| `reconciliation_sweep_run.cycle_id` | uuid | cycle this slice belongs to |
| `….cycle_date` | date | market date the cycle started |
| `….cycle_started_at` | timestamptz | the cycle's anchor; copied to every slice |
| `….slice_index` | smallint | unique with `cycle_id` |
| `….phase` | varchar | `ROWS`, `PASSES`, `DONE` when this slice ended |
| `….rows_complete` | boolean | the unswept query returned nothing (false when the pass reserve cut the loop) |
| `….passes_completed` | text[] | post-loop passes finished in this cycle |
| `….lease_until` | timestamptz | slice liveness; extended with every stamp and between passes |
| `….outcome` | varchar | `CYCLE_DONE`, `TIMED_OUT`, `FAILED`, `ABANDONED`, `SKIPPED_CYCLE_DONE` |
| `….failed_subscription_ids` | uuid[] | rows that failed in this slice |

Index: `idx_subscription_last_swept_at (last_swept_at ASC NULLS FIRST, id)`, the
slice query's order. All columns are nullable without default or backfill; legacy
single-run rows keep the new run columns null. `outcome` lives here, not in
`cron_runs`, whose statuses do not change (spec §6.3). `rows_read`,
`rows_failed` and the mark counters keep their meaning, per slice.

## 3. Slice algorithm

Every instant written below (`cycle_started_at`, stamps, `lease_until`) is the
database's `now()`, and the unswept comparison runs in SQL (spec §6.5, "One
clock").

1. Take the cron lock through `runCronJob`. Not taken → `cron_runs` records
   `details.skipped = 'overlap'`; stop.
2. Before opening anything, look for an open run of the sweep in any cycle:
   lease live → `details.skipped = 'lease_held'`, return success (this applies
   to `newCycle` too); lease expired → close it as `ABANDONED` and continue.
3. Resolve the cycle: the latest cycle of today's market date, unless `newCycle`.
   - None, or `newCycle` → open slice 0 (`cycle_started_at = now()`).
   - Latest is `DONE` → record `SKIPPED_CYCLE_DONE`, return success.
   - Otherwise open the next slice of that cycle.
   Decide whether this slice is the **last slot**: no scheduled firing of the
   sweep remains later on the same market day.
4. `phase = ROWS`. Page the unswept rows of the inventory ordered
   `last_swept_at ASC NULLS FIRST, id` (no row locks). Before each row check the
   budget and `ctx.signal`. After the row's act (success or row failure), in one
   transaction: `UPDATE reconciliation_sweep_run SET lease_until = now() +
   interval '5 min', <counters> WHERE id = :runId AND outcome IS NULL`; if it
   updated a row, `UPDATE subscription SET last_swept_at = now() WHERE id =
   :rowId` (the `set_updated_at()` trigger also bumps `updated_at`, spec N1); if
   it updated none, roll back and stop (this run was closed by another slice).
5. Last slot only: when the remaining budget falls below the pass reserve
   (15 min), leave the loop with `rows_complete = false`. A page that comes back
   empty sets `rows_complete = true`.
6. `phase = PASSES`, in today's order, skipping `passes_completed`:
   our-cancellation retry (unconfirmed), terminal return, credited payments, paid
   orders, mark escalation, pause gifts, zero-call checks. Extend the lease
   (same guard) after every page or batch a pass processes, and append the pass
   to `passes_completed` when it returns. Check budget and signal between
   passes and between pages; an interrupted pass restarts from its beginning
   next slice.
7. All passes done → `phase = DONE`, `outcome = CYCLE_DONE`, cycle summary (§5).
8. Budget or signal before 7 → `outcome = TIMED_OUT`, return `success: true`
   with `details.stoppedOnBudget`. A thrown fault → `outcome = FAILED` in a
   `finally`.

## 4. Why this is safe

- **Freshness is per row**: each row opens its own act
  (`reconciliation-sweep.service.ts:199`) and decides on reads stamped inside it
  (INV:D17); deadlines are evaluated against the act's instant.
- **A replayed row is harmless**: the only replay is a row whose act ran but
  whose stamp did not commit. Marks are find-or-insert under the open-mark unique
  index (`open-reconciliation-mark.service.ts:105-147`), collected charges are
  keyed by `uq_payment_provider_fact`, the undercharge summary dedupes by payment
  id (`persisted-daily-summary.ts:23-30`).
- **No skipped row**: a row leaves the unswept set only by its stamp, written
  after its act. `rows_complete` means the set is empty, so coverage needs no
  counter.
- **Fairness**: new rows (`NULL`) go first; rows an incomplete cycle missed keep
  the oldest stamps and go first next cycle.
- **Spacing**: two reads of a row are ~22–26 h apart; no check counts runs
  (mark escalation counts days, the cancellation retry uses a 3-day window), and
  the 5-minute `billing-reconciliation-summary` groups events by its own windows.

## 5. End of cycle

The slice that reaches `DONE` sums the cycle's slices, emits the HOS-1885 alert
once per cycle when rows or zero-call checks failed, sends the liveness ping only
when there were no failed rows and `rows_complete`, and returns
`details.cycle = { cycleId, cycleDate, slices, rowsRead, rowsFailed, … }`.
Earlier slices return `success: true` unless they faulted.

If the last slot ends without `DONE`, or with `rows_complete = false`, it logs
"reconciliation cycle incomplete" (error, `capture: true`) and returns
`success: false`. A cycle that needs the last slot logs `warn` "near capacity".
The operator can finish an incomplete cycle with the manual trigger, which runs
one more slice of it **only on the same market day**: the trigger resolves
today's latest cycle, so after midnight it opens a new cycle instead (which
reads the unreached rows first anyway).

Monitors (Sentry crontab `10 2 * * *` with a 170-min margin; Healthchecks
`10 2,3,4 * * *` with 1-hour grace) are specified in spec §6.5.
