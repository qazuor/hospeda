import { z } from 'zod';
import { EntityViewWindowSchema } from './entityView.query.schema.js';
import { TrackableEntityTypeSchema } from './entityView.schema.js';

/**
 * EntityView admin schemas (SPEC-197 — admin view-stats surfaces).
 *
 * These schemas cover the four admin-tier endpoints:
 *   - `GET /api/v1/admin/views/summary`
 *   - `GET /api/v1/admin/views/batch`
 *   - `GET /api/v1/admin/views/top`
 *   - `GET /api/v1/admin/views/daily-series`
 */

// ============================================================================
// SUMMARY RESPONSE
// ============================================================================

/**
 * A single row of the platform-wide view-count summary, one per entity type.
 *
 * Returned by `GET /api/v1/admin/views/summary` as an array of three items
 * (ACCOMMODATION, POST, EVENT). Missing entity types are zero-filled by the
 * service layer so the response always contains exactly three items.
 *
 * @example
 * ```ts
 * const item: AdminViewSummaryItem = {
 *   entityType: 'ACCOMMODATION',
 *   unique: 120,
 *   total: 340,
 * };
 * ```
 */
export const AdminViewSummaryItemSchema = z.object({
    /** Entity type — one of ACCOMMODATION, POST, EVENT. */
    entityType: TrackableEntityTypeSchema,

    /**
     * Count of distinct visitor fingerprints within the window.
     * Must be a non-negative integer.
     */
    unique: z.number().int().nonnegative(),

    /**
     * Deduplicated total visits within the window (30-min bucket dedup).
     * Must be a non-negative integer.
     */
    total: z.number().int().nonnegative()
});

/** TypeScript type for a summary row, inferred from {@link AdminViewSummaryItemSchema}. */
export type AdminViewSummaryItem = z.infer<typeof AdminViewSummaryItemSchema>;

/**
 * Response envelope for `GET /api/v1/admin/views/summary`.
 *
 * @example
 * ```ts
 * const response: AdminViewSummaryResponse = {
 *   data: [
 *     { entityType: 'ACCOMMODATION', unique: 120, total: 340 },
 *     { entityType: 'POST',          unique: 55,  total: 110 },
 *     { entityType: 'EVENT',         unique: 30,  total: 60  },
 *   ],
 * };
 * ```
 */
export const AdminViewSummaryResponseSchema = z.object({
    data: z.array(AdminViewSummaryItemSchema)
});

/** TypeScript type for the summary response, inferred from {@link AdminViewSummaryResponseSchema}. */
export type AdminViewSummaryResponse = z.infer<typeof AdminViewSummaryResponseSchema>;

// ============================================================================
// BATCH QUERY
// ============================================================================

/**
 * Query-params schema for `GET /api/v1/admin/views/batch`.
 *
 * `entityIds` arrives as a comma-separated string (HTTP query param) and is
 * transformed into a UUID array. The array must contain 1–100 valid UUIDs.
 * Empty string, more than 100 items, and any non-UUID value are rejected.
 *
 * zodError keys used:
 * - `zodError.entityView.entityId.invalidUuid` — per-item invalid UUID
 * - `zodError.adminView.batch.entityIds.empty` — array length < 1
 * - `zodError.adminView.batch.entityIds.tooMany` — array length > 100
 *
 * @example
 * ```ts
 * AdminViewBatchQuerySchema.parse({
 *   entityType: 'ACCOMMODATION',
 *   entityIds: 'uuid1,uuid2',
 *   window: '30d',
 * });
 * // → { entityType: 'ACCOMMODATION', entityIds: ['uuid1', 'uuid2'], window: '30d' }
 * ```
 */
export const AdminViewBatchQuerySchema = z.object({
    /** Entity type shared by all IDs in the batch. */
    entityType: TrackableEntityTypeSchema,

    /**
     * Comma-separated list of entity UUIDs to query.
     * Transformed to a UUID array on parse. Min 1, max 100 items.
     */
    entityIds: z
        .string()
        .transform((s) => s.split(','))
        .pipe(
            z
                .array(z.string().uuid({ message: 'zodError.entityView.entityId.invalidUuid' }))
                .min(1, { message: 'zodError.adminView.batch.entityIds.empty' })
                .max(100, { message: 'zodError.adminView.batch.entityIds.tooMany' })
        ),

    /** Rolling window. Defaults to `'30d'` when absent. */
    window: EntityViewWindowSchema.default('30d')
});

/** TypeScript type for the batch query params, inferred from {@link AdminViewBatchQuerySchema}. */
export type AdminViewBatchQuery = z.infer<typeof AdminViewBatchQuerySchema>;

// ============================================================================
// TOP-N QUERY
// ============================================================================

/**
 * Query-params schema for `GET /api/v1/admin/views/top`.
 *
 * `limit` is coerced from a query-string number to an integer. Accepted range
 * is 1–50; defaults to 10 when absent.
 *
 * @example
 * ```ts
 * AdminViewTopQuerySchema.parse({ entityType: 'POST', window: '7d', limit: '5' });
 * // → { entityType: 'POST', window: '7d', limit: 5 }
 *
 * AdminViewTopQuerySchema.parse({ entityType: 'EVENT' });
 * // → { entityType: 'EVENT', window: '30d', limit: 10 }
 * ```
 */
export const AdminViewTopQuerySchema = z.object({
    /** Entity type to rank. */
    entityType: TrackableEntityTypeSchema,

    /** Rolling window. Defaults to `'30d'` when absent. */
    window: EntityViewWindowSchema.default('30d'),

    /**
     * Maximum number of entities to return. Coerced from string (HTTP query
     * param). Must be an integer in [1, 50]; defaults to 10.
     */
    limit: z.coerce.number().int().min(1).max(50).default(10)
});

/** TypeScript type for the top-N query params, inferred from {@link AdminViewTopQuerySchema}. */
export type AdminViewTopQuery = z.infer<typeof AdminViewTopQuerySchema>;

// ============================================================================
// DAILY SERIES RESPONSE
// ============================================================================

/**
 * A single item in the daily view-count series.
 *
 * `date` must be a calendar date in `'YYYY-MM-DD'` format. The service layer
 * gap-fills missing days so that the full 30-day window always has an entry
 * per entity type (90 rows total for a 30-day window).
 *
 * zodError key: `zodError.adminView.dailySeries.date.invalid`
 *
 * @example
 * ```ts
 * const item: AdminViewDailySeriesItem = {
 *   date: '2026-06-05',
 *   entityType: 'ACCOMMODATION',
 *   total: 12,
 * };
 * ```
 */
export const AdminViewDailySeriesItemSchema = z.object({
    /**
     * Calendar date in ISO `'YYYY-MM-DD'` format.
     * Rejected if the string does not match the regex `^\d{4}-\d{2}-\d{2}$`.
     */
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
        message: 'zodError.adminView.dailySeries.date.invalid'
    }),

    /** Entity type for this day-bucket row. */
    entityType: TrackableEntityTypeSchema,

    /**
     * Deduplicated total visits for this day (30-min bucket dedup).
     * Zero for days with no views (gap-filled by service).
     */
    total: z.number().int().nonnegative()
});

/** TypeScript type for a daily series item, inferred from {@link AdminViewDailySeriesItemSchema}. */
export type AdminViewDailySeriesItem = z.infer<typeof AdminViewDailySeriesItemSchema>;

/**
 * Response envelope for `GET /api/v1/admin/views/daily-series`.
 *
 * The service gap-fills the result to 90 rows (3 entity types × 30 days).
 * Every row satisfies {@link AdminViewDailySeriesItemSchema}.
 *
 * @example
 * ```ts
 * const response: AdminViewDailySeriesResponse = {
 *   data: [
 *     { date: '2026-05-07', entityType: 'ACCOMMODATION', total: 5 },
 *     // ... 89 more rows
 *   ],
 * };
 * ```
 */
export const AdminViewDailySeriesResponseSchema = z.object({
    data: z.array(AdminViewDailySeriesItemSchema)
});

/** TypeScript type for the daily series response, inferred from {@link AdminViewDailySeriesResponseSchema}. */
export type AdminViewDailySeriesResponse = z.infer<typeof AdminViewDailySeriesResponseSchema>;
