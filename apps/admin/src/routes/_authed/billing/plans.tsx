import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/billing/plans')({
    component: BillingPlansPage
});

function BillingPlansPage() {
    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">Planes de Suscripción</h2>
                    <p className="text-muted-foreground">
                        Gestiona los planes de suscripción disponibles para los usuarios
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Planes Activos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            La gestión de planes de suscripción estará disponible próximamente.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </SidebarPageLayout>
    );
}
