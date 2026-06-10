import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    legacyAdapters,
    usePlatformSetting,
    useUpdatePlatformSetting
} from '@/hooks/use-platform-setting';
import { useTranslations } from '@/hooks/use-translations';
import { fetchApi } from '@/lib/api/client';
import type { AuthState } from '@/lib/auth-session';
import { type AnnouncementsValue, type MaintenanceModeValue, PermissionEnum } from '@repo/schemas';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/platform/critical/')({
    beforeLoad: ({ context }) => {
        // TYPE-WORKAROUND: TanStack Router types `beforeLoad` context as a generic
        // `Record<string, unknown>`; the `_authed` layout injects `AuthState` at runtime
        // but the type system doesn't propagate it to child route guards automatically.
        const authState = context as unknown as AuthState;
        const canView = authState.permissions?.includes(PermissionEnum.SYSTEM_MAINTENANCE_MODE);
        if (!canView) {
            throw redirect({ to: '/auth/forbidden' });
        }
    },
    component: CriticalSettingsPage
});

const DEFAULT_MAINTENANCE: MaintenanceModeValue = { enabled: false };

async function resetMetrics(): Promise<void> {
    await fetchApi({ path: '/api/v1/admin/metrics/reset', method: 'POST' });
}

/**
 * Pick the active announcement to preview at the top of the critical page.
 * "Active" = the first item whose `[startsAt, endsAt]` window contains `now`
 * (open-ended bounds count as active). The full editor lives elsewhere; this
 * page only previews the operator-facing copy in the default locale (`es`).
 */
function pickActiveAnnouncement(items: AnnouncementsValue, now: Date): string | null {
    for (const item of items) {
        const starts = item.startsAt ? new Date(item.startsAt) : null;
        const ends = item.endsAt ? new Date(item.endsAt) : null;
        if (starts && starts > now) continue;
        if (ends && ends < now) continue;
        return item.text.es;
    }
    return null;
}

function CriticalSettingsPage() {
    const { t } = useTranslations();
    const isDev = import.meta.env.MODE === 'development';

    // Maintenance mode — read+write through the platform_settings API. The
    // page is SUPER_ADMIN-gated at the route level (beforeLoad checks
    // SYSTEM_MAINTENANCE_MODE) and also via sidebar onMissing: 'hide' for
    // the link, so the server only needs to enforce the write permission.
    const maintenanceQuery = usePlatformSetting({
        key: 'maintenance.mode',
        legacyAdapter: legacyAdapters.maintenanceMode
    });
    const maintenanceMutation = useUpdatePlatformSetting({
        key: 'maintenance.mode',
        legacyAdapter: legacyAdapters.maintenanceMode
    });

    // Global announcements — read-only preview here; the editor lands in PR-4.
    const announcementsQuery = usePlatformSetting({ key: 'announcements.global' });

    const maintenanceValue: MaintenanceModeValue =
        maintenanceQuery.data?.row?.value ??
        maintenanceQuery.data?.legacyValue ??
        DEFAULT_MAINTENANCE;

    const announcementsValue: AnnouncementsValue = announcementsQuery.data?.row?.value ?? [];

    const activeAnnouncement = pickActiveAnnouncement(announcementsValue, new Date());

    const toggleMaintenance = (): void => {
        const next: MaintenanceModeValue = { enabled: !maintenanceValue.enabled };
        maintenanceMutation.mutate(next);
    };

    const resetCacheMutation = useMutation({ mutationFn: resetMetrics });

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
                                <Badge
                                    variant={maintenanceValue.enabled ? 'destructive' : 'default'}
                                >
                                    {maintenanceValue.enabled
                                        ? t('admin-pages.systemSettings.critical.enabled')
                                        : t('admin-pages.systemSettings.critical.disabled')}
                                </Badge>
                                <Button
                                    onClick={toggleMaintenance}
                                    variant="outline"
                                    size="sm"
                                    disabled={
                                        maintenanceQuery.isLoading || maintenanceMutation.isPending
                                    }
                                >
                                    {maintenanceValue.enabled
                                        ? t('admin-pages.systemSettings.critical.disable')
                                        : t('admin-pages.systemSettings.critical.enable')}
                                </Button>
                            </div>
                        </div>
                        {maintenanceMutation.isError && (
                            <p className="text-destructive text-xs">
                                {maintenanceMutation.error instanceof Error
                                    ? maintenanceMutation.error.message
                                    : String(maintenanceMutation.error)}
                            </p>
                        )}
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
                            {activeAnnouncement ? (
                                <div className="rounded-md bg-muted p-4">
                                    <p className="text-sm">{activeAnnouncement}</p>
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
                                <p className="text-sm text-success">
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

export { pickActiveAnnouncement };
