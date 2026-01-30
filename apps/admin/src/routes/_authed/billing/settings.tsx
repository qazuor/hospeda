import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/billing/settings')({
    component: BillingSettingsPage
});

function BillingSettingsPage() {
    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">Configuración de Facturación</h2>
                    <p className="text-muted-foreground">
                        Configura parámetros y opciones del sistema de facturación
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Pasarela de Pagos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            La configuración de pasarelas de pago estará disponible próximamente.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Configuración Fiscal</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            La configuración fiscal y de impuestos estará disponible próximamente.
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Notificaciones</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            La configuración de notificaciones de facturación estará disponible
                            próximamente.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </SidebarPageLayout>
    );
}
