import { defaultIntlLocale, formatNumber } from '@repo/i18n';
import type { ReactNode } from 'react';

type NumberCellProps = {
    readonly value: unknown;
    readonly locale?: string;
};

/**
 * NumberCell component for rendering numeric values in table cells.
 * Formats numbers with proper locale formatting via @repo/i18n formatNumber.
 */
export const NumberCell = ({ value, locale = defaultIntlLocale }: NumberCellProps): ReactNode => {
    if (value === null || value === undefined) {
        return <span className="text-muted-foreground">—</span>;
    }

    const numValue = Number(value);
    if (Number.isNaN(numValue)) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <span className="font-mono text-foreground tabular-nums">
            {formatNumber({ value: numValue, locale })}
        </span>
    );
};
