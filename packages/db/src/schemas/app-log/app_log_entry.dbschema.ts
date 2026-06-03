import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Application log entries table.
 * Persists WARN and ERROR entries surfaced by the API logger so they are
 * queryable from the admin panel (SPEC-184 / BETA-82). General application
 * logs only — audit/security log querying is SPEC-162's domain.
 *
 * Append-only by design: there is NO soft-delete (`deletedAt`). Rows are
 * hard-deleted exclusively by the `app-log-purge` job per the retention
 * policy (30 days, uniform for WARN and ERROR).
 *
 * Writes are fire-and-forget from the logger's 'db-sink' hook registered at
 * API startup; a write failure here never breaks the logging call site.
 */
export const appLogEntries = pgTable(
    'app_log_entries',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /**
         * Log level. Only 'WARN' | 'ERROR' are persisted (volume guard lives
         * at the sink). Uppercase to match the logger's LogLevelType values.
         */
        level: varchar('level', { length: 10 }).notNull(),
        /** Category key (e.g. 'API', 'BILLING', 'AUTH') */
        category: varchar('category', { length: 50 }),
        /** Optional label from the log call */
        label: text('label'),
        /** Log message (string payloads land here; empty for object payloads) */
        message: text('message').notNull(),
        /** Redacted structured payload (already sanitized by the logger) */
        data: jsonb('data').$type<Record<string, unknown>>(),
        /** When the log entry was emitted (LogEntry.ts) */
        loggedAt: timestamp('logged_at', { withTimezone: true }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        /** "Browse by level + time" + purge by age */
        appLogEntries_level_logged_idx: index('appLogEntries_level_logged_idx').on(
            table.level,
            table.loggedAt.desc()
        ),
        /** "Browse by category + time" */
        appLogEntries_category_logged_idx: index('appLogEntries_category_logged_idx').on(
            table.category,
            table.loggedAt.desc()
        )
    })
);
