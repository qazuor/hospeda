import { sql } from 'drizzle-orm';
import {
    boolean,
    check,
    date,
    index,
    integer,
    pgTable,
    smallint,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';

/**
 * One creation or portfolio sweep run (B11.md:1142-1188): each run records
 * its start, finish, rows read and rows failed. `cron_runs` is not reused
 * because it is written later and without a guarantee (.hoja/notas.md §4 DECISIÓN 2).
 */
export const reconciliationSweepRuns = pgTable(
    'reconciliation_sweep_run',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        correlationId: uuid('correlation_id').notNull(),
        startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
        finishedAt: timestamp('finished_at', { withTimezone: true }),
        rowsRead: integer('rows_read').notNull().default(0),
        rowsFailed: integer('rows_failed').notNull().default(0),
        cycleId: uuid('cycle_id'),
        cycleDate: date('cycle_date', { mode: 'string' }),
        cycleStartedAt: timestamp('cycle_started_at', { withTimezone: true }),
        sliceIndex: smallint('slice_index'),
        phase: varchar('phase', { length: 16 }),
        rowsComplete: boolean('rows_complete'),
        passesCompleted: text('passes_completed').array(),
        leaseUntil: timestamp('lease_until', { withTimezone: true }),
        outcome: varchar('outcome', { length: 32 }),
        failedSubscriptionIds: uuid('failed_subscription_ids').array()
    },
    (t) => ({
        countsCheck: check(
            'ck_reconciliation_sweep_run_counts',
            sql`${t.rowsRead} >= 0 AND ${t.rowsFailed} >= 0`
        ),
        spanCheck: check(
            'ck_reconciliation_sweep_run_span',
            sql`${t.finishedAt} IS NULL OR ${t.finishedAt} >= ${t.startedAt}`
        ),
        startedAtIndex: index('idx_reconciliation_sweep_run_started_at').on(t.startedAt.desc()),
        cycleSliceUnique: uniqueIndex('uq_reconciliation_sweep_run_cycle_slice')
            .on(t.cycleId, t.sliceIndex)
            .where(sql`${t.cycleId} IS NOT NULL`),
        openRunsIndex: index('idx_reconciliation_sweep_run_open')
            .on(t.leaseUntil)
            .where(sql`${t.outcome} IS NULL`),
        // At most ONE open cycle slice at any time: the lease no longer depends on the
        // caller holding withCronLock, because a second concurrent open fails on this index.
        oneOpenSliceUnique: uniqueIndex('uq_reconciliation_sweep_run_one_open')
            .on(sql`(true)`)
            .where(sql`${t.outcome} IS NULL AND ${t.cycleId} IS NOT NULL`)
    })
);

/** Insert shape for a reconciliation sweep run. */
export type InsertReconciliationSweepRun = typeof reconciliationSweepRuns.$inferInsert;
/** Select shape for a reconciliation sweep run. */
export type SelectReconciliationSweepRun = typeof reconciliationSweepRuns.$inferSelect;
/** Allowed outcomes for resumable reconciliation sweep slices. */
export const RECONCILIATION_SWEEP_OUTCOMES = [
    'CYCLE_DONE',
    'TIMED_OUT',
    'FAILED',
    'ABANDONED',
    'SKIPPED_CYCLE_DONE'
] as const;
/** Valid terminal outcomes for one resumable reconciliation sweep slice. */
export type ReconciliationSweepOutcome = (typeof RECONCILIATION_SWEEP_OUTCOMES)[number];
