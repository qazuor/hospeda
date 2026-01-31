/**
 * Cron Job Types
 * Defines the contract for all scheduled jobs in the system.
 * @module cron/types
 */

/**
 * Context passed to every cron job handler
 * Provides logging, timing, and execution mode information
 */
export interface CronJobContext {
    /** Logger instance with standard logging methods */
    logger: {
        info: (message: string, data?: Record<string, unknown>) => void;
        warn: (message: string, data?: Record<string, unknown>) => void;
        error: (message: string, data?: Record<string, unknown>) => void;
        debug: (message: string, data?: Record<string, unknown>) => void;
    };
    /** Timestamp when the job execution started */
    startedAt: Date;
    /** If true, job should run in dry-run mode (no actual changes) */
    dryRun: boolean;
}

/**
 * Result returned by every cron job handler
 * Standardized format for job execution outcomes
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
}

/**
 * Handler function type for cron jobs
 * All job handlers must implement this signature
 */
export type CronJobHandler = (ctx: CronJobContext) => Promise<CronJobResult>;

/**
 * Definition of a registered cron job
 * Complete configuration for a scheduled job
 */
export interface CronJobDefinition {
    /** Unique name for the job (used in API endpoints) */
    name: string;
    /** Human-readable description of what the job does */
    description: string;
    /** Cron schedule expression (e.g., "0 0 * * *" for daily at midnight) */
    schedule: string;
    /** Function to execute when the job runs */
    handler: CronJobHandler;
    /** Whether the job is enabled (disabled jobs won't be scheduled) */
    enabled: boolean;
    /** Maximum execution time in milliseconds (default: 30000ms) */
    timeoutMs?: number;
}
