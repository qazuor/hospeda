import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchApi } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/analytics/usage')({
    component: AnalyticsUsagePage
});

async function fetchMetrics(): Promise<Record<string, unknown>> {
    const result = await fetchApi<{ data?: Record<string, unknown> }>({
        path: '/api/v1/admin/metrics'
    });
    return result.data.data ?? (result.data as unknown as Record<string, unknown>);
}

function AnalyticsUsagePage() {
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

    const totalRequests = (metrics?.requests as number) ?? 0;
    const errorRate = (metrics?.errorRate as number) ?? 0;
    const avgResponseTime = (metrics?.avgResponseTime as number) ?? 0;

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.analyticsUsage">
            <div className="space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">API Usage Metrics</h2>
                    <p className="text-muted-foreground">
                        Monitor API performance and usage statistics
                    </p>
                </div>

                {error ? (
                    <Card>
                        <CardContent className="pt-6">
                            <p className="text-muted-foreground text-sm">
                                No metrics available. The metrics endpoint may not be responding.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="grid gap-4 md:grid-cols-3">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="font-medium text-sm">
                                        Total Requests
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="font-bold text-2xl">
                                        {isLoading ? '...' : totalRequests.toLocaleString()}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="font-medium text-sm">
                                        Error Rate
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="font-bold text-2xl">
                                        {isLoading ? '...' : `${(errorRate * 100).toFixed(2)}%`}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="font-medium text-sm">
                                        Avg Response Time
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="font-bold text-2xl">
                                        {isLoading ? '...' : `${avgResponseTime.toFixed(0)}ms`}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <Card>
                            <CardHeader>
                                <CardTitle>Raw Metrics Data</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <pre className="overflow-auto rounded-md bg-muted p-4 text-xs">
                                    {isLoading ? 'Loading...' : JSON.stringify(metrics, null, 2)}
                                </pre>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </SidebarPageLayout>
    );
}
