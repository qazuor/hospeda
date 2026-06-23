/**
 * HTTP-level Zod schemas for social post state-transition endpoints.
 *
 * These schemas cover request bodies and response shapes for the 9 admin
 * state-transition routes defined in SPEC-254 T-036. They live separately
 * from the entity schema (social-post.schema.ts) to keep HTTP concerns
 * isolated from the domain model.
 *
 * @module social-post.http.schema
 * @see SPEC-254 T-036
 */

import { z } from 'zod';
import { SocialPlatformEnumSchema } from '../../enums/social-platform.schema.js';

// ---------------------------------------------------------------------------
// Request body schemas
// ---------------------------------------------------------------------------

/**
 * Request body for POST /{id}/reject.
 * Requires a non-empty rejection reason.
 */
export const RejectSocialPostSchema = z.object({
    reason: z.string().trim().min(1, { message: 'zodError.socialPost.reason.required' })
});

export type RejectSocialPostInput = z.infer<typeof RejectSocialPostSchema>;

/**
 * Request body for POST /{id}/request-changes.
 * Requires non-empty change-request feedback.
 */
export const RequestChangesSocialPostSchema = z.object({
    feedback: z.string().trim().min(1, { message: 'zodError.socialPost.feedback.required' })
});

export type RequestChangesSocialPostInput = z.infer<typeof RequestChangesSocialPostSchema>;

/**
 * Request body for POST /{id}/schedule.
 * Requires a future datetime and a valid IANA timezone string.
 */
export const ScheduleSocialPostSchema = z.object({
    scheduledAt: z.coerce.date(),
    timezone: z.string().min(1, { message: 'zodError.socialPost.timezone.required' })
});

export type ScheduleSocialPostInput = z.infer<typeof ScheduleSocialPostSchema>;

/**
 * Request body for POST /{id}/promote-hashtag.
 * Requires hashtag text and category; all other fields are optional.
 */
export const PromoteHashtagSchema = z.object({
    hashtag: z.string().min(1, { message: 'zodError.socialPost.hashtag.required' }),
    category: z.string().min(1, { message: 'zodError.socialPost.category.required' }),
    platform: SocialPlatformEnumSchema.optional(),
    audienceId: z.string().uuid({ message: 'zodError.socialPost.audienceId.uuid' }).optional(),
    priority: z.number().int().optional()
});

export type PromoteHashtagInput = z.infer<typeof PromoteHashtagSchema>;

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

/**
 * Response shape for approve / reject / request-changes transitions.
 * Returns id, pipeline status, and approval status after the transition.
 */
export const SocialPostApprovalResponseSchema = z.object({
    id: z.string().uuid(),
    status: z.string(),
    approvalStatus: z.string()
});

export type SocialPostApprovalResponse = z.infer<typeof SocialPostApprovalResponseSchema>;

/**
 * Response shape for the schedule transition.
 * Returns id, pipeline status, and the scheduled datetime.
 */
export const SocialPostScheduleResponseSchema = z.object({
    id: z.string().uuid(),
    status: z.string(),
    scheduledAt: z.coerce.date().nullable()
});

export type SocialPostScheduleResponse = z.infer<typeof SocialPostScheduleResponseSchema>;

/**
 * Response shape for mark-ready and archive transitions.
 * Returns id and pipeline status.
 */
export const SocialPostStatusResponseSchema = z.object({
    id: z.string().uuid(),
    status: z.string()
});

export type SocialPostStatusResponse = z.infer<typeof SocialPostStatusResponseSchema>;

/**
 * Response shape for pause / unpause transitions.
 * Returns id and the paused flag after the transition.
 */
export const SocialPostPauseResponseSchema = z.object({
    id: z.string().uuid(),
    paused: z.boolean()
});

export type SocialPostPauseResponse = z.infer<typeof SocialPostPauseResponseSchema>;

/**
 * Warning attached to a promote-hashtag response to convey non-blocking
 * advisory information (e.g. auto-prepended `#` prefix).
 */
export const ServiceWarningSchema = z.object({
    field: z.string(),
    message: z.string()
});

/**
 * Response shape for the promote-hashtag action.
 * Returns the hashtag UUID, normalized text, creation flag, and advisory warnings.
 */
export const PromoteHashtagResponseSchema = z.object({
    hashtagId: z.string().uuid(),
    hashtag: z.string(),
    isNew: z.boolean(),
    warnings: z.array(ServiceWarningSchema).optional()
});

export type PromoteHashtagResponse = z.infer<typeof PromoteHashtagResponseSchema>;
