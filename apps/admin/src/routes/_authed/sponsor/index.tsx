/**
 * Sponsor Dashboard Overview
 *
 * Main dashboard for sponsors to view their sponsorships and analytics
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSponsorSummaryQuery } from '@/features/sponsor-dashboard/hooks';
import { useTranslations } from '@/hooks/use-translations';
import { formatCurrency, formatNumber } from '@repo/i18n';
import {
    ActivityIcon,
    BarChartIcon,
    MousePointerClickIcon,
    PackageIcon,
    TrendingUpIcon
} from '@repo/icons';
import { Link, createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/sponsor/')({
    component: SponsorDashboardPage
});

function SponsorDashboardPage() {
    const { t, locale } = useTranslations();
    const { data: summary, isLoading, error } = useSponsorSummaryQuery();

    if (error) {
        return (
            <SidebarPageLayout>
                <Card>
                    <CardContent className="py-8">
                        <div className="text-center">
                            <p className="text-muted-foreground">
                                {t('admin-pages.sponsor.dashboard.loadError')}
                            </p>
                            <p className="mt-2 text-destructive text-sm">{error.message}</p>
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
                    <h2 className="mb-2 font-bold text-2xl">
                        {t('admin-pages.sponsor.dashboard.title')}
                    </h2>
                    <p className="text-muted-foreground">
                        {t('admin-pages.sponsor.dashboard.subtitle')}
                    </p>
                </div>

                {/* Summary cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <SummaryCard
                        title={t('admin-pages.sponsor.dashboard.activeSponsorships')}
                        value={summary?.activeSponsorships || 0}
                        icon={<PackageIcon className="size-4 text-muted-foreground" />}
                        loading={isLoading}
                    />
                    <SummaryCard
                        title={t('admin-pages.sponsor.dashboard.totalImpressions')}
                        value={formatNumber({
                            value: summary?.totalImpressions || 0,
                            locale
                        })}
                        icon={<ActivityIcon className="size-4 text-muted-foreground" />}
                        loading={isLoading}
                    />
                    <SummaryCard
                        title={t('admin-pages.sponsor.dashboard.totalClicks')}
                        value={formatNumber({ value: summary?.totalClicks || 0, locale })}
                        icon={<MousePointerClickIcon className="size-4 text-muted-foreground" />}
                        loading={isLoading}
                    />
                    <SummaryCard
                        title={t('admin-pages.sponsor.dashboard.investment')}
                        value={formatCurrency({
                            value: summary?.revenue || 0,
                            locale,
                            currency: 'ARS'
                        })}
                        icon={<TrendingUpIcon className="size-4 text-muted-foreground" />}
                        loading={isLoading}
                    />
                </div>

                {/* Quick actions */}
                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin-pages.sponsor.dashboard.quickActions')}</CardTitle>
                        <CardDescription>
                            {t('admin-pages.sponsor.dashboard.quickActionsDesc')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-4 md:grid-cols-3">
                            <Link to="/sponsor/sponsorships">
                                <Button
                                    variant="outline"
                                    className="h-auto w-full flex-col items-start gap-2 p-4"
                                >
                                    <PackageIcon className="size-5" />
                                    <div className="text-left">
                                        <div className="font-semibold">
                                            {t('admin-pages.sponsor.dashboard.mySponsorships')}
                                        </div>
                                        <div className="text-muted-foreground text-xs">
                                            {t('admin-pages.sponsor.dashboard.mySponshorshipsDesc')}
                                        </div>
                                    </div>
                                </Button>
                            </Link>

                            <Link to="/sponsor/analytics">
                                <Button
                                    variant="outline"
                                    className="h-auto w-full flex-col items-start gap-2 p-4"
                                >
                                    <BarChartIcon className="size-5" />
                                    <div className="text-left">
                                        <div className="font-semibold">
                                            {t('admin-pages.sponsor.dashboard.analytics')}
                                        </div>
                                        <div className="text-muted-foreground text-xs">
                                            {t('admin-pages.sponsor.dashboard.analyticsDesc')}
                                        </div>
                                    </div>
                                </Button>
                            </Link>

                            <Link to="/sponsor/invoices">
                                <Button
                                    variant="outline"
                                    className="h-auto w-full flex-col items-start gap-2 p-4"
                                >
                                    <ActivityIcon className="size-5" />
                                    <div className="text-left">
                                        <div className="font-semibold">
                                            {t('admin-pages.sponsor.dashboard.invoices')}
                                        </div>
                                        <div className="text-muted-foreground text-xs">
                                            {t('admin-pages.sponsor.dashboard.invoicesDesc')}
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
                        <CardTitle>{t('admin-pages.sponsor.dashboard.recentActivity')}</CardTitle>
                        <CardDescription>
                            {t('admin-pages.sponsor.dashboard.recentActivityDesc')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="py-8 text-center">
                            <p className="text-muted-foreground text-sm">
                                {t('admin-pages.sponsor.dashboard.noRecentActivity')}
                            </p>
                            <p className="mt-2 text-muted-foreground text-xs">
                                {t('admin-pages.sponsor.dashboard.activityApiPending')}
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
