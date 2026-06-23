/**
 * Lifecycle status values for social posts in the Hospeda social automation system (SPEC-254).
 *
 * Tracks a post from initial GPT draft through editorial review, scheduling, and
 * automated publication via Make.com.
 *
 * State transitions:
 * - `DRAFT` → `NEEDS_REVIEW` (GPT submits draft; requires admin review before approval)
 * - `NEEDS_REVIEW` → `APPROVED` (admin approves the post)
 * - `NEEDS_REVIEW` → `DRAFT` (admin requests changes)
 * - `APPROVED` → `SCHEDULED` (admin sets `scheduled_at`)
 * - `APPROVED` / `SCHEDULED` → `READY_TO_PUBLISH` (admin marks ready; cron can dispatch)
 * - `READY_TO_PUBLISH` → `PUBLISHING` (cron dispatched to Make.com; awaiting claim callback)
 * - `PUBLISHING` → `PUBLISHED` (all targets complete successfully)
 * - `PUBLISHING` / `READY_TO_PUBLISH` → `FAILED` (all targets failed or max retries exceeded)
 * - Any non-terminal state → `PAUSED` (admin pauses; `paused = true` flag)
 * - Any state → `ARCHIVED` (admin archives; soft-delete applied)
 *
 * @module social-post-status.enum
 */

/**
 * All possible lifecycle states for a social post.
 *
 * @example
 * ```ts
 * import { SocialPostStatusEnum } from '@repo/schemas';
 *
 * const status: SocialPostStatusEnum = SocialPostStatusEnum.NEEDS_REVIEW;
 * ```
 */
export enum SocialPostStatusEnum {
    /** Initial state after GPT or admin creates the post. Editable; not yet queued for review. */
    DRAFT = 'DRAFT',

    /** Post submitted for admin review. Cannot be dispatched until approved. */
    NEEDS_REVIEW = 'NEEDS_REVIEW',

    /** Admin has approved the content. Can be scheduled or marked ready to publish. */
    APPROVED = 'APPROVED',

    /** Post is approved and has a `scheduled_at` time; cron will not dispatch until that time. */
    SCHEDULED = 'SCHEDULED',

    /** Post is cleared for immediate dispatch by the publish cron job. */
    READY_TO_PUBLISH = 'READY_TO_PUBLISH',

    /** Dispatch payload sent to Make.com; awaiting claim and result callbacks. */
    PUBLISHING = 'PUBLISHING',

    /** All platform targets completed successfully; post is live. */
    PUBLISHED = 'PUBLISHED',

    /** All targets failed or maximum retry count exceeded. Terminal error state. */
    FAILED = 'FAILED',

    /** Post is temporarily paused by admin; cron will skip it until unpaused. */
    PAUSED = 'PAUSED',

    /** Post has been archived by admin. Soft-deleted; excluded from active queues. */
    ARCHIVED = 'ARCHIVED'
}
