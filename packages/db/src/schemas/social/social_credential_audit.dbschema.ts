import { relations } from 'drizzle-orm';
import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from '../user/user.dbschema.ts';

/**
 * Social credential mutation audit trail (HOS-64 / SPEC-297a G-4).
 *
 * **APPEND-ONLY security trail.** Records every create / rotate / update /
 * delete of a social automation credential. There is NO soft-delete
 * (`deletedAt`) and NO `updatedAt` — rows are immutable by design (a
 * deleted audit row would undermine the security guarantee). Mirrors
 * `ai_credential_audit` (SPEC-173 T-005), replacing `providerId` with `key`
 * and adding the `updated` action (the social vault also supports a
 * metadata-only update, unlike the AI vault).
 */
export const socialCredentialAudit = pgTable(
    'social_credential_audit',
    {
        id: uuid('id').primaryKey().defaultRandom(),

        /**
         * FK → users.id. Admin who performed the credential mutation.
         * ON DELETE SET NULL: preserves the audit row even if the actor's
         * account is removed; the action was still performed.
         */
        actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),

        /**
         * The mutation that was performed.
         * Values: `created` | `rotated` | `updated` | `deleted`
         */
        action: varchar('action', { length: 20 }).notNull(),

        /**
         * Credential key targeted by this mutation.
         * Values: `make_webhook_url` | `make_api_key` | `ai_social_key` | `operator_pin`.
         */
        key: varchar('key', { length: 50 }).notNull(),

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

        // ---- NO deletedAt, NO updatedAt — append-only by design ----
    },
    (table) => ({
        /**
         * Chronological audit log query: list all events for a credential key.
         * Used by the admin credential management page.
         */
        socialCredentialAudit_key_created_idx: index('socialCredentialAudit_key_created_idx').on(
            table.key,
            table.createdAt.desc()
        ),

        /**
         * Forensics query: events performed by a specific actor.
         */
        socialCredentialAudit_actorId_idx: index('socialCredentialAudit_actorId_idx').on(
            table.actorId
        )
    })
);

/** Drizzle relations for `social_credential_audit`. */
export const socialCredentialAuditRelations = relations(socialCredentialAudit, ({ one }) => ({
    actor: one(users, {
        fields: [socialCredentialAudit.actorId],
        references: [users.id]
    })
}));

/** Type inference helpers. */
export type InsertSocialCredentialAudit = typeof socialCredentialAudit.$inferInsert;
export type SelectSocialCredentialAudit = typeof socialCredentialAudit.$inferSelect;
