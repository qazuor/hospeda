import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { roles } from './role.dbschema.ts';
import { users } from './user.dbschema.ts';

export const rUserRole = pgTable(
    'r_user_role',
    {
        userId: uuid('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        roleId: uuid('role_id')
            .notNull()
            .references(() => roles.id, { onDelete: 'cascade' })
    },
    (table) => ({
        pk: primaryKey({ columns: [table.userId, table.roleId] }),
        userId_idx: index('r_user_role_userId_idx').on(table.userId),
        roleId_idx: index('r_user_role_roleId_idx').on(table.roleId)
    })
);
