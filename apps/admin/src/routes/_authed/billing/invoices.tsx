import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/billing/invoices')({
    component: BillingInvoicesPage
});

function BillingInvoicesPage() {
    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">Facturas</h2>
                    <p className="text-muted-foreground">
                        Gestión de facturas emitidas y recibidas
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Listado de Facturas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            La gestión de facturas estará disponible próximamente.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </SidebarPageLayout>
    );
}
