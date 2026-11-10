import type { PriceType } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import {
    boolean,
    doublePrecision,
    index,
    jsonb,
    pgTable,
    primaryKey,
    uuid
} from 'drizzle-orm/pg-core';
import { amenities } from '../accommodation/amenity.dbschema.ts';
import { AmenityAvailabilityPgEnum, AmenityScopePgEnum } from '../enums.dbschema.ts';
import { venues } from './venue.dbschema.ts';

/**
 * Junction table: venue <-> amenity (many-to-many, SPEC-239).
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
            .references(() => amenities.id, { onDelete: 'cascade' }),
        /**
         * HOS-2061: relation attributes, identical in shape to
         * `r_accommodation_amenity` (one standard across verticals).
         */
        /**
         * HOS-2084: "paid separately / extra charge" (UI: "Con cargo extra"). A flag
         * only: no amount is captured. Written by the owner editor as `extraCharge`.
         */
        isOptional: boolean('is_optional').notNull().default(false),
        additionalCost: jsonb('additional_cost').$type<PriceType>(),
        additionalCostPercent: doublePrecision('additional_cost_percent'),
        /** private/shared. NULL = not declared; never inferred. */
        scope: AmenityScopePgEnum('scope'),
        /** year-round/seasonal. NULL = not declared; never inferred. */
        availability: AmenityAvailabilityPgEnum('availability')
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
