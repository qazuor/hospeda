import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/analytics/debug')({
    component: AnalyticsDebugPage
});

const API_BASE = '/api/v1';

async function fetchHealth(): Promise<Record<string, unknown>> {
    const response = await fetch(`${API_BASE}/health`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch health');
    const json = await response.json();
    return json.data ?? json;
}

async function fetchDbHealth(): Promise<Record<string, unknown>> {
    const response = await fetch(`${API_BASE}/health/db`, { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to fetch DB health');
    const json = await response.json();
    return json.data ?? json;
}

async function resetMetrics(): Promise<void> {
    const response = await fetch(`${API_BASE}/metrics/reset`, {
        method: 'POST',
        credentials: 'include'
    });
    if (!response.ok) throw new Error('Failed to reset metrics');
}

function AnalyticsDebugPage() {
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
                    <h2 className="mb-2 font-bold text-2xl">System Debug</h2>
                    <p className="text-muted-foreground">Health checks and system diagnostics</p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Health Checks</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">API Status</p>
                                <p className="text-muted-foreground text-sm">
                                    {isLoading
                                        ? 'Checking...'
                                        : ((health?.version as string) ?? 'N/A')}
                                </p>
                            </div>
                            <Badge variant={status === 'healthy' ? 'default' : 'destructive'}>
                                {isLoading ? '...' : (status ?? 'unknown')}
                            </Badge>
                        </div>

                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Database Status</p>
                                <p className="text-muted-foreground text-sm">Connection pool</p>
                            </div>
                            <Badge variant={dbStatus === 'healthy' ? 'default' : 'destructive'}>
                                {isLoading ? '...' : (dbStatus ?? 'unknown')}
                            </Badge>
                        </div>

                        {health?.uptime !== undefined && (
                            <div className="border-t pt-4">
                                <p className="text-sm">
                                    <span className="font-medium">Uptime:</span>{' '}
                                    {Math.floor((health.uptime as number) / 1000)}s
                                </p>
                                <p className="text-sm">
                                    <span className="font-medium">Environment:</span>{' '}
                                    {health.environment as string}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>System Info</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Node Version</span>
                                <span className="font-mono">{process.version}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Platform</span>
                                <span className="font-mono">{navigator.platform}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">User Agent</span>
                                <span className="max-w-xs truncate font-mono text-xs">
                                    {navigator.userAgent.split(' ').slice(0, 2).join(' ')}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Cache Management</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <p className="text-muted-foreground text-sm">
                                Clear API metrics cache (development only)
                            </p>
                            <Button
                                onClick={() => resetMutation.mutate()}
                                disabled={resetMutation.isPending}
                                variant="outline"
                            >
                                {resetMutation.isPending ? 'Clearing...' : 'Clear Cache'}
                            </Button>
                            {resetMutation.isSuccess && (
                                <p className="text-green-600 text-sm">Cache cleared successfully</p>
                            )}
                            {resetMutation.isError && (
                                <p className="text-destructive text-sm">Failed to clear cache</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </SidebarPageLayout>
    );
}
