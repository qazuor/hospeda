/**
 * Sponsor Analytics Page
 *
 * View analytics and metrics for sponsor's sponsorships
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSponsorAnalyticsQuery } from '@/features/sponsor-dashboard/hooks';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/sponsor/analytics')({
    component: SponsorAnalyticsPage
});

function SponsorAnalyticsPage() {
    const { data: analytics, isLoading, error } = useSponsorAnalyticsQuery();

    if (error) {
        return (
            <SidebarPageLayout>
                <Card>
                    <CardContent className="py-8">
                        <div className="text-center">
                            <p className="text-muted-foreground">
                                No se pudieron cargar las analíticas. Verifica que la API esté
                                funcionando.
                            </p>
                            <p className="mt-2 text-red-600 text-sm">{error.message}</p>
                        </div>
                    </CardContent>
                </Card>
            </SidebarPageLayout>
        );
    }

    const totalImpressions = analytics?.reduce((acc, item) => acc + item.impressions, 0) || 0;
    const totalClicks = analytics?.reduce((acc, item) => acc + item.clicks, 0) || 0;
    const totalCouponUsage = analytics?.reduce((acc, item) => acc + item.couponUsage, 0) || 0;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                {/* Page header */}
                <div>
                    <h2 className="mb-2 font-bold text-2xl">Analíticas</h2>
                    <p className="text-muted-foreground">
                        Visualiza métricas de rendimiento de tus patrocinios
                    </p>
                </div>

                {/* Summary metrics */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <MetricCard
                        title="Impresiones Totales"
                        value={totalImpressions.toLocaleString('es-AR')}
                        loading={isLoading}
                    />
                    <MetricCard
                        title="Clicks Totales"
                        value={totalClicks.toLocaleString('es-AR')}
                        loading={isLoading}
                    />
                    <MetricCard
                        title="CTR Promedio"
                        value={`${ctr.toFixed(2)}%`}
                        loading={isLoading}
                    />
                    <MetricCard
                        title="Cupones Usados"
                        value={totalCouponUsage.toLocaleString('es-AR')}
                        loading={isLoading}
                    />
                </div>

                {/* Charts placeholder */}
                <Card>
                    <CardHeader>
                        <CardTitle>Impresiones en el tiempo</CardTitle>
                        <CardDescription>
                            Visualiza la evolución de impresiones de tus patrocinios
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex h-64 items-center justify-center rounded-md border bg-muted/50">
                            <div className="text-center">
                                <p className="text-muted-foreground text-sm">
                                    Gráfico de impresiones en el tiempo
                                </p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    Requiere implementación de librería de gráficos (ej: Recharts)
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Click-through Rate</CardTitle>
                        <CardDescription>Porcentaje de clicks sobre impresiones</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex h-64 items-center justify-center rounded-md border bg-muted/50">
                            <div className="text-center">
                                <p className="text-muted-foreground text-sm">
                                    Gráfico de CTR en el tiempo
                                </p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    Requiere implementación de librería de gráficos
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Uso de cupones</CardTitle>
                        <CardDescription>Cantidad de cupones redimidos por período</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex h-64 items-center justify-center rounded-md border bg-muted/50">
                            <div className="text-center">
                                <p className="text-muted-foreground text-sm">
                                    Gráfico de uso de cupones
                                </p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    Requiere implementación de librería de gráficos
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Breakdown by sponsorship */}
                <Card>
                    <CardHeader>
                        <CardTitle>Desglose por patrocinio</CardTitle>
                        <CardDescription>Métricas individuales de cada patrocinio</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!analytics || analytics.length === 0 ? (
                            <div className="py-8 text-center">
                                <p className="text-muted-foreground text-sm">
                                    No hay datos disponibles
                                </p>
                                <p className="mt-2 text-muted-foreground text-xs">
                                    Requiere implementación de API de analíticas
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="border-b">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium">
                                                Período
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Impresiones
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Clicks
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                CTR
                                            </th>
                                            <th className="px-4 py-3 text-right font-medium">
                                                Cupones
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analytics.map((item) => (
                                            <tr
                                                key={`${item.period}-${item.impressions}-${item.clicks}`}
                                                className="border-b last:border-b-0"
                                            >
                                                <td className="px-4 py-3">{item.period}</td>
                                                <td className="px-4 py-3 text-right">
                                                    {item.impressions.toLocaleString('es-AR')}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {item.clicks.toLocaleString('es-AR')}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {item.impressions > 0
                                                        ? (
                                                              (item.clicks / item.impressions) *
                                                              100
                                                          ).toFixed(2)
                                                        : 0}
                                                    %
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {item.couponUsage.toLocaleString('es-AR')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </SidebarPageLayout>
    );
}

/**
 * Metric Card Component
 */
function MetricCard({
    title,
    value,
    loading
}: {
    title: string;
    value: string;
    loading?: boolean;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm">{title}</CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="h-8 w-32 animate-pulse rounded bg-muted" />
                ) : (
                    <p className="font-bold text-2xl">{value}</p>
                )}
            </CardContent>
        </Card>
    );
}
