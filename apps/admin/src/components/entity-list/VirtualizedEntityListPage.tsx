import { cn } from '@/lib/utils';
import { adminLogger } from '@/utils/logger';
import type { ReactNode } from 'react';
import {
    DefaultEmptyState,
    DefaultErrorState,
    DefaultLoadingState,
    VirtualizedEntityList
} from './VirtualizedEntityList';
import {
    type VirtualizedEntityQueryConfig,
    useVirtualizedEntityQuery
} from './hooks/useVirtualizedEntityQuery';
import type { EntityQueryParams } from './types';

/**
 * Props for VirtualizedEntityListPage component
 */
export type VirtualizedEntityListPageProps<TData> = {
    /** Entity name for queries */
    readonly entityName: string;
    /** API endpoint */
    readonly endpoint: string;
    /** Render function for each item */
    readonly renderItem: (item: TData, index: number) => ReactNode;
    /** Virtualization configuration */
    readonly config: VirtualizedEntityQueryConfig;
    /** Base query parameters */
    readonly baseParams?: Partial<EntityQueryParams>;
    /** Container height */
    readonly height?: number;
    /** Container width */
    readonly width?: number;
    /** Additional CSS classes */
    readonly className?: string;
    /** Custom empty state */
    readonly emptyState?: ReactNode;
    /** Custom loading state */
    readonly loadingState?: ReactNode;
    /** Custom error state */
    readonly errorState?: ReactNode;
    /** Show scroll indicators */
    readonly showScrollIndicators?: boolean;
    /** Show debug info */
    readonly showDebugInfo?: boolean;
    /** Enable query */
    readonly enabled?: boolean;
    /** Refetch interval */
    readonly refetchInterval?: number;
    /** Stale time */
    readonly staleTime?: number;
    /** Header content */
    readonly header?: ReactNode;
    /** Footer content */
    readonly footer?: ReactNode;
    /** Loading more indicator */
    readonly loadingMoreIndicator?: ReactNode;
};

/**
 * Complete virtualized entity list page with infinite loading
 *
 * Combines virtualized rendering with infinite queries for optimal
 * performance with large datasets.
 *
 * @example
 * ```tsx
 * <VirtualizedEntityListPage
 *   entityName="accommodations"
 *   endpoint="/api/accommodations"
 *   renderItem={(accommodation) => (
 *     <AccommodationCard accommodation={accommodation} />
 *   )}
 *   config={{
 *     virtualization: {
 *       estimateSize: 120,
 *       overscan: 5
 *     },
 *     pageSize: 50,
 *     enableInfiniteLoading: true
 *   }}
 *   height={600}
 *   header={<h2>Accommodations</h2>}
 * />
 * ```
 */
export const VirtualizedEntityListPage = <TData extends { id: string }>({
    entityName,
    endpoint,
    renderItem,
    config,
    baseParams,
    height = 600,
    width,
    className,
    emptyState,
    loadingState,
    errorState,
    showScrollIndicators = true,
    showDebugInfo = false,
    enabled = true,
    refetchInterval,
    staleTime,
    header,
    footer,
    loadingMoreIndicator
}: VirtualizedEntityListPageProps<TData>) => {
    const {
        items,
        totalCount,
        isLoading,
        isError,
        error,
        hasNextPage,
        isFetchingNextPage,
        handleScrollNearBottom,
        virtualizationConfig,
        refetch,
        pagesLoaded,
        isStale
    } = useVirtualizedEntityQuery<TData>({
        entityName,
        endpoint,
        baseParams,
        config,
        enabled,
        refetchInterval,
        staleTime
    });

    // Default states
    const defaultEmptyState = emptyState || <DefaultEmptyState message="No items found" />;
    const defaultLoadingState = loadingState || <DefaultLoadingState message="Loading items..." />;
    const defaultErrorState = errorState || (
        <DefaultErrorState
            error={error instanceof Error ? error : undefined}
            onRetry={() => refetch()}
        />
    );

    const defaultLoadingMoreIndicator = loadingMoreIndicator || (
        <div className="flex items-center justify-center py-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
                Loading more...
            </div>
        </div>
    );

    return (
        <div className={cn('flex flex-col', className)}>
            {/* Header */}
            {header && <div className="mb-4">{header}</div>}

            {/* Stats and controls */}
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-4 text-gray-600 text-sm">
                    <span>
                        {isLoading ? 'Loading...' : `${items.length} of ${totalCount} items`}
                    </span>
                    {pagesLoaded > 1 && (
                        <span className="text-gray-400">({pagesLoaded} pages loaded)</span>
                    )}
                    {isStale && <span className="text-yellow-600">(stale)</span>}
                </div>

                <div className="flex items-center gap-2">
                    {/* Refresh button */}
                    <button
                        type="button"
                        onClick={() => refetch()}
                        disabled={isLoading}
                        className="rounded bg-gray-100 px-3 py-1 text-gray-700 text-sm hover:bg-gray-200 disabled:opacity-50"
                        title="Refresh"
                    >
                        <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <title>Refresh</title>
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                    </button>

                    {/* Debug info toggle */}
                    {process.env.NODE_ENV === 'development' && (
                        <button
                            type="button"
                            onClick={() => {
                                // This would need state management for the toggle
                                adminLogger.info(
                                    'Debug info:',
                                    `items: ${items.length}, totalCount: ${totalCount}, pagesLoaded: ${pagesLoaded}, hasNextPage: ${hasNextPage}, isFetchingNextPage: ${isFetchingNextPage}, isStale: ${isStale}`
                                );
                            }}
                            className="rounded bg-blue-100 px-2 py-1 text-blue-700 text-xs hover:bg-blue-200"
                            title="Debug info"
                        >
                            Debug
                        </button>
                    )}
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1">
                <VirtualizedEntityList
                    items={items}
                    renderItem={renderItem}
                    config={virtualizationConfig}
                    height={height}
                    width={width}
                    isLoading={isLoading}
                    error={
                        isError
                            ? error instanceof Error
                                ? error
                                : new Error('Unknown error')
                            : null
                    }
                    emptyState={defaultEmptyState}
                    loadingState={defaultLoadingState}
                    errorState={defaultErrorState}
                    showScrollIndicators={showScrollIndicators}
                    onScrollNearBottom={handleScrollNearBottom}
                    nearBottomThreshold={100}
                />
            </div>

            {/* Loading more indicator */}
            {isFetchingNextPage && <div className="mt-2">{defaultLoadingMoreIndicator}</div>}

            {/* End of list indicator */}
            {!hasNextPage && items.length > 0 && !isLoading && (
                <div className="mt-4 text-center text-gray-500 text-sm">
                    End of list ({totalCount} total items)
                </div>
            )}

            {/* Footer */}
            {footer && <div className="mt-4">{footer}</div>}

            {/* Debug panel */}
            {showDebugInfo && process.env.NODE_ENV === 'development' && (
                <div className="mt-4 rounded border bg-gray-50 p-3 text-xs">
                    <h4 className="mb-2 font-semibold">Debug Info</h4>
                    <div className="grid grid-cols-2 gap-2">
                        <div>Items loaded: {items.length}</div>
                        <div>Total count: {totalCount}</div>
                        <div>Pages loaded: {pagesLoaded}</div>
                        <div>Has next page: {hasNextPage ? 'Yes' : 'No'}</div>
                        <div>Fetching next: {isFetchingNextPage ? 'Yes' : 'No'}</div>
                        <div>Is stale: {isStale ? 'Yes' : 'No'}</div>
                        <div>Estimate size: {virtualizationConfig.estimateSize}px</div>
                        <div>Overscan: {virtualizationConfig.overscan}</div>
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * Simple wrapper for common use cases
 */
export const SimpleVirtualizedList = <TData extends { id: string }>({
    entityName,
    endpoint,
    renderItem,
    preset = 'medium',
    ...props
}: Omit<VirtualizedEntityListPageProps<TData>, 'config'> & {
    preset?: 'small' | 'medium' | 'large' | 'performance';
}) => {
    const presetConfigs = {
        small: {
            virtualization: { estimateSize: 40, overscan: 15, gap: 1 },
            pageSize: 100,
            enableInfiniteLoading: true,
            loadMoreThreshold: 20
        },
        medium: {
            virtualization: { estimateSize: 80, overscan: 10, gap: 8 },
            pageSize: 50,
            enableInfiniteLoading: true,
            loadMoreThreshold: 10
        },
        large: {
            virtualization: { estimateSize: 120, overscan: 5, gap: 12 },
            pageSize: 25,
            enableInfiniteLoading: true,
            loadMoreThreshold: 5
        },
        performance: {
            virtualization: { estimateSize: 60, overscan: 3, gap: 4 },
            pageSize: 200,
            enableInfiniteLoading: true,
            loadMoreThreshold: 50,
            maxPages: 20
        }
    } as const;

    return (
        <VirtualizedEntityListPage
            entityName={entityName}
            endpoint={endpoint}
            renderItem={renderItem}
            config={presetConfigs[preset]}
            {...props}
        />
    );
};
