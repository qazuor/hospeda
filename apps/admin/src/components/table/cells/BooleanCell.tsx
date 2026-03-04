import { CheckIcon, CloseIcon } from '@repo/icons';
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
        return <span className="text-muted-foreground">—</span>;
    }

    const boolValue = Boolean(value);

    return (
        <div className="flex items-center justify-center">
            {boolValue ? (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                    <CheckIcon
                        size={12}
                        weight="bold"
                        className="text-green-600 dark:text-green-400"
                        aria-label="True"
                    />
                </div>
            ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                    <CloseIcon
                        size={12}
                        weight="bold"
                        className="text-red-600 dark:text-red-400"
                        aria-label="False"
                    />
                </div>
            )}
        </div>
    );
};
