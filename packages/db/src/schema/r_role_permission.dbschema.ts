// packages/db/src/schema/r_role_permission.dbschema.ts

import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { permissions } from './permission.dbschema';
import { roles } from './role.dbschema';

/**
 * Join table between roles and permissions.
 * Composite PK on (role_id, permission_id).
 */
export const rolePermissions = pgTable(
    'r_role_permission',
    {
        /** FK to roles.id */
        roleId: uuid('role_id')
            .notNull()
            .references(() => roles.id, { onDelete: 'cascade' }),

        /** FK to permissions.id */
        permissionId: uuid('permission_id')
            .notNull()
            .references(() => permissions.id, { onDelete: 'cascade' })
    },
    (table) => ({
        /** Composite primary key */
        pk: primaryKey({ columns: [table.roleId, table.permissionId] })
    })
);
