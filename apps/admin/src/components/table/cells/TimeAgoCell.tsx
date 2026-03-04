import { useTranslations } from '@/hooks/use-translations';
import { defaultIntlLocale, formatDate } from '@repo/i18n';
import type { ReactNode } from 'react';

type TimeAgoCellProps = {
    readonly value: unknown;
    readonly locale?: string;
};

/**
 * TimeAgoCell component for rendering relative time values in table cells.
 * Displays relative time (e.g., "2 days ago") on top and the actual formatted date below in smaller text.
 * Uses GitHub's relative-time-element for consistent time formatting.
 *
 * Based on: https://github.com/github/relative-time-element#readme
 */
export const TimeAgoCell = ({ value, locale = defaultIntlLocale }: TimeAgoCellProps): ReactNode => {
    const { t } = useTranslations();

    if (value === null || value === undefined) {
        return <span className="text-muted-foreground">—</span>;
    }

    let date: Date;

    try {
        if (value instanceof Date) {
            date = value;
        } else {
            date = new Date(String(value));
        }

        if (Number.isNaN(date.getTime())) {
            return (
                <span className="text-muted-foreground">
                    {t('admin-common.tableCells.invalidDate')}
                </span>
            );
        }

        const isoString = date.toISOString();

        const formattedDate = formatDate({
            date,
            locale,
            options: { year: 'numeric', month: 'short', day: 'numeric' }
        });

        const formattedFull = formatDate({
            date,
            locale,
            options: {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }
        });

        return (
            <div className="flex flex-col">
                <span
                    className="text-foreground"
                    title={formattedFull}
                >
                    {formattedDate}
                </span>
                <time
                    dateTime={isoString}
                    className="text-muted-foreground text-xss"
                >
                    {formattedDate}
                </time>
            </div>
        );
    } catch {
        return (
            <span className="text-muted-foreground">
                {t('admin-common.tableCells.invalidDate')}
            </span>
        );
    }
};
