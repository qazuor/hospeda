import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { useTranslations } from '@/hooks/use-translations';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard')({
    component: Dashboard
});

function Dashboard() {
    const { t } = useTranslations();

    return (
        <SidebarPageLayout
            title={t('admin-dashboard.title')}
            actions={
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                        aria-label={t('admin-common.aria.refresh')}
                    >
                        {t('admin-dashboard.actions.refresh')}
                    </button>
                    <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-md bg-accent px-3 py-2 text-accent-foreground text-sm hover:brightness-95"
                        aria-label={t('admin-common.aria.create')}
                    >
                        {t('admin-dashboard.actions.create')}
                    </button>
                </div>
            }
        >
            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    title={t('admin-dashboard.kpis.visitors')}
                    value="8.2k"
                    trend="+12.4%"
                    gradient="from-sky-500 to-cyan-500"
                />
                <KpiCard
                    title={t('admin-dashboard.kpis.posts')}
                    value="324"
                    trend="+3.1%"
                    gradient="from-violet-500 to-fuchsia-500"
                />
                <KpiCard
                    title={t('admin-dashboard.kpis.accommodations')}
                    value="142"
                    trend="+1.8%"
                    gradient="from-emerald-500 to-lime-500"
                />
                <KpiCard
                    title={t('admin-dashboard.kpis.events')}
                    value="56"
                    trend="-0.9%"
                    gradient="from-amber-500 to-orange-500"
                />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Simple bars chart placeholder */}
                <div className="rounded-lg border p-4 lg:col-span-2">
                    <h2 className="mb-3 font-semibold text-sm">
                        {t('admin-dashboard.charts.traffic')}
                    </h2>
                    <div className="flex h-48 items-end justify-between gap-2">
                        {(
                            [
                                { label: t('admin-dashboard.charts.days.mon'), value: 30 },
                                { label: t('admin-dashboard.charts.days.tue'), value: 45 },
                                { label: t('admin-dashboard.charts.days.wed'), value: 60 },
                                { label: t('admin-dashboard.charts.days.thu'), value: 80 },
                                { label: t('admin-dashboard.charts.days.fri'), value: 55 },
                                { label: t('admin-dashboard.charts.days.sat'), value: 70 },
                                { label: t('admin-dashboard.charts.days.sun'), value: 95 }
                            ] as const
                        ).map(({ label, value }) => (
                            <div
                                key={label}
                                className="flex w-full flex-col items-center gap-2"
                            >
                                <div
                                    className="w-full rounded-t bg-gradient-to-t from-indigo-500 to-fuchsia-500"
                                    style={{ height: `${value}%` }}
                                />
                                <span className="text-muted-foreground text-xs">{label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent activity */}
                <div className="rounded-lg border p-4">
                    <h2 className="mb-3 font-semibold text-sm">
                        {t('admin-dashboard.activity.title')}
                    </h2>
                    <ul className="space-y-2">
                        {(
                            [
                                t('admin-dashboard.activity.items.newPost'),
                                t('admin-dashboard.activity.items.accommodationUpdated'),
                                t('admin-dashboard.activity.items.newReview'),
                                t('admin-dashboard.activity.items.eventCreated')
                            ] as const
                        ).map((text) => (
                            <li
                                key={text}
                                className="rounded-md border px-3 py-2 text-sm hover:bg-accent/40"
                            >
                                {text}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </SidebarPageLayout>
    );
}

type KpiCardProps = {
    readonly title: string;
    readonly value: string;
    readonly trend: string;
    readonly gradient: string; // e.g. "from-sky-500 to-cyan-500"
};

const KpiCard = ({ title, value, trend, gradient }: KpiCardProps) => (
    <div className="rounded-lg border p-4">
        <div className="mb-3 text-muted-foreground text-sm">{title}</div>
        <div className="flex items-end justify-between">
            <div className="font-semibold text-3xl">{value}</div>
            <div className={`rounded-md bg-gradient-to-r ${gradient} px-2 py-1 text-white text-xs`}>
                {trend}
            </div>
        </div>
    </div>
);
