import type { ReactNode } from 'react';

type NumberCellProps = {
    readonly value: unknown;
};

/**
 * NumberCell component for rendering numeric values in table cells.
 * Formats numbers with proper locale formatting and handles null/undefined values.
 */
export const NumberCell = ({ value }: NumberCellProps): ReactNode => {
    if (value === null || value === undefined) {
        return <span className="text-gray-400 dark:text-gray-500">—</span>;
    }

    const numValue = Number(value);
    if (Number.isNaN(numValue)) {
        return <span className="text-gray-400 dark:text-gray-500">—</span>;
    }

    return (
        <span className="font-mono text-gray-900 tabular-nums dark:text-gray-100">
            {numValue.toLocaleString()}
        </span>
    );
};
