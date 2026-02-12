import type { AdminInfoType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { LifecycleStatusPgEnum } from '../enums.dbschema.ts';
import { users } from '../user/user.dbschema.ts';
import { rDestinationAttraction } from './r_destination_attraction.dbschema.ts';

export const attractions = pgTable(
    'attractions',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        name: text('name').notNull(),
        slug: text('slug').notNull().unique(),
        description: text('description'),
        icon: text('icon'),
        isBuiltin: boolean('is_builtin').notNull().default(false),
        isFeatured: boolean('is_featured').notNull().default(false),
        lifecycleState: LifecycleStatusPgEnum('lifecycle_state').notNull().default('ACTIVE'),
        adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
        createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
        updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
        deletedAt: timestamp('deleted_at', { withTimezone: true }),
        deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
    },
    (table) => ({
        attractions_slug_idx: index('attractions_slug_idx').on(table.slug),
        attractions_isFeatured_idx: index('attractions_isFeatured_idx').on(table.isFeatured),
        attractions_lifecycleState_idx: index('attractions_lifecycleState_idx').on(
            table.lifecycleState
        )
    })
);

export const attractionsRelations = relations(attractions, ({ many }) => ({
    destinations: many(rDestinationAttraction)
}));
