import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/billing/addons')({
    component: BillingAddonsPage
});

function BillingAddonsPage() {
    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">Add-ons</h2>
                    <p className="text-muted-foreground">
                        Gestiona complementos y servicios adicionales
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Add-ons Disponibles</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            La gestión de add-ons estará disponible próximamente.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </SidebarPageLayout>
    );
}
