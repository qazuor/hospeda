import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/billing/payments')({
    component: BillingPaymentsPage
});

function BillingPaymentsPage() {
    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">Pagos</h2>
                    <p className="text-muted-foreground">
                        Historial de pagos y transacciones del sistema
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Historial de Pagos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            El historial de pagos estará disponible próximamente.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </SidebarPageLayout>
    );
}
