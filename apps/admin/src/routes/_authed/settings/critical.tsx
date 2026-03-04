import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from '@/hooks/use-translations';
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
    const { t } = useTranslations();
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
                    <h2 className="mb-2 font-bold text-2xl">
                        {t('admin-pages.systemSettings.critical.title')}
                    </h2>
                    <p className="text-muted-foreground">
                        {t('admin-pages.systemSettings.critical.subtitle')}
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            {t('admin-pages.systemSettings.critical.maintenanceMode')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">
                                    {t('admin-pages.systemSettings.critical.maintenanceModeStatus')}
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-pages.systemSettings.critical.maintenanceModeDesc')}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge variant={maintenanceMode ? 'destructive' : 'default'}>
                                    {maintenanceMode
                                        ? t('admin-pages.systemSettings.critical.enabled')
                                        : t('admin-pages.systemSettings.critical.disabled')}
                                </Badge>
                                <Button
                                    onClick={toggleMaintenance}
                                    variant="outline"
                                    size="sm"
                                >
                                    {maintenanceMode
                                        ? t('admin-pages.systemSettings.critical.disable')
                                        : t('admin-pages.systemSettings.critical.enable')}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            {t('admin-pages.systemSettings.critical.globalAnnouncements')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <p className="text-muted-foreground text-sm">
                                {t('admin-pages.systemSettings.critical.globalAnnouncementsDesc')}
                            </p>
                            {announcement ? (
                                <div className="rounded-md bg-muted p-4">
                                    <p className="text-sm">{announcement}</p>
                                </div>
                            ) : (
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-pages.systemSettings.critical.noAnnouncements')}
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            {t('admin-pages.systemSettings.critical.cacheManagement')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <p className="text-muted-foreground text-sm">
                                {t('admin-pages.systemSettings.critical.cacheManagementDesc')}
                            </p>
                            <Button
                                onClick={() => resetCacheMutation.mutate()}
                                disabled={resetCacheMutation.isPending}
                                variant="outline"
                            >
                                {resetCacheMutation.isPending
                                    ? t('admin-pages.systemSettings.critical.clearing')
                                    : t('admin-pages.systemSettings.critical.clearCache')}
                            </Button>
                            {resetCacheMutation.isSuccess && (
                                <p className="text-green-600 text-sm dark:text-green-400">
                                    {t('admin-pages.systemSettings.critical.cacheCleared')}
                                </p>
                            )}
                            {resetCacheMutation.isError && (
                                <p className="text-destructive text-sm">
                                    {t('admin-pages.systemSettings.critical.cacheClearError')}
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {isDev && (
                    <Card className="border-destructive">
                        <CardHeader>
                            <CardTitle className="text-destructive">
                                {t('admin-pages.systemSettings.critical.dangerZone')}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <p className="text-muted-foreground text-sm">
                                    {t('admin-pages.systemSettings.critical.dangerZoneDesc')}
                                </p>
                                <p className="font-medium text-sm">
                                    {t('admin-pages.systemSettings.critical.dangerZoneDevOnly')}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </SidebarPageLayout>
    );
}
