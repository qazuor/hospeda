import type { ReactNode } from 'react';

type DateCellProps = {
    readonly value: unknown;
};

/**
 * DateCell component for rendering date values in table cells.
 * Formats dates using locale-specific formatting.
 */
export const DateCell = ({ value }: DateCellProps): ReactNode => {
    if (value === null || value === undefined) {
        return <span className="text-gray-400 dark:text-gray-500">—</span>;
    }

    let date: Date;

    try {
        if (value instanceof Date) {
            date = value;
        } else {
            date = new Date(String(value));
        }

        if (Number.isNaN(date.getTime())) {
            return <span className="text-gray-400 dark:text-gray-500">Invalid date</span>;
        }

        const formattedDate = date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        return (
            <time
                dateTime={date.toISOString()}
                className="text-gray-900 dark:text-gray-100"
                title={date.toLocaleString()}
            >
                {formattedDate}
            </time>
        );
    } catch {
        return <span className="text-gray-400 dark:text-gray-500">Invalid date</span>;
    }
};
