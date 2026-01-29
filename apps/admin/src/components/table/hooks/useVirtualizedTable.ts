import { type VirtualItem, useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useMemo, useRef } from 'react';

/**
 * Configuration for virtualized table
 */
export type VirtualizedTableConfig = {
    /** Estimated row height in pixels */
    readonly estimateRowHeight: number;
    /** Number of rows to render outside visible area */
    readonly overscan?: number;
    /** Enable smooth scrolling */
    readonly smoothScroll?: boolean;
    /** Maximum container height (defaults to 600px) */
    readonly maxHeight?: number;
};

/**
 * Props for useVirtualizedTable hook
 */
export type UseVirtualizedTableProps<TData> = {
    /** Array of data rows */
    readonly rows: readonly TData[];
    /** Virtualization configuration */
    readonly config: VirtualizedTableConfig;
    /** Get unique row ID */
    readonly getRowId: (row: TData) => string;
};

/**
 * Hook for virtualizing TanStack Table rows
 *
 * Provides efficient rendering of large tables by only rendering
 * visible rows and a small buffer around them.
 *
 * @example
 * ```tsx
 * const {
 *   containerRef,
 *   virtualizer,
 *   virtualRows,
 *   totalSize,
 *   getRowStyles
 * } = useVirtualizedTable({
 *   rows: table.getRowModel().rows,
 *   config: { estimateRowHeight: 48, overscan: 10 },
 *   getRowId: (row) => row.id
 * });
 *
 * return (
 *   <div ref={containerRef} style={{ height: '600px', overflow: 'auto' }}>
 *     <table>
 *       <tbody style={{ height: totalSize, position: 'relative' }}>
 *         {virtualRows.map((virtualRow) => {
 *           const row = rows[virtualRow.index];
 *           return (
 *             <tr key={row.id} style={getRowStyles(virtualRow)}>
 *               {row.cells.map(cell => ...)}
 *             </tr>
 *           );
 *         })}
 *       </tbody>
 *     </table>
 *   </div>
 * );
 * ```
 */
export const useVirtualizedTable = <TData>({
    rows,
    config,
    getRowId
}: UseVirtualizedTableProps<TData>) => {
    const containerRef = useRef<HTMLDivElement>(null);

    // Create virtualizer instance
    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => containerRef.current,
        estimateSize: () => config.estimateRowHeight,
        overscan: config.overscan ?? 10,
        // Use row IDs for stable keys
        getItemKey: (index) => getRowId(rows[index] as TData)
    });

    // Get virtual rows
    const virtualRows = virtualizer.getVirtualItems();

    // Total size for the spacer
    const totalSize = virtualizer.getTotalSize();

    // Get styles for a virtual row
    const getRowStyles = useCallback(
        (virtualRow: VirtualItem): React.CSSProperties => ({
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${virtualRow.size}px`,
            transform: `translateY(${virtualRow.start}px)`
        }),
        []
    );

    // Container styles
    const containerStyles = useMemo(
        (): React.CSSProperties => ({
            height: config.maxHeight ?? 600,
            overflow: 'auto',
            position: 'relative'
        }),
        [config.maxHeight]
    );

    // Body wrapper styles (for positioning absolute rows)
    const bodyWrapperStyles = useMemo(
        (): React.CSSProperties => ({
            height: totalSize,
            width: '100%',
            position: 'relative'
        }),
        [totalSize]
    );

    // Scroll to row by index
    const scrollToRow = useCallback(
        (
            index: number,
            options?: { align?: 'start' | 'center' | 'end' | 'auto'; behavior?: 'auto' | 'smooth' }
        ) => {
            virtualizer.scrollToIndex(index, {
                align: options?.align ?? 'auto',
                behavior: options?.behavior ?? (config.smoothScroll ? 'smooth' : 'auto')
            });
        },
        [virtualizer, config.smoothScroll]
    );

    // Scroll to top
    const scrollToTop = useCallback(
        (behavior: 'auto' | 'smooth' = config.smoothScroll ? 'smooth' : 'auto') => {
            virtualizer.scrollToIndex(0, { align: 'start', behavior });
        },
        [virtualizer, config.smoothScroll]
    );

    // Scroll to bottom
    const scrollToBottom = useCallback(
        (behavior: 'auto' | 'smooth' = config.smoothScroll ? 'smooth' : 'auto') => {
            if (rows.length > 0) {
                virtualizer.scrollToIndex(rows.length - 1, { align: 'end', behavior });
            }
        },
        [virtualizer, rows.length, config.smoothScroll]
    );

    // Get visible range for debugging/analytics
    const getVisibleRange = useCallback(() => {
        if (virtualRows.length === 0) return { start: 0, end: 0 };

        return {
            start: virtualRows[0]?.index ?? 0,
            end: virtualRows[virtualRows.length - 1]?.index ?? 0
        };
    }, [virtualRows]);

    // Check if virtualization is needed (skip for small datasets)
    const shouldVirtualize = rows.length > 30;

    return {
        // Core
        virtualizer,
        containerRef,

        // Virtual rows
        virtualRows,
        totalSize,

        // Styles
        containerStyles,
        bodyWrapperStyles,
        getRowStyles,

        // Navigation
        scrollToRow,
        scrollToTop,
        scrollToBottom,

        // Utilities
        getVisibleRange,
        shouldVirtualize,

        // State
        isScrolling: virtualizer.isScrolling,
        rowCount: rows.length
    };
};

/**
 * Preset configurations for common table scenarios
 */
export const TABLE_VIRTUALIZATION_PRESETS = {
    /** Compact tables with small rows */
    compact: {
        estimateRowHeight: 36,
        overscan: 15,
        maxHeight: 500
    },
    /** Standard data tables */
    standard: {
        estimateRowHeight: 48,
        overscan: 10,
        maxHeight: 600
    },
    /** Tables with larger rows (images, multiline) */
    comfortable: {
        estimateRowHeight: 64,
        overscan: 8,
        maxHeight: 700
    },
    /** Tables with very large rows */
    spacious: {
        estimateRowHeight: 80,
        overscan: 5,
        maxHeight: 800
    }
} as const satisfies Record<string, VirtualizedTableConfig>;
