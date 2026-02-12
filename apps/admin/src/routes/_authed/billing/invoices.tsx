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
import {
    useInvoicesQuery,
    usePayInvoiceMutation,
    useVoidInvoiceMutation
} from '@/features/billing-invoices/hooks';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { createFileRoute } from '@tanstack/react-router';
import { CalendarIcon, DownloadIcon, FileTextIcon, MailIcon } from 'lucide-react';
import { useState } from 'react';

export const Route = createFileRoute('/_authed/billing/invoices')({
    component: BillingInvoicesPage
});

type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

interface InvoiceLineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

interface Invoice {
    id: string;
    invoiceNumber: string;
    userName: string;
    userEmail: string;
    amount: number;
    status: InvoiceStatus;
    issueDate: string;
    dueDate: string;
    paidDate?: string;
    lineItems: InvoiceLineItem[];
    subtotal: number;
    tax: number;
    total: number;
    paymentMethod?: string;
    notes?: string;
}

/**
 * Get status badge variant
 */
function getStatusVariant(status: InvoiceStatus) {
    const variants = {
        draft: 'outline',
        open: 'default',
        paid: 'success',
        void: 'outline',
        uncollectible: 'destructive'
    } as const;
    return variants[status];
}

/**
 * Get status label
 */
function getStatusLabel(status: InvoiceStatus, t: (key: TranslationKey) => string): string {
    const labels = {
        draft: t('admin-billing.invoices.statuses.draft'),
        open: t('admin-billing.invoices.statuses.open'),
        paid: t('admin-billing.invoices.statuses.paid'),
        void: t('admin-billing.invoices.statuses.void'),
        uncollectible: t('admin-billing.invoices.statuses.uncollectible')
    };
    return labels[status];
}

/**
 * Format date to Spanish locale
 */
function formatDate(date: string): string {
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
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
 * Invoice detail dialog component
 */
function InvoiceDetailDialog({
    invoice,
    open,
    onOpenChange,
    onMarkAsPaid,
    onMarkAsVoid,
    onSendReminder
}: {
    invoice: Invoice | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onMarkAsPaid: (invoice: Invoice) => void;
    onMarkAsVoid: (invoice: Invoice) => void;
    onSendReminder: (invoice: Invoice) => void;
}) {
    const { t } = useTranslations();

    if (!invoice) return null;

    const canMarkAsPaid = invoice.status === 'open';
    const canMarkAsVoid = ['draft', 'open'].includes(invoice.status);
    const canSendReminder = invoice.status === 'open';

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileTextIcon className="size-5" />
                        {t('admin-billing.invoices.dialog.invoicePrefix')} {invoice.invoiceNumber}
                    </DialogTitle>
                    <DialogDescription>
                        {t('admin-billing.invoices.dialog.issuedOn')}{' '}
                        {formatDate(invoice.issueDate)} • {t('admin-billing.invoices.dialog.dueOn')}{' '}
                        {formatDate(invoice.dueDate)}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6">
                    {/* Header Section */}
                    <div className="grid gap-4 rounded-md border p-4 md:grid-cols-2">
                        <div>
                            <p className="mb-2 font-semibold text-sm">
                                {t('admin-billing.invoices.dialog.client')}
                            </p>
                            <p className="font-medium">{invoice.userName}</p>
                            <p className="text-muted-foreground text-sm">{invoice.userEmail}</p>
                        </div>
                        <div className="text-left md:text-right">
                            <p className="mb-2 font-semibold text-sm">
                                {t('admin-billing.invoices.dialog.status')}
                            </p>
                            <Badge
                                variant={getStatusVariant(invoice.status)}
                                className="text-sm"
                            >
                                {getStatusLabel(invoice.status, t)}
                            </Badge>
                            {invoice.paidDate && (
                                <p className="mt-1 text-muted-foreground text-xs">
                                    {t('admin-billing.invoices.dialog.paidOn')}{' '}
                                    {formatDate(invoice.paidDate)}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Line Items */}
                    <div>
                        <h3 className="mb-3 font-semibold text-sm">
                            {t('admin-billing.invoices.dialog.lineItemsTitle')}
                        </h3>
                        <div className="overflow-x-auto rounded-md border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-medium">
                                            {t('admin-billing.invoices.dialog.descriptionCol')}
                                        </th>
                                        <th className="px-4 py-2 text-center font-medium">
                                            {t('admin-billing.invoices.dialog.quantityCol')}
                                        </th>
                                        <th className="px-4 py-2 text-right font-medium">
                                            {t('admin-billing.invoices.dialog.unitPriceCol')}
                                        </th>
                                        <th className="px-4 py-2 text-right font-medium">
                                            {t('admin-billing.invoices.dialog.totalCol')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoice.lineItems.map((item) => (
                                        <tr
                                            key={`${item.description}-${item.quantity}-${item.unitPrice}`}
                                            className="border-b last:border-b-0"
                                        >
                                            <td className="px-4 py-3">{item.description}</td>
                                            <td className="px-4 py-3 text-center">
                                                {item.quantity}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {formatArs(item.unitPrice)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium">
                                                {formatArs(item.total)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Totals */}
                    <div className="rounded-md border bg-muted p-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                    {t('admin-billing.invoices.dialog.subtotal')}
                                </span>
                                <span className="font-medium">{formatArs(invoice.subtotal)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                    {t('admin-billing.invoices.dialog.tax')}
                                </span>
                                <span className="font-medium">{formatArs(invoice.tax)}</span>
                            </div>
                            <div className="border-t pt-2">
                                <div className="flex justify-between font-semibold text-lg">
                                    <span>{t('admin-billing.invoices.dialog.total')}</span>
                                    <span>{formatArs(invoice.total)}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Payment Information */}
                    {invoice.status === 'paid' && invoice.paymentMethod && (
                        <div className="rounded-md border bg-green-50 p-4">
                            <p className="mb-1 font-semibold text-green-900 text-sm">
                                {t('admin-billing.invoices.dialog.paymentInfo')}
                            </p>
                            <p className="text-green-800 text-sm">
                                {t('admin-billing.invoices.dialog.paymentMethod')}:{' '}
                                {invoice.paymentMethod}
                            </p>
                            {invoice.paidDate && (
                                <p className="text-green-800 text-sm">
                                    {t('admin-billing.invoices.dialog.paymentDate')}:{' '}
                                    {formatDate(invoice.paidDate)}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Notes */}
                    {invoice.notes && (
                        <div>
                            <p className="mb-2 font-semibold text-sm">
                                {t('admin-billing.invoices.dialog.notes')}
                            </p>
                            <p className="rounded-md border bg-muted p-3 text-sm">
                                {invoice.notes}
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-col gap-2 sm:flex-row">
                    <div className="flex flex-1 gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                window.print();
                            }}
                        >
                            <DownloadIcon className="mr-2 size-4" />
                            {t('admin-billing.invoices.dialog.downloadPdf')}
                        </Button>
                        {canSendReminder && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onSendReminder(invoice)}
                            >
                                <MailIcon className="mr-2 size-4" />
                                {t('admin-billing.invoices.dialog.sendReminder')}
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        {canMarkAsVoid && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onMarkAsVoid(invoice)}
                            >
                                {t('admin-billing.invoices.dialog.voidInvoice')}
                            </Button>
                        )}
                        {canMarkAsPaid && (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => onMarkAsPaid(invoice)}
                            >
                                {t('admin-billing.invoices.dialog.markAsPaid')}
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            {t('admin-billing.common.close')}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function BillingInvoicesPage() {
    const { t } = useTranslations();
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
        data: invoices = [],
        isLoading,
        isError
    } = useInvoicesQuery({
        status: statusFilter,
        q: searchQuery,
        startDate,
        endDate
    });

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
                                        Fecha Desde
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
                                        Fecha Hasta
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
                                        Limpiar Filtros de Fecha
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Invoices Table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Listado de Facturas</CardTitle>
                        <CardDescription>
                            {isLoading
                                ? 'Cargando...'
                                : isError
                                  ? 'Error al cargar facturas'
                                  : filteredInvoices.length === 0
                                    ? 'No hay facturas'
                                    : `${filteredInvoices.length} factura${filteredInvoices.length !== 1 ? 's' : ''}`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="py-12 text-center">
                                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                                <p className="mt-4 text-muted-foreground text-sm">
                                    Cargando facturas...
                                </p>
                            </div>
                        ) : isError ? (
                            <div className="py-12 text-center">
                                <p className="text-destructive text-sm">Error al cargar facturas</p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    Verifica que la API esté disponible
                                </p>
                            </div>
                        ) : filteredInvoices.length === 0 ? (
                            <div className="py-12 text-center">
                                <p className="text-muted-foreground text-sm">
                                    No hay facturas registradas aún.
                                </p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    Las facturas se generarán automáticamente cuando se procesen
                                    pagos.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="px-4 py-3 text-left font-medium">
                                                Nº Factura
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                Usuario
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Monto
                                            </th>
                                            <th className="px-4 py-3 text-center font-medium">
                                                Estado
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                Emisión
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                Vencimiento
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Acciones
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
                                                    {formatArs(invoice.amount)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Badge
                                                        variant={getStatusVariant(invoice.status)}
                                                    >
                                                        {getStatusLabel(invoice.status, t)}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                                    {formatDate(invoice.issueDate)}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                                    {formatDate(invoice.dueDate)}
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
                                                            Ver
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
