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
import { SocialRecurrenceTypeEnum } from '../../enums/social-recurrence-type.enum.js';
import { SocialRecurrenceTypeEnumSchema } from '../../enums/social-recurrence-type.schema.js';

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
 * Weekday sub-schema for WEEKLY recurrence. Constrained to the 7 canonical
 * uppercase English names that the dispatch service's `computeNextWeeklyDate`
 * expects as `recurrenceParamsJson.weekday`.
 */
export const RecurrenceWeekdaySchema = z.enum(
    ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
    {
        error: () => ({ message: 'zodError.socialPost.weekday.invalid' })
    }
);

/**
 * Request body for POST /{id}/schedule.
 *
 * Required fields:
 * - `scheduledAt` — coerced to Date; must be in the future (service-level guard).
 * - `timezone`    — non-empty IANA timezone string.
 *
 * Optional fields:
 * - `recurrenceType` — cadence; defaults to `ONCE`.
 * - `recurrenceParamsJson` — additional params per cadence.
 *   For `WEEKLY`, the `weekday` property is required (see cross-field refinement).
 *   For `ONCE`, `BIWEEKLY`, and `MONTHLY`, `recurrenceParamsJson` may be omitted.
 *
 * @see SocialRecurrenceTypeEnum
 */
export const ScheduleSocialPostSchema = z
    .object({
        scheduledAt: z.coerce.date(),
        timezone: z.string().min(1, { message: 'zodError.socialPost.timezone.required' }),
        recurrenceType: SocialRecurrenceTypeEnumSchema.default(SocialRecurrenceTypeEnum.ONCE),
        recurrenceParamsJson: z
            .object({
                weekday: RecurrenceWeekdaySchema.describe('Required when recurrenceType is WEEKLY')
            })
            .optional()
    })
    .superRefine((data, ctx) => {
        if (
            data.recurrenceType === SocialRecurrenceTypeEnum.WEEKLY &&
            !data.recurrenceParamsJson?.weekday
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'zodError.socialPost.weekday.requiredForWeekly',
                path: ['recurrenceParamsJson', 'weekday']
            });
        }
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

// ---------------------------------------------------------------------------
// Set hashtags endpoint
// ---------------------------------------------------------------------------

/**
 * Request body for PUT /{id}/hashtags.
 * Accepts an ordered array of hashtag strings (with or without `#` prefix).
 * An empty array clears all hashtags from the post.
 */
export const SocialPostSetHashtagsSchema = z.object({
    hashtags: z.array(z.string().min(1, { message: 'zodError.socialPost.hashtag.required' }))
});

export type SocialPostSetHashtagsInput = z.infer<typeof SocialPostSetHashtagsSchema>;

/**
 * Single item in the set-hashtags response.
 */
export const SetHashtagsItemSchema = z.object({
    hashtagId: z.string().uuid(),
    hashtag: z.string(),
    isNew: z.boolean()
});

/**
 * Response shape for PUT /{id}/hashtags.
 * Returns the full resolved ordered hashtag set and the regenerated finalHashtagsText.
 */
export const SetPostHashtagsResponseSchema = z.object({
    hashtags: z.array(SetHashtagsItemSchema),
    finalHashtagsText: z.string()
});

export type SetPostHashtagsResponse = z.infer<typeof SetPostHashtagsResponseSchema>;

// ---------------------------------------------------------------------------
// Publish-now endpoint (SPEC-254 "Publish Now")
// ---------------------------------------------------------------------------

/**
 * Single-target outcome item in the publish-now response.
 */
export const PublishNowTargetOutcomeSchema = z.object({
    /** UUID of the `social_post_targets` row. */
    targetId: z.string().uuid(),
    /** Social platform name (e.g. 'INSTAGRAM'). */
    platform: z.string(),
    /** Outcome of this dispatch attempt (dispatched / retry_scheduled / exhausted / skipped_*). */
    outcome: z.string()
});

export type PublishNowTargetOutcome = z.infer<typeof PublishNowTargetOutcomeSchema>;

/**
 * Response shape for POST /{id}/publish-now.
 * Returns per-target dispatch outcomes and aggregate counters.
 */
export const PublishNowResponseSchema = z.object({
    /** Per-target dispatch results. */
    outcomes: z.array(PublishNowTargetOutcomeSchema),
    /** Number of targets dispatched (HTTP POST to Make.com succeeded). */
    dispatched: z.number().int().nonnegative(),
    /** Number of targets skipped (no webhook configured or lock contention). */
    skipped: z.number().int().nonnegative(),
    /** Number of targets that failed or were exhausted. */
    failed: z.number().int().nonnegative()
});

export type PublishNowResponse = z.infer<typeof PublishNowResponseSchema>;
