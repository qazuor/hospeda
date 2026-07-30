import { relations } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { RoleGrantActionPgEnum, RolePgEnum } from '../enums.dbschema.ts';
import { users } from './user.dbschema.ts';

/**
 * Append-only history of every role grant and revoke (HOS-296 G-7).
 *
 * **Immutable by design**: no `updatedAt`, no soft delete. Rows are only ever
 * inserted, in the same transaction as the `user_role` mutation they describe.
 *
 * It exists because `revokeRole` DELETES the live `user_role` row: without
 * this table the who/why of a revoke would vanish with the row it describes.
 * Grants are recorded here too so an accumulated set of hats can be explained
 * (see R-1 — privilege accumulation is the main risk of the union model, and
 * an admin cannot manage what they cannot see).
 *
 * **Every actor FK is `ON DELETE SET NULL`** — including `userId`, unlike
 * `user_role` which cascades. A hard delete of either the subject or the
 * granting actor must neither be blocked by the audit trail nor erase it.
 * Same pattern as `ai_credential_audit.actorId`.
 */
export const userRoleAudit = pgTable(
    'user_role_audit',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** Subject of the mutation. Null once the account is hard-deleted. */
        userId: uuid('user_id').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
        role: RolePgEnum('role').notNull(),
        /** Direction of the mutation: `grant` or `revoke`. */
        action: RoleGrantActionPgEnum('action').notNull(),
        /** When the mutation happened. The only timestamp — rows are immutable. */
        at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
        /** Actor who performed the mutation. Null = system/automatic. */
        by: uuid('by').references((): AnyPgColumn => users.id, { onDelete: 'set null' }),
        /** Why the mutation happened, e.g. `last_accommodation_archived`. */
        reason: text('reason')
    },
    (table) => ({
        /** Chronological history for one account — the admin role editor. */
        userRoleAudit_userId_at_idx: index('userRoleAudit_userId_at_idx').on(
            table.userId,
            table.at.desc()
        ),
        /** Forensics: everything a given actor granted or revoked. */
        userRoleAudit_by_idx: index('userRoleAudit_by_idx').on(table.by)
    })
);

/** Drizzle relations for `user_role_audit`. */
export const userRoleAuditRelations = relations(userRoleAudit, ({ one }) => ({
    user: one(users, {
        fields: [userRoleAudit.userId],
        references: [users.id],
        relationName: 'userRoleAuditSubject'
    }),
    actor: one(users, {
        fields: [userRoleAudit.by],
        references: [users.id],
        relationName: 'userRoleAuditActor'
    })
}));

/** Type inference helpers. */
export type InsertUserRoleAudit = typeof userRoleAudit.$inferInsert;
export type SelectUserRoleAudit = typeof userRoleAudit.$inferSelect;
