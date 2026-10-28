/**
 * Admin Search Schema for Venue Listings
 *
 * Extends the base admin search schema with venue-specific filters
 * for use in admin list endpoints.
 */
import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { PriceRangeEnumSchema, VenueTypeEnumSchema } from '../../enums/index.js';
import { PublicationStatusEnum } from '../../enums/publication-status.enum.js';

/**
 * Admin search schema for venue listings.
 * Extends the base admin search with venue-specific filters.
 *
 * @example
 * ```ts
 * const params = VenueAdminSearchSchema.parse({
 *   page: 1,
 *   pageSize: 20,
 *   type: 'RESTAURANT',
 *   priceRange: 'MID',
 * });
 * ```
 */
export const VenueAdminSearchSchema = AdminSearchBaseSchema.extend({
    /**
     * Filter by `publicationStatus` (HOS-1641). REPLACES the base `status`,
     * which is a `LifecycleStatusEnum` filter: venue listings no longer carry a
     * lifecycle column, so the panel filters on the six `PublicationStatusEnum`
     * values instead. `'all'` (the default) does not filter. Same override as
     * `HostTradeBenefitUsageAdminSearchSchema`.
     */
    status: z
        .enum(['all', ...Object.values(PublicationStatusEnum)] as [string, ...string[]])
        .default('all')
        .describe('Filter by publication status. Use "all" to show all statuses'),

    /** Filter by venue sub-type. */
    type: VenueTypeEnumSchema.optional().describe('Filter by gastronomy type'),

    /** Filter by destination UUID. */
    destinationId: z
        .string()
        .uuid({ message: 'zodError.admin.search.venue.destinationId.uuid' })
        .optional()
        .describe('Filter by destination'),

    /** Filter by price-range tier. */
    priceRange: PriceRangeEnumSchema.optional().describe('Filter by price range'),

    /** Filter by owner UUID. */
    ownerId: z
        .string()
        .uuid({ message: 'zodError.admin.search.venue.ownerId.uuid' })
        .optional()
        .describe('Filter by owner')

    /** Filter featured venue listings. */
});

/**
 * Type inferred from {@link VenueAdminSearchSchema}.
 * Represents the validated admin search parameters for venue listings.
 */
export type VenueAdminSearch = z.infer<typeof VenueAdminSearchSchema>;
