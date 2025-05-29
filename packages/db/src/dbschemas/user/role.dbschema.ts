import type { AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { rRolePermission } from './r_role_permission.dbschema.ts';
import { rUserRole } from './r_user_role.dbschema.ts';
import { users } from './user.dbschema.ts';

export const roles: ReturnType<typeof pgTable> = pgTable(
    'roles',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: text('name').notNull().unique(),
        description: text('description').notNull(),
        isBuiltIn: boolean('is_built_in').notNull().default(false),
        isDeprecated: boolean('is_deprecated').notNull().default(false),
        isDefault: boolean('is_default').notNull().default(false),
        lifecycle: LifecycleStatusPgEnum('lifecycle').notNull().default('ACTIVE'),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table: typeof roles) => ({
        uniqueRoleName: uniqueIndex('roles_name_key').on(table.name)
    })
);

export const rolesRelations = relations(roles, ({ many }) => ({
    users: many(rUserRole),
    permissions: many(rRolePermission)
}));
