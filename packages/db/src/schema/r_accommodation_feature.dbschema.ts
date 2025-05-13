import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { accommodations } from './accommodation.dbschema';
import { accommodationFeatures } from './accommodation_feature.dbschema';

/**
 * r_accommodation_feature join table
 * Composite PK on (accommodation_id, feature_id)
 */
export const accommodationFeatureRelations: ReturnType<typeof pgTable> = pgTable(
    'r_accommodation_feature',
    {
        accommodationId: uuid('accommodation_id')
            .notNull()
            .references(() => accommodations.id, { onDelete: 'cascade' }),
        featureId: uuid('feature_id')
            .notNull()
            .references(() => accommodationFeatures.id, { onDelete: 'cascade' })
    },
    (table) => ({
        pk: primaryKey({ columns: [table.accommodationId, table.featureId] })
    })
);
