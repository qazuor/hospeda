/**
 * Shared hook for fetching batch view stats from the admin views endpoint.
 *
 * Calls GET /api/v1/admin/views/batch with the supplied entity IDs and type,
 * returning a Map<entityId, total> for quick O(1) per-cell lookups. The batch
 * result is stable in the React Query cache for 5 minutes (staleTime).
 *
 * The hook is a no-op (returns an empty Map, isLoading=false) when:
 * - `entityIds` is empty, OR
 * - `enabled` is false (used by callers to gate on ANALYTICS_VIEW permission).
 *
 * @module use-views-batch
 */

import { fetchApi } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

/** Entity type values accepted by the admin batch endpoint. */
export type ViewsBatchEntityType = 'ACCOMMODATION' | 'POST' | 'EVENT';

/** Raw item shape returned by the batch endpoint. */
interface ViewsBatchItem {
    readonly entityId: string;
    readonly unique: number;
    readonly total: number;
}

/** API envelope returned by GET /admin/views/batch. */
interface ViewsBatchResponse {
    readonly success: boolean;
    readonly data: readonly ViewsBatchItem[];
}

/** Input parameters for {@link useViewsBatch}. RO-RO pattern. */
export interface UseViewsBatchParams {
    /** Entity type to query — used as `entityType` query param. */
    readonly entityType: ViewsBatchEntityType;
    /**
     * Array of entity UUIDs whose view counts are requested.
     * When empty, the hook is disabled and returns an empty Map immediately.
     * Maximum 100 entries (enforced by the batch endpoint).
     */
    readonly entityIds: readonly string[];
    /**
     * Master enable flag.
     * Set to `false` to fully suppress the API call (e.g. when the user
     * lacks ANALYTICS_VIEW permission). Defaults to `true`.
     */
    readonly enabled?: boolean;
}

/** Return value of {@link useViewsBatch}. */
export interface UseViewsBatchResult {
    /** Maps each entityId to its total 30-day view count. Zero-filled by the API. */
    readonly viewsMap: ReadonlyMap<string, number>;
    /** True while the batch request is in-flight. */
    readonly isLoading: boolean;
    /** True when the batch request has failed. */
    readonly isError: boolean;
}

/** Stable empty map returned when the hook is disabled. */
const EMPTY_MAP: ReadonlyMap<string, number> = new Map();

/**
 * Fetches 30-day total view counts for a page of entities via a single
 * admin batch call.
 *
 * All cells on the same list page that share the same `entityType` and
 * `entityIds` will resolve from the same React Query cache entry, ensuring
 * a single network request per page render.
 *
 * @param params - {@link UseViewsBatchParams}
 * @returns {@link UseViewsBatchResult}
 *
 * @example
 * ```tsx
 * const { viewsMap, isLoading, isError } = useViewsBatch({
 *   entityType: 'ACCOMMODATION',
 *   entityIds: rows.map((r) => r.id),
 *   enabled: hasAnalyticsView,
 * });
 * const total = viewsMap.get(entityId) ?? 0;
 * ```
 */
export function useViewsBatch({
    entityType,
    entityIds,
    enabled = true
}: UseViewsBatchParams): UseViewsBatchResult {
    // Stable sorted key so that different orderings of the same IDs hit the
    // same cache entry. Sort is O(n log n) on 20 items — negligible.
    const sortedIds = useMemo(() => [...entityIds].sort(), [entityIds]);

    const isQueryEnabled = enabled && sortedIds.length > 0;

    const { data, isLoading, isError } = useQuery({
        queryKey: ['views-batch', entityType, sortedIds] as const,
        queryFn: async (): Promise<ReadonlyMap<string, number>> => {
            const idsParam = sortedIds.join(',');
            const response = await fetchApi<ViewsBatchResponse>({
                path: `/api/v1/admin/views/batch?entityType=${entityType}&entityIds=${idsParam}&window=30d`
            });

            const items = response.data?.data ?? [];
            const map = new Map<string, number>();
            for (const item of items) {
                map.set(item.entityId, item.total);
            }
            return map;
        },
        enabled: isQueryEnabled,
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: false
    });

    return {
        viewsMap: data ?? EMPTY_MAP,
        isLoading: isQueryEnabled ? isLoading : false,
        isError: isQueryEnabled ? isError : false
    };
}
