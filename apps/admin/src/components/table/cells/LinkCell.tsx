import type { ReactNode } from 'react';

type LinkCellProps<TData> = {
    readonly value: unknown;
    readonly row: TData;
    readonly linkHandler?: (row: TData) => void;
};

/**
 * LinkCell component for rendering clickable link values in table cells.
 * Executes the provided linkHandler when clicked.
 */
export const LinkCell = <TData,>({ value, row, linkHandler }: LinkCellProps<TData>): ReactNode => {
    if (value === null || value === undefined) {
        return <span className="text-gray-400 dark:text-gray-500">—</span>;
    }

    const stringValue = String(value);

    if (!linkHandler) {
        return <span className="text-gray-900 dark:text-gray-100">{stringValue}</span>;
    }

    const handleClick = (event: React.MouseEvent) => {
        event.preventDefault();
        linkHandler(row);
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            linkHandler(row);
        }
    };

    return (
        <button
            type="button"
            className="cursor-pointer text-blue-600 underline transition-colors hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:text-blue-400 dark:hover:text-blue-300"
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            aria-label={`Navigate to ${stringValue}`}
        >
            {stringValue}
        </button>
    );
};
