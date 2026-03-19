import { useTranslations } from '@/hooks/use-translations';
import { cn } from '@/lib/utils';
import { adminLogger } from '@/utils/logger';
import { LoaderIcon, RefreshIcon } from '@repo/icons';
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
    const { t } = useTranslations();
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

    // Default states - DefaultEmptyState and DefaultLoadingState use translations internally
    const defaultEmptyState = emptyState || <DefaultEmptyState />;
    const defaultLoadingState = loadingState || (
        <DefaultLoadingState message={t('ui.loading.items')} />
    );
    const defaultErrorState = errorState || (
        <DefaultErrorState
            error={error instanceof Error ? error : undefined}
            onRetry={() => refetch()}
        />
    );

    const defaultLoadingMoreIndicator = loadingMoreIndicator || (
        <div className="flex items-center justify-center py-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <LoaderIcon
                    className="h-4 w-4 animate-spin text-primary"
                    aria-label="Loading more"
                />
                {t('ui.loading.more')}
            </div>
        </div>
    );

    return (
        <div className={cn('flex flex-col', className)}>
            {/* Header */}
            {header && <div className="mb-4">{header}</div>}

            {/* Stats and controls */}
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-4 text-muted-foreground text-sm">
                    <span>
                        {isLoading ? 'Loading...' : `${items.length} of ${totalCount} items`}
                    </span>
                    {pagesLoaded > 1 && (
                        <span className="text-muted-foreground">({pagesLoaded} pages loaded)</span>
                    )}
                    {isStale && (
                        <span className="text-yellow-600 dark:text-yellow-400">(stale)</span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Refresh button */}
                    <button
                        type="button"
                        onClick={() => refetch()}
                        disabled={isLoading}
                        className="rounded bg-muted px-3 py-1 text-foreground text-sm hover:bg-accent disabled:opacity-50"
                        title={t('ui.actions.refresh')}
                    >
                        <RefreshIcon
                            className="h-4 w-4"
                            aria-label={t('ui.actions.refresh')}
                        />
                    </button>

                    {/* Debug info toggle */}
                    {import.meta.env.DEV && (
                        <button
                            type="button"
                            onClick={() => {
                                // This would need state management for the toggle
                                adminLogger.info(
                                    'Debug info:',
                                    `items: ${items.length}, totalCount: ${totalCount}, pagesLoaded: ${pagesLoaded}, hasNextPage: ${hasNextPage}, isFetchingNextPage: ${isFetchingNextPage}, isStale: ${isStale}`
                                );
                            }}
                            className="rounded bg-blue-100 px-2 py-1 text-blue-700 text-xs hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800"
                            title={t('ui.actions.debugInfo')}
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
                <div className="mt-4 text-center text-muted-foreground text-sm">
                    End of list ({totalCount} total items)
                </div>
            )}

            {/* Footer */}
            {footer && <div className="mt-4">{footer}</div>}

            {/* Debug panel */}
            {showDebugInfo && import.meta.env.DEV && (
                <div className="mt-4 rounded border bg-muted p-3 text-xs">
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
