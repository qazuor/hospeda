/**
 * TanStack Query hooks for the AI usage dashboard (SPEC-260 T-013).
 *
 * One hook per endpoint. Each hook:
 *   1. Accepts a filter object whose shape matches the corresponding
 *      `*SearchSchema` type (consumed from TanStack Router search params).
 *   2. Builds a `URLSearchParams` string and calls the shared admin `fetchApi`.
 *   3. Keys the query by the full resolved filter object so that any filter
 *      change triggers a fresh fetch and occupies its own cache entry.
 *   4. Returns typed rows from `@repo/schemas`.
 *
 * Endpoints consumed:
 *   - GET /api/v1/admin/ai/usage/by-model         → `useAiUsageByModelQuery`
 *   - GET /api/v1/admin/ai/usage/by-provider       → `useAiUsageByProviderQuery`
 *   - GET /api/v1/admin/ai/usage/by-feature-model  → `useAiUsageByFeatureModelQuery`
 *   - GET /api/v1/admin/ai/usage/daily             → `useAiUsageDailyQuery`
 *
 * Response envelope from the API:
 * ```json
 * { "success": true, "data": { "items": [...], "pagination": {...} } }
 * ```
 *
 * Money convention: `costMicroUsd` values are integer µUSD (1 USD = 1,000,000 µUSD).
 *
 * @module features/ai-usage/hooks
 */

import { fetchApi } from '@/lib/api/client';
import type {
    AiUsageByFeatureModelRow,
    AiUsageByModelRow,
    AiUsageByProviderRow,
    AiUsageDailyRow
} from '@repo/schemas';
import { useQuery } from '@tanstack/react-query';
import { buildAiUsageSearchParams } from './types';
import type {
    AiUsageByFeatureModelSearch,
    AiUsageByModelSearch,
    AiUsageByProviderSearch,
    AiUsageDailySearch
} from './types';

// ---------------------------------------------------------------------------
// Pagination envelope shape
// ---------------------------------------------------------------------------

/**
 * Standard paginated list envelope returned by every admin list route.
 * @internal
 */
interface PaginatedResponse<T> {
    readonly items: readonly T[];
    readonly pagination: {
        readonly page: number;
        readonly pageSize: number;
        readonly total: number;
        readonly totalPages: number;
    };
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

/**
 * TanStack Query key factory for AI usage reporting queries.
 *
 * The resolved filter object is the last segment of every key, which means:
 *   - Changing any filter → new cache entry (fresh fetch).
 *   - `queryClient.invalidateQueries({ queryKey: aiUsageQueryKeys.all })`
 *     invalidates every AI usage query at once.
 */
export const aiUsageQueryKeys = {
    /** Root key for all AI usage queries — useful for bulk invalidation. */
    all: ['ai-usage'] as const,

    /**
     * Key for the per-model aggregate query.
     * @param filters - Resolved by-model search params.
     */
    byModel: (filters: AiUsageByModelSearch) =>
        [...aiUsageQueryKeys.all, 'by-model', filters] as const,

    /**
     * Key for the per-provider aggregate query.
     * @param filters - Resolved by-provider search params.
     */
    byProvider: (filters: AiUsageByProviderSearch) =>
        [...aiUsageQueryKeys.all, 'by-provider', filters] as const,

    /**
     * Key for the feature × model cross aggregate query.
     * @param filters - Resolved by-feature-model search params.
     */
    byFeatureModel: (filters: AiUsageByFeatureModelSearch) =>
        [...aiUsageQueryKeys.all, 'by-feature-model', filters] as const,

    /**
     * Key for the daily time-series query.
     * @param filters - Resolved daily search params.
     */
    daily: (filters: AiUsageDailySearch) => [...aiUsageQueryKeys.all, 'daily', filters] as const
} as const;

// ---------------------------------------------------------------------------
// Private fetch helpers
// ---------------------------------------------------------------------------

/**
 * Fetches AI usage aggregated per model for the given window and filters.
 *
 * @param filters - Resolved by-model search params from TanStack Router.
 * @returns Paginated response containing `AiUsageByModelRow[]`.
 */
async function fetchUsageByModel(
    filters: AiUsageByModelSearch
): Promise<PaginatedResponse<AiUsageByModelRow>> {
    // Pick ONLY the params /by-model accepts. The page passes the superset
    // AiUsageDailySearch (which includes `model`); sending an unaccepted param
    // makes createAdminListRoute reject the request with 422. Destructuring drops
    // any excess key (e.g. `model`) regardless of what the caller passes.
    const { year, month, since, until, feature, provider, userId, page, pageSize } = filters;
    const params = buildAiUsageSearchParams({
        year,
        month,
        since,
        until,
        feature,
        provider,
        userId,
        page,
        pageSize
    });
    const result = await fetchApi<{
        success: boolean;
        data: PaginatedResponse<AiUsageByModelRow>;
    }>({
        path: `/api/v1/admin/ai/usage/by-model?${params.toString()}`
    });
    return result.data.data;
}

/**
 * Fetches AI usage aggregated per provider for the given window and filters.
 *
 * @param filters - Resolved by-provider search params from TanStack Router.
 * @returns Paginated response containing `AiUsageByProviderRow[]`.
 */
async function fetchUsageByProvider(
    filters: AiUsageByProviderSearch
): Promise<PaginatedResponse<AiUsageByProviderRow>> {
    // /by-provider accepts feature + userId only (no `provider`/`model`).
    // Destructure to drop any excess key the page-level superset may carry.
    const { year, month, since, until, feature, userId, page, pageSize } = filters;
    const params = buildAiUsageSearchParams({
        year,
        month,
        since,
        until,
        feature,
        userId,
        page,
        pageSize
    });
    const result = await fetchApi<{
        success: boolean;
        data: PaginatedResponse<AiUsageByProviderRow>;
    }>({
        path: `/api/v1/admin/ai/usage/by-provider?${params.toString()}`
    });
    return result.data.data;
}

/**
 * Fetches AI usage aggregated per feature × model pair for the given window and filters.
 *
 * @param filters - Resolved by-feature-model search params from TanStack Router.
 * @returns Paginated response containing `AiUsageByFeatureModelRow[]`.
 */
async function fetchUsageByFeatureModel(
    filters: AiUsageByFeatureModelSearch
): Promise<PaginatedResponse<AiUsageByFeatureModelRow>> {
    // /by-feature-model accepts window + userId only (it groups by feature AND
    // model, so feature/model/provider are NOT filters). Drop any excess key.
    const { year, month, since, until, userId, page, pageSize } = filters;
    const params = buildAiUsageSearchParams({
        year,
        month,
        since,
        until,
        userId,
        page,
        pageSize
    });
    const result = await fetchApi<{
        success: boolean;
        data: PaginatedResponse<AiUsageByFeatureModelRow>;
    }>({
        path: `/api/v1/admin/ai/usage/by-feature-model?${params.toString()}`
    });
    return result.data.data;
}

/**
 * Fetches AI usage aggregated by UTC calendar day for the given window and filters.
 *
 * @param filters - Resolved daily search params from TanStack Router.
 * @returns Paginated response containing `AiUsageDailyRow[]`.
 */
async function fetchDailyUsage(
    filters: AiUsageDailySearch
): Promise<PaginatedResponse<AiUsageDailyRow>> {
    // /daily accepts the full filter set (feature/model/provider/userId).
    // Explicit destructure keeps this consistent with the other helpers and
    // guarantees no stray key reaches the request.
    const { year, month, since, until, feature, model, provider, userId, page, pageSize } = filters;
    const params = buildAiUsageSearchParams({
        year,
        month,
        since,
        until,
        feature,
        model,
        provider,
        userId,
        page,
        pageSize
    });
    const result = await fetchApi<{
        success: boolean;
        data: PaginatedResponse<AiUsageDailyRow>;
    }>({
        path: `/api/v1/admin/ai/usage/daily?${params.toString()}`
    });
    return result.data.data;
}

// ---------------------------------------------------------------------------
// Public hooks
// ---------------------------------------------------------------------------

/**
 * Hook to fetch AI usage aggregated per model.
 *
 * Consumes `GET /api/v1/admin/ai/usage/by-model`.
 * Keyed by the full resolved filter object — any filter change fetches fresh data.
 *
 * Filters accepted:
 * - Time window: `year`+`month` OR `since`/`until`
 * - `feature`, `provider`, `userId` (all optional)
 * - `page`, `pageSize` (pagination; defaults: 1 / 20)
 *
 * Uses a 2-minute stale time; usage data changes rarely mid-session.
 *
 * @param filters - Resolved by-model search params, typically from `Route.useSearch()`.
 * @returns TanStack Query result with `data: PaginatedResponse<AiUsageByModelRow>`.
 *
 * @example
 * ```tsx
 * const search = Route.useSearch();
 * const { data, isLoading, error } = useAiUsageByModelQuery(search);
 * ```
 */
export const useAiUsageByModelQuery = (filters: AiUsageByModelSearch) => {
    return useQuery({
        queryKey: aiUsageQueryKeys.byModel(filters),
        queryFn: () => fetchUsageByModel(filters),
        staleTime: 2 * 60_000,
        retry: 1
    });
};

/**
 * Hook to fetch AI usage aggregated per provider.
 *
 * Consumes `GET /api/v1/admin/ai/usage/by-provider`.
 * Keyed by the full resolved filter object.
 *
 * Filters accepted:
 * - Time window: `year`+`month` OR `since`/`until`
 * - `feature`, `userId` (both optional)
 * - `page`, `pageSize` (pagination; defaults: 1 / 20)
 *
 * @param filters - Resolved by-provider search params, typically from `Route.useSearch()`.
 * @returns TanStack Query result with `data: PaginatedResponse<AiUsageByProviderRow>`.
 *
 * @example
 * ```tsx
 * const search = Route.useSearch();
 * const { data, isLoading, error } = useAiUsageByProviderQuery(search);
 * ```
 */
export const useAiUsageByProviderQuery = (filters: AiUsageByProviderSearch) => {
    return useQuery({
        queryKey: aiUsageQueryKeys.byProvider(filters),
        queryFn: () => fetchUsageByProvider(filters),
        staleTime: 2 * 60_000,
        retry: 1
    });
};

/**
 * Hook to fetch AI usage aggregated per feature × model pair.
 *
 * Consumes `GET /api/v1/admin/ai/usage/by-feature-model`.
 * Keyed by the full resolved filter object.
 *
 * Filters accepted:
 * - Time window: `year`+`month` OR `since`/`until`
 * - `userId` (optional)
 * - `page`, `pageSize` (pagination; defaults: 1 / 20)
 *
 * @param filters - Resolved by-feature-model search params, typically from `Route.useSearch()`.
 * @returns TanStack Query result with `data: PaginatedResponse<AiUsageByFeatureModelRow>`.
 *
 * @example
 * ```tsx
 * const search = Route.useSearch();
 * const { data, isLoading, error } = useAiUsageByFeatureModelQuery(search);
 * ```
 */
export const useAiUsageByFeatureModelQuery = (filters: AiUsageByFeatureModelSearch) => {
    return useQuery({
        queryKey: aiUsageQueryKeys.byFeatureModel(filters),
        queryFn: () => fetchUsageByFeatureModel(filters),
        staleTime: 2 * 60_000,
        retry: 1
    });
};

/**
 * Hook to fetch AI usage aggregated by UTC calendar day.
 *
 * Consumes `GET /api/v1/admin/ai/usage/daily`.
 * Keyed by the full resolved filter object.
 *
 * Filters accepted:
 * - Time window: `year`+`month` OR `since`/`until`
 * - `feature`, `model`, `provider`, `userId` (all optional)
 * - `page`, `pageSize` (pagination; defaults: 1 / 20)
 *
 * Uses a 2-minute stale time. Days with zero activity are zero-filled by the
 * API so the returned series is always continuous.
 *
 * @param filters - Resolved daily search params, typically from `Route.useSearch()`.
 * @returns TanStack Query result with `data: PaginatedResponse<AiUsageDailyRow>`.
 *
 * @example
 * ```tsx
 * const search = Route.useSearch();
 * const { data, isLoading, error } = useAiUsageDailyQuery(search);
 * ```
 */
export const useAiUsageDailyQuery = (filters: AiUsageDailySearch) => {
    return useQuery({
        queryKey: aiUsageQueryKeys.daily(filters),
        queryFn: () => fetchDailyUsage(filters),
        staleTime: 2 * 60_000,
        retry: 1
    });
};
