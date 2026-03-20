/**
 * Admin Search Schema for Destinations
 *
 * Extends the base admin search schema with destination-specific filters
 * for use in admin list endpoints.
 */
import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';
import { DestinationTypeEnumSchema } from '../../enums/index.js';

/**
 * Admin search schema for destinations.
 * Extends base admin search with destination-specific filters.
 *
 * Hierarchy levels:
 * - 0: COUNTRY
 * - 1: REGION
 * - 2: PROVINCE
 * - 3: DEPARTMENT
 * - 4: CITY
 * - 5: TOWN
 * - 6: NEIGHBORHOOD
 *
 * @example
 * ```ts
 * const params = DestinationAdminSearchSchema.parse({
 *   page: 1,
 *   destinationType: 'CITY',
 *   level: 4,
 *   isFeatured: true
 * });
 * ```
 */
export const DestinationAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by parent destination UUID */
    parentDestinationId: z
        .string()
        .uuid({ message: 'zodError.admin.search.destination.parentDestinationId.uuid' })
        .optional()
        .describe('Filter by parent destination'),

    /** Filter by destination type (COUNTRY, REGION, PROVINCE, etc.) */
    destinationType: DestinationTypeEnumSchema.optional().describe('Filter by destination type'),

    /** Filter by hierarchy level (0=country, 6=neighborhood) */
    level: z.coerce
        .number()
        .int({ message: 'zodError.admin.search.destination.level.int' })
        .min(0, { message: 'zodError.admin.search.destination.level.min' })
        .max(6, { message: 'zodError.admin.search.destination.level.max' })
        .optional()
        .describe('Filter by hierarchy level'),

    /** Filter featured destinations */
    isFeatured: queryBooleanParam().describe('Filter by featured status')
});

/**
 * Type inferred from {@link DestinationAdminSearchSchema}.
 * Represents the validated admin search parameters for destinations.
 */
export type DestinationAdminSearch = z.infer<typeof DestinationAdminSearchSchema>;
