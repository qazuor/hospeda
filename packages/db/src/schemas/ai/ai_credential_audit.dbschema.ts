import { relations } from 'drizzle-orm';
import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';

/**
 * Credential mutation audit trail (SPEC-173 T-005, Q1 resolved).
 *
 * **APPEND-ONLY security trail.** Records every create / rotate / delete of an
 * AI provider credential. There is NO soft-delete (`deletedAt`) and NO
 * `updatedAt` — rows are immutable by design (a deleted audit row would
 * undermine the security guarantee).
 *
 * The decision to use a dedicated table (rather than a generic audit log) was
 * owner-approved in SPEC-173 §5.5 / Q1: the repo has no reusable generic admin
 * audit table — only `billing_audit_logs` from the third-party qzpay lib and
 * a log-based `AuditEventType`, neither suitable for a queryable credential
 * security trail over cost-bearing secrets.
 *
 * The `action` column uses a varchar instead of a pgEnum because the three
 * values (`created`, `rotated`, `deleted`) are stable and short, and adding a
 * pgEnum migration for a three-value enum with no query-time benefit is
 * unnecessary overhead.
 *
 * Decision (owner-approved 2026-06-04): varchar chosen for AI enums (consistent
 * with repo — pgEnum is reserved for TS enums in @repo/schemas; AI values are
 * z.enum). Migrating to pgEnum is a future option if these are ever promoted to
 * TS enums.
 */
export const aiCredentialAudit = pgTable(
    'ai_credential_audit',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /**
         * FK → users.id. SUPER_ADMIN who performed the credential mutation.
         * ON DELETE SET NULL: preserves the audit row even if the actor's
         * account is removed; the action was still performed.
         */
        actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),

        /**
         * The mutation that was performed.
         * Values: `created` | `rotated` | `deleted`
         */
        action: varchar('action', { length: 20 }).notNull(),

        /**
         * Provider identifier targeted by this mutation.
         * Values: `openai` | `anthropic` | `stub`
         * (matches `AiProviderId` from `@repo/schemas`).
         */
        providerId: varchar('provider_id', { length: 50 }).notNull(),

        /**
         * IP address of the actor at mutation time (optional).
         * Useful for security forensics; may be null if the request came from
         * a context where the IP is unavailable.
         */
        ipAddress: varchar('ip_address', { length: 45 }),

        /**
         * When the mutation occurred.
         * The only timestamp on this table — there is no `updatedAt` because
         * audit rows are immutable.
         */
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

        // ---- NO deletedAt, NO updatedAt — append-only by design (Q1) ----
    },
    (table) => ({
        /**
         * Chronological audit log query: list all events for a provider.
         * Used by the admin credential management page.
         */
        aiCredentialAudit_providerId_created_idx: index(
            'aiCredentialAudit_providerId_created_idx'
        ).on(table.providerId, table.createdAt.desc()),

        /**
         * Forensics query: events performed by a specific actor.
         */
        aiCredentialAudit_actorId_idx: index('aiCredentialAudit_actorId_idx').on(table.actorId)
    })
);

/** Drizzle relations for `ai_credential_audit`. */
export const aiCredentialAuditRelations = relations(aiCredentialAudit, ({ one }) => ({
    actor: one(users, {
        fields: [aiCredentialAudit.actorId],
        references: [users.id]
    })
}));

/** Type inference helpers. */
export type InsertAiCredentialAudit = typeof aiCredentialAudit.$inferInsert;
export type SelectAiCredentialAudit = typeof aiCredentialAudit.$inferSelect;
