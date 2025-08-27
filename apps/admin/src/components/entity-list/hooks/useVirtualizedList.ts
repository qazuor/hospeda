import { type VirtualItem, useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef } from 'react';

/**
 * Configuration for virtualized list
 */
export type VirtualizedListConfig = {
    /** Estimated size of each item in pixels */
    readonly estimateSize: number;
    /** Number of items to render outside the visible area */
    readonly overscan?: number;
    /** Enable horizontal scrolling */
    readonly horizontal?: boolean;
    /** Custom scroll element (defaults to parent) */
    readonly scrollElement?: HTMLElement | null;
    /** Enable smooth scrolling */
    readonly smoothScroll?: boolean;
    /** Gap between items in pixels */
    readonly gap?: number;
};

/**
 * Props for useVirtualizedList hook
 */
export type UseVirtualizedListProps<TData> = {
    /** Array of items to virtualize */
    readonly items: readonly TData[];
    /** Virtualization configuration */
    readonly config: VirtualizedListConfig;
    /** Optional container height (if not using parent) */
    readonly containerHeight?: number;
    /** Optional container width (for horizontal) */
    readonly containerWidth?: number;
};

/**
 * Hook for virtualizing large lists with TanStack Virtual
 *
 * @example
 * ```tsx
 * const { virtualizer, containerRef, getVirtualItems } = useVirtualizedList({
 *   items: entities,
 *   config: {
 *     estimateSize: 80,
 *     overscan: 5
 *   }
 * });
 *
 * return (
 *   <div ref={containerRef} style={{ height: '400px', overflow: 'auto' }}>
 *     <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
 *       {getVirtualItems().map(virtualItem => (
 *         <div
 *           key={virtualItem.key}
 *           style={{
 *             position: 'absolute',
 *             top: 0,
 *             left: 0,
 *             width: '100%',
 *             height: virtualItem.size,
 *             transform: `translateY(${virtualItem.start}px)`
 *           }}
 *         >
 *           <EntityItem entity={items[virtualItem.index]} />
 *         </div>
 *       ))}
 *     </div>
 *   </div>
 * );
 * ```
 */
export const useVirtualizedList = <TData>({
    items,
    config,
    containerHeight,
    containerWidth
}: UseVirtualizedListProps<TData>) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Create virtualizer instance
    const virtualizer = useVirtualizer({
        count: items.length,
        getScrollElement: () => config.scrollElement || containerRef.current,
        estimateSize: () => config.estimateSize,
        overscan: config.overscan ?? 5,
        horizontal: config.horizontal ?? false,
        ...(config.gap && { gap: config.gap })
    });

    // Get virtual items with memoization for performance
    const getVirtualItems = useMemo(() => {
        return () => virtualizer.getVirtualItems();
    }, [virtualizer]);

    // Calculate container styles
    const containerStyles = useMemo(() => {
        const baseStyles: React.CSSProperties = {
            position: 'relative',
            overflow: 'auto'
        };

        if (config.horizontal) {
            return {
                ...baseStyles,
                width: containerWidth || '100%',
                height: containerHeight || 'auto'
            };
        }

        return {
            ...baseStyles,
            height: containerHeight || '400px',
            width: '100%'
        };
    }, [config.horizontal, containerHeight, containerWidth]);

    // Calculate total size styles
    const totalSizeStyles = useMemo(() => {
        const totalSize = virtualizer.getTotalSize();

        if (config.horizontal) {
            return {
                width: totalSize,
                height: '100%',
                position: 'relative' as const
            };
        }

        return {
            height: totalSize,
            width: '100%',
            position: 'relative' as const
        };
    }, [virtualizer, config.horizontal]);

    // Get item styles for positioning
    const getItemStyles = (virtualItem: VirtualItem) => {
        const baseStyles: React.CSSProperties = {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%'
        };

        if (config.horizontal) {
            return {
                ...baseStyles,
                height: '100%',
                width: virtualItem.size,
                transform: `translateX(${virtualItem.start}px)`
            };
        }

        return {
            ...baseStyles,
            height: virtualItem.size,
            transform: `translateY(${virtualItem.start}px)`
        };
    };

    // Scroll to specific item
    const scrollToItem = (
        index: number,
        options?: { align?: 'start' | 'center' | 'end' | 'auto'; behavior?: 'auto' | 'smooth' }
    ) => {
        virtualizer.scrollToIndex(index, {
            align: options?.align ?? 'auto',
            behavior: options?.behavior ?? (config.smoothScroll ? 'smooth' : 'auto')
        });
    };

    // Scroll to top/bottom
    const scrollToTop = (behavior: 'auto' | 'smooth' = config.smoothScroll ? 'smooth' : 'auto') => {
        virtualizer.scrollToIndex(0, { align: 'start', behavior });
    };

    const scrollToBottom = (
        behavior: 'auto' | 'smooth' = config.smoothScroll ? 'smooth' : 'auto'
    ) => {
        virtualizer.scrollToIndex(items.length - 1, { align: 'end', behavior });
    };

    // Get visible range for debugging/analytics
    const getVisibleRange = () => {
        const virtualItems = virtualizer.getVirtualItems();
        if (virtualItems.length === 0) return { start: 0, end: 0 };

        return {
            start: virtualItems[0]?.index ?? 0,
            end: virtualItems[virtualItems.length - 1]?.index ?? 0
        };
    };

    return {
        // Core virtualizer
        virtualizer,

        // Refs and elements
        containerRef,

        // Styles
        containerStyles,
        totalSizeStyles,
        getItemStyles,

        // Data and items
        getVirtualItems,
        items,

        // Navigation
        scrollToItem,
        scrollToTop,
        scrollToBottom,

        // Utilities
        getVisibleRange,

        // State
        isScrolling: virtualizer.isScrolling,
        totalSize: virtualizer.getTotalSize()
    };
};

/**
 * Default configurations for common use cases
 */
export const VIRTUALIZATION_PRESETS = {
    /** Small items like simple text rows */
    small: {
        estimateSize: 40,
        overscan: 10,
        gap: 1
    },
    /** Medium items like cards or detailed rows */
    medium: {
        estimateSize: 80,
        overscan: 5,
        gap: 8
    },
    /** Large items like complex cards */
    large: {
        estimateSize: 120,
        overscan: 3,
        gap: 12
    },
    /** Extra large items like detailed panels */
    xlarge: {
        estimateSize: 200,
        overscan: 2,
        gap: 16
    }
} as const satisfies Record<string, VirtualizedListConfig>;
