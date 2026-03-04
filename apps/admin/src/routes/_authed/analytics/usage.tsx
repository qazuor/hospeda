import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { fetchApi } from '@/lib/api/client';
import { formatNumber } from '@repo/i18n';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/analytics/usage')({
    component: AnalyticsUsagePage
});

/**
 * Metrics response shape from the API
 */
interface MetricsSummary {
    readonly totalRequests: number;
    readonly totalErrors: number;
    readonly globalErrorRate: number;
    readonly activeConnections: number;
    readonly timestamp: string;
}

interface EndpointMetric {
    readonly endpoint: string;
    readonly requests: number;
    readonly errors: number;
    readonly errorRate: number;
    readonly avgResponseTime: number;
    readonly maxResponseTime: number;
    readonly minResponseTime: number;
    readonly p95ResponseTime: number;
    readonly p99ResponseTime: number;
    readonly sampleCount: number;
}

interface MetricsData {
    readonly summary: MetricsSummary;
    readonly endpoints: EndpointMetric[];
}

async function fetchMetrics(): Promise<MetricsData> {
    const result = await fetchApi<{ data?: MetricsData }>({
        path: '/api/v1/admin/metrics'
    });
    return (
        result.data.data ?? {
            summary: {
                totalRequests: 0,
                totalErrors: 0,
                globalErrorRate: 0,
                activeConnections: 0,
                timestamp: new Date().toISOString()
            },
            endpoints: []
        }
    );
}

function AnalyticsUsagePage() {
    const { t, locale } = useTranslations();
    const {
        data: metrics,
        isLoading,
        error
    } = useQuery({
        queryKey: ['metrics'],
        queryFn: fetchMetrics,
        staleTime: 60 * 1000, // 1 minute
        retry: 1
    });

    const totalRequests = metrics?.summary?.totalRequests ?? 0;
    const totalErrors = metrics?.summary?.totalErrors ?? 0;
    const errorRate = metrics?.summary?.globalErrorRate ?? 0;
    const activeConnections = metrics?.summary?.activeConnections ?? 0;

    // Compute average response time across all endpoints
    const avgResponseTime =
        metrics?.endpoints && metrics.endpoints.length > 0
            ? metrics.endpoints.reduce((sum, ep) => sum + ep.avgResponseTime, 0) /
              metrics.endpoints.length
            : 0;

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.analyticsUsage">
            <div className="space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">
                        {t('admin-pages.analytics.usage.title')}
                    </h2>
                    <p className="text-muted-foreground">
                        {t('admin-pages.analytics.usage.subtitle')}
                    </p>
                </div>

                {error ? (
                    <Card>
                        <CardContent className="pt-6">
                            <p className="text-muted-foreground text-sm">
                                {t('admin-pages.analytics.usage.noMetrics')}
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="font-medium text-sm">
                                        {t('admin-pages.analytics.usage.totalRequests')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="font-bold text-2xl">
                                        {isLoading
                                            ? '...'
                                            : formatNumber({ value: totalRequests, locale })}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="font-medium text-sm">
                                        {t('admin-pages.analytics.usage.totalErrors')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="font-bold text-2xl">
                                        {isLoading
                                            ? '...'
                                            : formatNumber({ value: totalErrors, locale })}
                                    </div>
                                    <p className="text-muted-foreground text-xs">
                                        {isLoading
                                            ? ''
                                            : t('admin-pages.analytics.usage.errorRate').replace(
                                                  '{{rate}}',
                                                  errorRate.toFixed(2)
                                              )}
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="font-medium text-sm">
                                        {t('admin-pages.analytics.usage.avgResponseTime')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="font-bold text-2xl">
                                        {isLoading ? '...' : `${avgResponseTime.toFixed(0)}ms`}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="font-medium text-sm">
                                        {t('admin-pages.analytics.usage.activeConnections')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="font-bold text-2xl">
                                        {isLoading ? '...' : activeConnections}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Endpoint breakdown table */}
                        {metrics?.endpoints && metrics.endpoints.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>
                                        {t('admin-pages.analytics.usage.endpointBreakdown')}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b text-left">
                                                    <th className="pb-2 font-medium">
                                                        {t(
                                                            'admin-pages.analytics.usage.colEndpoint'
                                                        )}
                                                    </th>
                                                    <th className="pb-2 font-medium">
                                                        {t(
                                                            'admin-pages.analytics.usage.colRequests'
                                                        )}
                                                    </th>
                                                    <th className="pb-2 font-medium">
                                                        {t('admin-pages.analytics.usage.colErrors')}
                                                    </th>
                                                    <th className="pb-2 font-medium">
                                                        {t('admin-pages.analytics.usage.colAvg')}
                                                    </th>
                                                    <th className="pb-2 font-medium">
                                                        {t('admin-pages.analytics.usage.colP95')}
                                                    </th>
                                                    <th className="pb-2 font-medium">
                                                        {t('admin-pages.analytics.usage.colP99')}
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {metrics.endpoints
                                                    .sort((a, b) => b.requests - a.requests)
                                                    .slice(0, 20)
                                                    .map((ep) => (
                                                        <tr
                                                            key={ep.endpoint}
                                                            className="border-b last:border-0"
                                                        >
                                                            <td className="py-2 font-mono text-xs">
                                                                {ep.endpoint}
                                                            </td>
                                                            <td className="py-2">
                                                                {formatNumber({
                                                                    value: ep.requests,
                                                                    locale
                                                                })}
                                                            </td>
                                                            <td className="py-2">
                                                                <span
                                                                    className={
                                                                        ep.errors > 0
                                                                            ? 'text-destructive'
                                                                            : ''
                                                                    }
                                                                >
                                                                    {ep.errors}
                                                                </span>
                                                            </td>
                                                            <td className="py-2">
                                                                {ep.avgResponseTime.toFixed(0)}
                                                            </td>
                                                            <td className="py-2">
                                                                {ep.p95ResponseTime.toFixed(0)}
                                                            </td>
                                                            <td className="py-2">
                                                                {ep.p99ResponseTime.toFixed(0)}
                                                            </td>
                                                        </tr>
                                                    ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        <Card>
                            <CardHeader>
                                <CardTitle>{t('admin-pages.analytics.usage.rawData')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <pre className="overflow-auto rounded-md bg-muted p-4 text-xs">
                                    {isLoading
                                        ? t('admin-pages.analytics.usage.loading')
                                        : JSON.stringify(metrics, null, 2)}
                                </pre>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </SidebarPageLayout>
    );
}
