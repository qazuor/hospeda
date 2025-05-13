import type { AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { StatePgEnum } from './enums.dbschema';
import { rolePermissions } from './r_role_permission.dbschema';
import { userPermissions } from './r_user_permission.dbschema';
import { roles } from './role.dbschema';
import { users } from './user.dbschema';

/**
 * permissions table schema
 */
export const permissions: ReturnType<typeof pgTable> = pgTable(
    'permissions',
    {
        /** Primary key */
        id: uuid('id').primaryKey().defaultRandom(),

        /** Internal name of the permission (must be unique) */
        name: text('name').notNull(),

        /** Display name for UI */
        displayName: text('display_name').notNull(),

        /** Description of what this permission allows */
        description: text('description').notNull(),

        /** General state (ACTIVE, INACTIVE, etc.) */
        state: StatePgEnum('state').default('ACTIVE').notNull(),

        /** Admin metadata (notes, favorite) */
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),

        /** Built-in vs custom permission */
        isBuiltIn: boolean('is_builtin').notNull(),

        /** Deprecated flag */
        isDeprecated: boolean('is_deprecated'),

        /** Audit timestamps and soft-delete */
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),

        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),

        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        /** Enforce unique permission names */
        uniquePermissionName: uniqueIndex('permissions_name_key').on(table.name)
    })
);

/**
 * Relations for permissions table
 */
export const permissionsRelations = relations(permissions, ({ one, many }) => ({
    /** Who created this permission */
    createdBy: one(users, {
        fields: [permissions.createdById],
        references: [users.id]
    }),
    /** Who last updated this permission */
    updatedBy: one(users, {
        fields: [permissions.updatedById],
        references: [users.id]
    }),
    /** Who soft-deleted this permission */
    deletedBy: one(users, {
        fields: [permissions.deletedById],
        references: [users.id]
    }),

    /** Which roles include this permission */
    rolePermissions: many(rolePermissions),
    roles: many(roles, { relationName: 'r_role_permission' }),

    /** Which users have this explicit permission */
    userPermissions: many(userPermissions),
    users: many(users, { relationName: 'r_user_permission' })
}));
