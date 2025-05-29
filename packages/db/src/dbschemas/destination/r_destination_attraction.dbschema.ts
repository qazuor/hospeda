import { relations } from 'drizzle-orm';
import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { attractions } from './attraction.dbschema.ts';
import { destinations } from './destination.dbschema.ts';

export const rDestinationAttraction = pgTable(
    'r_destination_attraction',
    {
        destinationId: uuid('destination_id')
            .notNull()
            .references(() => destinations.id, { onDelete: 'cascade' }),
        attractionId: uuid('attraction_id')
            .notNull()
            .references(() => attractions.id, { onDelete: 'cascade' })
    },
    (table) => ({
        pk: primaryKey({ columns: [table.destinationId, table.attractionId] }),
        destinationId_attractionId_idx: index('destinationId_attractionId_idx').on(
            table.destinationId,
            table.attractionId
        ),
        attractionId_idx: index('r_destination_attraction_attractionId_idx').on(table.attractionId)
    })
);

export const rDestinationAttractionRelations = relations(
    rDestinationAttraction,
    ({ one, many }) => ({
        destination: one(destinations, {
            fields: [rDestinationAttraction.destinationId],
            references: [destinations.id]
        }),
        attraction: one(attractions, {
            fields: [rDestinationAttraction.attractionId],
            references: [attractions.id]
        }),
        /**
         * Inverse navigation: All destinations that have this attraction (for join queries).
         */
        destinationsWithAttraction: many(destinations)
    })
);
