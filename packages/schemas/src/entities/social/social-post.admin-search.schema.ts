import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { queryBooleanParam } from '../../common/query-helpers.js';
import { SocialApprovalStatusEnumSchema } from '../../enums/social-approval-status.schema.js';
import { SocialPostStatusEnumSchema } from '../../enums/social-post-status.schema.js';
import { SocialSourceEnumSchema } from '../../enums/social-source.schema.js';

/**
 * Admin search schema for social posts.
 * Extends base admin search with post-specific filters covering the
 * full pipeline (status, approval, source, scheduling, campaign, etc.).
 *
 * @example
 * ```ts
 * const params = SocialPostAdminSearchSchema.parse({
 *   page: 1,
 *   status: 'APPROVED',
 *   approvalStatus: 'APPROVED',
 *   paused: false
 * });
 * ```
 */
export const SocialPostAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by pipeline status */
    status: SocialPostStatusEnumSchema.optional().describe('Filter by pipeline status'),

    /** Filter by approval status */
    approvalStatus: SocialApprovalStatusEnumSchema.optional().describe('Filter by approval status'),

    /** Filter by content source */
    source: SocialSourceEnumSchema.optional().describe('Filter by content source'),

    /** Filter by content pillar */
    pillar: z.string().optional().describe('Filter by content pillar label'),

    /** Filter by campaign */
    campaignId: z
        .string()
        .uuid({ message: 'zodError.admin.search.socialPost.campaignId.uuid' })
        .optional()
        .describe('Filter by campaign'),

    /** Filter by content batch */
    batchId: z
        .string()
        .uuid({ message: 'zodError.admin.search.socialPost.batchId.uuid' })
        .optional()
        .describe('Filter by content batch'),

    /** Filter by audience */
    audienceId: z
        .string()
        .uuid({ message: 'zodError.admin.search.socialPost.audienceId.uuid' })
        .optional()
        .describe('Filter by audience'),

    /** Filter paused posts */
    paused: queryBooleanParam().describe('Filter paused posts'),

    /** Filter posts scheduled after this date */
    scheduledAfter: z.coerce.date().optional().describe('Filter posts scheduled after this date'),

    /** Filter posts scheduled before this date */
    scheduledBefore: z.coerce.date().optional().describe('Filter posts scheduled before this date'),

    /** Filter by approving admin */
    approvedById: z
        .string()
        .uuid({ message: 'zodError.admin.search.socialPost.approvedById.uuid' })
        .optional()
        .describe('Filter by approving admin')
});

/**
 * Type inferred from {@link SocialPostAdminSearchSchema}.
 */
export type SocialPostAdminSearch = z.infer<typeof SocialPostAdminSearchSchema>;
