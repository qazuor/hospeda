import { PointOfInterestDestinationRelationEnum } from '@repo/schemas';
import { relations } from 'drizzle-orm';
import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { PointOfInterestDestinationRelationPgEnum } from '../enums.dbschema.ts';
import { destinations } from './destination.dbschema.ts';
import { pointsOfInterest } from './point-of-interest.dbschema.ts';

/**
 * Destination <-> Point of Interest join table (M2M, HOS-113 OQ-1). A POI's
 * coordinates live on the POI row (a single physical point); this table
 * lets a regional/border landmark surface from several destinations.
 * Mirrors `r_destination_attraction`.
 *
 * `relation` (HOS-140) distinguishes a POI physically located in the
 * destination (`PRIMARY`, the default) from a POI merely cross-referenced
 * from a different destination's page (`NEARBY`). It is a plain column
 * outside the composite PK — see HOS-140 spec §6.1 for why the PK stays
 * `(destinationId, pointOfInterestId)` unchanged.
 */
export const rDestinationPointOfInterest = pgTable(
    'r_destination_point_of_interest',
    {
        destinationId: uuid('destination_id')
            .notNull()
            .references(() => destinations.id, { onDelete: 'cascade' }),
        pointOfInterestId: uuid('point_of_interest_id')
            .notNull()
            .references(() => pointsOfInterest.id, { onDelete: 'cascade' }),
        relation: PointOfInterestDestinationRelationPgEnum('relation')
            .notNull()
            .default(PointOfInterestDestinationRelationEnum.PRIMARY)
    },
    (table) => ({
        pk: primaryKey({ columns: [table.destinationId, table.pointOfInterestId] }),
        destinationId_pointOfInterestId_idx: index('destinationId_pointOfInterestId_idx').on(
            table.destinationId,
            table.pointOfInterestId
        ),
        pointOfInterestId_idx: index('r_destination_point_of_interest_pointOfInterestId_idx').on(
            table.pointOfInterestId
        )
    })
);

export const rDestinationPointOfInterestRelations = relations(
    rDestinationPointOfInterest,
    ({ one, many }) => ({
        destination: one(destinations, {
            fields: [rDestinationPointOfInterest.destinationId],
            references: [destinations.id]
        }),
        pointOfInterest: one(pointsOfInterest, {
            fields: [rDestinationPointOfInterest.pointOfInterestId],
            references: [pointsOfInterest.id]
        }),
        /**
         * Inverse navigation: All destinations that have this point of
         * interest (for join queries).
         */
        destinationsWithPointOfInterest: many(destinations)
    })
);

export type InsertRDestinationPointOfInterest = typeof rDestinationPointOfInterest.$inferInsert;
export type SelectRDestinationPointOfInterest = typeof rDestinationPointOfInterest.$inferSelect;
