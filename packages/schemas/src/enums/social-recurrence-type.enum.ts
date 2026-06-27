/**
 * Recurrence schedule types for social posts in the Hospeda social automation system (SPEC-254).
 *
 * Controls how `next_run_at` is recomputed after a successful publish cycle.
 * When a post completes publication, the dispatch service uses this value
 * to determine whether the post should be rescheduled automatically.
 *
 * @module social-recurrence-type.enum
 */

/**
 * All supported recurrence cadences for a social post.
 *
 * @example
 * ```ts
 * import { SocialRecurrenceTypeEnum } from '@repo/schemas';
 *
 * const recurrence: SocialRecurrenceTypeEnum = SocialRecurrenceTypeEnum.WEEKLY;
 * ```
 */
export enum SocialRecurrenceTypeEnum {
    /** Post is published once; `next_run_at` is set to `null` after completion. */
    ONCE = 'ONCE',

    /** Post repeats every 7 days; `next_run_at` advances by 7 days after each publish. */
    WEEKLY = 'WEEKLY',

    /** Post repeats every 14 days; `next_run_at` advances by 14 days after each publish. */
    BIWEEKLY = 'BIWEEKLY',

    /** Post repeats every calendar month; `next_run_at` advances by ~30 days after each publish. */
    MONTHLY = 'MONTHLY'
}
