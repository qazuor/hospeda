/**
 * Hook for fetching per-entity view stats for two time windows simultaneously.
 *
 * Fires two admin batch calls — one for `window=7d` and one for `window=30d` —
 * each returning `{ unique, total }` for a single entity. Results are cached
 * independently by React Query using the window as part of the key.
 *
 * Returns a no-op (all stats = null, isLoading = false) when:
 * - `enabled` is false (used to gate on ANALYTICS_VIEW permission), OR
 * - `entityId` is empty.
 *
 * @module use-entity-view-stats
 */

import type { ViewsBatchEntityType } from '@/hooks/use-views-batch';
import { fetchApi } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';

/** Supported time windows for the admin batch endpoint. */
export type ViewWindow = '7d' | '30d';

/** Stats for a single entity + window combination. */
export interface EntityWindowStats {
    readonly unique: number;
    readonly total: number;
}

/** Raw item shape returned by the batch endpoint. */
interface BatchItem {
    readonly entityId: string;
    readonly unique: number;
    readonly total: number;
}

/** API envelope returned by GET /admin/views/batch. */
interface BatchResponse {
    readonly success: boolean;
    readonly data: readonly BatchItem[];
}

/** Input parameters for {@link useEntityViewStats}. RO-RO pattern. */
export interface UseEntityViewStatsParams {
    /** Single entity UUID whose stats are requested. */
    readonly entityId: string;
    /** Entity type used as the `entityType` query param. */
    readonly entityType: ViewsBatchEntityType;
    /**
     * Master enable flag. Set to `false` to suppress all API calls
     * (e.g. when the user lacks ANALYTICS_VIEW permission).
     * Defaults to `true`.
     */
    readonly enabled?: boolean;
}

/** Return value of {@link useEntityViewStats}. */
export interface UseEntityViewStatsResult {
    /** View stats for the 7-day window. Null while loading or on error. */
    readonly stats7d: EntityWindowStats | null;
    /** View stats for the 30-day window. Null while loading or on error. */
    readonly stats30d: EntityWindowStats | null;
    /** True while either batch request is in-flight. */
    readonly isLoading: boolean;
    /** True when either batch request has failed. */
    readonly isError: boolean;
}

/**
 * Fetches a single entity's view stats for both 7d and 30d windows
 * via two independent admin batch calls.
 *
 * @param params - {@link UseEntityViewStatsParams}
 * @returns {@link UseEntityViewStatsResult}
 *
 * @example
 * ```tsx
 * const { stats7d, stats30d, isLoading, isError } = useEntityViewStats({
 *   entityId: id,
 *   entityType: 'ACCOMMODATION',
 *   enabled: hasAnalyticsView,
 * });
 * ```
 */
export function useEntityViewStats({
    entityId,
    entityType,
    enabled = true
}: UseEntityViewStatsParams): UseEntityViewStatsResult {
    const isQueryEnabled = enabled && Boolean(entityId);

    const fetchWindowStats = async (window: ViewWindow): Promise<EntityWindowStats | null> => {
        const response = await fetchApi<BatchResponse>({
            path: `/api/v1/admin/views/batch?entityType=${entityType}&entityIds=${entityId}&window=${window}`
        });
        const items = response.data?.data ?? [];
        const item = items.find((i) => i.entityId === entityId);
        return item ? { unique: item.unique, total: item.total } : { unique: 0, total: 0 };
    };

    const query7d = useQuery({
        queryKey: ['views-entity-stats', entityType, entityId, '7d'] as const,
        queryFn: () => fetchWindowStats('7d'),
        enabled: isQueryEnabled,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: false
    });

    const query30d = useQuery({
        queryKey: ['views-entity-stats', entityType, entityId, '30d'] as const,
        queryFn: () => fetchWindowStats('30d'),
        enabled: isQueryEnabled,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: false
    });

    if (!isQueryEnabled) {
        return {
            stats7d: null,
            stats30d: null,
            isLoading: false,
            isError: false
        };
    }

    return {
        stats7d: query7d.data ?? null,
        stats30d: query30d.data ?? null,
        isLoading: query7d.isLoading || query30d.isLoading,
        isError: query7d.isError || query30d.isError
    };
}
