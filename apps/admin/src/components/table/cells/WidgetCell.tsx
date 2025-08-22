import type { ReactNode } from 'react';

type WidgetCellProps<TData> = {
    readonly row: TData;
    readonly widgetRenderer?: (row: TData) => ReactNode;
};

/**
 * WidgetCell component for rendering custom widgets in table cells.
 * Uses a provided renderer function to generate custom content based on the row data.
 * Provides fallback handling when no renderer is provided.
 */
export const WidgetCell = <TData,>({ row, widgetRenderer }: WidgetCellProps<TData>): ReactNode => {
    // If no widget renderer is provided, show a placeholder
    if (!widgetRenderer) {
        return <span className="text-gray-400 italic dark:text-gray-500">No widget renderer</span>;
    }

    try {
        // Execute the widget renderer with error boundary
        const renderedWidget = widgetRenderer(row);

        // Handle null/undefined results
        if (renderedWidget === null || renderedWidget === undefined) {
            return <span className="text-gray-400 dark:text-gray-500">—</span>;
        }

        return <div className="widget-cell-container">{renderedWidget}</div>;
    } catch (error) {
        // Handle rendering errors gracefully
        console.error('Widget renderer error:', error);
        return <span className="text-red-500 text-sm dark:text-red-400">Widget error</span>;
    }
};
