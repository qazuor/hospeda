/**
 * Cron Job Types
 * Defines the contract for all scheduled jobs in the system.
 * @module cron/types
 */

/**
 * Options for a cron logger call. A subset of `LoggerOptions` from
 * `@repo/logger`, kept here to avoid a direct import cycle.
 */
export interface CronLogOptions {
    /**
     * When `true` on an `error` call, forwards the logged value to the
     * registered capture hook (e.g. Sentry). Only honoured at `error` level;
     * silently ignored on `info`/`warn`/`debug`.
     * @see SPEC-180 BETA-64
     */
    capture?: boolean;
}

/**
 * Context passed to every cron job handler
 * Provides logging, timing, and execution mode information
 */
export interface CronJobContext {
    /** Logger instance with standard logging methods */
    logger: {
        info: (message: string, data?: Record<string, unknown>) => void;
        warn: (message: string, data?: Record<string, unknown>) => void;
        /**
         * Log an error. Pass `options.capture = true` for genuinely actionable
         * errors that should create a Sentry issue (startup failures, unrecoverable
         * cron errors). Omit `capture` for expected/transient errors.
         */
        error: (message: string, data?: Record<string, unknown>, options?: CronLogOptions) => void;
        debug: (message: string, data?: Record<string, unknown>) => void;
    };
    /** Timestamp when the job execution started */
    startedAt: Date;
    /**
     * Identifier of this run (HOS-1424, NUCLEO/08 §2.3). Fresh on every tick
     * and every manual trigger; stamped on every log line of the run so a run
     * can be read whole. `cron_runs` keeps its own row id; this one is not
     * persisted there.
     */
    runId: string;
    /**
     * Correlation of this run (HOS-1424, AC:U2:9): a job carries the
     * correlation of its run AND, for each item it processes, the item's own
     * (the one stored on the entity, or one minted for the item). This is the
     * first of the two; per-item correlations are the job's business.
     */
    correlationId: string;
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
    /**
     * Cron schedule expression (e.g., "0 0 * * *" for daily at midnight).
     * Read on the wall clock of the market time zone,
     * `America/Argentina/Buenos_Aires` (HOS-1424): `0 8 * * *` runs at 08:00
     * in Buenos Aires (11:00 UTC), whatever the process zone is.
     */
    schedule: string;
    /** Function to execute when the job runs */
    handler: CronJobHandler;
    /** Whether the job is enabled (disabled jobs won't be scheduled) */
    enabled: boolean;
    /** Maximum execution time in milliseconds (default: 30000ms) */
    timeoutMs?: number;
    /**
     * Optional async resolver for a settings-driven cron cadence. When
     * present, `startCronScheduler` awaits this once per job at scheduler
     * startup and registers the returned cron expression with node-cron
     * instead of the static `schedule` literal above. `schedule` still
     * describes the documented default — it is what `schedules.manifest.ts`
     * and the admin panel compare against — this is a startup-time override
     * only: a changed setting takes effect on the next process restart, not
     * live. If the resolver throws, registration falls back to `schedule`.
     */
    resolveSchedule?: () => Promise<string>;
}
