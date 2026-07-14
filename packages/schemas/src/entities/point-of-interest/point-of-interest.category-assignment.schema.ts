import { z } from 'zod';
import { I18nTextSchema } from '../../common/i18n.schema.js';
import { PoiCategoryIdSchema, PointOfInterestIdSchema } from '../../common/id.schema.js';

/**
 * Category-assignment admin schemas for point of interest (HOS-143 T-004).
 *
 * Complements `poi-category.relations.schema.ts`'s single-category
 * assign/unassign schemas with a bulk "set the whole category set at once"
 * input (used by the admin category-picker UI) and a display-oriented
 * assignment item shape.
 */

/**
 * Schema for replacing the full set of categories assigned to a point of
 * interest in one call, including which one is primary.
 *
 * `primaryCategoryId` must be one of the ids in `categoryIds` — enforced by
 * the refinement below, mirroring the `isPrimary` per-POI invariant
 * documented in `poi-category.relations.schema.ts` (HOS-139 spec §6.2/§6.4).
 */
export const PointOfInterestSetCategoriesInputSchema = z
    .object({
        pointOfInterestId: PointOfInterestIdSchema,
        categoryIds: z
            .array(PoiCategoryIdSchema)
            .min(1, { message: 'zodError.pointOfInterest.categories.min' })
            .max(10, { message: 'zodError.pointOfInterest.categories.max' }),
        primaryCategoryId: PoiCategoryIdSchema
    })
    .refine((value) => value.categoryIds.includes(value.primaryCategoryId), {
        message: 'zodError.pointOfInterest.categories.primaryNotInSet',
        path: ['primaryCategoryId']
    });

/**
 * Schema for a single category assignment as displayed on a point of
 * interest's admin detail view (denormalized category display fields,
 * plus the per-POI `isPrimary` flag from the join row).
 */
export const PointOfInterestCategoryAssignmentSchema = z.object({
    id: PoiCategoryIdSchema,
    slug: z.string(),
    nameI18n: I18nTextSchema,
    icon: z.string().nullish(),
    isPrimary: z.boolean()
});

/**
 * Type exports
 */
export type PointOfInterestSetCategoriesInput = z.infer<
    typeof PointOfInterestSetCategoriesInputSchema
>;
export type PointOfInterestCategoryAssignment = z.infer<
    typeof PointOfInterestCategoryAssignmentSchema
>;
