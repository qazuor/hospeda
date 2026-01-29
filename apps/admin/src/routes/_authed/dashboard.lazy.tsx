/**
 * Dashboard page - Lazy loaded component
 *
 * This file contains the heavy UI components that are loaded on demand.
 * The route configuration is in dashboard.tsx
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { DashboardSkeleton } from '@/components/loading';
import { useDashboardStats } from '@/features/dashboard/hooks/useDashboardStats';
import { useTranslations } from '@/hooks/use-translations';
import { useQueryClient } from '@tanstack/react-query';
import { createLazyFileRoute } from '@tanstack/react-router';

export const Route = createLazyFileRoute('/_authed/dashboard')({
    component: Dashboard,
    pendingComponent: DashboardSkeleton
});

function Dashboard() {
    const { t } = useTranslations();
    const { entities, isLoading } = useDashboardStats();
    const queryClient = useQueryClient();

    // Map entity names to KPI config
    const kpiConfig = [
        {
            key: 'accommodations',
            titleKey: 'admin-dashboard.kpis.accommodations' as const,
            gradient: 'from-emerald-500 to-lime-500'
        },
        {
            key: 'destinations',
            titleKey: 'admin-dashboard.kpis.destinations' as const,
            gradient: 'from-sky-500 to-cyan-500'
        },
        {
            key: 'events',
            titleKey: 'admin-dashboard.kpis.events' as const,
            gradient: 'from-amber-500 to-orange-500'
        },
        {
            key: 'posts',
            titleKey: 'admin-dashboard.kpis.posts' as const,
            gradient: 'from-violet-500 to-fuchsia-500'
        }
    ];

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    return (
        <SidebarPageLayout
            title={t('admin-dashboard.title')}
            actions={
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                        aria-label={t('admin-common.aria.refresh')}
                    >
                        {t('admin-dashboard.actions.refresh')}
                    </button>
                </div>
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
                            gradient={kpi.gradient}
                            loading={entity?.isLoading ?? isLoading}
                        />
                    );
                })}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Traffic chart placeholder */}
                <div className="rounded-lg border p-4 lg:col-span-2">
                    <h2 className="mb-3 font-semibold text-sm">
                        {t('admin-dashboard.charts.traffic')}
                    </h2>
                    <div className="flex h-48 items-center justify-center">
                        <p className="text-muted-foreground text-sm">
                            Connect analytics provider to view traffic data
                        </p>
                    </div>
                </div>

                {/* Recent activity */}
                <div className="rounded-lg border p-4">
                    <h2 className="mb-3 font-semibold text-sm">
                        {t('admin-dashboard.activity.title')}
                    </h2>
                    <div className="flex h-48 items-center justify-center">
                        <p className="text-center text-muted-foreground text-sm">
                            Activity feed will be available once the audit log system is implemented
                        </p>
                    </div>
                </div>
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

type KpiCardProps = {
    readonly title: string;
    readonly value: string;
    readonly gradient: string;
    readonly loading?: boolean;
};

const KpiCard = ({ title, value, gradient, loading }: KpiCardProps) => (
    <div className="rounded-lg border p-4">
        <div className="mb-3 text-muted-foreground text-sm">{title}</div>
        <div className="flex items-end justify-between">
            {loading ? (
                <div className="h-9 w-20 animate-pulse rounded bg-muted" />
            ) : (
                <div className="font-semibold text-3xl">{value}</div>
            )}
            <div className={`rounded-md bg-gradient-to-r ${gradient} px-2 py-1 text-white text-xs`}>
                Live
            </div>
        </div>
    </div>
);
