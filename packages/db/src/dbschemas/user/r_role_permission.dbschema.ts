import { pgTable, primaryKey } from 'drizzle-orm/pg-core';
import { PermissionPgEnum, RolePgEnum } from '../enums.dbschema.ts';

/**
 * Table for assigning permissions to roles (by enum, not id).
 */
export const rolePermission = pgTable(
    'role_permission',
    {
        role: RolePgEnum('role').notNull(),
        permission: PermissionPgEnum('permission').notNull()
    },
    (table) => ({
        pk: primaryKey({ columns: [table.role, table.permission] })
    })
);
