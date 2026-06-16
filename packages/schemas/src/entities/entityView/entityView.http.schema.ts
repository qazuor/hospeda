import { z } from 'zod';
import { EntityViewCaptureInputSchema } from './entityView.crud.schema.js';
import { EntityViewQuerySchema, EntityViewWindowSchema } from './entityView.query.schema.js';

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

/**
 * Bare array schema for bulk view-stats route handlers.
 *
 * Route handlers for batch, top-N, and protected editor/host endpoints return
 * this array directly. The response middleware (`createResponse`) wraps it once
 * into the `{ success, data }` envelope. Use this as `responseSchema` in route
 * factories to avoid double-wrapping.
 *
 * @example
 * ```ts
 * // Handler returns:
 * return result.data; // EntityViewStats[]
 * // Wire body becomes:
 * // { success: true, data: [{ entityId, unique, total }, ...] }
 * ```
 */
export const EntityViewStatsListSchema = z.array(EntityViewStatsSchema);

/** TypeScript type for the bare view-stats array, inferred from {@link EntityViewStatsListSchema}. */
export type EntityViewStatsList = z.infer<typeof EntityViewStatsListSchema>;

// ============================================================================
// HOST DAILY SERIES (SPEC-207)
// ============================================================================

/**
 * A single item in the per-host daily view-count series.
 *
 * `date` is a calendar date in `'YYYY-MM-DD'` format. `total` is the
 * deduplicated visit count across ALL of the host's accommodations for that
 * day (30-min bucket dedup — same semantics as the admin daily series).
 *
 * The service layer gap-fills missing days so the caller always receives
 * exactly `window` items (7 or 30 dates) with no gaps.
 *
 * @example
 * ```ts
 * const item: HostViewDailySeriesItem = { date: '2026-06-05', total: 12 };
 * ```
 */
export const HostViewDailySeriesItemSchema = z.object({
    /**
     * Calendar date in ISO `'YYYY-MM-DD'` format.
     * Rejected if the string does not match `^\d{4}-\d{2}-\d{2}$`.
     */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'zodError.entityView.hostDailySeries.date.invalid'
    }),

    /**
     * Deduplicated total visits across all owned accommodations for this day.
     * Zero for gap-filled days with no views. Must be a non-negative integer.
     */
    total: z
        .number({
            message: 'zodError.entityView.hostDailySeries.total.required'
        })
        .int({ message: 'zodError.entityView.hostDailySeries.total.integer' })
        .nonnegative({ message: 'zodError.entityView.hostDailySeries.total.nonnegative' })
});

/**
 * TypeScript type for a single host daily-series item, inferred from
 * {@link HostViewDailySeriesItemSchema}.
 */
export type HostViewDailySeriesItem = z.infer<typeof HostViewDailySeriesItemSchema>;

/**
 * Response envelope for `GET /api/v1/protected/views/accommodations/me/daily-series`.
 *
 * `window` echoes the requested rolling window ('7d' or '30d').
 * `items` is a gap-filled array of exactly `windowDays` entries, one per
 * calendar day, ordered from oldest to newest.
 *
 * @example
 * ```ts
 * const response: HostViewDailySeriesResponse = {
 *   window: '30d',
 *   items: [
 *     { date: '2026-05-17', total: 3 },
 *     { date: '2026-05-18', total: 0 },
 *     // ... 28 more rows
 *   ],
 * };
 * ```
 */
export const HostViewDailySeriesSchema = z.object({
    /**
     * Rolling window echoed from the request query param.
     * Useful for the consumer to display the chart x-axis range.
     */
    window: EntityViewWindowSchema,

    /**
     * Gap-filled daily series, one entry per calendar day in the window.
     * Always exactly 7 items for '7d' and 30 items for '30d'.
     */
    items: z.array(HostViewDailySeriesItemSchema)
});

/**
 * TypeScript type for the host daily-series response, inferred from
 * {@link HostViewDailySeriesSchema}.
 */
export type HostViewDailySeries = z.infer<typeof HostViewDailySeriesSchema>;
