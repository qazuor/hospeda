/**
 * User Activity Tab Route
 *
 * Displays activity history and metadata for a specific user.
 * Shows user creation/update timestamps and placeholder for activity logs.
 */

import { PageTabs, userTabs } from '@/components/layout/PageTabs';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useUserQuery } from '@/features/users/hooks/useUserQuery';
import { useTranslations } from '@/hooks/use-translations';
import { formatLongDate } from '@/lib/format-helpers';
import type { TranslationKey } from '@repo/i18n';
import { ActivityIcon, AlertCircleIcon, CalendarIcon, ClockIcon, LoaderIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/access/users/$id_/activity')({
    component: UserActivityPage
});

/**
 * Calculate localized time since date
 * @param date - The date to calculate from
 * @param t - Translation function from useTranslations
 */
function getTimeSince({
    date,
    t
}: {
    readonly date: string | Date | null | undefined;
    readonly t: (key: TranslationKey, params?: Record<string, unknown>) => string;
}): string {
    if (!date) return t('admin-common.relativeTime.notAvailable');

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 1) {
        return t('admin-common.relativeTime.days', { n: diffDays });
    }
    if (diffDays === 1) {
        return t('admin-common.relativeTime.oneDay');
    }
    if (diffHours > 0) {
        return t('admin-common.relativeTime.hours', { n: diffHours });
    }
    if (diffMinutes > 0) {
        return t('admin-common.relativeTime.minutes', { n: diffMinutes });
    }
    return t('admin-common.relativeTime.justNow');
}

function UserActivityPage() {
    const { t, locale } = useTranslations();
    const { id } = Route.useParams();

    // Fetch user data
    const { data: user, isLoading, error } = useUserQuery(id);

    if (isLoading) {
        return (
            <SidebarPageLayout titleKey="admin-pages.titles.usersView">
                <div className="space-y-4">
                    <PageTabs
                        tabs={userTabs}
                        basePath={`/access/users/${id}`}
                    />
                    <div className="flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-3">
                            <LoaderIcon className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-muted-foreground text-sm">
                                {t('admin-pages.access.users.loadingData')}
                            </p>
                        </div>
                    </div>
                </div>
            </SidebarPageLayout>
        );
    }

    if (error || !user) {
        return (
            <SidebarPageLayout titleKey="admin-pages.titles.usersView">
                <div className="space-y-4">
                    <PageTabs
                        tabs={userTabs}
                        basePath={`/access/users/${id}`}
                    />
                    <div className="flex items-center justify-center py-12">
                        <div className="flex flex-col items-center gap-3 text-center">
                            <AlertCircleIcon className="h-12 w-12 text-destructive" />
                            <div>
                                <p className="font-semibold">
                                    {t('admin-pages.access.users.errorLoading')}
                                </p>
                                <p className="text-muted-foreground text-sm">
                                    {error?.message || t('admin-pages.access.users.userNotFound')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </SidebarPageLayout>
        );
    }

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.usersView">
            <div className="space-y-4">
                <PageTabs
                    tabs={userTabs}
                    basePath={`/access/users/${id}`}
                />

                <div className="space-y-6">
                    {/* User metadata */}
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Account created */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 dark:bg-green-400/10">
                                        <CalendarIcon className="h-5 w-5 text-green-500 dark:text-green-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">
                                            {t('admin-pages.access.users.activity.accountCreated')}
                                        </CardTitle>
                                        <p className="text-muted-foreground text-sm">
                                            {t(
                                                'admin-pages.access.users.activity.accountCreatedDesc'
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <p className="font-medium">
                                        {formatLongDate({
                                            date: user.createdAt as
                                                | string
                                                | Date
                                                | null
                                                | undefined,
                                            locale
                                        })}
                                    </p>
                                    <Badge
                                        variant="secondary"
                                        className="text-xs"
                                    >
                                        {getTimeSince({
                                            date: user.createdAt as
                                                | string
                                                | Date
                                                | null
                                                | undefined,
                                            t
                                        })}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Last updated */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 dark:bg-blue-400/10">
                                        <ClockIcon className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-lg">
                                            {t('admin-pages.access.users.activity.lastUpdated')}
                                        </CardTitle>
                                        <p className="text-muted-foreground text-sm">
                                            {t('admin-pages.access.users.activity.lastUpdatedDesc')}
                                        </p>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <p className="font-medium">
                                        {formatLongDate({
                                            date: user.updatedAt as
                                                | string
                                                | Date
                                                | null
                                                | undefined,
                                            locale
                                        })}
                                    </p>
                                    <Badge
                                        variant="secondary"
                                        className="text-xs"
                                    >
                                        {getTimeSince({
                                            date: user.updatedAt as
                                                | string
                                                | Date
                                                | null
                                                | undefined,
                                            t
                                        })}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Activity log (placeholder) */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 dark:bg-purple-400/10">
                                    <ActivityIcon className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">
                                        {t('admin-pages.access.users.activity.activityHistory')}
                                    </CardTitle>
                                    <p className="text-muted-foreground text-sm">
                                        {t('admin-pages.access.users.activity.activityHistoryDesc')}
                                    </p>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <ActivityIcon className="mb-4 h-16 w-16 text-muted-foreground opacity-50" />
                                <p className="mb-2 font-medium text-muted-foreground">
                                    {t('admin-pages.access.users.activity.noActivity')}
                                </p>
                                <p className="max-w-md text-muted-foreground text-sm">
                                    {t('admin-pages.access.users.activity.noActivityDesc')}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Future features info */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950">
                        <p className="text-blue-900 text-sm dark:text-blue-100">
                            <strong>{t('admin-pages.access.users.activity.comingSoon')}</strong>{' '}
                            {t('admin-pages.access.users.activity.comingSoonDesc')}
                        </p>
                    </div>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
