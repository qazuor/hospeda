/**
 * Dashboard page - Lazy loaded component
 *
 * This file contains the heavy UI components that are loaded on demand.
 * The route configuration is in dashboard.tsx
 */
import { ComingSoon } from '@/components/feedback/ComingSoon';
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { DashboardSkeleton } from '@/components/loading';
import { useDashboardStats } from '@/features/dashboard/hooks/useDashboardStats';
import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import {
    AccommodationIcon,
    ActivityIcon,
    BarChartIcon,
    DestinationIcon,
    EventIcon,
    PostIcon,
    RefreshIcon
} from '@repo/icons';
import { useQueryClient } from '@tanstack/react-query';
import { Link, createLazyFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';

export const Route = createLazyFileRoute('/_authed/dashboard')({
    component: Dashboard,
    pendingComponent: DashboardSkeleton
});

function Dashboard() {
    const { t } = useTranslations();
    const { entities, isLoading } = useDashboardStats();
    const queryClient = useQueryClient();

    const kpiConfig: readonly KpiConfig[] = [
        {
            key: 'accommodations',
            titleKey: 'admin-dashboard.kpis.accommodations' as TranslationKey,
            icon: <AccommodationIcon className="h-5 w-5" />,
            href: '/accommodations'
        },
        {
            key: 'destinations',
            titleKey: 'admin-dashboard.kpis.destinations' as TranslationKey,
            icon: <DestinationIcon className="h-5 w-5" />,
            href: '/destinations'
        },
        {
            key: 'events',
            titleKey: 'admin-dashboard.kpis.events' as TranslationKey,
            icon: <EventIcon className="h-5 w-5" />,
            href: '/events'
        },
        {
            key: 'posts',
            titleKey: 'admin-dashboard.kpis.posts' as TranslationKey,
            icon: <PostIcon className="h-5 w-5" />,
            href: '/posts'
        }
    ];

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    return (
        <SidebarPageLayout
            title={t('admin-dashboard.title')}
            actions={
                <button
                    type="button"
                    onClick={handleRefresh}
                    className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                    aria-label={t('admin-common.aria.refresh')}
                >
                    <RefreshIcon className="h-4 w-4" />
                    {t('admin-dashboard.actions.refresh')}
                </button>
            }
        >
            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {kpiConfig.map((kpi) => {
                    const entity = entities.find((e) => e.name === kpi.key);
                    return (
                        <KpiCard
                            key={kpi.key}
                            title={t(kpi.titleKey)}
                            value={entity?.isLoading ? '...' : String(entity?.count ?? 0)}
                            icon={kpi.icon}
                            href={kpi.href}
                            loading={entity?.isLoading ?? isLoading}
                        />
                    );
                })}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Traffic chart - Coming Soon */}
                <div className="lg:col-span-2">
                    <ComingSoon
                        title={t('admin-dashboard.charts.traffic')}
                        description={t('admin-dashboard.comingSoon.analytics' as TranslationKey)}
                        icon={<BarChartIcon className="h-8 w-8" />}
                        className="h-full min-h-[200px]"
                    />
                </div>

                {/* Recent activity - Coming Soon */}
                <ComingSoon
                    title={t('admin-dashboard.activity.title')}
                    description={t('admin-dashboard.comingSoon.auditLog' as TranslationKey)}
                    icon={<ActivityIcon className="h-8 w-8" />}
                    className="min-h-[200px]"
                />
            </div>

            {/* Additional stats row */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {entities
                    .filter((e) => !kpiConfig.some((k) => k.key === e.name))
                    .map((entity) => (
                        <div
                            key={entity.name}
                            className="rounded-lg border p-4"
                        >
                            <p className="text-muted-foreground text-sm capitalize">
                                {entity.name}
                            </p>
                            <p className="font-semibold text-2xl">
                                {entity.isLoading ? '...' : entity.count}
                            </p>
                        </div>
                    ))}
            </div>
        </SidebarPageLayout>
    );
}

type KpiConfig = {
    readonly key: string;
    readonly titleKey: TranslationKey;
    readonly icon: ReactNode;
    readonly href: string;
};

type KpiCardProps = {
    readonly title: string;
    readonly value: string;
    readonly icon: ReactNode;
    readonly href: string;
    readonly loading?: boolean;
};

const KpiCard = ({ title, value, icon, href, loading }: KpiCardProps) => (
    <Link
        to={href}
        className="group rounded-lg border p-4 transition-colors hover:bg-accent/50"
    >
        <div className="mb-3 flex items-center gap-2">
            <div className="rounded-md bg-primary/10 p-1.5 text-primary">{icon}</div>
            <span className="text-muted-foreground text-sm">{title}</span>
        </div>
        <div className="flex items-end justify-between">
            {loading ? (
                <div className="h-9 w-20 animate-pulse rounded bg-muted" />
            ) : (
                <div className="font-semibold text-3xl">{value}</div>
            )}
        </div>
    </Link>
);
