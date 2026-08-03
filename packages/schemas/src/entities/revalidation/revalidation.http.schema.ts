import { isValidCacheTag } from '@repo/cache-tags';
import { z } from 'zod';
import { RevalidationEntityTypeEnum } from './revalidation-config.schema.js';

/**
 * A single Cloudflare cache tag, validated against the same rules
 * `@repo/cache-tags`'s {@link isValidCacheTag} enforces at the emitter/purger
 * boundary: printable ASCII (0x21–0x7E) excluding the comma, at most 1024
 * characters. Delegating to `isValidCacheTag` instead of re-deriving the
 * pattern keeps this the single source of truth for "what is a valid tag".
 */
const CacheTagSchema = z.string().refine((tag) => isValidCacheTag({ tag }), {
    message:
        'Cache tag must be printable ASCII (0x21-0x7E) excluding commas, 1-1024 characters long'
});

/**
 * ManualRevalidateByTagsSchema
 *
 * Request body for manually revalidating a list of specific cache tags.
 * Accepts between 1 and 100 tags per request.
 */
export const ManualRevalidateByTagsSchema = z
    .object({
        /** List of cache tags to revalidate (e.g., `["accom-hotel-palace", "list-accom"]`) */
        tags: z.array(CacheTagSchema).min(1).max(100),
        /** Optional human-readable reason for the manual revalidation (for audit logs) */
        reason: z.string().max(500).optional()
    })
    .strict();

/**
 * ManualRevalidatePurgeEverythingSchema
 *
 * Request body for a whole-zone Cloudflare purge. `purgeEverything` must be
 * the literal `true` — there is no implicit whole-zone fallback, so a
 * request that omits it can never reach the destructive path.
 */
export const ManualRevalidatePurgeEverythingSchema = z
    .object({
        /** Explicit opt-in to a whole-zone purge; the only way to reach it */
        purgeEverything: z.literal(true),
        /** Optional human-readable reason for the purge (for audit logs) */
        reason: z.string().max(500).optional()
    })
    .strict();

/**
 * ManualRevalidateRequestSchema
 *
 * Request body for the manual revalidation endpoint: either a bounded list of
 * cache tags, or an explicit whole-zone purge opt-in.
 *
 * Both branches are `.strict()`, which is what actually makes the two shapes
 * mutually exclusive. Without it a `z.union` would happily match
 * `{ tags: [...], purgeEverything: true }` against the FIRST branch and drop
 * the flag silently — the operator would ask for a whole-zone flush, watch the
 * request succeed, and get a tag purge. On an endpoint whose whole point is
 * that the destructive path can only be reached deliberately, an ambiguous
 * body must be rejected, not resolved.
 */
export const ManualRevalidateRequestSchema = z.union([
    ManualRevalidateByTagsSchema,
    ManualRevalidatePurgeEverythingSchema
]);

/** Request type for manually revalidating specific tags, or purging everything */
export type ManualRevalidateRequest = z.infer<typeof ManualRevalidateRequestSchema>;

/**
 * RevalidateEntityRequestSchema
 *
 * Request body for revalidating all cache tags associated with a specific entity instance.
 */
export const RevalidateEntityRequestSchema = z.object({
    /** The type of entity to revalidate cache tags for */
    entityType: RevalidationEntityTypeEnum,
    /** The ID of the specific entity instance */
    entityId: z.string().min(1),
    /** Optional human-readable reason for the revalidation (for audit logs) */
    reason: z.string().max(500).optional()
});

/** Request type for revalidating all cache tags for a specific entity instance */
export type RevalidateEntityRequest = z.infer<typeof RevalidateEntityRequestSchema>;

/**
 * RevalidateTypeRequestSchema
 *
 * Request body for revalidating the collection cache tag for an entire entity type.
 * Use with caution — this can trigger a large number of revalidations.
 */
export const RevalidateTypeRequestSchema = z.object({
    /** The entity type whose collection cache tag should be revalidated */
    entityType: RevalidationEntityTypeEnum,
    /** Optional human-readable reason for the revalidation (for audit logs) */
    reason: z.string().max(500).optional()
});

/** Request type for revalidating the collection cache tag for a given entity type */
export type RevalidateTypeRequest = z.infer<typeof RevalidateTypeRequestSchema>;

/**
 * RevalidationResponseSchema
 *
 * Response returned after a revalidation operation completes.
 * Includes per-target success/failure breakdown and total duration. `target`
 * here is whatever was purged: a cache tag, or `*` for a whole-zone purge.
 */
export const RevalidationResponseSchema = z.object({
    /** Whether the overall revalidation operation succeeded */
    success: z.boolean(),
    /** Targets that were successfully revalidated (cache tags, or `*`) */
    revalidated: z.array(z.string()),
    /** Targets that failed to revalidate */
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
