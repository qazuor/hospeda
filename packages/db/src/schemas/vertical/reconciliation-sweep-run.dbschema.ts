import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

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
        rowsFailed: integer('rows_failed').notNull().default(0)
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
        startedAtIndex: index('idx_reconciliation_sweep_run_started_at').on(t.startedAt.desc())
    })
);

/** Insert shape for a reconciliation sweep run. */
export type InsertReconciliationSweepRun = typeof reconciliationSweepRuns.$inferInsert;
/** Select shape for a reconciliation sweep run. */
export type SelectReconciliationSweepRun = typeof reconciliationSweepRuns.$inferSelect;
