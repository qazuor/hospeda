import type { AdminInfoType, BasePriceType } from '@repo/types';
import { relations } from 'drizzle-orm';
import { boolean, doublePrecision, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { accommodations } from './accommodation.dbschema.js';
import { amenities } from './amenity.dbschema.js';
import { StatePgEnum } from './enums.dbschema.js';
import { users } from './user.dbschema.js';

/**
 * accommodation_amenities table schema - relationships between accommodations and amenities
 */
export const accommodationAmenities = pgTable('accommodation_amenities', {
    /** FK to accommodations.id */
    accommodationId: uuid('accommodation_id')
        .notNull()
        .references(() => accommodations.id, { onDelete: 'cascade' }),

    /** FK to amenities.id (the new base table) */
    amenityId: uuid('amenity_id')
        .notNull()
        .references(() => amenities.id, { onDelete: 'cascade' }), // Reference the new amenities table

    // Attributes specific to this relationship (moved from the previous structure)
    isOptional: boolean('is_optional').notNull(),
    additionalCost: jsonb('additional_cost').$type<BasePriceType>(), // Typed JSONB
    additionalCostPercent: doublePrecision('additional_cost_percent'),

    state: StatePgEnum('state').default('ACTIVE').notNull(), // State for THIS relationship
    adminInfo: jsonb('admin_info').$type<AdminInfoType>(), // Admin info for THIS relationship

    // Audit fields for THIS relationship
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdById: uuid('created_by_id').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    updatedById: uuid('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedById: uuid('deleted_by_id').references(() => users.id, { onDelete: 'set null' })
});

/**
 * Relations for accommodation_amenities table
 */
export const accommodationAmenitiesRelations = relations(accommodationAmenities, ({ one }) => ({
    // Relation to the accommodation
    accommodation: one(accommodations, {
        fields: [accommodationAmenities.accommodationId],
        references: [accommodations.id]
    }),

    // Relation to the amenity
    amenity: one(amenities, {
        fields: [accommodationAmenities.amenityId],
        references: [amenities.id]
    }),

    // Audit relations
    createdBy: one(users, {
        fields: [accommodationAmenities.createdById],
        references: [users.id]
    }),
    updatedBy: one(users, {
        fields: [accommodationAmenities.updatedById],
        references: [users.id]
    }),
    deletedBy: one(users, {
        fields: [accommodationAmenities.deletedById],
        references: [users.id]
    })
}));
