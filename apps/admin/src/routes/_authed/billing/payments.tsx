import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useToast } from '@/components/ui/ToastProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePaymentsQuery, useRefundPaymentMutation } from '@/features/billing-payments/hooks';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { CalendarIcon, DollarSignIcon, FilterIcon, LoaderIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/billing/payments')({
    component: BillingPaymentsPage
});

type PaymentStatus = 'completed' | 'pending' | 'failed' | 'refunded';
type PaymentMethod = 'credit_card' | 'debit_card' | 'mercado_pago' | 'bank_transfer';

interface Payment {
    id: string;
    userName: string;
    userEmail: string;
    amount: number;
    status: PaymentStatus;
    date: string;
    method: PaymentMethod;
    planName: string;
    subscriptionId: string;
    invoiceId: string;
    transactionId: string;
}

/**
 * Get status badge variant
 */
function getStatusVariant(status: PaymentStatus) {
    const variants = {
        completed: 'success',
        pending: 'default',
        failed: 'destructive',
        refunded: 'outline'
    } as const;
    return variants[status];
}

/**
 * Get status label
 */
function getStatusLabel(status: PaymentStatus, t: (key: TranslationKey) => string): string {
    const labels = {
        completed: t('admin-billing.payments.statuses.completed'),
        pending: t('admin-billing.payments.statuses.pending'),
        failed: t('admin-billing.payments.statuses.failed'),
        refunded: t('admin-billing.payments.statuses.refunded')
    };
    return labels[status];
}

/**
 * Get payment method label
 */
function getPaymentMethodLabel(method: PaymentMethod, t: (key: TranslationKey) => string): string {
    const labels = {
        credit_card: t('admin-billing.payments.methods.creditCard'),
        debit_card: t('admin-billing.payments.methods.debitCard'),
        mercado_pago: t('admin-billing.payments.methods.mercadoPago'),
        bank_transfer: t('admin-billing.payments.methods.bankTransfer')
    };
    return labels[method];
}

/**
 * Format date to Spanish locale
 */
function formatDate(date: string): string {
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(date));
}

/**
 * Format ARS currency
 */
function formatArs(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

/**
 * Payment detail dialog component
 */
function PaymentDetailDialog({
    payment,
    open,
    onOpenChange
}: {
    payment: Payment | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { t } = useTranslations();

    if (!payment) return null;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{t('admin-billing.payments.dialog.title')}</DialogTitle>
                    <DialogDescription>ID: {payment.id}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    {/* User Information */}
                    <div className="grid gap-2">
                        <h3 className="font-semibold text-sm">
                            {t('admin-billing.payments.dialog.userInfo')}
                        </h3>
                        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 text-sm">
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.payments.dialog.nameLabel')}
                                </p>
                                <p className="font-medium">{payment.userName}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.payments.dialog.emailLabel')}
                                </p>
                                <p className="font-medium">{payment.userEmail}</p>
                            </div>
                        </div>
                    </div>

                    {/* Payment Information */}
                    <div className="grid gap-2">
                        <h3 className="font-semibold text-sm">
                            {t('admin-billing.payments.dialog.paymentInfo')}
                        </h3>
                        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 text-sm">
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.payments.dialog.amountLabel')}
                                </p>
                                <p className="font-semibold text-lg">{formatArs(payment.amount)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.payments.dialog.statusLabel')}
                                </p>
                                <Badge variant={getStatusVariant(payment.status)}>
                                    {getStatusLabel(payment.status, t)}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.payments.dialog.dateLabel')}
                                </p>
                                <p className="font-medium">{formatDate(payment.date)}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.payments.dialog.methodLabel')}
                                </p>
                                <p className="font-medium">
                                    {getPaymentMethodLabel(payment.method, t)}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.payments.dialog.planLabel')}
                                </p>
                                <p className="font-medium">{payment.planName}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.payments.dialog.transactionIdLabel')}
                                </p>
                                <p className="font-mono text-xs">{payment.transactionId}</p>
                            </div>
                        </div>
                    </div>

                    {/* Related Information */}
                    <div className="grid gap-2">
                        <h3 className="font-semibold text-sm">
                            {t('admin-billing.payments.dialog.references')}
                        </h3>
                        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 text-sm">
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.payments.dialog.subscriptionLabel')}
                                </p>
                                <p className="font-mono text-xs">{payment.subscriptionId}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground text-xs">
                                    {t('admin-billing.payments.dialog.invoiceLabel')}
                                </p>
                                <Button
                                    variant="link"
                                    size="sm"
                                    className="h-auto p-0 font-mono text-xs"
                                    disabled
                                >
                                    {payment.invoiceId}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                    >
                        {t('admin-billing.common.close')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Refund dialog component
 */
function RefundDialog({
    payment,
    open,
    onOpenChange,
    refundMutation,
    addToast
}: {
    payment: Payment | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    refundMutation: ReturnType<typeof useRefundPaymentMutation>;
    addToast: ReturnType<typeof useToast>['addToast'];
}) {
    const { t } = useTranslations();
    const [refundType, setRefundType] = useState<'full' | 'partial'>('full');
    const [partialAmount, setPartialAmount] = useState('');
    const [reason, setReason] = useState('');

    if (!payment) return null;

    const handleRefund = () => {
        if (!payment) return;

        const refundAmount =
            refundType === 'full' ? payment.amount : Number.parseFloat(partialAmount) || 0;

        refundMutation.mutate(
            {
                id: payment.id,
                amount: refundType === 'partial' ? refundAmount : undefined,
                reason
            },
            {
                onSuccess: () => {
                    addToast({
                        message: t('admin-billing.payments.toasts.refundSuccess'),
                        variant: 'success'
                    });
                    onOpenChange(false);
                    setRefundType('full');
                    setPartialAmount('');
                    setReason('');
                },
                onError: (error) => {
                    addToast({
                        message: `${t('admin-billing.payments.toasts.refundError')} ${error.message}`,
                        variant: 'error'
                    });
                }
            }
        );
    };

    const refundAmount =
        refundType === 'full' ? payment.amount : Number.parseFloat(partialAmount) || 0;

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('admin-billing.payments.refundDialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.payments.refundDialog.description')} {payment.id}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4">
                    {/* Payment Info */}
                    <div className="rounded-md border bg-muted p-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium text-sm">{payment.userName}</p>
                                <p className="text-muted-foreground text-xs">{payment.userEmail}</p>
                            </div>
                            <div className="text-right">
                                <p className="font-semibold text-lg">{formatArs(payment.amount)}</p>
                                <p className="text-muted-foreground text-xs">
                                    {formatDate(payment.date)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Refund Type */}
                    <div className="grid gap-2">
                        <Label>{t('admin-billing.payments.refundDialog.refundTypeLabel')}</Label>
                        <div className="flex gap-4">
                            <label className="flex cursor-pointer items-center gap-2">
                                <input
                                    type="radio"
                                    name="refundType"
                                    value="full"
                                    checked={refundType === 'full'}
                                    onChange={(e) =>
                                        setRefundType(e.target.value as 'full' | 'partial')
                                    }
                                />
                                <span className="text-sm">
                                    {t('admin-billing.payments.refundDialog.fullRefund')}
                                </span>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                                <input
                                    type="radio"
                                    name="refundType"
                                    value="partial"
                                    checked={refundType === 'partial'}
                                    onChange={(e) =>
                                        setRefundType(e.target.value as 'full' | 'partial')
                                    }
                                />
                                <span className="text-sm">
                                    {t('admin-billing.payments.refundDialog.partialRefund')}
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Partial Amount */}
                    {refundType === 'partial' && (
                        <div className="grid gap-2">
                            <Label htmlFor="partialAmount">
                                {t('admin-billing.payments.refundDialog.partialAmountLabel')}
                            </Label>
                            <Input
                                id="partialAmount"
                                type="number"
                                placeholder="0.00"
                                value={partialAmount}
                                onChange={(e) => setPartialAmount(e.target.value)}
                                min="0"
                                max={payment.amount}
                                step="0.01"
                            />
                            <p className="text-muted-foreground text-xs">
                                {t('admin-billing.payments.refundDialog.maxAmount')}{' '}
                                {formatArs(payment.amount)}
                            </p>
                        </div>
                    )}

                    {/* Reason */}
                    <div className="grid gap-2">
                        <Label htmlFor="reason">
                            {t('admin-billing.payments.refundDialog.reasonLabel')}
                        </Label>
                        <textarea
                            id="reason"
                            className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder={t('admin-billing.payments.refundDialog.reasonPlaceholder')}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>

                    {/* Summary */}
                    <div className="rounded-md border bg-muted p-3">
                        <div className="flex items-center justify-between font-semibold text-sm">
                            <span>{t('admin-billing.payments.refundDialog.totalToRefund')}</span>
                            <span className="text-lg">{formatArs(refundAmount)}</span>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={refundMutation.isPending}
                    >
                        {t('admin-billing.common.cancel')}
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleRefund}
                        disabled={
                            refundMutation.isPending ||
                            (refundType === 'partial' && (!partialAmount || refundAmount <= 0)) ||
                            !reason
                        }
                    >
                        {refundMutation.isPending
                            ? t('admin-billing.payments.refundDialog.processingButton')
                            : t('admin-billing.payments.refundDialog.confirmButton')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function BillingPaymentsPage() {
    const { t } = useTranslations();
    const { addToast } = useToast();
    const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
    const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [minAmount, setMinAmount] = useState('');
    const [maxAmount, setMaxAmount] = useState('');
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);
    const [refundDialogOpen, setRefundDialogOpen] = useState(false);
    const [showFilters, setShowFilters] = useState(false);

    // Fetch payments with filters
    const {
        data: paymentsData = [],
        isLoading,
        isError
    } = usePaymentsQuery({
        status: statusFilter,
        method: methodFilter,
        q: searchQuery,
        startDate,
        endDate,
        minAmount: minAmount ? Number.parseFloat(minAmount) : undefined,
        maxAmount: maxAmount ? Number.parseFloat(maxAmount) : undefined
    });
    const payments = ((paymentsData as { items?: Payment[] } | undefined)?.items ??
        []) as Payment[];

    // Refund mutation
    const refundMutation = useRefundPaymentMutation();

    const filteredPayments = payments.filter((payment: Payment) => {
        const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
        const matchesMethod = methodFilter === 'all' || payment.method === methodFilter;
        const matchesSearch =
            searchQuery === '' ||
            payment.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
            payment.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            payment.userEmail.toLowerCase().includes(searchQuery.toLowerCase());

        // Date range filter
        const paymentDate = new Date(payment.date);
        const matchesStartDate = !startDate || paymentDate >= new Date(startDate);
        const matchesEndDate = !endDate || paymentDate <= new Date(endDate);

        // Amount range filter
        const matchesMinAmount = !minAmount || payment.amount >= Number.parseFloat(minAmount);
        const matchesMaxAmount = !maxAmount || payment.amount <= Number.parseFloat(maxAmount);

        return (
            matchesStatus &&
            matchesMethod &&
            matchesSearch &&
            matchesStartDate &&
            matchesEndDate &&
            matchesMinAmount &&
            matchesMaxAmount
        );
    });

    const handleViewDetails = (payment: Payment) => {
        setSelectedPayment(payment);
        setDetailDialogOpen(true);
    };

    const handleRefund = (payment: Payment) => {
        setSelectedPayment(payment);
        setRefundDialogOpen(true);
    };

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">{t('admin-billing.payments.title')}</h2>
                    <p className="text-muted-foreground">
                        {t('admin-billing.payments.description')}
                    </p>
                </div>

                {/* Search and Quick Filters */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>{t('admin-billing.payments.searchTitle')}</CardTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
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
                                    onChange={(e) => setSearchQuery(e.target.value)}
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
                                        setStatusFilter(e.target.value as PaymentStatus | 'all')
                                    }
                                >
                                    <option value="all">
                                        {t('admin-billing.payments.allFilter')}
                                    </option>
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
                                        setMethodFilter(e.target.value as PaymentMethod | 'all')
                                    }
                                >
                                    <option value="all">
                                        {t('admin-billing.payments.allFilter')}
                                    </option>
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
                                        onChange={(e) => setStartDate(e.target.value)}
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
                                        onChange={(e) => setEndDate(e.target.value)}
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
                                        onChange={(e) => setMinAmount(e.target.value)}
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
                                        onChange={(e) => setMaxAmount(e.target.value)}
                                        min="0"
                                        step="100"
                                    />
                                </div>

                                {/* Reset Button */}
                                <div className="col-span-2 flex justify-end">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setStartDate('');
                                            setEndDate('');
                                            setMinAmount('');
                                            setMaxAmount('');
                                        }}
                                    >
                                        {t('admin-billing.payments.clearAdvancedFilters')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Payments Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin-billing.payments.tableTitle')}</CardTitle>
                        <CardDescription>
                            {isLoading
                                ? t('admin-billing.payments.loadingPayments')
                                : isError
                                  ? t('admin-billing.payments.errorLoading')
                                  : filteredPayments.length === 0
                                    ? t('admin-billing.payments.noPayments')
                                    : `${filteredPayments.length} ${filteredPayments.length !== 1 ? t('admin-billing.payments.paymentCountPlural') : t('admin-billing.payments.paymentCount')}`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="py-12 text-center">
                                <LoaderIcon className="mx-auto h-8 w-8 animate-spin text-primary" />
                                <p className="mt-4 text-muted-foreground text-sm">
                                    {t('admin-billing.payments.loadingPayments')}
                                </p>
                            </div>
                        ) : isError ? (
                            <div className="py-12 text-center">
                                <p className="text-destructive text-sm">
                                    {t('admin-billing.payments.errorLoading')}
                                </p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    {t('admin-billing.payments.apiCheckError')}
                                </p>
                            </div>
                        ) : filteredPayments.length === 0 ? (
                            <div className="py-12 text-center">
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-billing.payments.emptyTitle')}
                                </p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    {t('admin-billing.payments.emptyHint')}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="px-4 py-3 text-left font-medium">
                                                {t('admin-billing.payments.columns.id')}
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                {t('admin-billing.payments.columns.user')}
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                {t('admin-billing.payments.columns.amount')}
                                            </th>
                                            <th className="px-4 py-3 text-center font-medium">
                                                {t('admin-billing.payments.columns.status')}
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                {t('admin-billing.payments.columns.date')}
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                {t('admin-billing.payments.columns.method')}
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                {t('admin-billing.payments.columns.plan')}
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                {t('admin-billing.payments.columns.actions')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPayments.map((payment: Payment) => (
                                            <tr
                                                key={payment.id}
                                                className="border-b hover:bg-muted/50"
                                            >
                                                <td className="px-4 py-3 font-mono text-xs">
                                                    {payment.id.slice(0, 8)}...
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div>
                                                        <div className="font-medium">
                                                            {payment.userName}
                                                        </div>
                                                        <div className="text-muted-foreground text-xs">
                                                            {payment.userEmail}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium">
                                                    {formatArs(payment.amount)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Badge
                                                        variant={getStatusVariant(payment.status)}
                                                    >
                                                        {getStatusLabel(payment.status, t)}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                                    {formatDate(payment.date)}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                                    {getPaymentMethodLabel(payment.method, t)}
                                                </td>
                                                <td className="px-4 py-3 text-xs">
                                                    {payment.planName}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleViewDetails(payment)
                                                            }
                                                        >
                                                            {t('admin-billing.payments.viewButton')}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleRefund(payment)}
                                                            disabled={
                                                                payment.status !== 'completed'
                                                            }
                                                            title={
                                                                payment.status !== 'completed'
                                                                    ? t(
                                                                          'admin-billing.payments.refundDisabledTitle'
                                                                      )
                                                                    : t(
                                                                          'admin-billing.payments.refundEnabledTitle'
                                                                      )
                                                            }
                                                        >
                                                            {t(
                                                                'admin-billing.payments.refundButton'
                                                            )}
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Dialogs */}
                <PaymentDetailDialog
                    payment={selectedPayment}
                    open={detailDialogOpen}
                    onOpenChange={setDetailDialogOpen}
                />
                <RefundDialog
                    payment={selectedPayment}
                    open={refundDialogOpen}
                    onOpenChange={setRefundDialogOpen}
                    refundMutation={refundMutation}
                    addToast={addToast}
                />
            </div>
        </SidebarPageLayout>
    );
}
