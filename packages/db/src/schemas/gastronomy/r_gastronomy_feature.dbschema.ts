import { relations } from 'drizzle-orm';
import { index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { features } from '../accommodation/feature.dbschema.ts';
import { gastronomies } from './gastronomy.dbschema.ts';

/**
 * Junction table: gastronomy <-> feature (many-to-many, SPEC-239).
 *
 * Mirrors r_accommodation_feature with composite PK on (gastronomyId, featureId).
 * Both FKs cascade on delete so rows are cleaned up automatically.
 * References the existing shared `features` catalog (same as accommodations).
 * Includes hostReWriteName and comments just like the accommodation variant.
 */
export const rGastronomyFeature = pgTable(
    'r_gastronomy_feature',
    {
        gastronomyId: uuid('gastronomy_id')
            .notNull()
            .references(() => gastronomies.id, { onDelete: 'cascade' }),
        featureId: uuid('feature_id')
            .notNull()
            .references(() => features.id, { onDelete: 'cascade' }),
        /** Optional owner-provided rename for the feature label. */
        hostReWriteName: text('host_rewrite_name'),
        /** Optional freeform comments about the feature for this listing. */
        comments: text('comments')
    },
    (table) => ({
        pk: primaryKey({ columns: [table.gastronomyId, table.featureId] }),
        gastronomyId_featureId_idx: index('r_gastronomy_feature_gastronomyId_featureId_idx').on(
            table.gastronomyId,
            table.featureId
        ),
        featureId_idx: index('r_gastronomy_feature_featureId_idx').on(table.featureId)
    })
);

export const rGastronomyFeatureRelations = relations(rGastronomyFeature, ({ one }) => ({
    gastronomy: one(gastronomies, {
        relationName: 'gastronomyToFeature',
        fields: [rGastronomyFeature.gastronomyId],
        references: [gastronomies.id]
    }),
    feature: one(features, {
        fields: [rGastronomyFeature.featureId],
        references: [features.id]
    })
}));

/** Type-inferred insert type for r_gastronomy_feature rows. */
export type InsertRGastronomyFeature = typeof rGastronomyFeature.$inferInsert;
/** Type-inferred select type for r_gastronomy_feature rows. */
export type SelectRGastronomyFeature = typeof rGastronomyFeature.$inferSelect;
