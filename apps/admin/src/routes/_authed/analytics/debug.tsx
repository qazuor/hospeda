import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
import { fetchApi } from '@/lib/api/client';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/analytics/debug')({
    component: AnalyticsDebugPage
});

async function fetchHealth(): Promise<Record<string, unknown>> {
    const result = await fetchApi<{ data?: Record<string, unknown> }>({
        path: '/api/v1/health'
    });
    return result.data.data ?? (result.data as unknown as Record<string, unknown>);
}

async function fetchDbHealth(): Promise<Record<string, unknown>> {
    const result = await fetchApi<{ data?: Record<string, unknown> }>({
        path: '/api/v1/health/db'
    });
    return result.data.data ?? (result.data as unknown as Record<string, unknown>);
}

async function resetMetrics(): Promise<void> {
    await fetchApi({ path: '/api/v1/admin/metrics/reset', method: 'POST' });
}

function AnalyticsDebugPage() {
    const { t } = useTranslations();
    const queryClient = useQueryClient();

    const [healthQuery, dbHealthQuery] = useQueries({
        queries: [
            {
                queryKey: ['health'],
                queryFn: fetchHealth,
                staleTime: 30 * 1000 // 30 seconds
            },
            {
                queryKey: ['db-health'],
                queryFn: fetchDbHealth,
                staleTime: 30 * 1000 // 30 seconds
            }
        ]
    });

    const resetMutation = useMutation({
        mutationFn: resetMetrics,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['metrics'] });
        }
    });

    const health = healthQuery.data;
    const dbHealth = dbHealthQuery.data;
    const isLoading = healthQuery.isLoading || dbHealthQuery.isLoading;

    const status = health?.status as string | undefined;
    const dbStatus = dbHealth?.status as string | undefined;

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.analyticsDebug">
            <div className="space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">
                        {t('admin-pages.analytics.debug.title')}
                    </h2>
                    <p className="text-muted-foreground">
                        {t('admin-pages.analytics.debug.subtitle')}
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin-pages.analytics.debug.healthChecks')}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">
                                    {t('admin-pages.analytics.debug.apiStatus')}
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    {isLoading
                                        ? t('admin-pages.analytics.debug.checking')
                                        : ((health?.version as string) ?? 'N/A')}
                                </p>
                            </div>
                            <Badge variant={status === 'healthy' ? 'default' : 'destructive'}>
                                {isLoading ? '...' : (status ?? 'unknown')}
                            </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">
                                    {t('admin-pages.analytics.debug.dbStatus')}
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-pages.analytics.debug.dbConnectionPool')}
                                </p>
                            </div>
                            <Badge variant={dbStatus === 'healthy' ? 'default' : 'destructive'}>
                                {isLoading ? '...' : (dbStatus ?? 'unknown')}
                            </Badge>
                        </div>

                        {health?.uptime !== undefined && (
                            <div className="border-t pt-4">
                                <p className="text-sm">
                                    <span className="font-medium">
                                        {t('admin-pages.analytics.debug.uptime')}
                                    </span>{' '}
                                    {Math.floor((health.uptime as number) / 1000)}s
                                </p>
                                <p className="text-sm">
                                    <span className="font-medium">
                                        {t('admin-pages.analytics.debug.environment')}
                                    </span>{' '}
                                    {health.environment as string}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin-pages.analytics.debug.systemInfo')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {t('admin-pages.analytics.debug.nodeVersion')}
                                </span>
                                <span className="font-mono">{process.version}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {t('admin-pages.analytics.debug.platform')}
                                </span>
                                <span className="font-mono">{navigator.platform}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    {t('admin-pages.analytics.debug.userAgent')}
                                </span>
                                <span className="max-w-xs truncate font-mono text-xs">
                                    {navigator.userAgent.split(' ').slice(0, 2).join(' ')}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin-pages.analytics.debug.cacheManagement')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <p className="text-muted-foreground text-sm">
                                {t('admin-pages.analytics.debug.cacheClearDesc')}
                            </p>
                            <Button
                                onClick={() => resetMutation.mutate()}
                                disabled={resetMutation.isPending}
                                variant="outline"
                            >
                                {resetMutation.isPending
                                    ? t('admin-pages.analytics.debug.clearing')
                                    : t('admin-pages.analytics.debug.clearCache')}
                            </Button>
                            {resetMutation.isSuccess && (
                                <p className="text-green-600 text-sm dark:text-green-400">
                                    {t('admin-pages.analytics.debug.cacheCleared')}
                                </p>
                            )}
                            {resetMutation.isError && (
                                <p className="text-destructive text-sm">
                                    {t('admin-pages.analytics.debug.cacheClearError')}
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </SidebarPageLayout>
    );
}
