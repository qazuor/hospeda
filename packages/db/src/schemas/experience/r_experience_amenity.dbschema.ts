import { relations } from 'drizzle-orm';
import { index, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { amenities } from '../accommodation/amenity.dbschema.ts';
import { experiences } from './experiences.dbschema.ts';

/**
 * Junction table: experience <-> amenity (many-to-many, SPEC-240).
 *
 * Mirrors r_gastronomy_amenity with composite PK on (experienceId, amenityId).
 * Both FKs cascade on delete so rows are cleaned up automatically.
 * References the existing shared `amenities` catalog (same as accommodations and gastronomy).
 */
export const rExperienceAmenity = pgTable(
    'r_experience_amenity',
    {
        experienceId: uuid('experience_id')
            .notNull()
            .references(() => experiences.id, { onDelete: 'cascade' }),
        amenityId: uuid('amenity_id')
            .notNull()
            .references(() => amenities.id, { onDelete: 'cascade' })
    },
    (table) => ({
        pk: primaryKey({ columns: [table.experienceId, table.amenityId] }),
        experienceId_amenityId_idx: index('r_experience_amenity_experienceId_amenityId_idx').on(
            table.experienceId,
            table.amenityId
        ),
        amenityId_idx: index('r_experience_amenity_amenityId_idx').on(table.amenityId)
    })
);

export const rExperienceAmenityRelations = relations(rExperienceAmenity, ({ one }) => ({
    experience: one(experiences, {
        relationName: 'experienceToAmenity',
        fields: [rExperienceAmenity.experienceId],
        references: [experiences.id]
    }),
    amenity: one(amenities, {
        fields: [rExperienceAmenity.amenityId],
        references: [amenities.id]
    })
}));

/** Type-inferred insert type for r_experience_amenity rows. */
export type InsertRExperienceAmenity = typeof rExperienceAmenity.$inferInsert;
/** Type-inferred select type for r_experience_amenity rows. */
export type SelectRExperienceAmenity = typeof rExperienceAmenity.$inferSelect;
