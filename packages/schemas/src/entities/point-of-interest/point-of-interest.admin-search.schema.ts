import type { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { DestinationIdSchema, PoiCategoryIdSchema } from '../../common/id.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';
import { PointOfInterestTypeEnumSchema } from '../../enums/point-of-interest-type.schema.js';

/**
 * Admin search schema for points of interest.
 * Extends base admin search with point-of-interest-specific filters
 * (HOS-143 T-001).
 *
 * Note: `destinationId` is NOT a direct column on the `points_of_interest`
 * table. POIs are linked to destinations via the many-to-many
 * `r_destination_point_of_interest` relation table (HOS-113 OQ-1). Likewise,
 * `categoryId` is resolved through the `r_poi_category` join table
 * (HOS-139), not a plain column.
 *
 * @example
 * ```ts
 * const params = PointOfInterestAdminSearchSchema.parse({
 *   page: 1,
 *   isFeatured: true,
 *   search: 'playa'
 * });
 * ```
 */
export const PointOfInterestAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by the legacy closed point-of-interest type (deprecated-transitional, HOS-138). */
    type: PointOfInterestTypeEnumSchema.optional(),

    /** Filter featured points of interest */
    isFeatured: queryBooleanParam().describe('Filter by featured status'),

    /** Filter builtin (system-seeded) points of interest */
    isBuiltin: queryBooleanParam().describe('Filter by builtin status'),

    /** Filter points of interest that have a dedicated detail page */
    hasOwnPage: queryBooleanParam().describe('Filter by has-own-page status'),

    /** Filter points of interest that have been curator-verified */
    verified: queryBooleanParam().describe('Filter by verified status'),

    /** Filter by destination relation (many-to-many via `r_destination_point_of_interest`) */
    destinationId: DestinationIdSchema.optional(),

    /** Filter by category relation (many-to-many via `r_poi_category`, HOS-139) */
    categoryId: PoiCategoryIdSchema.optional()
});

/** Inferred TypeScript type for point-of-interest admin search parameters */
export type PointOfInterestAdminSearch = z.infer<typeof PointOfInterestAdminSearchSchema>;
