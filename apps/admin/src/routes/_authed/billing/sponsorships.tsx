import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/billing/sponsorships')({
    component: BillingSponsorshipsPage
});

function BillingSponsorshipsPage() {
    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">Patrocinios</h2>
                    <p className="text-muted-foreground">
                        Gestiona patrocinios y contenido destacado
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Patrocinios Activos</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            La gestión de patrocinios estará disponible próximamente.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </SidebarPageLayout>
    );
}
