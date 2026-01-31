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
import { createFileRoute } from '@tanstack/react-router';
import { DownloadIcon } from 'lucide-react';

export const Route = createFileRoute('/_authed/sponsor/invoices')({
    component: SponsorInvoicesPage
});

type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void';

function SponsorInvoicesPage() {
    const { data: invoices, isLoading, error } = useSponsorInvoicesQuery();

    const formatDate = (date: string) => {
        return new Intl.DateTimeFormat('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).format(new Date(date));
    };

    const formatArs = (amount: number) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 0
        }).format(amount);
    };

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
            draft: 'Borrador',
            open: 'Abierta',
            paid: 'Pagada',
            void: 'Anulada'
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
                                No se pudieron cargar las facturas. Verifica que la API esté
                                funcionando.
                            </p>
                            <p className="mt-2 text-red-600 text-sm">{error.message}</p>
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
                    <h2 className="mb-2 font-bold text-2xl">Mis Facturas</h2>
                    <p className="text-muted-foreground">
                        Consulta y descarga tus facturas de patrocinio
                    </p>
                </div>

                {/* Invoices table */}
                <Card>
                    <CardHeader>
                        <CardTitle>Listado de facturas</CardTitle>
                        <CardDescription>
                            {!invoices || invoices.length === 0
                                ? 'No hay facturas'
                                : `${invoices.length} factura${invoices.length !== 1 ? 's' : ''}`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="py-8 text-center">
                                <p className="text-muted-foreground text-sm">Cargando...</p>
                            </div>
                        ) : !invoices || invoices.length === 0 ? (
                            <div className="py-8 text-center">
                                <p className="text-muted-foreground text-sm">
                                    No hay facturas registradas aún
                                </p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    Las facturas se generarán automáticamente cuando se procesen
                                    pagos
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium">
                                                Nº Factura
                                            </th>
                                            <th className="px-4 py-3 text-left font-medium">
                                                Fecha
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Monto
                                            </th>
                                            <th className="px-4 py-3 text-center font-medium">
                                                Estado
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Acciones
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
                                                    {formatDate(invoice.date)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium">
                                                    {formatArs(invoice.amount)}
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
                                                        title="Requiere API de facturación"
                                                    >
                                                        <DownloadIcon className="mr-2 size-4" />
                                                        Descargar
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
                            <CardTitle className="text-base">Resumen</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid gap-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Total de facturas:
                                    </span>
                                    <span className="font-medium">{invoices.length}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Facturas pagas:</span>
                                    <span className="font-medium">
                                        {invoices.filter((inv) => inv.status === 'paid').length}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                        Facturas pendientes:
                                    </span>
                                    <span className="font-medium">
                                        {invoices.filter((inv) => inv.status === 'open').length}
                                    </span>
                                </div>
                                <div className="border-t pt-2">
                                    <div className="flex justify-between font-semibold">
                                        <span>Total invertido:</span>
                                        <span>
                                            {formatArs(
                                                invoices.reduce(
                                                    (acc, inv) =>
                                                        inv.status === 'paid'
                                                            ? acc + inv.amount
                                                            : acc,
                                                    0
                                                )
                                            )}
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
