import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/dashboard')({
    component: Dashboard
});

function Dashboard() {
    return (
        <SidebarPageLayout
            title="Dashboard"
            actions={
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                        aria-label="Refresh"
                    >
                        Refresh
                    </button>
                    <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-md bg-accent px-3 py-2 text-accent-foreground text-sm hover:brightness-95"
                        aria-label="Create"
                    >
                        Create
                    </button>
                </div>
            }
        >
            {/* KPI Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                    title="Visitors"
                    value="8.2k"
                    trend="+12.4%"
                    gradient="from-sky-500 to-cyan-500"
                />
                <KpiCard
                    title="Posts"
                    value="324"
                    trend="+3.1%"
                    gradient="from-violet-500 to-fuchsia-500"
                />
                <KpiCard
                    title="Accommodations"
                    value="142"
                    trend="+1.8%"
                    gradient="from-emerald-500 to-lime-500"
                />
                <KpiCard
                    title="Events"
                    value="56"
                    trend="-0.9%"
                    gradient="from-amber-500 to-orange-500"
                />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Simple bars chart placeholder */}
                <div className="rounded-lg border p-4 lg:col-span-2">
                    <h2 className="mb-3 font-semibold text-sm">Traffic (last 7 days)</h2>
                    <div className="flex h-48 items-end justify-between gap-2">
                        {(
                            [
                                { label: 'Mon', value: 30 },
                                { label: 'Tue', value: 45 },
                                { label: 'Wed', value: 60 },
                                { label: 'Thu', value: 80 },
                                { label: 'Fri', value: 55 },
                                { label: 'Sat', value: 70 },
                                { label: 'Sun', value: 95 }
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
                    <h2 className="mb-3 font-semibold text-sm">Recent activity</h2>
                    <ul className="space-y-2">
                        {(
                            [
                                'New post published: Summer in Patagonia',
                                'Accommodation updated: Mountain View Cabin',
                                'New review on: City Loft Apartment',
                                'Event created: Jazz Night at The Bay'
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
