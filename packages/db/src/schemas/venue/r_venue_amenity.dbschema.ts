import { relations } from 'drizzle-orm';
import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { amenities } from '../accommodation/amenity.dbschema.ts';
import { venues } from './venue.dbschema.ts';

/**
 * Junction table: gastronomy <-> amenity (many-to-many, SPEC-239).
 *
 * Mirrors r_accommodation_amenity with composite PK on (venueId, amenityId).
 * Both FKs cascade on delete so rows are cleaned up automatically.
 * References the existing shared `amenities` catalog (same as accommodations).
 */
export const rVenueAmenity = pgTable(
    'r_venue_amenity',
    {
        venueId: uuid('venue_id')
            .notNull()
            .references(() => venues.id, { onDelete: 'cascade' }),
        amenityId: uuid('amenity_id')
            .notNull()
            .references(() => amenities.id, { onDelete: 'cascade' })
    },
    (table) => ({
        pk: primaryKey({ columns: [table.venueId, table.amenityId] }),
        venueId_amenityId_idx: index('r_venue_amenity_venueId_amenityId_idx').on(
            table.venueId,
            table.amenityId
        ),
        amenityId_idx: index('r_venue_amenity_amenityId_idx').on(table.amenityId)
    })
);

export const rVenueAmenityRelations = relations(rVenueAmenity, ({ one }) => ({
    venue: one(venues, {
        relationName: 'venueToAmenity',
        fields: [rVenueAmenity.venueId],
        references: [venues.id]
    }),
    amenity: one(amenities, {
        fields: [rVenueAmenity.amenityId],
        references: [amenities.id]
    })
}));

/** Type-inferred insert type for r_venue_amenity rows. */
export type InsertRVenueAmenity = typeof rVenueAmenity.$inferInsert;
/** Type-inferred select type for r_venue_amenity rows. */
export type SelectRVenueAmenity = typeof rVenueAmenity.$inferSelect;
