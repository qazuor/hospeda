/**
 * Cron Jobs Feature Types
 *
 * Type definitions for cron job management in the admin panel
 */

/**
 * Cron job definition from the API
 */
export interface CronJob {
    /** Unique name for the job (used in API endpoints) */
    name: string;
    /** Human-readable description of what the job does */
    description: string;
    /** Cron schedule expression (e.g., "0 0 * * *" for daily at midnight) */
    schedule: string;
    /** Whether the job is enabled (disabled jobs won't be scheduled) */
    enabled: boolean;
}

/**
 * Response from GET /api/v1/cron
 */
export interface CronJobsListResponse {
    jobs: CronJob[];
    totalJobs: number;
    enabledJobs: number;
}

/**
 * Cron job execution result
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
 * Response from POST /api/v1/cron/:jobName
 */
export interface TriggerCronJobResponse {
    success: boolean;
    data: CronJobResult;
}

/**
 * Error response from POST /api/v1/cron/:jobName
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

/**
 * Cron job execution status (for UI display)
 */
export type CronJobStatus = 'idle' | 'running' | 'success' | 'error';

/**
 * Cron job with execution state (for UI)
 */
export interface CronJobWithState extends CronJob {
    status: CronJobStatus;
    lastResult?: CronJobResult;
}
