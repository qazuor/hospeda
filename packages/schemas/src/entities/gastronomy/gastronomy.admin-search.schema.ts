/**
 * Admin Search Schema for Gastronomy Listings
 *
 * Extends the base admin search schema with gastronomy-specific filters
 * for use in admin list endpoints.
 */
import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { GastronomyTypeEnumSchema, PriceRangeEnumSchema } from '../../enums/index.js';

/**
 * Admin search schema for gastronomy listings.
 * Extends the base admin search with gastronomy-specific filters.
 *
 * @example
 * ```ts
 * const params = GastronomyAdminSearchSchema.parse({
 *   page: 1,
 *   pageSize: 20,
 *   type: 'RESTAURANT',
 *   priceRange: 'MID',
 * });
 * ```
 */
export const GastronomyAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by gastronomy sub-type. */
    type: GastronomyTypeEnumSchema.optional().describe('Filter by gastronomy type'),

    /** Filter by destination UUID. */
    destinationId: z
        .string()
        .uuid({ message: 'zodError.admin.search.gastronomy.destinationId.uuid' })
        .optional()
        .describe('Filter by destination'),

    /** Filter by price-range tier. */
    priceRange: PriceRangeEnumSchema.optional().describe('Filter by price range'),

    /** Filter by owner UUID. */
    ownerId: z
        .string()
        .uuid({ message: 'zodError.admin.search.gastronomy.ownerId.uuid' })
        .optional()
        .describe('Filter by owner')

    /** Filter featured gastronomy listings. */
});

/**
 * Type inferred from {@link GastronomyAdminSearchSchema}.
 * Represents the validated admin search parameters for gastronomy listings.
 */
export type GastronomyAdminSearch = z.infer<typeof GastronomyAdminSearchSchema>;
