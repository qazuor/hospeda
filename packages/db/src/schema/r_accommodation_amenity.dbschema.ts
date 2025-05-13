import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { accommodations } from './accommodation.dbschema';
import { accommodationAmenities } from './accommodation_amenity.dbschema';

/**
 * r_accommodation_amenity join table
 * Composite PK on (accommodation_id, amenity_id)
 */
export const accommodationAmenityRelations: ReturnType<typeof pgTable> = pgTable(
    'r_accommodation_amenity',
    {
        accommodationId: uuid('accommodation_id')
            .notNull()
            .references(() => accommodations.id, { onDelete: 'cascade' }),
        amenityId: uuid('amenity_id')
            .notNull()
            .references(() => accommodationAmenities.id, { onDelete: 'cascade' })
    },
    (table) => ({
        pk: primaryKey({ columns: [table.accommodationId, table.amenityId] })
    })
);
