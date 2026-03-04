import { useTranslations } from '@/hooks/use-translations';
import { defaultIntlLocale, formatDate } from '@repo/i18n';
import type { ReactNode } from 'react';

type DateCellProps = {
    readonly value: unknown;
    readonly locale?: string;
};

/**
 * DateCell component for rendering date values in table cells.
 * Formats dates using locale-specific formatting via @repo/i18n formatDate.
 */
export const DateCell = ({ value, locale = defaultIntlLocale }: DateCellProps): ReactNode => {
    const { t } = useTranslations();

    if (value === null || value === undefined || value === '' || value === 0 || value === '0') {
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
            <time
                dateTime={date.toISOString()}
                className="text-foreground"
                title={formattedFull}
            >
                {formattedDate}
            </time>
        );
    } catch {
        return (
            <span className="text-muted-foreground">
                {t('admin-common.tableCells.invalidDate')}
            </span>
        );
    }
};
