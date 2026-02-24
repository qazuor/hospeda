import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchApi } from '@/lib/api/client';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';

export const Route = createFileRoute('/_authed/settings/critical')({
    component: CriticalSettingsPage
});

const MAINTENANCE_KEY = 'hospeda-admin-maintenance-mode';
const ANNOUNCEMENT_KEY = 'hospeda-admin-global-announcement';

async function resetMetrics(): Promise<void> {
    await fetchApi({ path: '/api/v1/admin/metrics/reset', method: 'POST' });
}

function CriticalSettingsPage() {
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [announcement, setAnnouncement] = useState('');
    const isDev = import.meta.env.MODE === 'development';

    useEffect(() => {
        try {
            const stored = localStorage.getItem(MAINTENANCE_KEY);
            if (stored) setMaintenanceMode(JSON.parse(stored));

            const storedAnnouncement = localStorage.getItem(ANNOUNCEMENT_KEY);
            if (storedAnnouncement) setAnnouncement(storedAnnouncement);
        } catch {
            // Silently fail if localStorage is not available
        }
    }, []);

    const toggleMaintenance = useCallback(() => {
        const newValue = !maintenanceMode;
        setMaintenanceMode(newValue);
        try {
            localStorage.setItem(MAINTENANCE_KEY, JSON.stringify(newValue));
        } catch {
            // Silently fail
        }
    }, [maintenanceMode]);

    const resetCacheMutation = useMutation({
        mutationFn: resetMetrics
    });

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.settingsCritical">
            <div className="max-w-3xl space-y-6">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">Critical Settings</h2>
                    <p className="text-muted-foreground">
                        Manage system-wide critical configuration
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Maintenance Mode</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">Maintenance Mode Status</p>
                                <p className="text-muted-foreground text-sm">
                                    When enabled, visitors see a maintenance page
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant={maintenanceMode ? 'destructive' : 'default'}>
                                    {maintenanceMode ? 'Enabled' : 'Disabled'}
                                </Badge>
                                <Button
                                    onClick={toggleMaintenance}
                                    variant="outline"
                                    size="sm"
                                >
                                    {maintenanceMode ? 'Disable' : 'Enable'}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Global Announcements</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <p className="text-muted-foreground text-sm">
                                Display site-wide announcements to all users
                            </p>
                            {announcement ? (
                                <div className="rounded-md bg-muted p-4">
                                    <p className="text-sm">{announcement}</p>
                                </div>
                            ) : (
                                <p className="text-muted-foreground text-sm">
                                    No active announcements
                                </p>
                            )}
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
                                onClick={() => resetCacheMutation.mutate()}
                                disabled={resetCacheMutation.isPending}
                                variant="outline"
                            >
                                {resetCacheMutation.isPending ? 'Clearing...' : 'Clear Cache'}
                            </Button>
                            {resetCacheMutation.isSuccess && (
                                <p className="text-green-600 text-sm">Cache cleared successfully</p>
                            )}
                            {resetCacheMutation.isError && (
                                <p className="text-destructive text-sm">Failed to clear cache</p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {isDev && (
                    <Card className="border-destructive">
                        <CardHeader>
                            <CardTitle className="text-destructive">Danger Zone</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <p className="text-muted-foreground text-sm">
                                    Database reset and other dangerous operations
                                </p>
                                <p className="font-medium text-sm">
                                    Only available in development environment
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </SidebarPageLayout>
    );
}
