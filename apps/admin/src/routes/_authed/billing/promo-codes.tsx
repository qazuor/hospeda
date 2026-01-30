import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/billing/promo-codes')({
    component: BillingPromoCodesPage
});

function BillingPromoCodesPage() {
    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">Códigos Promocionales</h2>
                    <p className="text-muted-foreground">
                        Gestiona códigos de descuento y promociones
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Códigos Activos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            La gestión de códigos promocionales estará disponible próximamente.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </SidebarPageLayout>
    );
}
