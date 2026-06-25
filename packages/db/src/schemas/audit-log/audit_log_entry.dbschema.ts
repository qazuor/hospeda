import {
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
 * Audit & security log entries table (SPEC-162).
 *
 * Persists the audit/security events emitted by `audit-logger.ts` so they are
 * queryable from the admin panel. A single table serves both families,
 * discriminated by `logType`:
 * - `'audit'`   — admin actions (billing/permission/user mutations, route mutations)
 * - `'security'`— auth events (login failures/success, lockouts, access denied, signout)
 *
 * Two admin endpoints read this table, each gated by its own permission and
 * filtering by `logType` (the route injects the discriminator — clients never
 * supply it), so AUDIT_LOG_VIEW and SECURITY_LOG_VIEW grant strictly separate
 * surfaces over the same store.
 *
 * Append-only by design: there is NO soft-delete (`deletedAt`) and NO
 * `updatedAt`. Rows are write-once. A retention purge (hard-delete) can be added
 * later as hardening — out of scope per the spec.
 *
 * Writes are fire-and-forget from the audit-logger's injected persister
 * (registered at API startup); a write failure here never breaks the logging
 * call site.
 */
export const auditLogEntries = pgTable(
    'audit_log_entries',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** Event family discriminator: 'audit' | 'security' */
        logType: varchar('log_type', { length: 10 }).notNull(),
        /** The AuditEventType value (e.g. 'auth.login.failed', 'billing.mutation') */
        eventType: varchar('event_type', { length: 50 }).notNull(),
        /**
         * Severity: 'critical' for CRITICAL_AUDIT_EVENTS, 'info' otherwise.
         * Analog of app_log_entries.level — powers the admin "level" filter.
         */
        severity: varchar('severity', { length: 10 }).notNull(),
        /**
         * Actor who performed the action. No foreign key by design: logs must
         * survive user deletion and a future purge must stay decoupled from the
         * users table. Null for unauthenticated security events (login attempts).
         */
        actorId: uuid('actor_id'),
        /** Actor role at the time of the event (e.g. 'ADMIN', 'guest'). Nullable. */
        actorRole: varchar('actor_role', { length: 50 }),
        /**
         * Target of the action (target user id, resource id). Stored as varchar —
         * not all targets are UUIDs. Nullable.
         */
        targetId: varchar('target_id', { length: 255 }),
        /** Client IP for security events. Nullable. */
        ip: varchar('ip', { length: 64 }),
        /** HTTP method of the in-flight request (e.g. 'GET', 'POST'). Nullable. */
        method: varchar('method', { length: 10 }),
        /** Request / resource path (e.g. '/api/v1/admin/...'). Nullable. */
        path: text('path'),
        /** HTTP status code of the response, when applicable. Nullable. */
        statusCode: integer('status_code'),
        /** Human-readable summary of the event. */
        message: text('message').notNull(),
        /** Full redacted entry (already scrubbed by audit-logger). */
        data: jsonb('data').$type<Record<string, unknown>>(),
        /** When the event occurred. */
        loggedAt: timestamp('logged_at', { withTimezone: true }).notNull(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
    },
    (table) => ({
        /** "Browse by type + time" — primary access pattern for both endpoints */
        auditLogEntries_type_logged_idx: index('auditLogEntries_type_logged_idx').on(
            table.logType,
            table.loggedAt.desc()
        ),
        /** "Filter by event type + time" */
        auditLogEntries_event_logged_idx: index('auditLogEntries_event_logged_idx').on(
            table.eventType,
            table.loggedAt.desc()
        ),
        /** "Per-actor investigation + time" */
        auditLogEntries_actor_logged_idx: index('auditLogEntries_actor_logged_idx').on(
            table.actorId,
            table.loggedAt.desc()
        )
    })
);
