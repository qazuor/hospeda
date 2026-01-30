import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/billing/metrics')({
    component: BillingMetricsPage
});

function BillingMetricsPage() {
    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">Métricas de Facturación</h2>
                    <p className="text-muted-foreground">
                        Analíticas y reportes de ingresos y facturación
                    </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="font-medium text-sm">
                                Ingresos Mensuales
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="font-bold text-2xl">$0.00</div>
                            <p className="mt-1 text-muted-foreground text-xs">Mes actual</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="font-medium text-sm">
                                Suscripciones Activas
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="font-bold text-2xl">0</div>
                            <p className="mt-1 text-muted-foreground text-xs">Total</p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="font-medium text-sm">
                                Tasa de Conversión
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="font-bold text-2xl">0%</div>
                            <p className="mt-1 text-muted-foreground text-xs">Últimos 30 días</p>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Métricas Detalladas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            Las métricas detalladas de facturación estarán disponibles próximamente.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </SidebarPageLayout>
    );
}
