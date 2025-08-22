import { ListOrientation } from '@/components/table/DataTable';
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
    if (value === null || value === undefined) {
        return <span className="text-gray-400 dark:text-gray-500">—</span>;
    }

    // Handle non-array values
    if (!Array.isArray(value)) {
        return <span className="text-gray-900 dark:text-gray-100">{String(value)}</span>;
    }

    // Handle empty arrays
    if (value.length === 0) {
        return <span className="text-gray-300 dark:text-gray-500">Empty</span>;
    }

    // Convert all items to strings and filter out empty ones
    const items = value.map((item) => String(item)).filter((item) => item.trim() !== '');

    if (items.length === 0) {
        return <span className="text-gray-400 dark:text-gray-500">Empty</span>;
    }

    // Determine if we need truncation
    const needsTruncation = items.length > maxItems;
    const visibleItems = needsTruncation ? items.slice(0, maxItems) : items;
    const remainingCount = needsTruncation ? items.length - maxItems : 0;

    // Handle row (horizontal) orientation
    if (orientation === ListOrientation.ROW) {
        if (!needsTruncation) {
            return (
                <span className="text-gray-900 dark:text-gray-100">{items.join(separator)}</span>
            );
        }

        return (
            <div className="flex flex-col gap-1">
                <span className="text-gray-900 dark:text-gray-100">
                    {visibleItems.join(separator)}
                </span>
                <span className="text-gray-500 text-xs dark:text-gray-400">
                    and {remainingCount} more
                </span>
            </div>
        );
    }

    // Handle column (vertical) orientation
    if (orientation === ListOrientation.COLUMN) {
        return (
            <div className="flex flex-col gap-1">
                {visibleItems.map((item) => (
                    <span
                        key={item}
                        className="text-gray-900 dark:text-gray-100"
                    >
                        {item}
                    </span>
                ))}
                {needsTruncation && (
                    <span className="text-gray-500 text-xs dark:text-gray-400">
                        and {remainingCount} more
                    </span>
                )}
            </div>
        );
    }

    // Fallback to row orientation
    return <span className="text-gray-900 dark:text-gray-100">{items.join(separator)}</span>;
};
