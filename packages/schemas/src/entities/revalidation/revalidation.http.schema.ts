import { z } from 'zod';
import { RevalidationEntityTypeEnum } from './revalidation-config.schema.js';

/**
 * ManualRevalidateRequestSchema
 *
 * Request body for manually revalidating a list of specific URL paths.
 * Accepts between 1 and 100 paths per request.
 */
export const ManualRevalidateRequestSchema = z.object({
    /** List of URL paths to revalidate (e.g., `["/en/accommodations/hotel-palace"]`) */
    paths: z.array(z.string().min(1)).min(1).max(100),
    /** Optional human-readable reason for the manual revalidation (for audit logs) */
    reason: z.string().max(500).optional()
});

/** Request type for manually revalidating specific paths */
export type ManualRevalidateRequest = z.infer<typeof ManualRevalidateRequestSchema>;

/**
 * RevalidateEntityRequestSchema
 *
 * Request body for revalidating all paths associated with a specific entity instance.
 */
export const RevalidateEntityRequestSchema = z.object({
    /** The type of entity to revalidate paths for */
    entityType: RevalidationEntityTypeEnum,
    /** The ID of the specific entity instance */
    entityId: z.string().min(1),
    /** Optional human-readable reason for the revalidation (for audit logs) */
    reason: z.string().max(500).optional()
});

/** Request type for revalidating all paths for a specific entity instance */
export type RevalidateEntityRequest = z.infer<typeof RevalidateEntityRequestSchema>;

/**
 * RevalidateTypeRequestSchema
 *
 * Request body for revalidating all paths for an entire entity type.
 * Use with caution — this can trigger a large number of revalidations.
 */
export const RevalidateTypeRequestSchema = z.object({
    /** The entity type whose paths should all be revalidated */
    entityType: RevalidationEntityTypeEnum,
    /** Optional human-readable reason for the revalidation (for audit logs) */
    reason: z.string().max(500).optional()
});

/** Request type for revalidating all paths for a given entity type */
export type RevalidateTypeRequest = z.infer<typeof RevalidateTypeRequestSchema>;

/**
 * RevalidationResponseSchema
 *
 * Response returned after a revalidation operation completes.
 * Includes per-path success/failure breakdown and total duration.
 */
export const RevalidationResponseSchema = z.object({
    /** Whether the overall revalidation operation succeeded */
    success: z.boolean(),
    /** List of paths that were successfully revalidated */
    revalidated: z.array(z.string()),
    /** List of paths that failed to revalidate */
    failed: z.array(z.string()),
    /** Total duration of the revalidation operation in milliseconds */
    duration: z.number().int()
});

/** Response type for a revalidation operation */
export type RevalidationResponse = z.infer<typeof RevalidationResponseSchema>;

/**
 * RevalidationStatsSchema
 *
 * Aggregated statistics for revalidation activity.
 * Used in admin dashboards to monitor revalidation health and performance.
 */
export const RevalidationStatsSchema = z.object({
    /** Total number of revalidation attempts recorded */
    totalRevalidations: z.number().int(),
    /** Ratio of successful revalidations to total (0.0 to 1.0) */
    successRate: z.number().min(0).max(1),
    /** Average revalidation duration in milliseconds */
    avgDurationMs: z.number().int(),
    /** Timestamp of the most recent revalidation, or null if none recorded */
    lastRevalidation: z.coerce.date().nullable(),
    /** Revalidation counts broken down by entity type */
    byEntityType: z.record(z.string(), z.number().int()),
    /** Revalidation counts broken down by trigger source */
    byTrigger: z.record(z.string(), z.number().int())
});

/** Aggregated revalidation statistics */
export type RevalidationStats = z.infer<typeof RevalidationStatsSchema>;
