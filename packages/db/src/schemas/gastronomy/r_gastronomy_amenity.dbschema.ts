import { relations } from 'drizzle-orm';
import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { amenities } from '../accommodation/amenity.dbschema.ts';
import { gastronomies } from './gastronomy.dbschema.ts';

/**
 * Junction table: gastronomy <-> amenity (many-to-many, SPEC-239).
 *
 * Mirrors r_accommodation_amenity with composite PK on (gastronomyId, amenityId).
 * Both FKs cascade on delete so rows are cleaned up automatically.
 * References the existing shared `amenities` catalog (same as accommodations).
 */
export const rGastronomyAmenity = pgTable(
    'r_gastronomy_amenity',
    {
        gastronomyId: uuid('gastronomy_id')
            .notNull()
            .references(() => gastronomies.id, { onDelete: 'cascade' }),
        amenityId: uuid('amenity_id')
            .notNull()
            .references(() => amenities.id, { onDelete: 'cascade' })
    },
    (table) => ({
        pk: primaryKey({ columns: [table.gastronomyId, table.amenityId] }),
        gastronomyId_amenityId_idx: index('r_gastronomy_amenity_gastronomyId_amenityId_idx').on(
            table.gastronomyId,
            table.amenityId
        ),
        amenityId_idx: index('r_gastronomy_amenity_amenityId_idx').on(table.amenityId)
    })
);

export const rGastronomyAmenityRelations = relations(rGastronomyAmenity, ({ one }) => ({
    gastronomy: one(gastronomies, {
        relationName: 'gastronomyToAmenity',
        fields: [rGastronomyAmenity.gastronomyId],
        references: [gastronomies.id]
    }),
    amenity: one(amenities, {
        fields: [rGastronomyAmenity.amenityId],
        references: [amenities.id]
    })
}));

/** Type-inferred insert type for r_gastronomy_amenity rows. */
export type InsertRGastronomyAmenity = typeof rGastronomyAmenity.$inferInsert;
/** Type-inferred select type for r_gastronomy_amenity rows. */
export type SelectRGastronomyAmenity = typeof rGastronomyAmenity.$inferSelect;
