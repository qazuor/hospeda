/**
 * Admin Search Schema for Experience Listings
 *
 * Extends the base admin search schema with experience-specific filters
 * for use in admin list endpoints.
 */
import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { ExperienceTypeEnumSchema } from '../../enums/index.js';
import { PublicationStatusEnum } from '../../enums/publication-status.enum.js';

/**
 * Admin search schema for experience listings.
 * Extends the base admin search with experience-specific filters.
 *
 * @example
 * ```ts
 * const params = ExperienceAdminSearchSchema.parse({
 *   page: 1,
 *   pageSize: 20,
 *   type: 'EXCURSION',
 * });
 * ```
 */
export const ExperienceAdminSearchSchema = AdminSearchBaseSchema.extend({
    /**
     * Filter by `publicationStatus` (HOS-1641). REPLACES the base `status`,
     * which is a `LifecycleStatusEnum` filter: experience listings no longer carry a
     * lifecycle column, so the panel filters on the six `PublicationStatusEnum`
     * values instead. `'all'` (the default) does not filter. Same override as
     * `HostTradeBenefitUsageAdminSearchSchema`.
     */
    status: z
        .enum(['all', ...Object.values(PublicationStatusEnum)] as [string, ...string[]])
        .default('all')
        .describe('Filter by publication status. Use "all" to show all statuses'),

    /** Filter by experience sub-type. */
    type: ExperienceTypeEnumSchema.optional().describe('Filter by experience type'),

    /** Filter by destination UUID. */
    destinationId: z
        .string()
        .uuid({ message: 'zodError.admin.search.experience.destinationId.uuid' })
        .optional()
        .describe('Filter by destination'),

    /** Filter by owner UUID. */
    ownerId: z
        .string()
        .uuid({ message: 'zodError.admin.search.experience.ownerId.uuid' })
        .optional()
        .describe('Filter by owner')

    /** Filter featured experience listings. */

    /** Filter by active subscription flag (controls public visibility). */
});

/**
 * Type inferred from {@link ExperienceAdminSearchSchema}.
 * Represents the validated admin search parameters for experience listings.
 */
export type ExperienceAdminSearch = z.infer<typeof ExperienceAdminSearchSchema>;
