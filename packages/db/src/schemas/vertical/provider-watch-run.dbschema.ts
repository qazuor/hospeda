import { sql } from 'drizzle-orm';
import {
    check,
    index,
    jsonb,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';

/** The provider accounts a watch run can target. */
export const PROVIDER_WATCH_ACCOUNTS = ['sandbox', 'production'] as const;
/** The provider account a watch run targeted. */
export type ProviderWatchAccount = (typeof PROVIDER_WATCH_ACCOUNTS)[number];

/** How a watch run stands: `running` from the moment it starts until it ends. */
export const PROVIDER_WATCH_OUTCOMES = [
    'running',
    'completed',
    'failed',
    'aborted',
    'refused'
] as const;
/** How a watch run ended. */
export type ProviderWatchOutcome = (typeof PROVIDER_WATCH_OUTCOMES)[number];

/**
 * One run of the provider watch battery (HOS-1512, AC:B1:15): which account it
 * targeted, when, how it ended, what every measurement read and the shape of every
 * response, and each alert it provoked with the channel it went out on.
 *
 * The row opens when the run STARTS (a production run consumes the owner's authorization in
 * the same transaction) and is closed when it ends; a write that fails fails the run. The
 * shapes it observed are what the owner reviews and may accept as the baseline
 * (`provider_watch_shape_baseline`); a run never becomes the baseline by itself.
 * `cron_runs` is not reused: it is written later and without that guarantee.
 */
export const providerWatchRuns = pgTable(
    'provider_watch_run',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        account: varchar('account', { length: 16 }).$type<ProviderWatchAccount>().notNull(),
        startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
        /** NULL while the run is `running`. */
        finishedAt: timestamp('finished_at', { withTimezone: true }),
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
            sql`${t.outcome} IN ('running', 'completed', 'failed', 'aborted', 'refused')`
        ),
        spanCheck: check(
            'ck_provider_watch_run_span',
            sql`${t.finishedAt} IS NULL OR ${t.finishedAt} >= ${t.startedAt}`
        ),
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

/**
 * The response shapes the owner ACCEPTED for one measurement of one account (HOS-1512). The
 * baseline advances only when the owner accepts what a run observed: until then a changed shape
 * keeps alerting on every run.
 */
export const providerWatchShapeBaselines = pgTable(
    'provider_watch_shape_baseline',
    {
        account: varchar('account', { length: 16 }).$type<ProviderWatchAccount>().notNull(),
        measurementId: varchar('measurement_id', { length: 16 }).notNull(),
        /** Request label to shape map, exactly as the run recorded it. */
        shapes: jsonb('shapes').$type<Record<string, Record<string, string>>>().notNull(),
        /** The run whose observation was accepted. */
        sourceRunId: uuid('source_run_id')
            .notNull()
            .references(() => providerWatchRuns.id),
        acceptedBy: uuid('accepted_by')
            .notNull()
            .references(() => users.id),
        acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow()
    },
    (t) => ({
        pk: primaryKey({ columns: [t.account, t.measurementId] }),
        accountCheck: check(
            'ck_provider_watch_shape_baseline_account',
            sql`${t.account} IN ('sandbox', 'production')`
        )
    })
);

/** Insert shape for an accepted baseline. */
export type InsertProviderWatchShapeBaseline = typeof providerWatchShapeBaselines.$inferInsert;
/** Select shape for an accepted baseline. */
export type SelectProviderWatchShapeBaseline = typeof providerWatchShapeBaselines.$inferSelect;
