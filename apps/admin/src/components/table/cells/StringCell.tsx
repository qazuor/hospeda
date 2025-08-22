import type { ReactNode } from 'react';

type StringCellProps = {
    readonly value: unknown;
};

/**
 * StringCell component for rendering string values in table cells.
 * Handles null/undefined values gracefully by displaying empty content.
 */
export const StringCell = ({ value }: StringCellProps): ReactNode => {
    if (value === null || value === undefined) {
        return null;
    }

    return <span className="text-gray-900 dark:text-gray-100">{String(value)}</span>;
};
