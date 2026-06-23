import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { SocialPlatformEnumSchema } from '../../enums/social-platform.schema.js';
import { SocialPostStatusEnumSchema } from '../../enums/social-post-status.schema.js';
import { SocialPublishFormatEnumSchema } from '../../enums/social-publish-format.schema.js';

/**
 * Admin search schema for social post targets.
 * Extends base admin search with target-specific filters.
 *
 * @example
 * ```ts
 * const params = SocialPostTargetAdminSearchSchema.parse({
 *   page: 1,
 *   platform: 'INSTAGRAM',
 *   status: 'PUBLISHED'
 * });
 * ```
 */
export const SocialPostTargetAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by parent post */
    socialPostId: z
        .string()
        .uuid({ message: 'zodError.admin.search.socialPostTarget.socialPostId.uuid' })
        .optional()
        .describe('Filter by parent social post'),

    /** Filter by platform */
    platform: SocialPlatformEnumSchema.optional().describe('Filter by platform'),

    /** Filter by publish format */
    publishFormat: SocialPublishFormatEnumSchema.optional().describe('Filter by publish format'),

    /** Filter by target status */
    status: SocialPostStatusEnumSchema.optional().describe('Filter by target status')
});

/**
 * Type inferred from {@link SocialPostTargetAdminSearchSchema}.
 */
export type SocialPostTargetAdminSearch = z.infer<typeof SocialPostTargetAdminSearchSchema>;
