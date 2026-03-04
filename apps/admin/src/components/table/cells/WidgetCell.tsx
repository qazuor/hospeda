import { useTranslations } from '@/hooks/use-translations';
import { adminLogger } from '@/utils/logger';
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
    const { t } = useTranslations();

    // If no widget renderer is provided, show a placeholder
    if (!widgetRenderer) {
        return (
            <span className="text-muted-foreground italic">
                {t('admin-common.states.noWidgetRenderer')}
            </span>
        );
    }

    try {
        // Execute the widget renderer with error boundary
        const renderedWidget = widgetRenderer(row);

        // Handle null/undefined results
        if (renderedWidget === null || renderedWidget === undefined) {
            return <span className="text-muted-foreground">—</span>;
        }

        return <div className="widget-cell-container">{renderedWidget}</div>;
    } catch (error) {
        // Handle rendering errors gracefully
        adminLogger.error('Widget renderer error', error);
        return (
            <span className="text-red-500 text-sm dark:text-red-400">
                {t('admin-common.tableCells.widgetError')}
            </span>
        );
    }
};
