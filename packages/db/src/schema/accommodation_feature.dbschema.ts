import type { AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { accommodations } from './accommodation.dbschema';
import { StatePgEnum } from './enums.dbschema';
import { accommodationFeatureRelations } from './r_accommodation_feature.dbschema';
import { entityTagRelations } from './r_entity_tag.dbschema';
import { users } from './user.dbschema';

/**
 * accommodation_features table schema
 */
export const accommodationFeatures: ReturnType<typeof pgTable> = pgTable('accommodation_features', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    displayName: text('display_name').notNull(),
    description: text('description'),
    icon: text('icon'),
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
 * Relations for accommodation_features table
 */
export const accommodationFeaturesRelations = relations(accommodationFeatures, ({ one, many }) => ({
    createdBy: one(users, { fields: [accommodationFeatures.createdById], references: [users.id] }),
    updatedBy: one(users, { fields: [accommodationFeatures.updatedById], references: [users.id] }),
    deletedBy: one(users, { fields: [accommodationFeatures.deletedById], references: [users.id] }),
    accommodationRelations: many(accommodationFeatureRelations),
    accommodations: many(accommodations, { relationName: 'r_accommodation_feature' }),
    tags: many(entityTagRelations)
}));
