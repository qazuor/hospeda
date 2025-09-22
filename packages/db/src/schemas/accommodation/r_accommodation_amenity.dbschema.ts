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
import { accommodations } from './accommodation.dbschema.ts';
import { amenities } from './amenity.dbschema.ts';

export const rAccommodationAmenity: ReturnType<typeof pgTable> = pgTable(
    'r_accommodation_amenity',
    {
        accommodationId: uuid('accommodation_id')
            .notNull()
            .references(() => accommodations.id, { onDelete: 'cascade' }),
        amenityId: uuid('amenity_id')
            .notNull()
            .references(() => amenities.id, { onDelete: 'cascade' }),
        isOptional: boolean('is_optional').notNull().default(false),
        additionalCost: jsonb('additional_cost').$type<PriceType>(),
        additionalCostPercent: doublePrecision('additional_cost_percent')
    },
    (table) => ({
        pk: primaryKey({ columns: [table.accommodationId, table.amenityId] }),
        accommodationId_amenityId_idx: index('accommodationId_amenityId_idx').on(
            table.accommodationId,
            table.amenityId
        ),
        amenityId_idx: index('r_accommodation_amenity_amenityId_idx').on(table.amenityId)
    })
);

export const rAccommodationAmenityRelations = relations(rAccommodationAmenity, ({ one, many }) => ({
    accommodation: one(accommodations, {
        fields: [rAccommodationAmenity.accommodationId],
        references: [accommodations.id]
    }),
    amenity: one(amenities, {
        fields: [rAccommodationAmenity.amenityId],
        references: [amenities.id]
    }),
    /**
     * Inverse navigation: All accommodations that have this amenity (for join queries).
     */
    accommodationsWithAmenity: many(accommodations)
}));
