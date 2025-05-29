import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { permissions } from './permission.dbschema.ts';
import { roles } from './role.dbschema.ts';

export const rRolePermission = pgTable(
    'r_role_permission',
    {
        roleId: uuid('role_id')
            .notNull()
            .references(() => roles.id, { onDelete: 'cascade' }),
        permissionId: uuid('permission_id')
            .notNull()
            .references(() => permissions.id, { onDelete: 'cascade' })
    },
    (table) => ({
        pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
        roleId_idx: index('r_role_permission_roleId_idx').on(table.roleId),
        permissionId_idx: index('r_role_permission_permissionId_idx').on(table.permissionId)
    })
);
