// packages/db/src/schema/role.dbschema.ts

import type { AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { StatePgEnum } from './enums.dbschema';
import { permissions } from './permission.dbschema';
import { rolePermissions } from './r_role_permission.dbschema';
import { users } from './user.dbschema';

/**
 * roles table schema
 */
export const roles: ReturnType<typeof pgTable> = pgTable(
    'roles',
    {
        /** Primary key for each role */
        id: uuid('id').primaryKey().defaultRandom(),

        /** Internal name of the role (must be unique) */
        name: text('name').notNull(),

        /** Display name for UI */
        displayName: text('display_name').notNull(),

        /** Human-readable description */
        description: text('description').notNull(),

        /** State of the role (ACTIVE, INACTIVE, etc.) */
        state: StatePgEnum('state').default('ACTIVE').notNull(),

        /** Admin metadata (notes, favorite) */
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),

        /** Built-in vs custom role */
        isBuiltIn: boolean('is_builtin').notNull(),
        /** Deprecated flag */
        isDeprecated: boolean('is_deprecated'),
        /** Default flag (assigned to new users) */
        isDefault: boolean('is_default'),

        /** Audit timestamps and soft-delete */
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),

        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),

        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        /** Enforce unique role names */
        uniqueRoleName: uniqueIndex('roles_name_key').on(table.name)
    })
);

/**
 * Relations for roles table
 */
export const rolesRelations = relations(roles, ({ one, many }) => ({
    /** Who created this role */
    createdBy: one(users, {
        fields: [roles.createdById],
        references: [users.id]
    }),
    /** Who last updated this role */
    updatedBy: one(users, {
        fields: [roles.updatedById],
        references: [users.id]
    }),
    /** Who soft-deleted this role */
    deletedBy: one(users, {
        fields: [roles.deletedById],
        references: [users.id]
    }),
    /** Users assigned to this role */
    users: many(users),

    // Join‐table N→M
    rolePermissions: many(rolePermissions),
    permissions: many(permissions, { relationName: 'r_role_permission' })
}));
