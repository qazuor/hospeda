/**
 * Sponsor Dashboard Overview
 *
 * Main dashboard for sponsors to view their sponsorships and analytics
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSponsorSummaryQuery } from '@/features/sponsor-dashboard/hooks';
import { Link, createFileRoute } from '@tanstack/react-router';
import { Activity, BarChart3, MousePointerClick, Package, TrendingUp } from 'lucide-react';

export const Route = createFileRoute('/_authed/sponsor/')({
    component: SponsorDashboardPage
});

function SponsorDashboardPage() {
    const { data: summary, isLoading, error } = useSponsorSummaryQuery();

    if (error) {
        return (
            <SidebarPageLayout>
                <Card>
                    <CardContent className="py-8">
                        <div className="text-center">
                            <p className="text-muted-foreground">
                                No se pudo cargar el resumen. Verifica que la API esté funcionando.
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
                    <h2 className="mb-2 font-bold text-2xl">Panel de Patrocinio</h2>
                    <p className="text-muted-foreground">
                        Gestiona tus patrocinios y visualiza estadísticas
                    </p>
                </div>

                {/* Summary cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <SummaryCard
                        title="Patrocinios Activos"
                        value={summary?.activeSponsorships || 0}
                        icon={<Package className="size-4 text-muted-foreground" />}
                        loading={isLoading}
                    />
                    <SummaryCard
                        title="Impresiones Totales"
                        value={(summary?.totalImpressions || 0).toLocaleString('es-AR')}
                        icon={<Activity className="size-4 text-muted-foreground" />}
                        loading={isLoading}
                    />
                    <SummaryCard
                        title="Clicks Totales"
                        value={(summary?.totalClicks || 0).toLocaleString('es-AR')}
                        icon={<MousePointerClick className="size-4 text-muted-foreground" />}
                        loading={isLoading}
                    />
                    <SummaryCard
                        title="Inversión"
                        value={new Intl.NumberFormat('es-AR', {
                            style: 'currency',
                            currency: 'ARS',
                            minimumFractionDigits: 0
                        }).format(summary?.revenue || 0)}
                        icon={<TrendingUp className="size-4 text-muted-foreground" />}
                        loading={isLoading}
                    />
                </div>

                {/* Quick actions */}
                <Card>
                    <CardHeader>
                        <CardTitle>Acciones rápidas</CardTitle>
                        <CardDescription>
                            Gestiona tus patrocinios y visualiza reportes
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-3">
                            <Link to="/sponsor/sponsorships">
                                <Button
                                    variant="outline"
                                    className="h-auto w-full flex-col items-start gap-2 p-4"
                                >
                                    <Package className="size-5" />
                                    <div className="text-left">
                                        <div className="font-semibold">Mis Patrocinios</div>
                                        <div className="text-muted-foreground text-xs">
                                            Ver y gestionar patrocinios
                                        </div>
                                    </div>
                                </Button>
                            </Link>

                            <Link to="/sponsor/analytics">
                                <Button
                                    variant="outline"
                                    className="h-auto w-full flex-col items-start gap-2 p-4"
                                >
                                    <BarChart3 className="size-5" />
                                    <div className="text-left">
                                        <div className="font-semibold">Analíticas</div>
                                        <div className="text-muted-foreground text-xs">
                                            Ver métricas de rendimiento
                                        </div>
                                    </div>
                                </Button>
                            </Link>

                            <Link to="/sponsor/invoices">
                                <Button
                                    variant="outline"
                                    className="h-auto w-full flex-col items-start gap-2 p-4"
                                >
                                    <Activity className="size-5" />
                                    <div className="text-left">
                                        <div className="font-semibold">Facturas</div>
                                        <div className="text-muted-foreground text-xs">
                                            Consultar y descargar facturas
                                        </div>
                                    </div>
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                {/* Recent activity */}
                <Card>
                    <CardHeader>
                        <CardTitle>Actividad reciente</CardTitle>
                        <CardDescription>Últimos eventos de tus patrocinios</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="py-8 text-center">
                            <p className="text-muted-foreground text-sm">
                                No hay actividad reciente
                            </p>
                            <p className="mt-2 text-muted-foreground text-xs">
                                Requiere implementación de API de actividades
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </SidebarPageLayout>
    );
}

/**
 * Summary Card Component
 */
function SummaryCard({
    title,
    value,
    icon,
    loading
}: {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    loading?: boolean;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="font-medium text-sm">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="h-7 w-24 animate-pulse rounded bg-muted" />
                ) : (
                    <div className="font-bold text-2xl">{value}</div>
                )}
            </CardContent>
        </Card>
    );
}
