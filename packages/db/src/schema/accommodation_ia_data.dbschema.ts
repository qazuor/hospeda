import type { AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { accommodations } from './accommodation.dbschema';
import { StatePgEnum } from './enums.dbschema';
import { entityTagRelations } from './r_entity_tag.dbschema';
import { users } from './user.dbschema';

/**
 * accommodation_ia_data table schema
 */
export const accommodationIaData: ReturnType<typeof pgTable> = pgTable('accommodation_ia_data', {
    id: uuid('id').primaryKey().defaultRandom(),
    accommodationId: uuid('accommodation_id')
        .notNull()
        .references(() => accommodations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    content: text('content').notNull(),
    category: text('category'),
    state: StatePgEnum('state').default('ACTIVE').notNull(),
    adminInfo: jsonb('admin_info').$type<AdminInfoType>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
});

/**
 * Relations for accommodation_ia_data table
 */
export const accommodationIaDataRelations = relations(accommodationIaData, ({ one, many }) => ({
    createdBy: one(users),
    updatedBy: one(users),
    deletedBy: one(users),
    accommodation: one(accommodations),
    tags: many(entityTagRelations)
}));
