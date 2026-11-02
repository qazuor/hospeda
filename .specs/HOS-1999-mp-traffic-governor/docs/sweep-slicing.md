# HOS-1999 — Resumable nightly sweep cycle (OQ-4 decision)

Supporting detail for [`../spec.md`](../spec.md) §6.5. Owner decision of
2026-11-02: the daily reconciliation sweep runs as several short slices across
the night that continue from the last processed id (OQ-4, option 2).

## 1. Terms

- **Cycle**: one complete pass over the sweep inventory plus the post-loop passes,
  identified by `cycle_date` (the market-time-zone date the cycle started).
- **Slice**: one cron execution of `billing-reconciliation-sweep`; it records one
  `reconciliation_sweep_run` row and advances the cycle as far as its budget allows.
- **Slots**: `10 2 * * *`, `10 3 * * *`, `10 4 * * *` (market time zone).
  Slice timeout 50 min, so a slice ends before the next slot even before the
  lock is considered.

## 2. State in `reconciliation_sweep_run` (expand-only migration)

New nullable columns; legacy rows (single daily runs) keep them null.

| Column | Type | Meaning |
|---|---|---|
| `cycle_date` | date | cycle this slice belongs to |
| `slice_index` | smallint | 0, 1, 2 … within the cycle; unique with `cycle_date` |
| `phase` | varchar | where the cycle stood when this slice ended: `ROWS`, `PASSES`, `DONE` |
| `cycle_origin_after_id` | uuid null | first-row boundary of the cycle (null = from the beginning; set when the previous cycle ended incomplete, see §5) |
| `cursor_after_id` | uuid null | last subscription id fully processed in the main loop |
| `cursor_wrapped` | boolean | the cursor has wrapped past the end of the id space back to the beginning (only when `cycle_origin_after_id` is set) |
| `passes_completed` | text[] | post-loop passes already finished in this cycle |
| `outcome` | varchar | `CYCLE_DONE`, `TIMED_OUT`, `FAILED`, `ABANDONED`, `SKIPPED_CYCLE_DONE` |
| `rows_visited`, `divergences`, `marks_opened`, `marks_accumulated` | integer | this slice's counters; `rows_visited` counts the distinct rows the cursor passed, success or failure (`rows_read` / `rows_failed` can overlap on one row) |
| `failed_subscription_ids` | uuid[] | rows that failed in this slice |

`rows_read` / `rows_failed` keep their meaning, per slice. Each new slice copies
the cycle state (`phase`, cursors, `passes_completed`) from the latest run row of
the same `cycle_date` and keeps it current on its own row.

## 3. Slice algorithm

1. Take the cron lock (spec §6.3). If not taken → `cron_runs` records `overlap`;
   nothing else happens.
2. Resolve the cycle: the latest run row whose `cycle_date` is today (market TZ).
   - None → open slice 0 of a new cycle (§5 decides `cycle_origin_after_id`).
   - Found with `phase = DONE` → record `SKIPPED_CYCLE_DONE`, return success.
   - Found with `finished_at` null (a slice that died: the lock is free, so its
     holder is gone) → close it as `ABANDONED` and resume from its cursor.
3. `phase = ROWS`: page the inventory by `subscription.id > cursor_after_id`
   (and, for a wrapped cycle, up to `cycle_origin_after_id`). After each row
   finishes — success or row failure — persist `cursor_after_id = row.id` and
   the counters with one `UPDATE`. Check `ctx.signal` before starting a row.
4. Inventory exhausted → `phase = PASSES`. Run the post-loop passes in today's
   fixed order, skipping those in `passes_completed`: our-cancellation retry
   (unconfirmed), terminal return, credited payments, paid orders, mark
   escalation, pause gifts, zero-call checks. Append each to `passes_completed`
   when it returns. Check `ctx.signal` between passes and between pages inside a
   pass; an interrupted pass is not marked and restarts from its beginning in the
   next slice.
5. All passes done → `phase = DONE`, `outcome = CYCLE_DONE`, cycle summary (§6).
6. Signal aborted before 5 → `outcome = TIMED_OUT`, return. A thrown fault →
   `outcome = FAILED` (run row closed in a `finally`), next slice resumes.

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
  (`open-reconciliation-mark.service.ts:105-147`), charge facts are keyed by
  `uq_payment_provider_fact`, and the undercharge summary deduplicates by payment
  id (`persisted-daily-summary.ts:23-30`).
- **Rows created during the cycle** with an id behind the cursor wait for the
  next cycle — the same as a row created after today's 06:00 run.
- **The 5-minute summary job** (`billing-reconciliation-summary`) groups domain
  events by its own windows, not by sweep run, so events spread across the night
  are summarized correctly.

## 5. Incomplete cycle and fairness

If the cycle is not `DONE` after the last slot, the last slice logs an error with
`capture: true` ("reconciliation cycle incomplete", with the cursor and pass
list) and returns `success: false`. The next cycle starts **after** that cursor
and wraps around (`cycle_origin_after_id`), so the rows the incomplete cycle
never reached are read first. Without this, a cycle that keeps running out of
time would starve the same tail rows every night. Manual triggers (the admin cron trigger, `apps/api/src/routes/cron-admin`, which takes the same lock)
run one more slice of the current cycle, which is the operator's way to finish
an incomplete cycle after 05:00.

## 6. End-of-cycle summary

The slice that reaches `DONE`:

- sums `rows_read`, `rows_failed`, `divergences`, `marks_*` and the
  `failed_subscription_ids` of every slice of the cycle;
- emits the HOS-1885 alert (`logger.error … capture: true`) when the cycle had
  failed rows or failed zero-call checks — once per cycle, not per slice;
- sends the liveness ping only when the cycle had zero failed rows (today's
  `isReconciliationSweepRunComplete` rule, applied to the cycle);
- returns `details.cycle = { cycleDate, slices, rowsRead, rowsFailed, … }`.

Earlier slices return `success: true` unless the slice itself faulted, so the
bootstrap's soft-failure capture does not page for row failures twice.

**Sentry monitor.** Today the monitor is an interval of 1 day with a 120-min
margin (`apps/api/src/utils/cron-monitor-ping.ts:10`). With the ping time moving
between ~02:15 and ~05:00, two consecutive pings can be up to ~27 h apart and
trip it falsely. It becomes a crontab monitor `10 2 * * *` with a check-in margin
that covers the last slot plus its timeout (170 min).

## 7. Capacity signal

Each cycle records how many slices it needed. A cycle that needs the last slot,
or ends incomplete, logs `warn` "reconciliation cycle near capacity". That is the
trigger to add slots or revisit D (suspicion-based sweep).
