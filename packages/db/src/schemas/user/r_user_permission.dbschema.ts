import { relations } from 'drizzle-orm';
import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { PermissionEffectPgEnum, PermissionPgEnum } from '../enums.dbschema.ts';
import { users } from './user.dbschema.ts';

/**
 * Table for assigning permissions to users (by enum, not id).
 *
 * `effect` (SPEC-170) is the direction of the override: `'grant'` adds the
 * permission on top of the user's role, `'deny'` subtracts a role-granted
 * permission from this single user. The composite PK `(userId, permission)`
 * guarantees a user cannot hold both a grant and a deny for the same
 * permission; callers upsert the row to flip the effect.
 */
export const userPermission = pgTable(
    'user_permission',
    {
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        permission: PermissionPgEnum('permission').notNull(),
        effect: PermissionEffectPgEnum('effect').notNull().default('grant')
    },
    (table) => ({
        pk: primaryKey({ columns: [table.userId, table.permission] }),
        userId_idx: index('user_permission_userId_idx').on(table.userId),
        permission_idx: index('user_permission_permission_idx').on(table.permission)
    })
);

/**
 * Drizzle relations for the userPermission junction table.
 * Only `user` is a real FK relation. `permission` is an enum column (no FK).
 */
export const userPermissionRelations = relations(userPermission, ({ one }) => ({
    user: one(users, {
        fields: [userPermission.userId],
        references: [users.id]
    })
}));
