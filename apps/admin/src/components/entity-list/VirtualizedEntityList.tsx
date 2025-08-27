import { cn } from '@/lib/utils';
import type { VirtualItem } from '@tanstack/react-virtual';
import type { ReactNode } from 'react';
import React from 'react';
import { type VirtualizedListConfig, useVirtualizedList } from './hooks/useVirtualizedList';

/**
 * Props for VirtualizedEntityList component
 */
export type VirtualizedEntityListProps<TData> = {
    /** Array of items to display */
    readonly items: readonly TData[];
    /** Render function for each item */
    readonly renderItem: (item: TData, index: number) => ReactNode;
    /** Virtualization configuration */
    readonly config: VirtualizedListConfig;
    /** Optional container height */
    readonly height?: number;
    /** Optional container width */
    readonly width?: number;
    /** Additional CSS classes for container */
    readonly className?: string;
    /** Loading state */
    readonly isLoading?: boolean;
    /** Empty state component */
    readonly emptyState?: ReactNode;
    /** Loading state component */
    readonly loadingState?: ReactNode;
    /** Error state */
    readonly error?: Error | null;
    /** Error state component */
    readonly errorState?: ReactNode;
    /** Show scroll indicators */
    readonly showScrollIndicators?: boolean;
    /** Callback when scroll reaches near bottom */
    readonly onScrollNearBottom?: () => void;
    /** Distance from bottom to trigger onScrollNearBottom */
    readonly nearBottomThreshold?: number;
};

/**
 * Virtualized list component for large datasets
 *
 * Provides high-performance rendering of large lists by only rendering
 * visible items and a small buffer around them.
 *
 * @example
 * ```tsx
 * <VirtualizedEntityList
 *   items={entities}
 *   renderItem={(entity, index) => (
 *     <EntityCard key={entity.id} entity={entity} />
 *   )}
 *   config={{
 *     estimateSize: 80,
 *     overscan: 5
 *   }}
 *   height={400}
 *   onScrollNearBottom={() => loadMore()}
 * />
 * ```
 */
export const VirtualizedEntityList = <TData extends { id: string }>({
    items,
    renderItem,
    config,
    height = 400,
    width,
    className,
    isLoading = false,
    emptyState,
    loadingState,
    error,
    errorState,
    showScrollIndicators = false,
    onScrollNearBottom,
    nearBottomThreshold = 100
}: VirtualizedEntityListProps<TData>) => {
    const {
        virtualizer,
        containerRef,
        containerStyles,
        totalSizeStyles,
        getItemStyles,
        getVirtualItems,
        getVisibleRange,
        scrollToTop,
        scrollToBottom
    } = useVirtualizedList({
        items,
        config,
        containerHeight: height,
        containerWidth: width
    });

    // Handle scroll near bottom detection
    React.useEffect(() => {
        if (!onScrollNearBottom) return;

        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

            if (distanceFromBottom <= nearBottomThreshold) {
                onScrollNearBottom();
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [onScrollNearBottom, nearBottomThreshold, containerRef]);

    // Show error state
    if (error && errorState) {
        return (
            <div className={cn('flex items-center justify-center p-8', className)}>
                {errorState}
            </div>
        );
    }

    // Show loading state
    if (isLoading && loadingState) {
        return (
            <div className={cn('flex items-center justify-center p-8', className)}>
                {loadingState}
            </div>
        );
    }

    // Show empty state
    if (!isLoading && items.length === 0 && emptyState) {
        return (
            <div className={cn('flex items-center justify-center p-8', className)}>
                {emptyState}
            </div>
        );
    }

    const virtualItems = getVirtualItems();
    const visibleRange = getVisibleRange();

    return (
        <div className={cn('relative', className)}>
            {/* Scroll indicators */}
            {showScrollIndicators && items.length > 0 && (
                <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
                    <button
                        type="button"
                        onClick={() => scrollToTop()}
                        className="rounded bg-gray-800/80 p-1 text-white opacity-70 hover:opacity-100"
                        title="Scroll to top"
                    >
                        <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <title>Scroll to top</title>
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 15l7-7 7 7"
                            />
                        </svg>
                    </button>
                    <button
                        type="button"
                        onClick={() => scrollToBottom()}
                        className="rounded bg-gray-800/80 p-1 text-white opacity-70 hover:opacity-100"
                        title="Scroll to bottom"
                    >
                        <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <title>Scroll to bottom</title>
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                            />
                        </svg>
                    </button>
                </div>
            )}

            {/* Virtual list container */}
            <div
                ref={containerRef}
                style={containerStyles}
                className="scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 hover:scrollbar-thumb-gray-400"
            >
                <div style={totalSizeStyles}>
                    {virtualItems.map((virtualItem: VirtualItem) => {
                        const item = items[virtualItem.index];
                        if (!item) return null;

                        return (
                            <div
                                key={virtualItem.key}
                                data-index={virtualItem.index}
                                ref={virtualizer.measureElement}
                                style={getItemStyles(virtualItem)}
                            >
                                {renderItem(item, virtualItem.index)}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Debug info (only in development) */}
            {process.env.NODE_ENV === 'development' && (
                <div className="mt-2 text-gray-500 text-xs">
                    Total: {items.length} | Visible: {visibleRange.start}-{visibleRange.end} |
                    Rendered: {virtualItems.length}
                </div>
            )}
        </div>
    );
};

/**
 * Default empty state component
 */
export const DefaultEmptyState: React.FC<{ message?: string }> = ({
    message = 'No items found'
}) => (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <svg
            className="mb-4 h-12 w-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
        >
            <title>Empty state</title>
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
        </svg>
        <p className="font-medium text-sm">{message}</p>
    </div>
);

/**
 * Default loading state component
 */
export const DefaultLoadingState: React.FC<{ message?: string }> = ({ message = 'Loading...' }) => (
    <div className="flex flex-col items-center justify-center py-12">
        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
        <p className="text-gray-500 text-sm">{message}</p>
    </div>
);

/**
 * Default error state component
 */
export const DefaultErrorState: React.FC<{ error?: Error; onRetry?: () => void }> = ({
    error,
    onRetry
}) => (
    <div className="flex flex-col items-center justify-center py-12 text-red-500">
        <svg
            className="mb-4 h-12 w-12"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
        >
            <title>Error state</title>
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
        </svg>
        <p className="mb-2 font-medium text-sm">Something went wrong</p>
        {error && <p className="mb-4 text-gray-600 text-xs">{error.message}</p>}
        {onRetry && (
            <button
                type="button"
                onClick={onRetry}
                className="rounded bg-red-100 px-3 py-1 text-red-700 text-sm hover:bg-red-200"
            >
                Try again
            </button>
        )}
    </div>
);
