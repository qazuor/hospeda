import { Badge } from '@/components/ui/badge';
/**
 * Rate History View
 *
 * Component for viewing exchange rate history with filters and pagination.
 */
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { useTranslations } from '@/hooks/use-translations';
import { formatDateWithTime } from '@/lib/format-helpers';
import { formatNumber } from '@repo/i18n';
import { useState } from 'react';
import { useExchangeRateHistoryQuery } from '../hooks';
import type { ExchangeRate, ExchangeRateHistoryFilters } from '../types';

/**
 * Format rate value using locale-aware number formatting
 */
function formatRate(rate: number, locale: string): string {
    return formatNumber({
        value: rate,
        locale,
        options: { minimumFractionDigits: 4, maximumFractionDigits: 4 }
    });
}

/**
 * Get badge variant for rate type
 */
function getRateTypeBadge(rateType: string): React.ReactNode {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
        oficial: 'default',
        blue: 'secondary',
        mep: 'outline',
        ccl: 'outline',
        tarjeta: 'destructive',
        standard: 'secondary'
    };

    return <Badge variant={variants[rateType] || 'default'}>{rateType.toUpperCase()}</Badge>;
}

/**
 * Get badge variant for source
 */
function getSourceBadge(source: string): React.ReactNode {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
        dolarapi: 'default',
        'exchangerate-api': 'secondary',
        manual: 'outline'
    };

    return <Badge variant={variants[source] || 'default'}>{source}</Badge>;
}

export function RateHistoryView() {
    const { t, locale } = useTranslations();
    const [filters, setFilters] = useState<ExchangeRateHistoryFilters>({
        fromCurrency: undefined,
        toCurrency: undefined,
        rateType: undefined,
        source: undefined,
        from: undefined,
        to: undefined,
        page: 1,
        limit: 50
    });

    const { data: history, isLoading, error } = useExchangeRateHistoryQuery(filters);

    const handleFilterChange = (key: keyof ExchangeRateHistoryFilters, value: string) => {
        setFilters((prev) => ({
            ...prev,
            [key]: value === 'all' || value === '' ? undefined : value
        }));
    };

    const handleReset = () => {
        setFilters({
            fromCurrency: undefined,
            toCurrency: undefined,
            rateType: undefined,
            source: undefined,
            from: undefined,
            to: undefined,
            page: 1,
            limit: 50
        });
    };

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="rounded-lg border p-6">
                <h3 className="mb-4 font-semibold text-lg">
                    {t('admin-billing.exchangeRates.historyView.filtersTitle')}
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                    <div>
                        <Label htmlFor="fromCurrency">
                            {t('admin-billing.exchangeRates.historyView.fields.fromCurrency')}
                        </Label>
                        <Select
                            value={filters.fromCurrency || 'all'}
                            onValueChange={(value) => handleFilterChange('fromCurrency', value)}
                        >
                            <SelectTrigger id="fromCurrency">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    {t('admin-billing.exchangeRates.historyView.selectAll')}
                                </SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="ARS">ARS</SelectItem>
                                <SelectItem value="BRL">BRL</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="toCurrency">
                            {t('admin-billing.exchangeRates.historyView.fields.toCurrency')}
                        </Label>
                        <Select
                            value={filters.toCurrency || 'all'}
                            onValueChange={(value) => handleFilterChange('toCurrency', value)}
                        >
                            <SelectTrigger id="toCurrency">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    {t('admin-billing.exchangeRates.historyView.selectAll')}
                                </SelectItem>
                                <SelectItem value="ARS">ARS</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="BRL">BRL</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="rateType">
                            {t('admin-billing.exchangeRates.historyView.fields.rateType')}
                        </Label>
                        <Select
                            value={filters.rateType || 'all'}
                            onValueChange={(value) => handleFilterChange('rateType', value)}
                        >
                            <SelectTrigger id="rateType">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    {t('admin-billing.exchangeRates.historyView.selectAllTypes')}
                                </SelectItem>
                                <SelectItem value="oficial">
                                    {t('admin-billing.exchangeRates.rateTypes.oficial')}
                                </SelectItem>
                                <SelectItem value="blue">
                                    {t('admin-billing.exchangeRates.rateTypes.blue')}
                                </SelectItem>
                                <SelectItem value="mep">
                                    {t('admin-billing.exchangeRates.rateTypes.mep')}
                                </SelectItem>
                                <SelectItem value="ccl">
                                    {t('admin-billing.exchangeRates.rateTypes.ccl')}
                                </SelectItem>
                                <SelectItem value="tarjeta">
                                    {t('admin-billing.exchangeRates.rateTypes.tarjeta')}
                                </SelectItem>
                                <SelectItem value="standard">
                                    {t('admin-billing.exchangeRates.rateTypes.standard')}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="source">
                            {t('admin-billing.exchangeRates.historyView.fields.source')}
                        </Label>
                        <Select
                            value={filters.source || 'all'}
                            onValueChange={(value) => handleFilterChange('source', value)}
                        >
                            <SelectTrigger id="source">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    {t('admin-billing.exchangeRates.historyView.selectAll')}
                                </SelectItem>
                                <SelectItem value="dolarapi">
                                    {t('admin-billing.exchangeRates.sources.dolarapi')}
                                </SelectItem>
                                <SelectItem value="exchangerate-api">
                                    {t('admin-billing.exchangeRates.sources.exchangerateApi')}
                                </SelectItem>
                                <SelectItem value="manual">
                                    {t('admin-billing.exchangeRates.sources.manual')}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="from">
                            {t('admin-billing.exchangeRates.historyView.fields.from')}
                        </Label>
                        <Input
                            id="from"
                            type="date"
                            value={filters.from || ''}
                            onChange={(e) => handleFilterChange('from', e.target.value)}
                        />
                    </div>

                    <div>
                        <Label htmlFor="to">
                            {t('admin-billing.exchangeRates.historyView.fields.to')}
                        </Label>
                        <Input
                            id="to"
                            type="date"
                            value={filters.to || ''}
                            onChange={(e) => handleFilterChange('to', e.target.value)}
                        />
                    </div>
                </div>

                <div className="mt-4 flex justify-end">
                    <Button
                        variant="outline"
                        onClick={handleReset}
                    >
                        {t('admin-billing.exchangeRates.historyView.clearFilters')}
                    </Button>
                </div>
            </div>

            {/* History Table */}
            <div className="rounded-lg border">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b bg-muted/50">
                            <tr>
                                <th className="px-4 py-3 text-left font-medium text-sm">
                                    {t('admin-billing.exchangeRates.historyView.tableHeaders.date')}
                                </th>
                                <th className="px-4 py-3 text-left font-medium text-sm">
                                    {t('admin-billing.exchangeRates.historyView.tableHeaders.pair')}
                                </th>
                                <th className="px-4 py-3 text-left font-medium text-sm">
                                    {t('admin-billing.exchangeRates.historyView.tableHeaders.rate')}
                                </th>
                                <th className="px-4 py-3 text-left font-medium text-sm">
                                    {t('admin-billing.exchangeRates.historyView.tableHeaders.type')}
                                </th>
                                <th className="px-4 py-3 text-left font-medium text-sm">
                                    {t(
                                        'admin-billing.exchangeRates.historyView.tableHeaders.source'
                                    )}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-4 py-8 text-center text-muted-foreground"
                                    >
                                        {t('admin-billing.exchangeRates.historyView.loading')}
                                    </td>
                                </tr>
                            )}

                            {error && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-4 py-8 text-center text-destructive"
                                    >
                                        {t('admin-billing.exchangeRates.historyView.error')}{' '}
                                        {error instanceof Error
                                            ? error.message
                                            : t(
                                                  'admin-billing.exchangeRates.historyView.unknownError'
                                              )}
                                    </td>
                                </tr>
                            )}

                            {!isLoading && !error && (!history || history.length === 0) && (
                                <tr>
                                    <td
                                        colSpan={5}
                                        className="px-4 py-8 text-center text-muted-foreground"
                                    >
                                        {t('admin-billing.exchangeRates.historyView.noRecords')}
                                    </td>
                                </tr>
                            )}

                            {!isLoading &&
                                !error &&
                                history &&
                                history.length > 0 &&
                                (history as unknown as ExchangeRate[]).map((rate, index) => (
                                    <tr
                                        key={`${rate.id}-${index}`}
                                        className="border-b hover:bg-muted/30"
                                    >
                                        <td className="px-4 py-3 text-sm">
                                            {formatDateWithTime({
                                                date: new Date(rate.fetchedAt),
                                                locale
                                            })}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-sm">
                                            {rate.fromCurrency}/{rate.toCurrency}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-sm">
                                            {formatRate(rate.rate, locale)}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {getRateTypeBadge(rate.rateType)}
                                        </td>
                                        <td className="px-4 py-3 text-sm">
                                            {getSourceBadge(rate.source)}
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Info */}
                {!isLoading && !error && history && history.length > 0 && (
                    <div className="border-t px-4 py-3 text-muted-foreground text-sm">
                        {t('admin-billing.exchangeRates.historyView.showingCount').replace(
                            '{n}',
                            String(history.length)
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
