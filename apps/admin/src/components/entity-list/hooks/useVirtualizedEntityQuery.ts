import { fetchApi } from '@/lib/api/client';
import { useEntityQueryKeys } from '@/lib/query-keys';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { EntityQueryParams, EntityQueryResponse } from '../types';
import type { VirtualizedListConfig } from './useVirtualizedList';

/**
 * Configuration for virtualized entity query
 */
export type VirtualizedEntityQueryConfig = {
    /** Virtualization settings */
    readonly virtualization: VirtualizedListConfig;
    /** Page size for infinite loading */
    readonly pageSize?: number;
    /** Enable infinite loading */
    readonly enableInfiniteLoading?: boolean;
    /** Threshold for loading next page (items from bottom) */
    readonly loadMoreThreshold?: number;
    /** Maximum pages to load */
    readonly maxPages?: number;
};

/**
 * Props for useVirtualizedEntityQuery hook
 */
export type UseVirtualizedEntityQueryProps = {
    /** Entity name for query keys */
    readonly entityName: string;
    /** API endpoint for fetching data */
    readonly endpoint: string;
    /** Base query parameters */
    readonly baseParams?: Partial<EntityQueryParams>;
    /** Virtualization configuration */
    readonly config: VirtualizedEntityQueryConfig;
    /** Enable the query */
    readonly enabled?: boolean;
    /** Refetch interval */
    readonly refetchInterval?: number;
    /** Stale time */
    readonly staleTime?: number;
};

/**
 * Hook for virtualized entity queries with infinite loading support
 *
 * Combines TanStack Query infinite queries with virtualization for
 * optimal performance with large datasets.
 *
 * @example
 * ```tsx
 * const {
 *   items,
 *   isLoading,
 *   error,
 *   hasNextPage,
 *   loadMore,
 *   virtualizationConfig
 * } = useVirtualizedEntityQuery({
 *   entityName: 'accommodations',
 *   endpoint: '/api/accommodations',
 *   config: {
 *     virtualization: {
 *       estimateSize: 80,
 *       overscan: 5
 *     },
 *     pageSize: 50,
 *     enableInfiniteLoading: true
 *   }
 * });
 *
 * return (
 *   <VirtualizedEntityList
 *     items={items}
 *     config={virtualizationConfig}
 *     renderItem={(item) => <EntityCard entity={item} />}
 *     onScrollNearBottom={loadMore}
 *   />
 * );
 * ```
 */
export const useVirtualizedEntityQuery = <TData extends { id: string }>({
    entityName,
    endpoint,
    baseParams = {},
    config,
    enabled = true,
    refetchInterval,
    staleTime = 5 * 60 * 1000 // 5 minutes
}: UseVirtualizedEntityQueryProps) => {
    const { queryKeys } = useEntityQueryKeys(entityName);

    const pageSize = config.pageSize ?? 50;
    const enableInfiniteLoading = config.enableInfiniteLoading ?? true;

    // Create query parameters for each page
    const createPageParams = (pageParam: number): EntityQueryParams => ({
        page: pageParam,
        pageSize,
        ...baseParams
    });

    // Infinite query for paginated data
    const infiniteQuery = useInfiniteQuery({
        queryKey: queryKeys.virtualizedList(baseParams),
        queryFn: async ({ pageParam = 1 }) => {
            const params = createPageParams(pageParam);

            // Convert params to query string
            const searchParams = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
                if (value !== undefined && value !== null) {
                    searchParams.append(key, String(value));
                }
            }

            const url = `${endpoint}?${searchParams.toString()}`;
            const response = await fetchApi<EntityQueryResponse<TData>>({
                path: url,
                method: 'GET'
            });

            return response.data;
        },
        getNextPageParam: (lastPage, allPages) => {
            if (!enableInfiniteLoading) return undefined;

            const currentPage = allPages.length;
            const totalPages = Math.ceil((lastPage.total ?? 0) / pageSize);

            // Check max pages limit
            if (config.maxPages && currentPage >= config.maxPages) {
                return undefined;
            }

            // Check if there are more pages
            if (currentPage < totalPages) {
                return currentPage + 1;
            }

            return undefined;
        },
        initialPageParam: 1,
        enabled,
        refetchInterval,
        staleTime,
        gcTime: 10 * 60 * 1000, // 10 minutes
        retry: (failureCount, error) => {
            // Don't retry on 4xx errors
            if (error && 'status' in error && typeof error.status === 'number') {
                return error.status >= 500 && failureCount < 3;
            }
            return failureCount < 3;
        }
    });

    // Flatten all pages into a single array
    const items = useMemo(() => {
        if (!infiniteQuery.data?.pages) return [];

        return infiniteQuery.data.pages.flatMap((page) => page.data || []);
    }, [infiniteQuery.data?.pages]);

    // Get total count from first page
    const totalCount = useMemo(() => {
        return infiniteQuery.data?.pages[0]?.total ?? 0;
    }, [infiniteQuery.data?.pages]);

    // Load more function with threshold checking
    const loadMore = () => {
        if (infiniteQuery.hasNextPage && !infiniteQuery.isFetchingNextPage) {
            infiniteQuery.fetchNextPage();
        }
    };

    // Auto-load more when near bottom
    const handleScrollNearBottom = () => {
        if (!config.loadMoreThreshold) {
            loadMore();
            return;
        }

        const remainingItems = totalCount - items.length;
        if (remainingItems <= config.loadMoreThreshold) {
            loadMore();
        }
    };

    // Enhanced virtualization config with loading states
    const virtualizationConfig: VirtualizedListConfig = {
        ...config.virtualization,
        // Adjust overscan based on loading state
        overscan: infiniteQuery.isFetchingNextPage
            ? (config.virtualization.overscan ?? 5) * 2
            : config.virtualization.overscan
    };

    return {
        // Data
        items,
        totalCount,

        // Query state
        isLoading: infiniteQuery.isLoading,
        isError: infiniteQuery.isError,
        error: infiniteQuery.error,

        // Infinite loading
        hasNextPage: infiniteQuery.hasNextPage,
        isFetchingNextPage: infiniteQuery.isFetchingNextPage,
        loadMore,
        handleScrollNearBottom: enableInfiniteLoading ? handleScrollNearBottom : undefined,

        // Virtualization
        virtualizationConfig,

        // Utilities
        refetch: infiniteQuery.refetch,
        invalidate: () => {
            // Note: invalidation would need queryClient access
            // This could be enhanced with useQueryClient if needed
        },

        // Debug info
        pagesLoaded: infiniteQuery.data?.pages.length ?? 0,
        isStale: infiniteQuery.isStale
    };
};

/**
 * Preset configurations for common virtualized query scenarios
 */
export const VIRTUALIZED_QUERY_PRESETS = {
    /** Small items with aggressive loading */
    small: {
        virtualization: {
            estimateSize: 40,
            overscan: 15,
            gap: 1
        },
        pageSize: 100,
        enableInfiniteLoading: true,
        loadMoreThreshold: 20
    },
    /** Medium items with balanced loading */
    medium: {
        virtualization: {
            estimateSize: 80,
            overscan: 10,
            gap: 8
        },
        pageSize: 50,
        enableInfiniteLoading: true,
        loadMoreThreshold: 10
    },
    /** Large items with conservative loading */
    large: {
        virtualization: {
            estimateSize: 120,
            overscan: 5,
            gap: 12
        },
        pageSize: 25,
        enableInfiniteLoading: true,
        loadMoreThreshold: 5
    },
    /** Performance-focused for very large datasets */
    performance: {
        virtualization: {
            estimateSize: 60,
            overscan: 3,
            gap: 4
        },
        pageSize: 200,
        enableInfiniteLoading: true,
        loadMoreThreshold: 50,
        maxPages: 20 // Limit memory usage
    }
} as const satisfies Record<string, VirtualizedEntityQueryConfig>;
