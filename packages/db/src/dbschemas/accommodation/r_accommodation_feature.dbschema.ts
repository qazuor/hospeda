import { relations } from 'drizzle-orm';
import { index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { accommodations } from './accommodation.dbschema.ts';
import { features } from './feature.dbschema.ts';

export const rAccommodationFeature = pgTable(
    'r_accommodation_feature',
    {
        accommodationId: uuid('accommodation_id')
            .notNull()
            .references(() => accommodations.id, { onDelete: 'cascade' }),
        featureId: uuid('feature_id')
            .notNull()
            .references(() => features.id, { onDelete: 'cascade' }),
        hostReWriteName: text('host_rewrite_name'),
        comments: text('comments')
    },
    (table) => ({
        pk: primaryKey({ columns: [table.accommodationId, table.featureId] }),
        accommodationId_featureId_idx: index('accommodationId_featureId_idx').on(
            table.accommodationId,
            table.featureId
        ),
        featureId_idx: index('r_accommodation_feature_featureId_idx').on(table.featureId)
    })
);

export const rAccommodationFeatureRelations = relations(rAccommodationFeature, ({ one, many }) => ({
    accommodation: one(accommodations, {
        fields: [rAccommodationFeature.accommodationId],
        references: [accommodations.id]
    }),
    feature: one(features, {
        fields: [rAccommodationFeature.featureId],
        references: [features.id]
    }),
    /**
     * Inverse navigation: All accommodations that have this feature (for join queries).
     */
    accommodationsWithFeature: many(accommodations)
}));
