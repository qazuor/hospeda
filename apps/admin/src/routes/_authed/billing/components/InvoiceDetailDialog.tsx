/**
 * Invoice Detail Dialog
 *
 * Modal dialog showing full invoice details including line items,
 * totals, payment info, and action buttons.
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { useTranslations } from '@/hooks/use-translations';
import { formatArs, formatShortDate } from '@/lib/format-helpers';
import type { TranslationKey } from '@repo/i18n';
import { DownloadIcon, FileTextIcon, MailIcon } from '@repo/icons';

/** Invoice status type */
export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

/** Invoice line item */
export interface InvoiceLineItem {
    readonly description: string;
    readonly quantity: number;
    readonly unitPrice: number;
    readonly total: number;
}

/** Invoice entity */
export interface Invoice {
    readonly id: string;
    readonly invoiceNumber: string;
    readonly userName: string;
    readonly userEmail: string;
    readonly amount: number;
    readonly status: InvoiceStatus;
    readonly issueDate: string;
    readonly dueDate: string;
    readonly paidDate?: string;
    readonly lineItems: InvoiceLineItem[];
    readonly subtotal: number;
    readonly tax: number;
    readonly total: number;
    readonly paymentMethod?: string;
    readonly notes?: string;
}

/**
 * Get status badge variant
 */
export function getStatusVariant(status: InvoiceStatus) {
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
export function getStatusLabel(status: InvoiceStatus, t: (key: TranslationKey) => string): string {
    const labels = {
        draft: t('admin-billing.invoices.statuses.draft'),
        open: t('admin-billing.invoices.statuses.open'),
        paid: t('admin-billing.invoices.statuses.paid'),
        void: t('admin-billing.invoices.statuses.void'),
        uncollectible: t('admin-billing.invoices.statuses.uncollectible')
    };
    return labels[status];
}

interface InvoiceDetailDialogProps {
    readonly invoice: Invoice | null;
    readonly open: boolean;
    readonly onOpenChange: (open: boolean) => void;
    readonly onMarkAsPaid: (invoice: Invoice) => void;
    readonly onMarkAsVoid: (invoice: Invoice) => void;
    readonly onSendReminder: (invoice: Invoice) => void;
}

/**
 * Invoice detail dialog component
 */
export function InvoiceDetailDialog({
    invoice,
    open,
    onOpenChange,
    onMarkAsPaid,
    onMarkAsVoid,
    onSendReminder
}: InvoiceDetailDialogProps) {
    const { t, locale } = useTranslations();

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
                        {formatShortDate({ date: invoice.issueDate, locale })} •{' '}
                        {t('admin-billing.invoices.dialog.dueOn')}{' '}
                        {formatShortDate({ date: invoice.dueDate, locale })}
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
                                    {formatShortDate({ date: invoice.paidDate, locale })}
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
                                                {formatArs({ value: item.unitPrice, locale })}
                                            </td>
                                            <td className="px-4 py-3 text-right font-medium">
                                                {formatArs({ value: item.total, locale })}
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
                                <span className="font-medium">
                                    {formatArs({ value: invoice.subtotal, locale })}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">
                                    {t('admin-billing.invoices.dialog.tax')}
                                </span>
                                <span className="font-medium">
                                    {formatArs({ value: invoice.tax, locale })}
                                </span>
                            </div>
                            <div className="border-t pt-2">
                                <div className="flex justify-between font-semibold text-lg">
                                    <span>{t('admin-billing.invoices.dialog.total')}</span>
                                    <span>{formatArs({ value: invoice.total, locale })}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Payment Information */}
                    {invoice.status === 'paid' && invoice.paymentMethod && (
                        <div className="rounded-md border bg-green-50 p-4 dark:bg-green-950">
                            <p className="mb-1 font-semibold text-green-900 text-sm dark:text-green-100">
                                {t('admin-billing.invoices.dialog.paymentInfo')}
                            </p>
                            <p className="text-green-800 text-sm dark:text-green-200">
                                {t('admin-billing.invoices.dialog.paymentMethod')}:{' '}
                                {invoice.paymentMethod}
                            </p>
                            {invoice.paidDate && (
                                <p className="text-green-800 text-sm dark:text-green-200">
                                    {t('admin-billing.invoices.dialog.paymentDate')}:{' '}
                                    {formatShortDate({ date: invoice.paidDate, locale })}
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
