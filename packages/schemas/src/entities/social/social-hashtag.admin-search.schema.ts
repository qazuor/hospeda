import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';
import { SocialPlatformEnumSchema } from '../../enums/social-platform.schema.js';

/**
 * Admin search schema for social hashtags.
 * Extends base admin search with hashtag-specific filters.
 *
 * @example
 * ```ts
 * const params = SocialHashtagAdminSearchSchema.parse({
 *   page: 1,
 *   platform: 'INSTAGRAM',
 *   active: true
 * });
 * ```
 */
export const SocialHashtagAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by platform restriction */
    platform: SocialPlatformEnumSchema.optional().describe('Filter by platform restriction'),

    /** Filter by category label */
    category: z.string().optional().describe('Filter by category label'),

    /** Filter by audience association */
    audienceId: z
        .string()
        .uuid({ message: 'zodError.admin.search.socialHashtag.audienceId.uuid' })
        .optional()
        .describe('Filter by audience association'),

    /** Filter by active status */
    active: queryBooleanParam().describe('Filter by active status')
});

/**
 * Type inferred from {@link SocialHashtagAdminSearchSchema}.
 */
export type SocialHashtagAdminSearch = z.infer<typeof SocialHashtagAdminSearchSchema>;
