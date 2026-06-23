/**
 * AI usage dashboard filter types (SPEC-260 T-013).
 *
 * These types mirror the query-param contract exposed by the four SPEC-260
 * admin endpoints:
 *   - GET /api/v1/admin/ai/usage/by-model
 *   - GET /api/v1/admin/ai/usage/by-provider
 *   - GET /api/v1/admin/ai/usage/by-feature-model
 *   - GET /api/v1/admin/ai/usage/daily
 *
 * The time-window contract is:
 *   - Either `year` + `month` (calendar-month UTC) → e.g. `{ year: 2026, month: 6 }`
 *   - Or `since` + `until` (ISO date strings) → e.g. `{ since: '2026-06-01', until: '2026-06-30' }`
 *   - All window params are optional; when absent the API returns all available data.
 *
 * Pagination (`page` + `pageSize`) is included in the search-param schema so
 * each endpoint's full filter set is self-contained in the URL.
 *
 * @module features/ai-usage/types
 */

import type { AiFeature } from '@repo/schemas';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Zod schemas for URL search-param serialization
// ---------------------------------------------------------------------------

/**
 * Base time-window fields shared by all four SPEC-260 endpoints.
 * Maps 1-to-1 with the query params accepted by the API.
 */
export const AiUsageTimeWindowSchema = z.object({
    /** Calendar year (UTC), e.g. `2026`. When combined with `month`, selects that month. */
    year: z.coerce.number().int().min(2024).max(2100).optional().catch(undefined),
    /** Calendar month 1–12 (UTC). Must be combined with `year` for a month window. */
    month: z.coerce.number().int().min(1).max(12).optional().catch(undefined),
    /**
     * Start of an explicit date-range window (ISO date string, e.g. `'2026-06-01'`).
     * When combined with `until`, selects that date range. Must be <= `until`.
     */
    since: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .catch(undefined),
    /**
     * End of an explicit date-range window (ISO date string, e.g. `'2026-06-30'`).
     * When combined with `since`, selects that date range. Must be >= `since`.
     */
    until: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .catch(undefined)
});

/** Inferred type for the time-window fields. */
export type AiUsageTimeWindow = z.infer<typeof AiUsageTimeWindowSchema>;

/**
 * Pagination fields shared by all list endpoints.
 * Defaults match the API defaults (`page=1`, `pageSize=20`).
 */
export const AiUsagePaginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1).catch(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20).catch(20)
});

// ---------------------------------------------------------------------------
// Per-endpoint filter schemas (= search-param schemas for TanStack Router)
// ---------------------------------------------------------------------------

/**
 * Search-param schema for the AI usage by-model page.
 * Maps to `GET /api/v1/admin/ai/usage/by-model`.
 *
 * Optional filters: `feature`, `provider`, `userId`.
 * Time window: `year`+`month` OR `since`/`until`.
 */
export const AiUsageByModelSearchSchema = AiUsageTimeWindowSchema.merge(
    AiUsagePaginationSchema
).extend({
    /** Narrow to a specific AI feature (one of the `AiFeature` enum values). */
    feature: z
        .enum([
            'text_improve',
            'chat',
            'search',
            'support',
            'translate',
            'accommodation_import',
            'post_generate'
        ] as const satisfies readonly [AiFeature, ...AiFeature[]])
        .optional()
        .catch(undefined),
    /** Narrow to a specific AI provider (e.g. `'openai'`, `'anthropic'`). */
    provider: z.string().min(1).optional().catch(undefined),
    /** Narrow to a single user UUID. */
    userId: z.string().uuid().optional().catch(undefined)
});

/** Resolved search-param type for the by-model page. */
export type AiUsageByModelSearch = z.infer<typeof AiUsageByModelSearchSchema>;

/**
 * Search-param schema for the AI usage by-provider page.
 * Maps to `GET /api/v1/admin/ai/usage/by-provider`.
 *
 * Optional filters: `feature`, `userId`.
 * Time window: `year`+`month` OR `since`/`until`.
 */
export const AiUsageByProviderSearchSchema = AiUsageTimeWindowSchema.merge(
    AiUsagePaginationSchema
).extend({
    /** Narrow to a specific AI feature (one of the `AiFeature` enum values). */
    feature: z
        .enum([
            'text_improve',
            'chat',
            'search',
            'support',
            'translate',
            'accommodation_import',
            'post_generate'
        ] as const satisfies readonly [AiFeature, ...AiFeature[]])
        .optional()
        .catch(undefined),
    /** Narrow to a single user UUID. */
    userId: z.string().uuid().optional().catch(undefined)
});

/** Resolved search-param type for the by-provider page. */
export type AiUsageByProviderSearch = z.infer<typeof AiUsageByProviderSearchSchema>;

/**
 * Search-param schema for the AI usage by-feature-model page.
 * Maps to `GET /api/v1/admin/ai/usage/by-feature-model`.
 *
 * Optional filters: `userId`.
 * Time window: `year`+`month` OR `since`/`until`.
 */
export const AiUsageByFeatureModelSearchSchema = AiUsageTimeWindowSchema.merge(
    AiUsagePaginationSchema
).extend({
    /** Narrow to a single user UUID. */
    userId: z.string().uuid().optional().catch(undefined)
});

/** Resolved search-param type for the by-feature-model page. */
export type AiUsageByFeatureModelSearch = z.infer<typeof AiUsageByFeatureModelSearchSchema>;

/**
 * Search-param schema for the AI usage daily page.
 * Maps to `GET /api/v1/admin/ai/usage/daily`.
 *
 * Optional filters: `feature`, `model`, `provider`, `userId`.
 * Time window: `year`+`month` OR `since`/`until`.
 */
export const AiUsageDailySearchSchema = AiUsageTimeWindowSchema.merge(
    AiUsagePaginationSchema
).extend({
    /** Narrow to a specific AI feature (one of the `AiFeature` enum values). */
    feature: z
        .enum([
            'text_improve',
            'chat',
            'search',
            'support',
            'translate',
            'accommodation_import',
            'post_generate'
        ] as const satisfies readonly [AiFeature, ...AiFeature[]])
        .optional()
        .catch(undefined),
    /** Narrow to a specific model string (e.g. `'gpt-4o-mini'`). */
    model: z.string().min(1).optional().catch(undefined),
    /** Narrow to a specific AI provider (e.g. `'openai'`). */
    provider: z.string().min(1).optional().catch(undefined),
    /** Narrow to a single user UUID. */
    userId: z.string().uuid().optional().catch(undefined)
});

/** Resolved search-param type for the daily page. */
export type AiUsageDailySearch = z.infer<typeof AiUsageDailySearchSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a resolved search-param filter object into a `URLSearchParams`
 * instance suitable for appending to API request paths.
 *
 * Only defined (non-undefined) values are included. `page` and `pageSize`
 * are always serialized because they have defaults.
 *
 * @param filters - The resolved filter object from `Route.useSearch()`.
 * @returns A `URLSearchParams` instance ready for string-ification.
 *
 * @example
 * ```ts
 * const params = buildAiUsageSearchParams({ year: 2026, month: 6, page: 1, pageSize: 20 });
 * fetch(`/api/v1/admin/ai/usage/by-model?${params}`);
 * ```
 */
export const buildAiUsageSearchParams = (
    filters: Readonly<Record<string, string | number | undefined>>
): URLSearchParams => {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined) {
            params.append(key, String(value));
        }
    }

    return params;
};
