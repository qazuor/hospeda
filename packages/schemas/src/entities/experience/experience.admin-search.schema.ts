/**
 * Admin Search Schema for Experience Listings
 *
 * Extends the base admin search schema with experience-specific filters
 * for use in admin list endpoints.
 */
import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';
import { ExperienceTypeEnumSchema } from '../../enums/index.js';

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
 *   hasActiveSubscription: true,
 * });
 * ```
 */
export const ExperienceAdminSearchSchema = AdminSearchBaseSchema.extend({
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
        .describe('Filter by owner'),

    /** Filter featured experience listings. */
    isFeatured: queryBooleanParam().describe('Filter by featured status'),

    /** Filter by active subscription flag (controls public visibility). */
    hasActiveSubscription: queryBooleanParam().describe(
        'Filter experiences with active subscription'
    )
});

/**
 * Type inferred from {@link ExperienceAdminSearchSchema}.
 * Represents the validated admin search parameters for experience listings.
 */
export type ExperienceAdminSearch = z.infer<typeof ExperienceAdminSearchSchema>;
