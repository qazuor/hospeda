import { z } from 'zod';
import { BaseAuditFields } from '../../common/audit.schema.js';
import { PoiCategoryIdSchema, PointOfInterestIdSchema } from '../../common/id.schema.js';

/**
 * Relation Schemas for POI Category assignment (HOS-139)
 *
 * Handles the many-to-many relationship between points of interest and
 * categories via the `r_poi_category` join table — mirrors
 * `point-of-interest.relations.schema.ts`'s shape for the
 * destination-relation join, with one addition: the `isPrimary` per-POI
 * invariant (spec §6.2) — at most one row per `pointOfInterestId` may have
 * `isPrimary = true`.
 */

/**
 * PointOfInterest-Category Relation Schema
 * Represents a single row of the many-to-many relationship between points of
 * interest and categories.
 */
export const PointOfInterestCategoryRelationSchema = z.object({
    pointOfInterestId: PointOfInterestIdSchema,
    categoryId: PoiCategoryIdSchema,
    isPrimary: z.boolean().default(false),
    ...BaseAuditFields
});

/**
 * Schema for assigning a category to a point of interest.
 *
 * If `isPrimary: true` is passed and the POI already has a different
 * primary category, the service demotes the existing primary in the same
 * transaction (spec §6.4) — never two primaries simultaneously.
 */
export const AssignCategoryToPointOfInterestInputSchema = z.object({
    pointOfInterestId: PointOfInterestIdSchema,
    categoryId: PoiCategoryIdSchema,
    isPrimary: z.boolean().default(false)
});

/**
 * Schema for unassigning a category from a point of interest.
 *
 * If the removed row was the primary and other category rows remain for
 * that POI, the service auto-promotes the next-highest-`displayWeight`
 * remaining category to primary (spec §6.4, OQ-1).
 */
export const UnassignCategoryFromPointOfInterestInputSchema = z.object({
    pointOfInterestId: PointOfInterestIdSchema,
    categoryId: PoiCategoryIdSchema
});

/**
 * Schema for explicitly re-assigning a point of interest's primary category
 * among its already-assigned categories (flips the old primary off, the new
 * one on, in one transaction — spec §6.4).
 */
export const SetPrimaryCategoryInputSchema = z.object({
    pointOfInterestId: PointOfInterestIdSchema,
    categoryId: PoiCategoryIdSchema
});

/**
 * Schema for a POI-category relation operation response
 * Returns success status and the relation data
 */
export const PointOfInterestCategoryRelationOutputSchema = z.object({
    success: z.boolean().default(true),
    relation: z.object({
        pointOfInterestId: PointOfInterestIdSchema,
        categoryId: PoiCategoryIdSchema,
        isPrimary: z.boolean(),
        createdAt: z.date().optional(),
        updatedAt: z.date().optional()
    })
});

/**
 * Type exports for relation operations
 */
export type PointOfInterestCategoryRelation = z.infer<typeof PointOfInterestCategoryRelationSchema>;
export type AssignCategoryToPointOfInterestInput = z.infer<
    typeof AssignCategoryToPointOfInterestInputSchema
>;
export type UnassignCategoryFromPointOfInterestInput = z.infer<
    typeof UnassignCategoryFromPointOfInterestInputSchema
>;
export type SetPrimaryCategoryInput = z.infer<typeof SetPrimaryCategoryInputSchema>;
export type PointOfInterestCategoryRelationOutput = z.infer<
    typeof PointOfInterestCategoryRelationOutputSchema
>;
