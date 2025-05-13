import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { permissions } from './permission.dbschema';
import { users } from './user.dbschema';

/**
 * Join table between users and permissions.
 * Composite PK on (user_id, permission_id).
 */
export const userPermissions = pgTable(
    'r_user_permission',
    {
        /** FK to users.id */
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),

        /** FK to permissions.id */
        permissionId: uuid('permission_id')
            .notNull()
            .references(() => permissions.id, { onDelete: 'cascade' })
    },
    (table) => ({
        /** Composite primary key */
        pk: primaryKey({ columns: [table.userId, table.permissionId] })
    })
);
