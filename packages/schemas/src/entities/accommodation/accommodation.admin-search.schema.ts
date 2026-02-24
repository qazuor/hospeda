/**
 * Admin Search Schema for Accommodations
 *
 * Extends the base admin search schema with accommodation-specific filters
 * for use in admin list endpoints.
 */
import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { AccommodationTypeEnumSchema } from '../../enums/index.js';

/**
 * Admin search schema for accommodations.
 * Extends base admin search with accommodation-specific filters.
 *
 * @example
 * ```ts
 * const params = AccommodationAdminSearchSchema.parse({
 *   page: 1,
 *   pageSize: 20,
 *   type: 'HOTEL',
 *   isFeatured: true,
 *   minPrice: 50,
 *   maxPrice: 500
 * });
 * ```
 */
export const AccommodationAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by accommodation type */
    type: AccommodationTypeEnumSchema.optional().describe('Filter by accommodation type'),

    /** Filter by destination UUID */
    destinationId: z
        .string()
        .uuid({ message: 'zodError.admin.search.accommodation.destinationId.uuid' })
        .optional()
        .describe('Filter by destination'),

    /** Filter by owner UUID */
    ownerId: z
        .string()
        .uuid({ message: 'zodError.admin.search.accommodation.ownerId.uuid' })
        .optional()
        .describe('Filter by owner'),

    /** Filter featured accommodations */
    isFeatured: z.coerce.boolean().optional().describe('Filter by featured status'),

    /** Minimum price per night */
    minPrice: z.coerce
        .number()
        .min(0, { message: 'zodError.admin.search.accommodation.minPrice.min' })
        .optional()
        .describe('Minimum price per night'),

    /** Maximum price per night */
    maxPrice: z.coerce
        .number()
        .min(0, { message: 'zodError.admin.search.accommodation.maxPrice.min' })
        .optional()
        .describe('Maximum price per night')
});

/**
 * Type inferred from {@link AccommodationAdminSearchSchema}.
 * Represents the validated admin search parameters for accommodations.
 */
export type AccommodationAdminSearch = z.infer<typeof AccommodationAdminSearchSchema>;
