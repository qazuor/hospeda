/**
 * Sponsor Invoices Page
 *
 * View and download sponsor invoices
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSponsorInvoicesQuery } from '@/features/sponsor-dashboard/hooks';
import { useTranslations } from '@/hooks/use-translations';
import { formatArs, formatShortDate } from '@/lib/format-helpers';
import { DownloadIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/sponsor/invoices')({
    component: SponsorInvoicesPage
});

type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void';

function SponsorInvoicesPage() {
    const { t, tPlural, locale } = useTranslations();
    const { data: invoices, isLoading, error } = useSponsorInvoicesQuery();

    const getStatusVariant = (status: InvoiceStatus) => {
        const variants = {
            draft: 'outline',
            open: 'default',
            paid: 'success',
            void: 'outline'
        } as const;
        return variants[status];
    };

    const getStatusLabel = (status: InvoiceStatus) => {
        const labels = {
            draft: t('admin-pages.sponsor.invoices.statusDraft'),
            open: t('admin-pages.sponsor.invoices.statusOpen'),
            paid: t('admin-pages.sponsor.invoices.statusPaid'),
            void: t('admin-pages.sponsor.invoices.statusVoid')
        };
        return labels[status];
    };

    const handleDownload = (_invoiceId: string) => {};

    if (error) {
        return (
            <SidebarPageLayout>
                <Card>
                    <CardContent className="py-8">
                        <div className="text-center">
                            <p className="text-muted-foreground">
                                {t('admin-pages.sponsor.invoices.loadError')}
                            </p>
                            <p className="mt-2 text-destructive text-sm">{error.message}</p>
                        </div>
                    </CardContent>
                </Card>
            </SidebarPageLayout>
        );
    }

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                {/* Page header */}
                <div>
                    <h2 className="mb-2 font-bold text-2xl">
                        {t('admin-pages.sponsor.invoices.title')}
                    </h2>
                    <p className="text-muted-foreground">
                        {t('admin-pages.sponsor.invoices.subtitle')}
                    </p>
                </div>

                {/* Invoices table */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin-pages.sponsor.invoices.listTitle')}</CardTitle>
                        <CardDescription>
                            {!invoices || invoices.length === 0
                                ? t('admin-pages.sponsor.invoices.noInvoices')
                                : tPlural(
                                      'admin-pages.sponsor.invoices.invoiceCount',
                                      invoices.length
                                  )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="py-8 text-center">
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-pages.sponsor.invoices.loading')}
                                </p>
                            </div>
                        ) : !invoices || invoices.length === 0 ? (
                            <div className="py-8 text-center">
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-pages.sponsor.invoices.emptyMessage')}
                                </p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    {t('admin-pages.sponsor.invoices.emptyHint')}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium">
                                                {t('admin-pages.sponsor.invoices.colNumber')}
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                {t('admin-pages.sponsor.invoices.colDate')}
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                {t('admin-pages.sponsor.invoices.colAmount')}
                                            </th>
                                            <th className="px-4 py-3 text-center font-medium">
                                                {t('admin-pages.sponsor.invoices.colStatus')}
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                {t('admin-pages.sponsor.invoices.colActions')}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoices.map((invoice) => (
                                            <tr
                                                key={invoice.id}
                                                className="border-b last:border-b-0 hover:bg-muted/50"
                                            >
                                                <td className="px-4 py-3 font-mono">
                                                    {invoice.invoiceNumber}
                                                </td>
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {formatShortDate({
                                                        date: invoice.date,
                                                        locale
                                                    })}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium">
                                                    {formatArs({ value: invoice.amount, locale })}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Badge
                                                        variant={getStatusVariant(invoice.status)}
                                                    >
                                                        {getStatusLabel(invoice.status)}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDownload(invoice.id)}
                                                        disabled
                                                        title={t(
                                                            'admin-pages.sponsor.invoices.downloadTooltip'
                                                        )}
                                                    >
                                                        <DownloadIcon className="mr-2 size-4" />
                                                        {t('admin-pages.sponsor.invoices.download')}
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Summary */}
                {invoices && invoices.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                {t('admin-pages.sponsor.invoices.summaryTitle')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        {t('admin-pages.sponsor.invoices.summaryTotal')}
                                    </span>
                                    <span className="font-medium">{invoices.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        {t('admin-pages.sponsor.invoices.summaryPaid')}
                                    </span>
                                    <span className="font-medium">
                                        {invoices.filter((inv) => inv.status === 'paid').length}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        {t('admin-pages.sponsor.invoices.summaryPending')}
                                    </span>
                                    <span className="font-medium">
                                        {invoices.filter((inv) => inv.status === 'open').length}
                                    </span>
                                </div>
                                <div className="border-t pt-2">
                                    <div className="flex justify-between font-semibold">
                                        <span>
                                            {t('admin-pages.sponsor.invoices.summaryInvested')}
                                        </span>
                                        <span>
                                            {formatArs({
                                                value: invoices.reduce(
                                                    (acc, inv) =>
                                                        inv.status === 'paid'
                                                            ? acc + inv.amount
                                                            : acc,
                                                    0
                                                ),
                                                locale
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </SidebarPageLayout>
    );
}
