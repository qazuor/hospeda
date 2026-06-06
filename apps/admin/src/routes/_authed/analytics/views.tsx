/**
 * Analytics Views Page — `/analytics/views`
 *
 * Three independent sections, each with its own loading skeleton so none
 * blocks the others (AC-38):
 *
 * 1. Summary tiles — WindowToggle (7d / 30d, default 30d) above three KPI
 *    Cards (ACCOMMODATION / POST / EVENT) showing unique + total counts.
 * 2. Top-10 ranked tables (fixed 30d) — entity name resolved via individual
 *    admin GET calls (no batch-by-ids endpoint exists on the backend).
 *    Falls back to entityId when resolution fails (AC-35).
 * 3. 30-day daily time-series LineChart (recharts) — three lines, zero-filled
 *    by the API (AC-37).
 *
 * Permission guard: `requireAnalyticsViewAccess` (beforeLoad, same pattern as
 * billing routes using `requireBillingAccess`). Redirects to `/auth/forbidden`
 * when `ANALYTICS_VIEW` is absent (AC-32).
 *
 * @module analytics/views
 */

import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type TimeWindow, WindowToggle } from '@/components/views/WindowToggle';
import { useTranslations } from '@/hooks/use-translations';
import { fetchApi } from '@/lib/api/client';
import type { AuthState } from '@/lib/auth-session';
import { PermissionEnum } from '@repo/schemas';
import { useQueries, useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// ============================================================================
// PERMISSION GUARD
// ============================================================================

/**
 * Assert that the given route context includes `ANALYTICS_VIEW`.
 *
 * Throws a TanStack Router redirect to `/auth/forbidden` when the permission
 * is absent. Returns `void` when access is granted.
 *
 * @param context - Raw TanStack Router `beforeLoad` context object.
 * @throws {ReturnType<typeof redirect>} Redirects to `/auth/forbidden`.
 */
function requireAnalyticsViewAccess(context: unknown): void {
    // TYPE-WORKAROUND: same pattern used in @/lib/billing-access.ts
    const authState = context as unknown as AuthState;
    if (!authState.permissions?.includes(PermissionEnum.ANALYTICS_VIEW)) {
        throw redirect({ to: '/auth/forbidden' });
    }
}

// ============================================================================
// ROUTE
// ============================================================================

export const Route = createFileRoute('/_authed/analytics/views')({
    beforeLoad: ({ context }) => requireAnalyticsViewAccess(context),
    component: AnalyticsViewsPage
});

// ============================================================================
// API SHAPES
// ============================================================================

/** Single row from GET /admin/views/summary */
interface ViewsSummaryRow {
    readonly entityType: 'ACCOMMODATION' | 'POST' | 'EVENT';
    readonly unique: number;
    readonly total: number;
}

/** Single row from GET /admin/views/top */
interface ViewsTopRow {
    readonly entityId: string;
    readonly unique: number;
    readonly total: number;
}

/** Single row from GET /admin/views/daily-series */
interface ViewsDailyRow {
    readonly date: string;
    readonly entityType: 'ACCOMMODATION' | 'POST' | 'EVENT';
    readonly total: number;
}

/** Pivoted shape for recharts — one entry per calendar day */
interface ChartDay {
    readonly date: string;
    readonly ACCOMMODATION: number;
    readonly POST: number;
    readonly EVENT: number;
}

/** Name shape from admin accommodation/post/event getById */
interface EntityNameData {
    readonly name?: string;
    readonly title?: string;
}

// ============================================================================
// FETCH HELPERS
// ============================================================================

const STALE_5_MIN = 5 * 60 * 1000;

/**
 * Fetch the views summary for a given time window.
 *
 * @param window - `'7d'` or `'30d'`
 * @returns Array of {@link ViewsSummaryRow} (three entries).
 */
async function fetchViewsSummary(window: TimeWindow): Promise<readonly ViewsSummaryRow[]> {
    const result = await fetchApi<{ success: boolean; data: ViewsSummaryRow[] }>({
        path: `/api/v1/admin/views/summary?window=${window}`
    });
    return result.data.data ?? [];
}

/**
 * Fetch top-10 entity IDs for a given entity type (fixed 30d window).
 *
 * @param entityType - `'ACCOMMODATION'`, `'POST'`, or `'EVENT'`
 * @returns Array of {@link ViewsTopRow} ordered by total DESC.
 */
async function fetchViewsTop(
    entityType: 'ACCOMMODATION' | 'POST' | 'EVENT'
): Promise<readonly ViewsTopRow[]> {
    const result = await fetchApi<{ success: boolean; data: ViewsTopRow[] }>({
        path: `/api/v1/admin/views/top?entityType=${entityType}&window=30d&limit=10`
    });
    return result.data.data ?? [];
}

/**
 * Fetch the full 90-row daily series (3 entity types × 30 days).
 *
 * @returns Array of {@link ViewsDailyRow}.
 */
async function fetchViewsDailySeries(): Promise<readonly ViewsDailyRow[]> {
    const result = await fetchApi<{ success: boolean; data: ViewsDailyRow[] }>({
        path: '/api/v1/admin/views/daily-series'
    });
    return result.data.data ?? [];
}

/**
 * Resolve a display name for a single entity ID.
 *
 * Falls back to `null` when the endpoint returns no data or errors, so
 * callers can show the raw `entityId` instead (AC-35).
 *
 * @param entityType - `'ACCOMMODATION'`, `'POST'`, or `'EVENT'`
 * @param entityId   - UUID of the entity.
 * @returns The entity name/title, or `null` on failure.
 */
async function resolveEntityName(
    entityType: 'ACCOMMODATION' | 'POST' | 'EVENT',
    entityId: string
): Promise<string | null> {
    const segmentMap: Record<'ACCOMMODATION' | 'POST' | 'EVENT', string> = {
        ACCOMMODATION: 'accommodations',
        POST: 'posts',
        EVENT: 'events'
    };
    try {
        const result = await fetchApi<{ success: boolean; data?: EntityNameData | null }>({
            path: `/api/v1/admin/${segmentMap[entityType]}/${entityId}`
        });
        const entity = result.data.data;
        return entity?.name ?? entity?.title ?? null;
    } catch {
        return null;
    }
}

// ============================================================================
// PIVOT HELPER
// ============================================================================

/**
 * Pivot the flat 90-row daily series into one entry per date (30 entries).
 *
 * The API gap-fills all days with zero, so the pivot only needs to merge rows.
 *
 * @param rows - Raw rows from the daily-series endpoint.
 * @returns Array of {@link ChartDay} ordered by date ascending.
 */
function pivotDailySeries(rows: readonly ViewsDailyRow[]): ChartDay[] {
    const byDate = new Map<string, ChartDay>();

    for (const row of rows) {
        const existing = byDate.get(row.date) ?? {
            date: row.date,
            ACCOMMODATION: 0,
            POST: 0,
            EVENT: 0
        };
        byDate.set(row.date, { ...existing, [row.entityType]: row.total });
    }

    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Format a `'YYYY-MM-DD'` date string to `'DD/MM'` for the X-axis tick.
 *
 * @param dateStr - ISO date string.
 * @returns Abbreviated date label.
 */
function formatXAxisTick(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}`;
}

// ============================================================================
// SKELETON HELPER
// ============================================================================

/**
 * Generic loading skeleton for card grids.
 *
 * @param count - Number of skeleton blocks to render.
 */
function CardSkeleton({ count }: { readonly count: number }) {
    return (
        <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: count }, (_, i) => i).map((i) => (
                <div
                    key={`card-skeleton-${i}`}
                    className="h-28 animate-pulse rounded-lg bg-muted"
                />
            ))}
        </div>
    );
}

// ============================================================================
// SECTION 1 — SUMMARY TILES
// ============================================================================

/** Summary tiles section props. */
interface SummaryTilesSectionProps {
    readonly window: TimeWindow;
    readonly onWindowChange: (w: TimeWindow) => void;
}

/**
 * Renders three KPI tiles (ACCOMMODATION / POST / EVENT) driven by
 * `GET /admin/views/summary?window=<window>`.
 *
 * The WindowToggle is local to this section so it doesn't affect the other
 * sections.
 */
function SummaryTilesSection({ window, onWindowChange }: SummaryTilesSectionProps) {
    const { t } = useTranslations();

    const { data: rows, isLoading } = useQuery({
        queryKey: ['admin-views-summary', window] as const,
        queryFn: () => fetchViewsSummary(window),
        staleTime: STALE_5_MIN
    });

    const entityOrder: Array<'ACCOMMODATION' | 'POST' | 'EVENT'> = [
        'ACCOMMODATION',
        'POST',
        'EVENT'
    ];

    const labelMap: Record<'ACCOMMODATION' | 'POST' | 'EVENT', string> = {
        ACCOMMODATION: t('admin-pages.analytics.views.labelAccommodation'),
        POST: t('admin-pages.analytics.views.labelPost'),
        EVENT: t('admin-pages.analytics.views.labelEvent')
    };

    return (
        <section aria-labelledby="summary-section-heading">
            <div className="mb-4 flex items-center justify-between">
                <h3
                    id="summary-section-heading"
                    className="font-semibold text-lg"
                >
                    {t('admin-pages.analytics.views.summaryTitle')}
                </h3>
                <WindowToggle
                    value={window}
                    onChange={onWindowChange}
                    disabled={isLoading}
                />
            </div>

            {isLoading ? (
                <CardSkeleton count={3} />
            ) : (
                <div className="grid gap-4 md:grid-cols-3">
                    {entityOrder.map((entityType) => {
                        const row = rows?.find((r) => r.entityType === entityType);

                        return (
                            <Card key={entityType}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="font-medium text-sm">
                                        {labelMap[entityType]}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex gap-6">
                                        <div>
                                            <p className="text-muted-foreground text-xs">
                                                {t('admin-pages.analytics.views.labelUnique')}
                                            </p>
                                            <p className="font-bold text-2xl">{row?.unique ?? 0}</p>
                                        </div>
                                        <div>
                                            <p className="text-muted-foreground text-xs">
                                                {t('admin-pages.analytics.views.labelTotal')}
                                            </p>
                                            <p className="font-bold text-2xl">{row?.total ?? 0}</p>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

// ============================================================================
// SECTION 2 — TOP-10 RANKED TABLES
// ============================================================================

/**
 * Single entity-type top-10 table including async name resolution.
 *
 * Names are fetched individually via Promise.all once the top-ID list is
 * available (enabled: `!!topRows.length`). Falls back to entityId (AC-35).
 */
function TopEntityTable({
    entityType
}: {
    readonly entityType: 'ACCOMMODATION' | 'POST' | 'EVENT';
}) {
    const { t } = useTranslations();

    const { data: topRows, isLoading: isLoadingTop } = useQuery({
        // INVARIANT: top-10 table is fixed to 30d; key includes it defensively.
        queryKey: ['admin-views-top', entityType, '30d'] as const,
        queryFn: () => fetchViewsTop(entityType),
        staleTime: STALE_5_MIN
    });

    // Batch-resolve names after top IDs are known.
    const entityIds = topRows?.map((r) => r.entityId) ?? [];
    const nameQueries = useQueries({
        queries: entityIds.map((id) => ({
            queryKey: ['admin-entity-name', entityType, id] as const,
            queryFn: () => resolveEntityName(entityType, id),
            staleTime: STALE_5_MIN,
            enabled: entityIds.length > 0
        }))
    });

    const labelMap: Record<'ACCOMMODATION' | 'POST' | 'EVENT', string> = {
        ACCOMMODATION: t('admin-pages.analytics.views.labelAccommodation'),
        POST: t('admin-pages.analytics.views.labelPost'),
        EVENT: t('admin-pages.analytics.views.labelEvent')
    };

    if (isLoadingTop) {
        return (
            <div className="space-y-2">
                {Array.from({ length: 5 }, (_, i) => i).map((i) => (
                    <div
                        key={`row-skeleton-${i}`}
                        className="h-8 animate-pulse rounded bg-muted"
                    />
                ))}
            </div>
        );
    }

    if (!topRows || topRows.length === 0) {
        return (
            <p className="py-4 text-center text-muted-foreground text-sm">
                {t('admin-pages.analytics.views.empty')}
            </p>
        );
    }

    return (
        <div>
            <h4 className="mb-3 font-semibold text-sm">{labelMap[entityType]}</h4>
            <div className="overflow-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b text-left">
                            <th className="pr-3 pb-2 font-medium">
                                {t('admin-pages.analytics.views.colRank')}
                            </th>
                            <th className="pr-3 pb-2 font-medium">{labelMap[entityType]}</th>
                            <th className="pr-3 pb-2 font-medium">
                                {t('admin-pages.analytics.views.colUnique')}
                            </th>
                            <th className="pb-2 font-medium">
                                {t('admin-pages.analytics.views.colTotal')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {topRows.map((row, idx) => {
                            const nameQuery = nameQueries[idx];
                            const resolvedName = nameQuery?.data ?? null;
                            const displayName = resolvedName ?? row.entityId;

                            return (
                                <tr
                                    key={row.entityId}
                                    className="border-b last:border-0"
                                >
                                    <td className="py-1.5 pr-3 text-muted-foreground tabular-nums">
                                        {idx + 1}
                                    </td>
                                    <td
                                        className="max-w-[160px] truncate py-1.5 pr-3"
                                        title={displayName}
                                    >
                                        {displayName}
                                    </td>
                                    <td className="py-1.5 pr-3 tabular-nums">{row.unique}</td>
                                    <td className="py-1.5 tabular-nums">{row.total}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/**
 * Renders three side-by-side Top-10 tables, one per entity type.
 */
function Top10Section() {
    const { t } = useTranslations();
    const entityTypes: Array<'ACCOMMODATION' | 'POST' | 'EVENT'> = [
        'ACCOMMODATION',
        'POST',
        'EVENT'
    ];

    return (
        <section aria-labelledby="top10-section-heading">
            <h3
                id="top10-section-heading"
                className="mb-4 font-semibold text-lg"
            >
                {t('admin-pages.analytics.views.top10Title')}
            </h3>
            <div className="grid gap-6 md:grid-cols-3">
                {entityTypes.map((entityType) => (
                    <Card key={entityType}>
                        <CardContent className="pt-4">
                            <TopEntityTable entityType={entityType} />
                        </CardContent>
                    </Card>
                ))}
            </div>
        </section>
    );
}

// ============================================================================
// SECTION 3 — 30D DAILY TIME-SERIES CHART
// ============================================================================

/**
 * Renders a recharts LineChart with three lines (ACCOMMODATION / POST / EVENT)
 * pivoted from the 90-row daily series response.
 *
 * The chart has its own loading skeleton so it never blocks sections 1 or 2
 * (AC-38). Zero-valued days render as 0, not gaps (AC-37).
 */
function DailySeriesChartSection() {
    const { t } = useTranslations();

    const {
        data: rawRows,
        isLoading,
        isError
    } = useQuery({
        queryKey: ['admin-views-daily-series'] as const,
        queryFn: fetchViewsDailySeries,
        staleTime: STALE_5_MIN
    });

    if (isLoading) {
        return (
            <section aria-labelledby="chart-section-heading">
                <h3
                    id="chart-section-heading"
                    className="mb-4 font-semibold text-lg"
                >
                    {t('admin-pages.analytics.views.chart.title')}
                </h3>
                <div className="h-64 animate-pulse rounded-lg bg-muted" />
            </section>
        );
    }

    return (
        <section aria-labelledby="chart-section-heading">
            <h3
                id="chart-section-heading"
                className="mb-4 font-semibold text-lg"
            >
                {t('admin-pages.analytics.views.chart.title')}
            </h3>

            {isError ? (
                <Card>
                    <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground text-sm">
                            {t('admin-pages.analytics.views.empty')}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="pt-4">
                        <ResponsiveContainer
                            width="100%"
                            height={280}
                        >
                            <LineChart
                                data={pivotDailySeries(rawRows ?? [])}
                                margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                            >
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={formatXAxisTick}
                                    tick={{ fontSize: 11 }}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    formatter={(value: number, name: string) => [
                                        value,
                                        name === 'ACCOMMODATION'
                                            ? t('admin-pages.analytics.views.chart.accommodation')
                                            : name === 'POST'
                                              ? t('admin-pages.analytics.views.chart.post')
                                              : t('admin-pages.analytics.views.chart.event')
                                    ]}
                                    labelFormatter={formatXAxisTick}
                                />
                                <Legend
                                    formatter={(value: string) =>
                                        value === 'ACCOMMODATION'
                                            ? t('admin-pages.analytics.views.chart.accommodation')
                                            : value === 'POST'
                                              ? t('admin-pages.analytics.views.chart.post')
                                              : t('admin-pages.analytics.views.chart.event')
                                    }
                                />
                                <Line
                                    type="monotone"
                                    dataKey="ACCOMMODATION"
                                    stroke="#2563eb"
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls={false}
                                    name="ACCOMMODATION"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="POST"
                                    stroke="#16a34a"
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls={false}
                                    name="POST"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="EVENT"
                                    stroke="#d97706"
                                    strokeWidth={2}
                                    dot={false}
                                    connectNulls={false}
                                    name="EVENT"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
        </section>
    );
}

// ============================================================================
// PAGE
// ============================================================================

/**
 * Full `/analytics/views` page.
 *
 * Renders three fully-independent sections (summary tiles, top-10, chart).
 * Each section manages its own loading state; a failure in one section does
 * not affect the others (AC-38).
 */
function AnalyticsViewsPage() {
    const { t } = useTranslations();
    const [summaryWindow, setSummaryWindow] = useState<TimeWindow>('30d');

    return (
        <SidebarPageLayout titleKey="admin-pages.titles.analyticsViews">
            <div className="space-y-8">
                <div>
                    <h2 className="mb-2 font-bold text-2xl">
                        {t('admin-pages.analytics.views.title')}
                    </h2>
                    <p className="text-muted-foreground">
                        {t('admin-pages.analytics.views.subtitle')}
                    </p>
                </div>

                <SummaryTilesSection
                    window={summaryWindow}
                    onWindowChange={setSummaryWindow}
                />

                <Top10Section />

                <DailySeriesChartSection />
            </div>
        </SidebarPageLayout>
    );
}
