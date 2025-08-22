import type { ReactNode } from 'react';

type BooleanCellProps = {
    readonly value: unknown;
};

/**
 * BooleanCell component for rendering boolean values in table cells.
 * Displays checkmarks for true values and X marks for false values.
 */
export const BooleanCell = ({ value }: BooleanCellProps): ReactNode => {
    if (value === null || value === undefined) {
        return <span className="text-gray-400 dark:text-gray-500">—</span>;
    }

    const boolValue = Boolean(value);

    return (
        <div className="flex items-center justify-center">
            {boolValue ? (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                    <svg
                        className="h-3 w-3 text-green-600 dark:text-green-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-label="True"
                    >
                        <title>True</title>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                </div>
            ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                    <svg
                        className="h-3 w-3 text-red-600 dark:text-red-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-label="False"
                    >
                        <title>False</title>
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </div>
            )}
        </div>
    );
};
