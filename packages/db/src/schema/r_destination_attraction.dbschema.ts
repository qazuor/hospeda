import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { destinations } from './destination.dbschema.js';
import { destinationAttractions } from './destination_attraction.dbschema.js';

/**
 * r_destination_attraction join table
 * Composite PK on (destination_id, attraction_id)
 */
export const destinationAttractionRelations: ReturnType<typeof pgTable> = pgTable(
    'r_destination_attraction',
    {
        /** FK to destinations.id */
        destinationId: uuid('destination_id')
            .notNull()
            .references(() => destinations.id, { onDelete: 'cascade' }),

        /** FK to destination_attractions.id */
        attractionId: uuid('attraction_id')
            .notNull()
            .references(() => destinationAttractions.id, { onDelete: 'cascade' })
    },
    (table) => ({
        /** Composite primary key to prevent duplicates */
        pk: primaryKey({ columns: [table.destinationId, table.attractionId] })
    })
);
