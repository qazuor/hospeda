/**
 * @file use-accommodation-view-stats.ts
 * @description Hook for fetching per-accommodation view statistics (SPEC-243 T-045).
 *
 * Endpoint: GET /api/v1/protected/views/accommodations/me?window=7d|30d
 * Response shape (after createProtectedRoute unwraps the envelope):
 *   EntityViewStats[] — array of { entityId, unique, total }
 *
 * The API middleware (createProtectedRoute + createResponse) wraps the handler
 * return value in `{ success: true, data: <value> }`, so the apiFetch client
 * unwraps `data` for us. The handler returns the bare array, which means the
 * wire body is `{ success: true, data: [ { entityId, unique, total }, ... ] }`.
 *
 * `EntityViewStatsListSchema` is NOT exported from the `@repo/schemas` index
 * (checked: no match in packages/schemas/src/index.ts). The schema is
 * defined inline here as a local Zod array, matching the exact shape from
 * `packages/schemas/src/entities/entityView/entityView.http.schema.ts`.
 *
 * @module lib/api/hooks/use-accommodation-view-stats
 */
import { z } from 'zod';
import { useApiQuery } from '../use-api-query';

// ---------------------------------------------------------------------------
// Wire schema — mirrors EntityViewStatsSchema from @repo/schemas (not re-exported
// from the index), plus EntityViewWindowSchema.
// ---------------------------------------------------------------------------

/** Rolling window parameter accepted by the API. */
export const ViewWindowSchema = z.enum(['7d', '30d']);

/** The two accepted window values. */
export type ViewWindow = z.infer<typeof ViewWindowSchema>;

/**
 * Per-accommodation view stats, matching EntityViewStatsSchema in @repo/schemas.
 *
 * - `entityId` — UUID of the accommodation.
 * - `unique`   — distinct visitor fingerprints within the window (≥ 0).
 * - `total`    — total view events within the window (≥ 0, total ≥ unique).
 */
export const AccommodationViewStatSchema = z.object({
    entityId: z.string().uuid(),
    unique: z.number().int().nonnegative(),
    total: z.number().int().nonnegative()
});

export type AccommodationViewStat = z.infer<typeof AccommodationViewStatSchema>;

/**
 * Response schema for GET /api/v1/protected/views/accommodations/me.
 *
 * The route handler returns a bare `EntityViewStats[]` which the
 * `createProtectedRoute` response middleware wraps as `{ success, data: [...] }`.
 * `apiFetch` unwraps `data`, so we validate the array directly.
 */
export const AccommodationViewStatsListSchema = z.array(AccommodationViewStatSchema);

export type AccommodationViewStatsList = z.infer<typeof AccommodationViewStatsListSchema>;

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

/** Stable TanStack Query keys for accommodation view stats. */
export const accommodationViewStatsKeys = {
    all: ['accommodation-view-stats'] as const,
    lists: () => [...accommodationViewStatsKeys.all, 'list'] as const,
    list: (window: ViewWindow) => [...accommodationViewStatsKeys.lists(), { window }] as const
};

// ---------------------------------------------------------------------------
// Input type
// ---------------------------------------------------------------------------

/**
 * Input params for {@link useAccommodationViewStats}.
 */
export interface UseAccommodationViewStatsInput {
    /** Rolling window for the stats. Defaults to '30d'. */
    readonly window?: ViewWindow;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetches view statistics for all accommodations owned by the authenticated host.
 *
 * Returns one entry per owned accommodation; accommodations with zero views
 * are included as `{ unique: 0, total: 0 }` by the server.
 *
 * Requires VIEW_BASIC_STATS entitlement (enforced server-side).
 *
 * @param input - Optional window parameter. Defaults to '30d'.
 * @returns TanStack `UseQueryResult<AccommodationViewStatsList>`.
 *
 * @example
 * ```ts
 * const { data, isLoading } = useAccommodationViewStats({ window: '7d' });
 * data?.forEach(stat => console.log(stat.entityId, stat.unique, stat.total));
 * ```
 */
export function useAccommodationViewStats({ window = '30d' }: UseAccommodationViewStatsInput = {}) {
    return useApiQuery({
        queryKey: accommodationViewStatsKeys.list(window),
        path: '/api/v1/protected/views/accommodations/me',
        query: { window },
        schema: AccommodationViewStatsListSchema,
        staleTime: 60 * 1000 // 1 minute — view stats are relatively fresh
    });
}
