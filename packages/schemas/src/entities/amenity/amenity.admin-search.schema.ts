import type { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';
import { AmenitiesTypeEnumSchema } from '../../enums/index.js';

/**
 * Admin search schema for amenities.
 * Extends base admin search with amenity-specific filters.
 *
 * @example
 * ```ts
 * const params = AmenityAdminSearchSchema.parse({
 *   page: 1,
 *   type: 'CONNECTIVITY',
 *   isBuiltin: true,
 *   search: 'wifi'
 * });
 * ```
 */
export const AmenityAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by amenity type (matches the `type` column using AmenitiesTypePgEnum) */
    type: AmenitiesTypeEnumSchema.optional().describe('Filter by amenity type'),
    /** Filter by built-in status */
    isBuiltin: queryBooleanParam().describe('Filter built-in amenities')
});

/** Inferred TypeScript type for amenity admin search parameters */
export type AmenityAdminSearch = z.infer<typeof AmenityAdminSearchSchema>;
