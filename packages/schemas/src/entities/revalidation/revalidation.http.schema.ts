import { z } from 'zod';
import { RevalidationEntityTypeEnum } from './revalidation-config.schema.js';

/**
 * Maximum characters in one cache tag (Cloudflare limit).
 * Mirrors `MAX_CACHE_TAG_LENGTH` in `@repo/cache-tags`.
 */
const MAX_CACHE_TAG_LENGTH = 1024;

/**
 * Printable ASCII (0x21–0x7E) excluding the comma, which is the `Cache-Tag`
 * list separator.
 *
 * **Deliberately duplicated** from `@repo/cache-tags`'s `isValidCacheTag`
 * rather than imported. `@repo/schemas` is consumed by every app in the repo,
 * several of which resolve it from SOURCE rather than from its build output —
 * so any runtime dependency it takes becomes a dependency every one of those
 * consumers must also declare, or their bundler fails to resolve it. That is
 * not hypothetical: importing it here broke `apps/admin`'s test run, which
 * pulls `@repo/schemas/src` through tsconfig paths.
 *
 * The duplication is held honest by `revalidation-http.schema.test.ts`, which
 * asserts this schema and `isValidCacheTag` agree on the same corpus of
 * accepted and rejected tags. `@repo/cache-tags` is a devDependency here for
 * exactly that test, never for runtime.
 */
const CACHE_TAG_PATTERN = /^[\x21-\x2B\x2D-\x7E]+$/;

/**
 * A single Cloudflare cache tag.
 *
 * Since HOS-369 W1-2 every tag on the wire is namespaced by deployment
 * environment (`prod:list-accom`, `preview:home`). The colon that separates
 * them is 0x3A, already inside {@link CACHE_TAG_PATTERN}'s `\x2D-\x7E` range,
 * so the namespace needed no widening of the rule on either side of the
 * duplication — which is the reason `:` was chosen over a character that would
 * have. The drift guard's corpus includes namespaced tags precisely so that
 * "it happens to still pass" is asserted rather than assumed.
 */
const CacheTagSchema = z.string().min(1).max(MAX_CACHE_TAG_LENGTH).regex(CACHE_TAG_PATTERN, {
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
 * RevalidationHealthSchema
 *
 * Operational state of the revalidation service, as reported by
 * `GET /api/v1/admin/revalidation/health`.
 *
 * `environmentFlushTarget` is the concrete cache tag a "flush everything"
 * request would purge on THIS deployment (`prod:all`, `preview:all`), or the
 * literal `'unresolved'` when the deployment namespace cannot be resolved. It
 * is reported as the resolved TAG rather than as the bare environment name so
 * that no consumer has to re-derive `<env>:all` on its own — the string here is
 * byte-for-byte the one that lands in `revalidation_log.target`, which is what
 * makes an operator's "did my flush run?" check a straight comparison.
 */
export const RevalidationHealthSchema = z.object({
    /** Whether the service singleton is up, absent, or erroring */
    status: z.enum(['operational', 'not_initialized', 'degraded']),
    /** Whether a real revalidation adapter is wired, or the no-op one */
    adapter: z.enum(['active', 'none']),
    /** The tag an environment flush would purge, or `'unresolved'` */
    environmentFlushTarget: z.string(),
    /** Time spent producing this report, in milliseconds */
    latencyMs: z.number().int().optional(),
    /** Error message when `status` is `degraded` */
    error: z.string().optional()
});

/** Operational state of the revalidation service */
export type RevalidationHealth = z.infer<typeof RevalidationHealthSchema>;

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
