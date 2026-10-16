import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { billingDeadlineVersions } from './billing-deadline-version.dbschema.ts';

/** Audit window for the aggregated reconciliation summary (AC:B11:17, DEC-OBS-001). */
export const reconciliationSummaryWindows = pgTable(
    'reconciliation_summary_window',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** Events after this instant belong to this window. */
        coversFrom: timestamp('covers_from', { withTimezone: true }).notNull(),
        openedAt: timestamp('opened_at', { withTimezone: true }).notNull(),
        closesAt: timestamp('closes_at', { withTimezone: true }).notNull(),
        windowMinutes: integer('window_minutes').notNull(),
        deadlinesVersion: integer('deadlines_version')
            .notNull()
            .references(() => billingDeadlineVersions.version),
        sentAt: timestamp('sent_at', { withTimezone: true }),
        eventCount: integer('event_count')
    },
    (t) => ({
        minutesPositive: check(
            'ck_reconciliation_summary_window_minutes_positive',
            sql`${t.windowMinutes} > 0`
        ),
        closesAfterOpen: check(
            'ck_reconciliation_summary_window_closes_after_open',
            sql`${t.closesAt} > ${t.openedAt}`
        ),
        sentPair: check(
            'ck_reconciliation_summary_window_sent_pair',
            sql`(${t.sentAt} IS NULL) = (${t.eventCount} IS NULL)`
        ),
        coversFromUnique: uniqueIndex('uq_reconciliation_summary_window_covers_from').on(
            t.coversFrom
        ),
        open: index('ix_reconciliation_summary_window_open')
            .on(t.closesAt)
            .where(sql`${t.sentAt} IS NULL`)
    })
);

/** Insert shape of a reconciliation summary window. */
export type InsertReconciliationSummaryWindow = typeof reconciliationSummaryWindows.$inferInsert;
/** Selected reconciliation summary window. */
export type SelectReconciliationSummaryWindow = typeof reconciliationSummaryWindows.$inferSelect;
