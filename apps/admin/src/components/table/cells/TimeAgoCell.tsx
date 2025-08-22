import type { ReactNode } from 'react';

type TimeAgoCellProps = {
    readonly value: unknown;
};

/**
 * TimeAgoCell component for rendering relative time values in table cells.
 * Displays relative time (e.g., "2 days ago") on top and the actual formatted date below in smaller text.
 * Uses GitHub's relative-time-element for consistent time formatting.
 *
 * Based on: https://github.com/github/relative-time-element#readme
 */
export const TimeAgoCell = ({ value }: TimeAgoCellProps): ReactNode => {
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

        const isoString = date.toISOString();

        const formattedDate = date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        return (
            <div className="flex flex-col">
                <span
                    className="text-gray-900 dark:text-gray-100"
                    title={date.toLocaleString()}
                >
                    {formattedDate}
                </span>
                <time
                    dateTime={isoString}
                    className="text-gray-500 text-xss dark:text-gray-400"
                >
                    {formattedDate}
                </time>
            </div>
        );
    } catch {
        return <span className="text-gray-400 dark:text-gray-500">Invalid date</span>;
    }
};
