import { z } from 'zod';
import { CronRunStatusEnum } from './cronRun.schema.js';

/**
 * Functional category a cron job belongs to. Used to group jobs in the admin
 * dashboard card and the platform crons page.
 */
export const CronCategoryEnum = z.enum([
    'billing',
    'notifications',
    'content',
    'media',
    'search-cache',
    'system'
]);

/** Union type of all cron job categories */
export type CronCategory = z.infer<typeof CronCategoryEnum>;

/** Compact last-run summary attached to each admin cron job entry. */
export const CronJobLastRunSchema = z.object({
    status: CronRunStatusEnum,
    finishedAt: z.coerce.date()
});

/** A job's most recent run, or null if it has never run. */
export type CronJobLastRun = z.infer<typeof CronJobLastRunSchema>;

/**
 * CronJobAdminSchema
 *
 * Enriched cron job entry returned by GET /api/v1/admin/cron. Combines the
 * registered job definition + presentation metadata (displayName, category),
 * a human-readable schedule, the computed next run, and the last recorded run.
 */
export const CronJobAdminSchema = z.object({
    /** Stable kebab-case identifier (CronJobDefinition.name) */
    name: z.string(),
    /** Friendly, human-facing name */
    displayName: z.string(),
    /** Functional category for grouping */
    category: CronCategoryEnum,
    /** Technical description of what the job does */
    description: z.string(),
    /** Raw 5-field cron expression */
    schedule: z.string(),
    /** Human-readable schedule (e.g. "Cada 15 minutos") */
    scheduleHuman: z.string(),
    /** Whether the job is enabled in the scheduler */
    enabled: z.boolean(),
    /** Next scheduled run (ISO string), or null if disabled / unparseable */
    nextRunAt: z.string().nullable(),
    /** Most recent recorded run, or null if none */
    lastRun: CronJobLastRunSchema.nullable()
});

/** An enriched admin cron job entry */
export type CronJobAdmin = z.infer<typeof CronJobAdminSchema>;

/**
 * CronJobsAdminListSchema
 *
 * Response payload for GET /api/v1/admin/cron: the enriched job list plus
 * counts.
 */
export const CronJobsAdminListSchema = z.object({
    jobs: z.array(CronJobAdminSchema),
    totalJobs: z.number().int(),
    enabledJobs: z.number().int()
});

/** Admin cron jobs list response */
export type CronJobsAdminList = z.infer<typeof CronJobsAdminListSchema>;
