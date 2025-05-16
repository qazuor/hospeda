import type { AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { accommodationFeatures } from './accommodation_feature.dbschema';
import { StatePgEnum } from './enums.dbschema';
import { entityTagRelations } from './r_entity_tag.dbschema';
import { users } from './user.dbschema';

/**
 * features table schema
 */
export const features = pgTable('features', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(), // Internal unique name
    displayName: text('display_name').notNull(), // Name for display
    description: text('description'),
    icon: text('icon'), // Icon identifier or URL
    isBuiltin: boolean('is_builtin').notNull(), // Is this a system-defined feature?
    state: StatePgEnum('state').default('ACTIVE').notNull(), // ACTIVE, INACTIVE, etc.
    adminInfo: jsonb('admin_info').$type<AdminInfoType>(), // JSON for admin notes, etc.

    // Audit fields
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
});

/**
 * Relations for features table
 */
export const featuresRelations = relations(features, ({ one, many }) => ({
    createdBy: one(users, {
        fields: [features.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [features.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [features.deletedById],
        references: [users.id]
    }),
    accommodationFeatures: many(accommodationFeatures),
    tags: many(entityTagRelations)
}));
