/**
 * Billing Invoices Page
 *
 * Displays invoices with filtering, search, and detail view.
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useToast } from '@/components/ui/ToastProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    useInvoicesQuery,
    usePayInvoiceMutation,
    useVoidInvoiceMutation
} from '@/features/billing-invoices/hooks';
import { useTranslations } from '@/hooks/use-translations';
import { formatArs, formatShortDate } from '@/lib/format-helpers';
import { CalendarIcon, DownloadIcon, LoaderIcon, MailIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

import {
    type Invoice,
    InvoiceDetailDialog,
    type InvoiceStatus,
    getStatusLabel,
    getStatusVariant
} from '@/features/billing-invoices/components/InvoiceDetailDialog';

export const Route = createFileRoute('/_authed/billing/invoices')({
    component: BillingInvoicesPage
});

function BillingInvoicesPage() {
    const { t, tPlural, locale } = useTranslations();
    const { addToast } = useToast();
    const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);
    const [showDateFilters, setShowDateFilters] = useState(false);

    // Fetch invoices with filters
    const {
        data: invoicesData = [],
        isLoading,
        isError
    } = useInvoicesQuery({
        status: statusFilter,
        q: searchQuery,
        startDate,
        endDate
    });
    const invoices = ((invoicesData as { items?: Invoice[] } | undefined)?.items ??
        []) as Invoice[];

    // Mutations
    const payMutation = usePayInvoiceMutation();
    const voidMutation = useVoidInvoiceMutation();

    const filteredInvoices = invoices.filter((invoice: Invoice) => {
        const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
        const matchesSearch =
            searchQuery === '' ||
            invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
            invoice.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            invoice.userEmail.toLowerCase().includes(searchQuery.toLowerCase());

        // Date range filter (based on issue date)
        const issueDate = new Date(invoice.issueDate);
        const matchesStartDate = !startDate || issueDate >= new Date(startDate);
        const matchesEndDate = !endDate || issueDate <= new Date(endDate);

        return matchesStatus && matchesSearch && matchesStartDate && matchesEndDate;
    });

    const handleViewDetails = (invoice: Invoice) => {
        setSelectedInvoice(invoice);
        setDetailDialogOpen(true);
    };

    const handleMarkAsPaid = (invoice: Invoice) => {
        payMutation.mutate(invoice.id, {
            onSuccess: () => {
                addToast({
                    message: t('admin-billing.invoices.toasts.markedAsPaid'),
                    variant: 'success'
                });
                setDetailDialogOpen(false);
            },
            onError: (error) => {
                addToast({
                    message: `${t('admin-billing.invoices.toasts.markError')} ${error.message}`,
                    variant: 'error'
                });
            }
        });
    };

    const handleMarkAsVoid = (invoice: Invoice) => {
        voidMutation.mutate(invoice.id, {
            onSuccess: () => {
                addToast({
                    message: t('admin-billing.invoices.toasts.voided'),
                    variant: 'success'
                });
                setDetailDialogOpen(false);
            },
            onError: (error) => {
                addToast({
                    message: `${t('admin-billing.invoices.toasts.voidError')} ${error.message}`,
                    variant: 'error'
                });
            }
        });
    };

    const handleSendReminder = (_invoice: Invoice) => {
        addToast({
            message: t('admin-billing.invoices.toasts.reminderSent'),
            variant: 'success'
        });
    };

    const handleDownloadPdf = (_invoice: Invoice) => {
        addToast({
            message: t('admin-billing.invoices.toasts.downloadingPdf'),
            variant: 'success'
        });
    };

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">{t('admin-billing.invoices.title')}</h2>
                    <p className="text-muted-foreground">
                        {t('admin-billing.invoices.description')}
                    </p>
                </div>

                {/* Filters */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>{t('admin-billing.invoices.filtersTitle')}</CardTitle>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowDateFilters(!showDateFilters)}
                            >
                                <CalendarIcon className="mr-2 size-4" />
                                {showDateFilters
                                    ? t('admin-billing.invoices.hideDateFilter')
                                    : t('admin-billing.invoices.showDateFilter')}{' '}
                                {t('admin-billing.invoices.dateFilterSuffix')}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label
                                    htmlFor="invoice-search"
                                    className="mb-2 block font-medium text-sm"
                                >
                                    {t('admin-billing.invoices.searchLabel')}
                                </label>
                                <Input
                                    id="invoice-search"
                                    placeholder={t('admin-billing.invoices.searchPlaceholder')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div>
                                <label
                                    htmlFor="invoice-status-filter"
                                    className="mb-2 block font-medium text-sm"
                                >
                                    {t('admin-billing.invoices.statusFilter')}
                                </label>
                                <select
                                    id="invoice-status-filter"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={statusFilter}
                                    onChange={(e) =>
                                        setStatusFilter(e.target.value as InvoiceStatus | 'all')
                                    }
                                >
                                    <option value="all">
                                        {t('admin-billing.invoices.allFilter')}
                                    </option>
                                    <option value="draft">
                                        {t('admin-billing.invoices.statuses.draft')}
                                    </option>
                                    <option value="open">
                                        {t('admin-billing.invoices.statuses.open')}
                                    </option>
                                    <option value="paid">
                                        {t('admin-billing.invoices.statuses.paid')}
                                    </option>
                                    <option value="void">
                                        {t('admin-billing.invoices.statuses.void')}
                                    </option>
                                    <option value="uncollectible">
                                        {t('admin-billing.invoices.statuses.uncollectible')}
                                    </option>
                                </select>
                            </div>
                        </div>

                        {/* Date Range Filters */}
                        {showDateFilters && (
                            <div className="mt-4 grid gap-4 rounded-md border bg-muted/50 p-4 md:grid-cols-2">
                                <div>
                                    <label
                                        htmlFor="invoice-start-date"
                                        className="mb-2 block font-medium text-sm"
                                    >
                                        {t('admin-billing.invoices.dateFrom')}
                                    </label>
                                    <Input
                                        id="invoice-start-date"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label
                                        htmlFor="invoice-end-date"
                                        className="mb-2 block font-medium text-sm"
                                    >
                                        {t('admin-billing.invoices.dateTo')}
                                    </label>
                                    <Input
                                        id="invoice-end-date"
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                    />
                                </div>
                                <div className="col-span-2 flex justify-end">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setStartDate('');
                                            setEndDate('');
                                        }}
                                    >
                                        {t('admin-billing.invoices.clearDateFilters')}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Invoices Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin-billing.invoices.listTitle')}</CardTitle>
                        <CardDescription>
                            {isLoading
                                ? t('admin-billing.invoices.loading')
                                : isError
                                  ? t('admin-billing.invoices.errorLoading')
                                  : filteredInvoices.length === 0
                                    ? t('admin-billing.invoices.noInvoices')
                                    : tPlural(
                                          'admin-billing.invoices.invoiceCount',
                                          filteredInvoices.length
                                      )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="py-12 text-center">
                                <LoaderIcon className="mx-auto h-8 w-8 animate-spin text-primary" />
                                <p className="mt-4 text-muted-foreground text-sm">
                                    {t('admin-billing.invoices.loadingInvoices')}
                                </p>
                            </div>
                        ) : isError ? (
                            <div className="py-12 text-center">
                                <p className="text-destructive text-sm">
                                    {t('admin-billing.invoices.errorLoading')}
                                </p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    {t('admin-billing.invoices.apiCheckError')}
                                </p>
                            </div>
                        ) : filteredInvoices.length === 0 ? (
                            <div className="py-12 text-center">
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-billing.invoices.emptyTitle')}
                                </p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    {t('admin-billing.invoices.emptyHint')}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="px-4 py-3 text-left font-medium">
                                                {t('admin-billing.invoices.columns.invoiceNumber')}
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                {t('admin-billing.invoices.columns.user')}
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                {t('admin-billing.invoices.columns.amount')}
                                            </th>
                                            <th className="px-4 py-3 text-center font-medium">
                                                {t('admin-billing.invoices.columns.status')}
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                {t('admin-billing.invoices.columns.issueDate')}
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                {t('admin-billing.invoices.columns.dueDate')}
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                {t('admin-billing.invoices.columns.actions')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredInvoices.map((invoice: Invoice) => (
                                            <tr
                                                key={invoice.id}
                                                className="border-b hover:bg-muted/50"
                                            >
                                                <td className="px-4 py-3 font-mono text-sm">
                                                    {invoice.invoiceNumber}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div>
                                                        <div className="font-medium">
                                                            {invoice.userName}
                                                        </div>
                                                        <div className="text-muted-foreground text-xs">
                                                            {invoice.userEmail}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium">
                                                    {formatArs({ value: invoice.amount, locale })}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Badge
                                                        variant={getStatusVariant(invoice.status)}
                                                    >
                                                        {getStatusLabel(invoice.status, t)}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                                    {formatShortDate({
                                                        date: invoice.issueDate,
                                                        locale
                                                    })}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                                    {formatShortDate({
                                                        date: invoice.dueDate,
                                                        locale
                                                    })}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleViewDetails(invoice)
                                                            }
                                                        >
                                                            {t(
                                                                'admin-billing.invoices.viewDetails'
                                                            )}
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleDownloadPdf(invoice)
                                                            }
                                                        >
                                                            <DownloadIcon className="size-4" />
                                                        </Button>
                                                        {invoice.status === 'open' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() =>
                                                                    handleSendReminder(invoice)
                                                                }
                                                            >
                                                                <MailIcon className="size-4" />
                                                            </Button>
                                                        )}
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

                {/* Detail Dialog */}
                <InvoiceDetailDialog
                    invoice={selectedInvoice}
                    open={detailDialogOpen}
                    onOpenChange={setDetailDialogOpen}
                    onMarkAsPaid={handleMarkAsPaid}
                    onMarkAsVoid={handleMarkAsVoid}
                    onSendReminder={handleSendReminder}
                />
            </div>
        </SidebarPageLayout>
    );
}
