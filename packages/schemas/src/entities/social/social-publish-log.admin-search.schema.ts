import { z } from 'zod';
import { SocialPlatformEnumSchema } from '../../enums/social-platform.schema.js';
import { SocialPublishResultStatusEnumSchema } from '../../enums/social-publish-result-status.schema.js';

/**
 * Admin search schema for social publish logs.
 * Used by GET /api/v1/admin/social/publish-logs.
 *
 * @example
 * ```ts
 * const params = SocialPublishLogAdminSearchSchema.parse({
 *   page: 1,
 *   pageSize: 20,
 *   status: 'FAILED'
 * });
 * ```
 */
export const SocialPublishLogAdminSearchSchema = z.object({
    /** Page number (1-based). */
    page: z.coerce
        .number()
        .int()
        .positive({ message: 'zodError.admin.search.page.positive' })
        .default(1),

    /** Items per page (1-100). */
    pageSize: z.coerce
        .number()
        .int()
        .positive({ message: 'zodError.admin.search.pageSize.positive' })
        .max(100, { message: 'zodError.admin.search.pageSize.max' })
        .default(20),

    /** Filter by parent post ID. */
    postId: z
        .string()
        .uuid({ message: 'zodError.socialPublishLog.socialPostId.uuid' })
        .optional()
        .describe('Filter by parent post UUID'),

    /** Filter by target ID. */
    targetId: z
        .string()
        .uuid({ message: 'zodError.socialPublishLog.socialPostTargetId.uuid' })
        .optional()
        .describe('Filter by target UUID'),

    /** Filter by publish result status. */
    status: SocialPublishResultStatusEnumSchema.optional().describe(
        'Filter by publish result status'
    ),

    /** Filter by platform. */
    platform: SocialPlatformEnumSchema.optional().describe('Filter by platform')
});

/** TypeScript type inferred from {@link SocialPublishLogAdminSearchSchema}. */
export type SocialPublishLogAdminSearch = z.infer<typeof SocialPublishLogAdminSearchSchema>;
