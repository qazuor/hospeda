import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { accommodations } from './accommodation.dbschema';
import { accommodationIaData } from './accommodation_ia_data.dbschema';

/**
 * r_accommodation_ia_data join table
 * Composite PK on (accommodation_id, ia_data_id)
 */
export const rAccommodationIaDataRelations: ReturnType<typeof pgTable> = pgTable(
    'r_accommodation_ia_data',
    {
        accommodationId: uuid('accommodation_id')
            .notNull()
            .references(() => accommodations.id, { onDelete: 'cascade' }),
        iaDataId: uuid('ia_data_id')
            .notNull()
            .references(() => accommodationIaData.id, { onDelete: 'cascade' })
    },
    (table) => ({
        pk: primaryKey({ columns: [table.accommodationId, table.iaDataId] })
    })
);
