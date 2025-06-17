import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { PermissionPgEnum } from '../enums.dbschema.ts';
import { users } from './user.dbschema.ts';

/**
 * Table for assigning permissions to users (by enum, not id).
 */
export const userPermission = pgTable(
    'user_permission',
    {
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        permission: PermissionPgEnum('permission').notNull()
    },
    (table) => ({
        pk: primaryKey({ columns: [table.userId, table.permission] }),
        userId_idx: index('user_permission_userId_idx').on(table.userId),
        permission_idx: index('user_permission_permission_idx').on(table.permission)
    })
);
