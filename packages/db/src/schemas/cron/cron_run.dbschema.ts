import {
    boolean,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';

/**
 * Cron run history table.
 * Records the outcome of every cron job execution (scheduled or manually triggered).
 * Powers admin observability: last run per job + recent failures (SPEC-155 card D).
 *
 * Append-only by design: there is NO soft-delete (`deletedAt`). Rows are hard-deleted
 * exclusively by the `cron-run-purge` job per the retention policy
 * (success > 60 days, failed/timeout > 180 days).
 *
 * Recording is fire-and-forget at the two execution sites (the cron bootstrap and the
 * cron-admin manual trigger); a write failure here never alters the job's own result.
 */
export const cronRuns = pgTable(
    'cron_runs',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** Job identifier, matches CronJobDefinition.name (e.g. 'dunning', 'subscription-poll') */
        jobName: varchar('job_name', { length: 100 }).notNull(),
        /** Outcome of the run: 'success' | 'failed' | 'timeout' */
        status: varchar('status', { length: 20 }).notNull(),
        /** When the job handler started */
        startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
        /** When the job handler finished (or timed out) */
        finishedAt: timestamp('finished_at', { withTimezone: true }).notNull(),
        /** Execution duration in milliseconds */
        durationMs: integer('duration_ms').notNull(),
        /** Number of items/records processed (from CronJobResult.processed) */
        processed: integer('processed').notNull().default(0),
        /** Number of errors encountered (from CronJobResult.errors) */
        errors: integer('errors').notNull().default(0),
        /** How the run was triggered: 'scheduled' | 'manual' */
        executionMode: varchar('execution_mode', { length: 20 }).notNull(),
        /** Whether the run was a dry-run (manual trigger with ?dryRun=true) */
        dryRun: boolean('dry_run').notNull().default(false),
        /** Truncated error message (<= 2000 chars); overflow/stacktrace lives in `details` */
        errorMessage: text('error_message'),
        /** Free-form execution details (from CronJobResult.details + overflow) */
        details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        /** "Latest runs for job X" + "last run per job" */
        cronRuns_job_started_idx: index('cronRuns_job_started_idx').on(
            table.jobName,
            table.startedAt.desc()
        ),
        /** "Recent failures across all jobs" + purge by status/age */
        cronRuns_status_created_idx: index('cronRuns_status_created_idx').on(
            table.status,
            table.createdAt.desc()
        )
    })
);
