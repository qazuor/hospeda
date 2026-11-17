import { sql } from 'drizzle-orm';
import { check, index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/** The provider accounts a watch run can target. */
export const PROVIDER_WATCH_ACCOUNTS = ['sandbox', 'production'] as const;
/** The provider account a watch run targeted. */
export type ProviderWatchAccount = (typeof PROVIDER_WATCH_ACCOUNTS)[number];

/** How a watch run ended. */
export const PROVIDER_WATCH_OUTCOMES = ['completed', 'failed', 'aborted', 'refused'] as const;
/** How a watch run ended. */
export type ProviderWatchOutcome = (typeof PROVIDER_WATCH_OUTCOMES)[number];

/**
 * One run of the provider watch battery (HOS-1512, AC:B1:15): which account it
 * targeted, when, how it ended, what every measurement read and the shape of every
 * response, and each alert it provoked with the channel it went out on.
 *
 * The row is the run's own record and it is written as part of the run: when the
 * write fails the run fails. The shapes of the latest `completed` run of an account
 * are the baseline the next run compares to, so there is no separate baseline table.
 * `cron_runs` is not reused: it is written later and without that guarantee.
 */
export const providerWatchRuns = pgTable(
    'provider_watch_run',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        account: varchar('account', { length: 16 }).$type<ProviderWatchAccount>().notNull(),
        startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
        finishedAt: timestamp('finished_at', { withTimezone: true }).notNull(),
        outcome: varchar('outcome', { length: 16 }).$type<ProviderWatchOutcome>().notNull(),
        /** Why the run did not complete, in one line. */
        reason: text('reason'),
        /** Per measurement id: outcome, expected, obtained and the shape of each response. */
        measurements: jsonb('measurements')
            .$type<Record<string, unknown>>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        /** One entry per alert the run provoked, with the channel it went out on. */
        alerts: jsonb('alerts').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`)
    },
    (t) => ({
        accountCheck: check(
            'ck_provider_watch_run_account',
            sql`${t.account} IN ('sandbox', 'production')`
        ),
        outcomeCheck: check(
            'ck_provider_watch_run_outcome',
            sql`${t.outcome} IN ('completed', 'failed', 'aborted', 'refused')`
        ),
        spanCheck: check('ck_provider_watch_run_span', sql`${t.finishedAt} >= ${t.startedAt}`),
        /** The baseline lookup: the latest completed run of one account. */
        completedByAccountIndex: index('idx_provider_watch_run_completed')
            .on(t.account, t.finishedAt.desc())
            .where(sql`${t.outcome} = 'completed'`)
    })
);

/** Insert shape for a provider watch run. */
export type InsertProviderWatchRun = typeof providerWatchRuns.$inferInsert;
/** Select shape for a provider watch run. */
export type SelectProviderWatchRun = typeof providerWatchRuns.$inferSelect;
