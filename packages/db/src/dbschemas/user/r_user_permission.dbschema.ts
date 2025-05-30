import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { permissions } from './permission.dbschema.ts';
import { users } from './user.dbschema.ts';

export const rUserPermission: ReturnType<typeof pgTable> = pgTable(
    'r_user_permission',
    {
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        permissionId: uuid('permission_id')
            .notNull()
            .references(() => permissions.id, { onDelete: 'cascade' })
    },
    (table) => ({
        pk: primaryKey({ columns: [table.userId, table.permissionId] }),
        userId_idx: index('r_user_permission_userId_idx').on(table.userId),
        permissionId_idx: index('r_user_permission_permissionId_idx').on(table.permissionId)
    })
);
