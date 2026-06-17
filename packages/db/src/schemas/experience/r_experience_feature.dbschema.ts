import { relations } from 'drizzle-orm';
import { index, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { features } from '../accommodation/feature.dbschema.ts';
import { experiences } from './experiences.dbschema.ts';

/**
 * Junction table: experience <-> feature (many-to-many, SPEC-240).
 *
 * Mirrors r_gastronomy_feature with composite PK on (experienceId, featureId).
 * Both FKs cascade on delete so rows are cleaned up automatically.
 * References the existing shared `features` catalog (same as accommodations and gastronomy).
 * Includes hostReWriteName and comments just like the gastronomy and accommodation variants.
 */
export const rExperienceFeature = pgTable(
    'r_experience_feature',
    {
        experienceId: uuid('experience_id')
            .notNull()
            .references(() => experiences.id, { onDelete: 'cascade' }),
        featureId: uuid('feature_id')
            .notNull()
            .references(() => features.id, { onDelete: 'cascade' }),
        /** Optional owner-provided rename for the feature label. */
        hostReWriteName: text('host_rewrite_name'),
        /** Optional freeform comments about the feature for this listing. */
        comments: text('comments')
    },
    (table) => ({
        pk: primaryKey({ columns: [table.experienceId, table.featureId] }),
        experienceId_featureId_idx: index('r_experience_feature_experienceId_featureId_idx').on(
            table.experienceId,
            table.featureId
        ),
        featureId_idx: index('r_experience_feature_featureId_idx').on(table.featureId)
    })
);

export const rExperienceFeatureRelations = relations(rExperienceFeature, ({ one }) => ({
    experience: one(experiences, {
        relationName: 'experienceToFeature',
        fields: [rExperienceFeature.experienceId],
        references: [experiences.id]
    }),
    feature: one(features, {
        fields: [rExperienceFeature.featureId],
        references: [features.id]
    })
}));

/** Type-inferred insert type for r_experience_feature rows. */
export type InsertRExperienceFeature = typeof rExperienceFeature.$inferInsert;
/** Type-inferred select type for r_experience_feature rows. */
export type SelectRExperienceFeature = typeof rExperienceFeature.$inferSelect;
