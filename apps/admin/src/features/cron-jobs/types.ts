/**
 * Cron Jobs Feature Types
 *
 * Type definitions for cron job management in the admin panel.
 * The enriched CronJobAdmin shape comes from @repo/schemas (SPEC-161).
 */

// Re-export the canonical types from schemas so all feature code
// references a single source of truth.
/**
 * Alias for the list response — kept for backward compatibility with
 * existing usages of `CronJobsListResponse` inside this feature.
 */
export type {
    CronJobAdmin,
    CronJobsAdminList,
    CronJobsAdminList as CronJobsListResponse
} from '@repo/schemas';

/**
 * Cron job execution result returned by POST /api/v1/admin/cron/:jobName
 */
export interface CronJobResult {
    /** Whether the job completed successfully */
    success: boolean;
    /** Human-readable message describing the outcome */
    message: string;
    /** Number of items/records processed */
    processed: number;
    /** Number of errors encountered */
    errors: number;
    /** Job execution duration in milliseconds */
    durationMs: number;
    /** Optional additional details about the execution */
    details?: Record<string, unknown>;
    /** Job name */
    jobName: string;
    /** Whether it was a dry run */
    dryRun: boolean;
    /** When the job was executed */
    executedAt: string;
}

/**
 * Response from POST /api/v1/admin/cron/:jobName
 *
 * NOTE: the API wraps the result directly (not under a nested `.data`);
 * the `fetchApi` helper unwraps the outer `{ success, data }` envelope,
 * so the mutation receives this shape directly.
 */
/**
 * Body of a 202: an exclusive job (HOS-1999) took its cron lock and runs in
 * the background. Its outcome is read later from the run history.
 */
export interface CronJobAccepted {
    accepted: true;
    runId: string;
    jobName: string;
    dryRun: boolean;
    executedAt: string;
}

/** Raw body of a successful manual trigger: 201 (completed) or 202 (accepted). */
export type TriggerCronJobResponse = CronJobResult | CronJobAccepted;

/**
 * What a manual trigger means for the card, normalised from the HTTP answer:
 * - `completed`: 201, the job ran in the request and this is its result;
 * - `accepted`: 202, the job is running; poll its run by `runId`;
 * - `busy`: 409, another run holds the cron lock (`holderRunId` may be unknown).
 */
export type TriggerCronJobOutcome =
    | { readonly kind: 'completed'; readonly result: CronJobResult }
    | { readonly kind: 'accepted'; readonly accepted: CronJobAccepted }
    | { readonly kind: 'busy'; readonly holderRunId: string | null };

/**
 * Error response from POST /api/v1/admin/cron/:jobName
 */
export interface TriggerCronJobError {
    success: false;
    error: {
        code: 'NOT_FOUND' | 'JOB_DISABLED' | 'JOB_EXECUTION_FAILED';
        message: string;
    };
    data?: {
        jobName: string;
        dryRun: boolean;
        durationMs: number;
    };
}
