import type { AdminInfoType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { accommodations } from './accommodation.dbschema.js';
import { StatePgEnum } from './enums.dbschema.js';
import { features } from './feature.dbschema.js';
import { users } from './user.dbschema.js';

/**
 * accommodation_features table schema - relationships between accommodations and features
 */
export const accommodationFeatures = pgTable('accommodation_features', {
    /** FK to accommodations.id */
    accommodationId: uuid('accommodation_id')
        .notNull()
        .references(() => accommodations.id, { onDelete: 'cascade' }),

    /** FK to features.id */
    featureId: uuid('feature_id')
        .notNull()
        .references(() => features.id, { onDelete: 'cascade' }),

    // Custom fields specific to this relationship as requested
    hostReWriteName: text('host_rewrite_name'),
    comments: text('comments'),

    state: StatePgEnum('state').default('ACTIVE').notNull(),
    adminInfo: jsonb('admin_info').$type<AdminInfoType>(),

    // Audit fields for THIS relationship
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
export const accommodationFeaturesRelations = relations(accommodationFeatures, ({ one }) => ({
    // Relation to the accommodation
    accommodation: one(accommodations, {
        fields: [accommodationFeatures.accommodationId],
        references: [accommodations.id]
    }),

    // Relation to the feature
    feature: one(features, {
        fields: [accommodationFeatures.featureId],
        references: [features.id]
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [accommodationFeatures.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [accommodationFeatures.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [accommodationFeatures.deletedById],
        references: [users.id]
    })
}));
