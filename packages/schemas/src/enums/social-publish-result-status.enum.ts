/**
 * Result status values for individual social post publish operations (SPEC-254).
 *
 * Recorded in `social_publish_logs` for each dispatch attempt made by the
 * publish cron job. Reflects the outcome reported back via the Make.com
 * result callback.
 *
 * @module social-publish-result-status.enum
 */

/**
 * All possible outcome statuses for a single publish dispatch attempt.
 *
 * @example
 * ```ts
 * import { SocialPublishResultStatusEnum } from '@repo/schemas';
 *
 * const result: SocialPublishResultStatusEnum = SocialPublishResultStatusEnum.SUCCESS;
 * ```
 */
export enum SocialPublishResultStatusEnum {
    /** Make.com confirmed successful publication on the target platform. */
    SUCCESS = 'SUCCESS',

    /** Make.com reported a failure; the error message is recorded in `social_publish_logs`. */
    FAILED = 'FAILED',

    /** Dispatch was intentionally skipped (e.g., platform disabled, post paused, or format unsupported). */
    SKIPPED = 'SKIPPED',

    /** Previous attempt failed; a retry is scheduled or in progress (retry_count < max). */
    RETRYING = 'RETRYING'
}
