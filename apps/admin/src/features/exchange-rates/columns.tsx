import { BadgeColor, ColumnType, type DataTableColumn } from '@/components/table/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { defaultIntlLocale, formatDate, formatNumber } from '@repo/i18n';
import { DeleteIcon } from '@repo/icons';
import type { ExchangeRate } from './types';

/**
 * Format rate value with appropriate decimal places using locale-aware formatting
 */
function formatRate(rate: number, locale: string, decimals = 4): string {
    return formatNumber({
        value: rate,
        locale,
        options: { minimumFractionDigits: decimals, maximumFractionDigits: decimals }
    });
}

/**
 * Format time relative to now using provided translation strings
 */
function formatRelativeTime(
    date: Date,
    translations: {
        justNow: string;
        minutes: string;
        hours: string;
        oneDay: string;
        days: string;
        locale?: string;
    }
): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return translations.justNow;
    if (diffMin < 60) return translations.minutes.replace('{n}', String(diffMin));
    if (diffHr < 24) return translations.hours.replace('{n}', String(diffHr));
    if (diffDay === 1) return translations.oneDay;
    if (diffDay < 30) return translations.days.replace('{n}', String(diffDay));

    return formatDate({
        date,
        locale: translations.locale ?? defaultIntlLocale,
        options: { day: '2-digit', month: '2-digit', year: 'numeric' }
    });
}

/**
 * Check if a date is stale (older than 1 hour)
 */
function isStaleDate(date: Date): boolean {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHr = diffMs / (1000 * 60 * 60);
    return diffHr > 1;
}

/**
 * Get badge color for rate type
 */
function getRateTypeBadgeColor(rateType: string): BadgeColor {
    const colors: Record<string, BadgeColor> = {
        oficial: BadgeColor.BLUE,
        blue: BadgeColor.GREEN,
        mep: BadgeColor.PURPLE,
        ccl: BadgeColor.YELLOW,
        tarjeta: BadgeColor.RED,
        standard: BadgeColor.DEFAULT
    };
    return colors[rateType] || BadgeColor.DEFAULT;
}

/**
 * Get badge color for source
 */
function getSourceBadgeColor(source: string): BadgeColor {
    const colors: Record<string, BadgeColor> = {
        dolarapi: BadgeColor.BLUE,
        'exchangerate-api': BadgeColor.GREEN,
        manual: BadgeColor.YELLOW
    };
    return colors[source] || BadgeColor.DEFAULT;
}

interface ExchangeRateColumnsOptions {
    onDelete?: (id: string) => void;
    isDeleting?: boolean;
    /** Translation function from useTranslations hook */
    t: (key: string) => string;
    /** BCP 47 locale string (e.g. 'es-AR', 'en-US') */
    locale?: string;
}

/**
 * Get DataTable columns for exchange rates list
 */
export function getExchangeRateColumns(
    options: ExchangeRateColumnsOptions
): ReadonlyArray<DataTableColumn<ExchangeRate>> {
    const { onDelete, isDeleting, t, locale = defaultIntlLocale } = options;

    const relativeTimeTranslations = {
        justNow: t('admin-billing.exchangeRates.relativeTime.justNow'),
        minutes: t('admin-billing.exchangeRates.relativeTime.minutes'),
        hours: t('admin-billing.exchangeRates.relativeTime.hours'),
        oneDay: t('admin-billing.exchangeRates.relativeTime.oneDay'),
        days: t('admin-billing.exchangeRates.relativeTime.days'),
        locale
    };

    const rateTypeLabels: Record<string, string> = {
        oficial: t('admin-billing.exchangeRates.rateTypes.oficial'),
        blue: t('admin-billing.exchangeRates.rateTypes.blue'),
        mep: t('admin-billing.exchangeRates.rateTypes.mep'),
        ccl: t('admin-billing.exchangeRates.rateTypes.ccl'),
        tarjeta: t('admin-billing.exchangeRates.rateTypes.tarjeta'),
        standard: t('admin-billing.exchangeRates.rateTypes.standard')
    };

    const sourceLabels: Record<string, string> = {
        dolarapi: t('admin-billing.exchangeRates.sources.dolarapi'),
        'exchangerate-api': t('admin-billing.exchangeRates.sources.exchangerateApi'),
        manual: t('admin-billing.exchangeRates.sources.manual')
    };

    return [
        {
            id: 'currencyPair',
            header: t('admin-billing.exchangeRates.columns.currencyPair'),
            enableSorting: true,
            columnType: ColumnType.STRING,
            cell: ({ row }) => (
                <div className="font-medium">
                    {row.fromCurrency}/{row.toCurrency}
                </div>
            )
        },
        {
            id: 'rate',
            header: t('admin-billing.exchangeRates.columns.rate'),
            enableSorting: true,
            columnType: ColumnType.NUMBER,
            cell: ({ row }) => (
                <div className="font-mono text-sm">{formatRate(row.rate, locale, 4)}</div>
            )
        },
        {
            id: 'inverseRate',
            header: t('admin-billing.exchangeRates.columns.inverseRate'),
            enableSorting: true,
            columnType: ColumnType.NUMBER,
            cell: ({ row }) => (
                <div className="font-mono text-muted-foreground text-xs">
                    {formatRate(row.inverseRate, locale, 6)}
                </div>
            )
        },
        {
            id: 'rateType',
            header: t('admin-billing.exchangeRates.columns.rateType'),
            accessorKey: 'rateType',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: 'oficial',
                    label: t('admin-billing.exchangeRates.rateTypes.oficial'),
                    color: BadgeColor.BLUE
                },
                {
                    value: 'blue',
                    label: t('admin-billing.exchangeRates.rateTypes.blue'),
                    color: BadgeColor.GREEN
                },
                {
                    value: 'mep',
                    label: t('admin-billing.exchangeRates.rateTypes.mep'),
                    color: BadgeColor.PURPLE
                },
                {
                    value: 'ccl',
                    label: t('admin-billing.exchangeRates.rateTypes.ccl'),
                    color: BadgeColor.YELLOW
                },
                {
                    value: 'tarjeta',
                    label: t('admin-billing.exchangeRates.rateTypes.tarjeta'),
                    color: BadgeColor.RED
                },
                {
                    value: 'standard',
                    label: t('admin-billing.exchangeRates.rateTypes.standard'),
                    color: BadgeColor.DEFAULT
                }
            ],
            cell: ({ row }) => (
                <Badge
                    variant="outline"
                    className={`badge-${getRateTypeBadgeColor(row.rateType)}`}
                >
                    {rateTypeLabels[row.rateType] || row.rateType}
                </Badge>
            )
        },
        {
            id: 'source',
            header: t('admin-billing.exchangeRates.columns.source'),
            accessorKey: 'source',
            enableSorting: true,
            columnType: ColumnType.BADGE,
            badgeOptions: [
                {
                    value: 'dolarapi',
                    label: t('admin-billing.exchangeRates.sources.dolarapi'),
                    color: BadgeColor.BLUE
                },
                {
                    value: 'exchangerate-api',
                    label: t('admin-billing.exchangeRates.sources.exchangerateApi'),
                    color: BadgeColor.GREEN
                },
                {
                    value: 'manual',
                    label: t('admin-billing.exchangeRates.sources.manual'),
                    color: BadgeColor.YELLOW
                }
            ],
            cell: ({ row }) => (
                <Badge
                    variant="outline"
                    className={`badge-${getSourceBadgeColor(row.source)}`}
                >
                    {sourceLabels[row.source] || row.source}
                </Badge>
            )
        },
        {
            id: 'fetchedAt',
            header: t('admin-billing.exchangeRates.columns.lastUpdated'),
            accessorKey: 'fetchedAt',
            enableSorting: true,
            columnType: ColumnType.DATE,
            cell: ({ row }) => {
                const fetchedAt = new Date(row.fetchedAt);
                const isStale = isStaleDate(fetchedAt);

                return (
                    <div className="text-sm">
                        <div>{formatRelativeTime(fetchedAt, relativeTimeTranslations)}</div>
                        {isStale && (
                            <div className="text-muted-foreground text-xs">
                                {t('admin-billing.exchangeRates.columns.stale')}
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            id: 'actions',
            header: t('admin-billing.exchangeRates.columns.actions'),
            enableSorting: false,
            enableHiding: false,
            cell: ({ row }) => {
                if (!row.isManualOverride) return null;

                return (
                    <div className="flex gap-2">
                        {onDelete && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => onDelete(row.id)}
                                disabled={isDeleting}
                                title={t('admin-billing.exchangeRates.deleteButton')}
                            >
                                <DeleteIcon className="mr-1 h-3 w-3" />
                                {t('admin-billing.exchangeRates.deleteButton')}
                            </Button>
                        )}
                    </div>
                );
            }
        }
    ];
}
