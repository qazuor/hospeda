/**
 * @module experience.review.admin-search.schema
 * @description Admin search schema for experience reviews.
 *
 * Required by the inherited `BaseCrudService.adminList`, which answers
 * `CONFIGURATION_ERROR` (HTTP 500) when a service has no `adminSearchSchema`
 * (HOS-1985). Mirrors `DestinationReviewAdminSearchSchema`.
 */
import { z } from 'zod';
import { AdminSearchBaseSchema } from '../../common/admin-search.schema.js';
import { ModerationStatusEnumSchema } from '../../enums/index.js';

/**
 * Admin search schema for experience reviews.
 *
 * Inherits pagination, `search`, `sort`, `status`, `includeDeleted` and the
 * created-date range from {@link AdminSearchBaseSchema}.
 *
 * Additional filters:
 * - `experienceId`: narrow to one experience listing
 * - `userId`: narrow to one reviewer
 * - `moderationState`: PENDING / APPROVED / REJECTED (moderation queue)
 */
export const ExperienceReviewAdminSearchSchema = AdminSearchBaseSchema.extend({
    /** Filter by experience UUID */
    experienceId: z
        .string()
        .uuid({ message: 'zodError.admin.search.experienceReview.experienceId.uuid' })
        .optional()
        .describe('Filter reviews by experience'),

    /** Filter by reviewer user UUID */
    userId: z
        .string()
        .uuid({ message: 'zodError.admin.search.experienceReview.userId.uuid' })
        .optional()
        .describe('Filter reviews by user'),

    /** Filter by moderation state (PENDING, APPROVED, REJECTED) */
    moderationState: ModerationStatusEnumSchema.optional().describe(
        'Filter reviews by moderation state (PENDING, APPROVED, REJECTED)'
    )
});

/** Validated admin search parameters for experience reviews. */
export type ExperienceReviewAdminSearch = z.infer<typeof ExperienceReviewAdminSearchSchema>;
