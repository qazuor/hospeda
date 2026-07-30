import { relations } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { RolePgEnum } from '../enums.dbschema.ts';
import { users } from './user.dbschema.ts';

/**
 * The set of hats a user wears (HOS-296).
 *
 * Replaces the single `users.role` column, which was dropped in the same
 * migration that created this table. One account can hold several roles at
 * once (host AND commerce owner, say), and effective permissions are the union
 * over the held roles then the per-user overrides in `user_permission`:
 * `(⋃ perms(role_i) ∪ grants) \ denies`.
 *
 * The composite PK `(userId, role)` is load-bearing: it is what makes the
 * `grantRole` primitive an idempotent "grant if absent" without a prior read,
 * which is what every role-write site in the codebase actually wants.
 *
 * `grantedBy` is `ON DELETE SET NULL` (not cascade) so deleting the granting
 * account never removes the grantee's capability; `userId` IS `ON DELETE
 * CASCADE` because a hat has no meaning without the head that wears it.
 * Revokes delete the row — the who/why survives in `user_role_audit`.
 */
export const userRole = pgTable(
    'user_role',
    {
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        role: RolePgEnum('role').notNull(),
        grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
        /** Actor who granted the hat. Null = system/automatic grant. */
        grantedBy: uuid('granted_by').references((): AnyPgColumn => users.id, {
            onDelete: 'set null'
        }),
        /** Why the hat was granted, e.g. `accommodation_activated`. */
        grantReason: text('grant_reason')
    },
    (table) => ({
        pk: primaryKey({ columns: [table.userId, table.role] }),
        /**
         * "Who holds this role" — the admin panel's per-role listing and the
         * `byRole` stats aggregate, which can no longer scan `users.role`.
         */
        role_idx: index('user_role_role_idx').on(table.role)
    })
);

/**
 * Drizzle relations for the `user_role` junction table.
 * `user` is the holder of the hat; `grantedByUser` is the actor who granted it
 * (null for system grants). `role` is an enum column, not an FK.
 */
export const userRoleRelations = relations(userRole, ({ one }) => ({
    user: one(users, {
        fields: [userRole.userId],
        references: [users.id],
        relationName: 'userRoleHolder'
    }),
    grantedByUser: one(users, {
        fields: [userRole.grantedBy],
        references: [users.id],
        relationName: 'userRoleGrantor'
    })
}));

/** Type inference helpers. */
export type InsertUserRole = typeof userRole.$inferInsert;
export type SelectUserRole = typeof userRole.$inferSelect;
