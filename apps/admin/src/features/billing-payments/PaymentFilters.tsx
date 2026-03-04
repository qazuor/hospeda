import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useTranslations } from '@/hooks/use-translations';
import { CalendarIcon, DollarSignIcon, FilterIcon } from '@repo/icons';
import type { PaymentMethod, PaymentStatus } from './types';

/**
 * Props for PaymentFilters
 */
export interface PaymentFiltersProps {
    readonly searchQuery: string;
    readonly onSearchChange: (value: string) => void;
    readonly statusFilter: PaymentStatus | 'all';
    readonly onStatusChange: (value: PaymentStatus | 'all') => void;
    readonly methodFilter: PaymentMethod | 'all';
    readonly onMethodChange: (value: PaymentMethod | 'all') => void;
    readonly startDate: string;
    readonly onStartDateChange: (value: string) => void;
    readonly endDate: string;
    readonly onEndDateChange: (value: string) => void;
    readonly minAmount: string;
    readonly onMinAmountChange: (value: string) => void;
    readonly maxAmount: string;
    readonly onMaxAmountChange: (value: string) => void;
    readonly showFilters: boolean;
    readonly onToggleFilters: () => void;
    readonly onClearAdvancedFilters: () => void;
}

/**
 * Payment filters component.
 * Renders search, status filter, method filter, and collapsible advanced filters
 * (date range and amount range).
 */
export function PaymentFilters({
    searchQuery,
    onSearchChange,
    statusFilter,
    onStatusChange,
    methodFilter,
    onMethodChange,
    startDate,
    onStartDateChange,
    endDate,
    onEndDateChange,
    minAmount,
    onMinAmountChange,
    maxAmount,
    onMaxAmountChange,
    showFilters,
    onToggleFilters,
    onClearAdvancedFilters
}: PaymentFiltersProps) {
    const { t } = useTranslations();

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>{t('admin-billing.payments.searchTitle')}</CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onToggleFilters}
                    >
                        <FilterIcon className="mr-2 size-4" />
                        {showFilters
                            ? t('admin-billing.payments.hideFilters')
                            : t('admin-billing.payments.moreFilters')}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                    <div>
                        <label
                            htmlFor="payment-search"
                            className="mb-2 block font-medium text-sm"
                        >
                            {t('admin-billing.payments.searchLabel')}
                        </label>
                        <Input
                            id="payment-search"
                            placeholder={t('admin-billing.payments.searchPlaceholder')}
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="payment-status-filter"
                            className="mb-2 block font-medium text-sm"
                        >
                            {t('admin-billing.payments.statusFilter')}
                        </label>
                        <select
                            id="payment-status-filter"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={statusFilter}
                            onChange={(e) =>
                                onStatusChange(e.target.value as PaymentStatus | 'all')
                            }
                        >
                            <option value="all">{t('admin-billing.payments.allFilter')}</option>
                            <option value="completed">
                                {t('admin-billing.payments.statuses.completed')}
                            </option>
                            <option value="pending">
                                {t('admin-billing.payments.statuses.pending')}
                            </option>
                            <option value="failed">
                                {t('admin-billing.payments.statuses.failed')}
                            </option>
                            <option value="refunded">
                                {t('admin-billing.payments.statuses.refunded')}
                            </option>
                        </select>
                    </div>
                    <div>
                        <label
                            htmlFor="payment-method-filter"
                            className="mb-2 block font-medium text-sm"
                        >
                            {t('admin-billing.payments.methodFilter')}
                        </label>
                        <select
                            id="payment-method-filter"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={methodFilter}
                            onChange={(e) =>
                                onMethodChange(e.target.value as PaymentMethod | 'all')
                            }
                        >
                            <option value="all">{t('admin-billing.payments.allFilter')}</option>
                            <option value="credit_card">
                                {t('admin-billing.payments.methods.creditCard')}
                            </option>
                            <option value="debit_card">
                                {t('admin-billing.payments.methods.debitCard')}
                            </option>
                            <option value="mercado_pago">
                                {t('admin-billing.payments.methods.mercadoPago')}
                            </option>
                            <option value="bank_transfer">
                                {t('admin-billing.payments.methods.bankTransfer')}
                            </option>
                        </select>
                    </div>
                </div>

                {/* Advanced Filters */}
                {showFilters && (
                    <div className="mt-4 grid gap-4 rounded-md border bg-muted/50 p-4 md:grid-cols-2">
                        <div className="col-span-2 font-medium text-sm">
                            {t('admin-billing.payments.advancedFilters')}
                        </div>

                        {/* Date Range */}
                        <div>
                            <label
                                htmlFor="payment-start-date"
                                className="mb-2 flex items-center gap-2 font-medium text-sm"
                            >
                                <CalendarIcon className="size-4" />
                                {t('admin-billing.payments.dateFrom')}
                            </label>
                            <Input
                                id="payment-start-date"
                                type="date"
                                value={startDate}
                                onChange={(e) => onStartDateChange(e.target.value)}
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="payment-end-date"
                                className="mb-2 flex items-center gap-2 font-medium text-sm"
                            >
                                <CalendarIcon className="size-4" />
                                {t('admin-billing.payments.dateTo')}
                            </label>
                            <Input
                                id="payment-end-date"
                                type="date"
                                value={endDate}
                                onChange={(e) => onEndDateChange(e.target.value)}
                            />
                        </div>

                        {/* Amount Range */}
                        <div>
                            <label
                                htmlFor="payment-min-amount"
                                className="mb-2 flex items-center gap-2 font-medium text-sm"
                            >
                                <DollarSignIcon className="size-4" />
                                {t('admin-billing.payments.minAmount')}
                            </label>
                            <Input
                                id="payment-min-amount"
                                type="number"
                                placeholder="0.00"
                                value={minAmount}
                                onChange={(e) => onMinAmountChange(e.target.value)}
                                min="0"
                                step="100"
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="payment-max-amount"
                                className="mb-2 flex items-center gap-2 font-medium text-sm"
                            >
                                <DollarSignIcon className="size-4" />
                                {t('admin-billing.payments.maxAmount')}
                            </label>
                            <Input
                                id="payment-max-amount"
                                type="number"
                                placeholder="0.00"
                                value={maxAmount}
                                onChange={(e) => onMaxAmountChange(e.target.value)}
                                min="0"
                                step="100"
                            />
                        </div>

                        {/* Reset Button */}
                        <div className="col-span-2 flex justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onClearAdvancedFilters}
                            >
                                {t('admin-billing.payments.clearAdvancedFilters')}
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
