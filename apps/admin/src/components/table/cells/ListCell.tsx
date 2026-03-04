import { ListOrientation } from '@/components/table/DataTable';
import { useTranslations } from '@/hooks/use-translations';
import type { ReactNode } from 'react';

type ListCellProps = {
    readonly value: unknown;
    readonly separator?: string;
    readonly maxItems?: number;
    readonly orientation?: ListOrientation;
};

/**
 * ListCell component for rendering arrays of strings in table cells.
 * Displays items as comma-separated values with optional custom separator.
 * Supports truncation for long lists with a "show more" indicator.
 * Can display items in row (horizontal) or column (vertical) orientation.
 */
export const ListCell = ({
    value,
    separator = ', ',
    maxItems = 3,
    orientation = ListOrientation.ROW
}: ListCellProps): ReactNode => {
    const { t } = useTranslations();

    if (value === null || value === undefined) {
        return <span className="text-muted-foreground">—</span>;
    }

    // Handle non-array values
    if (!Array.isArray(value)) {
        return <span className="text-foreground">{String(value)}</span>;
    }

    // Handle empty arrays
    if (value.length === 0) {
        return (
            <span className="text-muted-foreground/50">{t('admin-common.tableCells.empty')}</span>
        );
    }

    // Convert all items to strings and filter out empty ones
    const items = value.map((item) => String(item)).filter((item) => item.trim() !== '');

    if (items.length === 0) {
        return <span className="text-muted-foreground">{t('admin-common.tableCells.empty')}</span>;
    }

    // Determine if we need truncation
    const needsTruncation = items.length > maxItems;
    const visibleItems = needsTruncation ? items.slice(0, maxItems) : items;
    const remainingCount = needsTruncation ? items.length - maxItems : 0;

    // Handle row (horizontal) orientation
    if (orientation === ListOrientation.ROW) {
        if (!needsTruncation) {
            return <span className="text-foreground">{items.join(separator)}</span>;
        }

        return (
            <div className="flex flex-col gap-1">
                <span className="text-foreground">{visibleItems.join(separator)}</span>
                <span className="text-muted-foreground text-xs">
                    {t('admin-common.tableCells.andMore', { count: String(remainingCount) })}
                </span>
            </div>
        );
    }

    // Handle column (vertical) orientation
    if (orientation === ListOrientation.COLUMN) {
        return (
            <div className="flex flex-col gap-1">
                {visibleItems.map((item, index) => {
                    const uniqueKey = `list-${item}-${index}`;
                    return (
                        <span
                            key={uniqueKey}
                            className="text-foreground"
                        >
                            {item}
                        </span>
                    );
                })}
                {needsTruncation && (
                    <span className="text-muted-foreground text-xs">
                        {t('admin-common.tableCells.andMore', { count: String(remainingCount) })}
                    </span>
                )}
            </div>
        );
    }

    // Fallback to row orientation
    return <span className="text-foreground">{items.join(separator)}</span>;
};
