# HOS-1999 — Resumable nightly sweep cycle (OQ-4 decision)

Supporting detail for [`../spec.md`](../spec.md) §6.5. Owner decision of
2026-11-02: the daily reconciliation sweep runs as several short slices across
the night that continue from the last processed id (OQ-4, option 2).

OQ-8 (pending) asks whether to replace the cursor with a per-row
`last_swept_at`. This document describes the cursor variant; §8 lists what the
other variant removes. The lease (§3) is needed either way.

## 1. Terms

- **Cycle**: one complete pass over the sweep inventory plus the post-loop passes,
  identified by `cycle_id` (the id of its slice 0 run row) and dated by
  `cycle_date` (the market-time-zone date it started). A day normally has one
  cycle; the manual trigger with `?newCycle=true` opens another.
- **Slice**: one cron execution of `billing-reconciliation-sweep`; it records one
  `reconciliation_sweep_run` row and advances the cycle as far as its budget allows.
- **Slots**: `10 2 * * *`, `10 3 * * *`, `10 4 * * *` (market time zone,
  `America/Argentina/Buenos_Aires`). Timeout 50 min (safety net) and an own
  budget of 45 min: the slice stops itself before the race fires and before the
  next slot.

## 2. State in `reconciliation_sweep_run` (expand-only migration)

New nullable columns; legacy rows (single daily runs) keep them null.

| Column | Type | Meaning |
|---|---|---|
| `cycle_id` | uuid | cycle this slice belongs to (slice 0's run id) |
| `cycle_date` | date | market date the cycle started |
| `slice_index` | smallint | 0, 1, 2 … within the cycle; unique with `cycle_id` |
| `phase` | varchar | where the cycle stood when this slice ended: `ROWS`, `PASSES`, `DONE` |
| `cycle_origin_after_id` | uuid null | first-row boundary of the cycle (null = from the beginning; set when the previous cycle ended incomplete, see §5) |
| `cursor_after_id` | uuid null | last subscription id fully processed in the main loop |
| `cursor_seq` | integer | incremented by every cursor `UPDATE`; the optimistic guard (§3) |
| `cursor_wrapped` | boolean | the cursor has wrapped past the end of the id space back to the beginning (only when `cycle_origin_after_id` is set) |
| `rows_complete` | boolean | the row loop reached the end of the cycle's range (false when the pass reserve cut it, §3 step 4) |
| `passes_completed` | text[] | post-loop passes already finished in this cycle |
| `lease_until` | timestamptz | liveness of the slice; extended on every cursor `UPDATE` and between passes |
| `inventory_size_at_start` | integer | rows in the inventory when slice 0 opened the cycle (coverage check, §6) |
| `outcome` | varchar | `CYCLE_DONE`, `TIMED_OUT`, `FAILED`, `ABANDONED`, `SKIPPED_CYCLE_DONE` |
| `rows_visited`, `divergences`, `marks_opened`, `marks_accumulated` | integer | this slice's counters; `rows_visited` counts the distinct rows the cursor passed, success or failure (`rows_read` / `rows_failed` can overlap on one row) |
| `failed_subscription_ids` | uuid[] | rows that failed in this slice |

`outcome` lives on this table, not on `cron_runs`: the cron run of every slice
uses the existing `cron_runs` statuses, and a skip is `details.skipped`
(spec §6.3). `rows_read` / `rows_failed` keep their meaning, per slice. Each new
slice copies the cycle state (`phase`, cursors, `rows_complete`,
`passes_completed`) from the latest run row of the same `cycle_id` and keeps it
current on its own row.

## 3. Slice algorithm

1. Take the cron lock through `runCronJob` (spec §6.3). If not taken →
   `cron_runs` records `details.skipped = 'overlap'`; nothing else happens.
2. Resolve the cycle: the latest cycle whose `cycle_date` is today (market TZ),
   unless `newCycle` was requested.
   - None, or `newCycle` → open slice 0 of a new cycle (§5 decides
     `cycle_origin_after_id`; count `inventory_size_at_start`).
   - Latest run with `phase = DONE` → record `SKIPPED_CYCLE_DONE`, return success.
   - Latest run with `finished_at` null:
     - `lease_until` in the past → close it as `ABANDONED`, resume from its cursor;
     - `lease_until` in the future → its slice may still be alive even though the
       lock is free (the lock dies with its connection, R-6): record
       `details.skipped = 'lease_held'` and return success.
3. `phase = ROWS`: page the inventory by `subscription.id > cursor_after_id`
   (and, for a wrapped cycle, up to `cycle_origin_after_id`). Check the budget
   and `ctx.signal` before starting a row. After each row finishes — success or
   row failure — run one guarded `UPDATE`:
   `SET cursor_after_id = :rowId, cursor_seq = cursor_seq + 1,
   lease_until = now() + 5 min, <counters> WHERE id = :runId AND outcome IS NULL
   AND cursor_seq = :expectedSeq`. Zero rows updated → this run was closed by another slice: stop
   immediately, write nothing else.
4. **Pass reserve.** In the last slot of the night, when the remaining budget
   falls below the pass reserve (15 min), stop the row loop with
   `rows_complete = false` and go to step 5 anyway. Otherwise go to step 5 when
   the range is exhausted (`rows_complete = true`).
5. `phase = PASSES`. Run the post-loop passes in today's fixed order, skipping
   those in `passes_completed`: our-cancellation retry (unconfirmed), terminal
   return, credited payments, paid orders, mark escalation, pause gifts,
   zero-call checks. Append each to `passes_completed` when it returns (same
   guard as step 3, lease extended). Check the budget and `ctx.signal` between
   passes and between pages inside a pass; an interrupted pass is not marked and
   restarts from its beginning in the next slice.
6. All passes done → `phase = DONE`, `outcome = CYCLE_DONE`, cycle summary (§6).
7. Budget reached or signal aborted before 6 → `outcome = TIMED_OUT`, return
   `success: true` with `details.stoppedOnBudget` (no Sentry capture, no
   Healthchecks `/fail`). A thrown fault → `outcome = FAILED` (run row closed in
   a `finally`), next slice resumes.

## 4. Why a row read at a different hour is safe

- **Freshness is already per row.** Every row opens its own act
  (`reconciliation-sweep.service.ts:199`) and decides on reads stamped inside it
  (INV:D17). Nothing in the comparisons or row checks reads the run's start.
- **Deadlines are evaluated against the act's instant**, so a grace that ends at
  03:00 is taken by whichever slice reads the row after 03:00 — the same rule as
  today's 06:00 run, with up to ~2 h of variation in when it happens.
- **Spacing between two reads of one row** varies between ~22 h and ~26 h
  instead of ~24 h. No check counts sweep runs; mark escalation counts days since
  a mark opened, and the cancellation retry uses a 3-day window.
- **Exactly once per cycle**, except the row in flight when a process dies (the
  cursor advances only after a row finishes). Replaying that row is safe:
  opening a mark is find-or-insert under the open-mark unique index
  (`open-reconciliation-mark.service.ts:105-147`), collected charges are keyed by
  `uq_payment_provider_fact`, and the undercharge summary deduplicates by payment
  id (`persisted-daily-summary.ts:23-30`).
- **Rows created during the cycle** with an id behind the cursor wait for the
  next cycle — the same as a row created after today's 06:00 run.
- **The 5-minute summary job** (`billing-reconciliation-summary`) groups domain
  events by its own windows, not by sweep run, so events spread across the night
  are summarized correctly.

## 5. Incomplete cycle and fairness

If the cycle is not `DONE` after the last slot, or is `DONE` with
`rows_complete = false`, the last slice logs an error with `capture: true`
("reconciliation cycle incomplete", with the cursor and pass list) and returns
`success: false` — the one deliberate page of the night. The next cycle starts
**after** that cursor and wraps around (`cycle_origin_after_id`), so the rows the
incomplete cycle never reached are read first. Without this, a cycle that keeps
running out of time would starve the same tail rows every night. The manual
trigger (same `runCronJob`, same lock, asynchronous, spec §6.3) runs one more
slice of the current cycle, which is the operator's way to finish an incomplete
cycle after 05:00.

## 6. End-of-cycle summary

The slice that reaches `DONE`:

- sums `rows_read`, `rows_failed`, `divergences`, `marks_*` and the
  `failed_subscription_ids` of every slice of the cycle;
- emits the HOS-1885 alert (`logger.error … capture: true`) when the cycle had
  failed rows or failed zero-call checks — once per cycle, not per slice;
- sends the liveness ping only when the cycle had zero failed rows and
  `rows_complete` (today's `isReconciliationSweepRunComplete` rule, applied to
  the cycle);
- compares the summed `rows_visited` with `inventory_size_at_start` and logs a
  difference at `warn` with both numbers: rows created or soft-deleted during
  the cycle make an exact match impossible, so this is a signal, not an error;
- returns `details.cycle = { cycleId, cycleDate, slices, rowsRead, rowsFailed, … }`.

Earlier slices return `success: true` unless the slice itself faulted, so the
bootstrap's soft-failure capture does not page for row failures twice.

## 7. Monitors and capacity

**Sentry monitor.** Today the monitor is an interval of 1 day with a 120-min
margin (`apps/api/src/utils/cron-monitor-ping.ts:10`). With the ping time moving
between ~02:15 and ~05:00, two consecutive pings can be up to ~27 h apart and
trip it falsely. It becomes a crontab monitor `10 2 * * *`, timezone
`America/Argentina/Buenos_Aires`, with a check-in margin that covers the last
slot plus its timeout (170 min).

**Healthchecks.** `<env>-billing-reconciliation-sweep` is pinged on every tick
(start, then success or fail). Its schedule moves from `0 6 * * *` to
`10 2,3,4 * * *` in the same zone with a 1-hour grace, by hand in the
Healthchecks UI; `scripts/cutover/README.md:632-638` is updated with it.

**Capacity.** Each cycle records how many slices it needed. A cycle that needs
the last slot, or ends incomplete, logs `warn` "reconciliation cycle near
capacity". That is the trigger to add slots or revisit D (suspicion-based
sweep).

## 8. The OQ-8 variant (pending)

With a per-row `last_swept_at`, a slice takes `WHERE last_swept_at <
cycle_start ORDER BY last_swept_at NULLS FIRST, id` and stamps each row when it
finishes. That removes `cursor_after_id`, `cursor_seq`, `cycle_origin_after_id`,
`cursor_wrapped` and the `ABANDONED` resume logic (an unstamped row is simply
picked up again), and is fair to new rows and to rows an incomplete cycle
missed. It keeps `phase`, `passes_completed`, `rows_complete`, the pass reserve,
the counters, the lease and the once-per-cycle summary; the per-row stamp is
written in the same transaction as a check that the run is still open and its
lease is live.
