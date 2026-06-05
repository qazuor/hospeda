import { z } from 'zod';
import { EntityViewCaptureInputSchema } from './entityView.crud.schema.js';
import { EntityViewQuerySchema } from './entityView.query.schema.js';

/**
 * EntityView HTTP wire schemas (SPEC-159 §5).
 *
 * These are the request/response shapes exchanged over HTTP. Separated from
 * the stored-entity schema following the same convention as `entityComment.http.schema.ts`.
 */

// ============================================================================
// PATH PARAMS
// ============================================================================

/**
 * `:entityId` path param for the view-stats endpoint.
 *
 * @example
 * ```ts
 * EntityViewPathParamsSchema.parse({ entityId: '550e8400-e29b-41d4-a716-446655440000' });
 * ```
 */
export const EntityViewPathParamsSchema = z.object({
    entityId: z
        .string({ message: 'zodError.entityView.entityId.required' })
        .uuid({ message: 'zodError.entityView.entityId.invalidUuid' })
});

/** TypeScript type for the path params, inferred from {@link EntityViewPathParamsSchema}. */
export type EntityViewPathParams = z.infer<typeof EntityViewPathParamsSchema>;

// ============================================================================
// REQUEST BODIES
// ============================================================================

/**
 * Capture request body for `POST /…/views`.
 * Re-exported from the CRUD module for route co-location.
 */
export const CaptureViewBodySchema = EntityViewCaptureInputSchema;

/** TypeScript type for the capture request body. */
export type CaptureViewBody = z.infer<typeof CaptureViewBodySchema>;

// ============================================================================
// QUERY PARAMS
// ============================================================================

/**
 * Query params schema for the view-stats endpoint.
 * Re-exported from the query module for route co-location.
 */
export const ViewStatsQuerySchema = EntityViewQuerySchema;

/** TypeScript type for the view-stats query params. */
export type ViewStatsQuery = z.infer<typeof ViewStatsQuerySchema>;

// ============================================================================
// RESPONSE ITEMS
// ============================================================================

/**
 * Per-entity view-count statistics for a single rolling window.
 *
 * Returned by `GET /…/:entityId/view-stats?window=<7d|30d>`.
 *
 * - `unique` — distinct visitor fingerprints within the window (≥ 0).
 * - `total`  — total view events recorded within the window (≥ 0, total ≥ unique).
 *
 * Both counts are non-negative integers; the schema rejects negative values
 * and non-integer numbers. SPEC-159 §5.2.
 *
 * @example
 * ```ts
 * const stats: EntityViewStats = { entityId: 'uuid', unique: 42, total: 150 };
 * ```
 */
export const EntityViewStatsSchema = z.object({
    /** UUID of the entity whose stats are reported. */
    entityId: z
        .string({ message: 'zodError.entityView.entityId.required' })
        .uuid({ message: 'zodError.entityView.entityId.invalidUuid' }),

    /**
     * Count of distinct visitor fingerprints within the window.
     * Must be a non-negative integer.
     */
    unique: z
        .number({ message: 'zodError.entityView.stats.unique.required' })
        .int({ message: 'zodError.entityView.stats.unique.integer' })
        .nonnegative({ message: 'zodError.entityView.stats.unique.nonnegative' }),

    /**
     * Total view-event count within the window (includes repeat views from the
     * same visitor). Must be a non-negative integer.
     */
    total: z
        .number({ message: 'zodError.entityView.stats.total.required' })
        .int({ message: 'zodError.entityView.stats.total.integer' })
        .nonnegative({ message: 'zodError.entityView.stats.total.nonnegative' })
});

/** TypeScript type for per-entity view stats, inferred from {@link EntityViewStatsSchema}. */
export type EntityViewStats = z.infer<typeof EntityViewStatsSchema>;

/**
 * Response for `GET /…/:entityId/view-stats` — a single entity's stats.
 *
 * @example
 * ```ts
 * const response: EntityViewStatsResponse = {
 *   data: { entityId: 'uuid', unique: 42, total: 150 },
 * };
 * ```
 */
export const EntityViewStatsResponseSchema = z.object({
    data: EntityViewStatsSchema
});

/** TypeScript type for the single-entity stats response. */
export type EntityViewStatsResponse = z.infer<typeof EntityViewStatsResponseSchema>;

/**
 * Response for a bulk view-stats list — an array of per-entity stats entries.
 *
 * Follows the same flat `{ data: [...] }` envelope used by
 * `EntityCommentRecentListResponseSchema` for non-paginated lists.
 *
 * @example
 * ```ts
 * const response: EntityViewStatsListResponse = {
 *   data: [
 *     { entityId: 'uuid-1', unique: 10, total: 30 },
 *     { entityId: 'uuid-2', unique: 5,  total: 12 },
 *   ],
 * };
 * ```
 */
export const EntityViewStatsListResponseSchema = z.object({
    data: z.array(EntityViewStatsSchema)
});

/** TypeScript type for the list stats response. */
export type EntityViewStatsListResponse = z.infer<typeof EntityViewStatsListResponseSchema>;
