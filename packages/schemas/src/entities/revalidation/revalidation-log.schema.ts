import { z } from 'zod';

/**
 * What initiated a revalidation event.
 * - `manual`: Triggered by an admin via the UI or API
 * - `hook`: Triggered by an entity change webhook
 * - `cron`: Triggered by a scheduled cron job
 * - `stale`: Triggered because the cached content exceeded its TTL
 */
export const RevalidationTriggerEnum = z.enum(['manual', 'hook', 'cron', 'stale']);

/** Union type of all supported revalidation trigger sources */
export type RevalidationTrigger = z.infer<typeof RevalidationTriggerEnum>;

/**
 * Outcome of a revalidation attempt for a single path.
 * - `success`: Path was successfully revalidated
 * - `failed`: Revalidation was attempted but encountered an error
 * - `skipped`: Revalidation was not performed (e.g., debounce active, feature disabled)
 */
export const RevalidationStatusEnum = z.enum(['success', 'failed', 'skipped']);

/** Union type of all supported revalidation statuses */
export type RevalidationStatus = z.infer<typeof RevalidationStatusEnum>;

/**
 * RevalidationLogSchema
 *
 * Records a single revalidation attempt for an ISR path.
 * Used for auditing, debugging, and monitoring revalidation health.
 */
export const RevalidationLogSchema = z.object({
    /** Unique identifier for this log entry */
    id: z.string().uuid(),
    /** The URL path that was revalidated (e.g., `/en/accommodations/hotel-palace`) */
    path: z.string(),
    /** The entity type associated with this revalidation (e.g., `accommodation`) */
    entityType: z.string(),
    /** The specific entity ID that triggered this revalidation, if applicable */
    entityId: z.string().nullable().optional(),
    /** What initiated this revalidation */
    trigger: RevalidationTriggerEnum,
    /** User ID or system identifier that triggered the revalidation, if applicable */
    triggeredBy: z.string().nullable().optional(),
    /** Whether the revalidation succeeded, failed, or was skipped */
    status: RevalidationStatusEnum,
    /** How long the revalidation took in milliseconds, if measured */
    durationMs: z.number().int().nullable().optional(),
    /** Error message if the revalidation failed */
    errorMessage: z.string().nullable().optional(),
    /** Arbitrary additional context for this revalidation event */
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    /** Timestamp when this log entry was created */
    createdAt: z.coerce.date()
});

/** A single revalidation log entry */
export type RevalidationLog = z.infer<typeof RevalidationLogSchema>;
