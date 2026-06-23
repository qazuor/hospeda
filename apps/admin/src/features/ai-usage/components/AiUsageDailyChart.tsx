/**
 * AiUsageDailyChart — Daily cost time-series line chart (SPEC-260 T-017).
 *
 * Renders a recharts AreaChart of estimated cost per UTC calendar day,
 * overlaying total calls as a secondary line on a right Y-axis.
 *
 * ## Data source
 * Uses `useAiUsageDailyQuery` with the full page `search` object, which already
 * strips params to the accepted set. Rows are `AiUsageDailyRow`:
 *   `{ day: 'YYYY-MM-DD', calls, tokensIn, tokensOut, costMicroUsd }`
 *
 * ## Pagination & truncation caveat (MVP limitation)
 * `pageSize` is capped at 100 by `AiUsagePaginationSchema`. A calendar month
 * (≤31 zero-filled days) fits comfortably; wide custom date-ranges may truncate.
 * When `pagination.total > pagination.pageSize`, a caption is shown under the
 * chart via the `admin-pages.ai.usage.daily.truncationNotice` i18n key.
 * Multi-page fetching is explicitly deferred to a future task (T-019 polish).
 *
 * ## Sort guarantee
 * Rows are sorted client-side by `day` ASC before passing to recharts so the
 * time axis is always left-to-right regardless of API ordering.
 *
 * ## Charting approach
 * Mirrors `apps/admin/src/routes/_authed/analytics/views.tsx`: raw recharts
 * primitives (`ResponsiveContainer`, `AreaChart`, `Area`, `Line`, `XAxis`,
 * `YAxis`, `CartesianGrid`, `Tooltip`, `Legend`) imported directly from
 * `recharts`. No `ChartContainer` wrapper — that is the established pattern
 * for data-driven charts in this codebase.
 *
 * @module features/ai-usage/components/AiUsageDailyChart
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAiUsageDailyQuery } from '@/features/ai-usage/hooks';
import type { AiUsageDailySearch } from '@/features/ai-usage/types';
import { useTranslations } from '@/hooks/use-translations';
import { LoaderIcon } from '@repo/icons';
import type { AiUsageDailyRow } from '@repo/schemas';
import { formatMicroUsd } from '@repo/utils';
import {
    Area,
    AreaChart,
    CartesianGrid,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Props for {@link AiUsageDailyChart}.
 */
export interface AiUsageDailyChartProps {
    /** Current resolved search params from `Route.useSearch()`. */
    readonly search: AiUsageDailySearch;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum rows returned by the daily endpoint per request.
 * Governed by `AiUsagePaginationSchema.pageSize.max(100)`.
 */
const MAX_DAILY_PAGE_SIZE = 100;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Shape passed to recharts — cost converted to USD float for Y-axis readability.
 */
interface ChartRow {
    readonly day: string;
    /** Estimated cost in USD (µUSD ÷ 1,000,000). */
    readonly costUsd: number;
    /** Raw µUSD value — used by tooltip to format via formatMicroUsd. */
    readonly costMicroUsd: number;
    /** Total AI calls for the day. */
    readonly calls: number;
}

/**
 * Converts a sorted array of `AiUsageDailyRow` into recharts-ready `ChartRow[]`.
 * Sorts ascending by `day` (client-side guard against any API ordering variation).
 *
 * @param rows - Items from the daily paginated response.
 * @returns Chart-ready array sorted by day ASC.
 */
function toChartRows(rows: readonly AiUsageDailyRow[]): readonly ChartRow[] {
    return [...rows]
        .sort((a, b) => a.day.localeCompare(b.day))
        .map((row) => ({
            day: row.day,
            costUsd: row.costMicroUsd / 1_000_000,
            costMicroUsd: row.costMicroUsd,
            calls: row.calls
        }));
}

/**
 * Formats a `'YYYY-MM-DD'` date string to `'DD/MM'` for the X-axis tick.
 * Mirrors the `formatXAxisTick` used in analytics/views.tsx.
 *
 * @param dateStr - ISO date string from the `day` field.
 * @returns Short label like `'15/06'`.
 */
function formatXAxisTick(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}`;
}

/**
 * Formats a Y-axis tick from USD float to a compact dollar string.
 *
 * @param value - USD value (float).
 * @returns Compact string like `'$0.12'` or `'$5'`.
 */
function formatCostTick(value: number): string {
    if (value === 0) return '$0';
    return `$${value.toFixed(4).replace(/\.?0+$/, '')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Daily cost time-series chart for the AI usage dashboard.
 *
 * Primary series: estimated cost (µUSD → USD, area fill).
 * Secondary series: total calls (right Y-axis, line only).
 *
 * Handles loading (spinner), error (message), and empty-state (card) gracefully.
 * Shows a truncation notice when the window contains more days than the page
 * can return (>100-day ranges).
 *
 * @param props - {@link AiUsageDailyChartProps}
 */
export function AiUsageDailyChart({ search }: AiUsageDailyChartProps) {
    const { t, tPlural } = useTranslations();

    // Pass the full search object — the hook already strips to accepted params
    // (window: year/month/since/until, feature/model/provider/userId, page/pageSize).
    // Use pageSize: MAX_DAILY_PAGE_SIZE to capture as many days as possible.
    const { data, isLoading, isError } = useAiUsageDailyQuery({
        ...search,
        page: 1,
        pageSize: MAX_DAILY_PAGE_SIZE
    });

    const chartRows = data ? toChartRows(data.items) : [];

    // Truncation detection: when the API has more days than we fetched.
    const isTruncated = data !== undefined && data.pagination.total > data.pagination.pageSize;

    const hasData = chartRows.length > 0;

    const description = isLoading
        ? t('admin-pages.ai.usage.daily.loading')
        : isError
          ? t('admin-pages.ai.usage.daily.loadError')
          : hasData
            ? tPlural('admin-pages.ai.usage.daily.desc', chartRows.length)
            : t('admin-pages.ai.usage.daily.empty');

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('admin-pages.ai.usage.daily.title')}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="py-10 text-center">
                        <LoaderIcon className="mx-auto h-6 w-6 animate-spin text-primary" />
                        <p className="mt-3 text-muted-foreground text-sm">
                            {t('admin-pages.ai.usage.daily.loading')}
                        </p>
                    </div>
                ) : isError ? (
                    <div className="py-10 text-center">
                        <p className="text-destructive text-sm">
                            {t('admin-pages.ai.usage.daily.loadError')}
                        </p>
                        <p className="mt-1 text-muted-foreground text-xs">
                            {t('admin-pages.ai.usage.daily.loadErrorHint')}
                        </p>
                    </div>
                ) : hasData ? (
                    <>
                        <ResponsiveContainer
                            width="100%"
                            height={300}
                        >
                            <AreaChart
                                data={[...chartRows] as unknown as Record<string, unknown>[]}
                                margin={{ top: 8, right: 64, left: 8, bottom: 4 }}
                            >
                                <defs>
                                    <linearGradient
                                        id="costGradient"
                                        x1="0"
                                        y1="0"
                                        x2="0"
                                        y2="1"
                                    >
                                        <stop
                                            offset="5%"
                                            stopColor="#2563eb"
                                            stopOpacity={0.25}
                                        />
                                        <stop
                                            offset="95%"
                                            stopColor="#2563eb"
                                            stopOpacity={0}
                                        />
                                    </linearGradient>
                                </defs>

                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    vertical={false}
                                />

                                <XAxis
                                    dataKey="day"
                                    tickFormatter={formatXAxisTick}
                                    tick={{ fontSize: 11 }}
                                    tickLine={false}
                                />

                                {/* Left Y-axis: cost in USD */}
                                <YAxis
                                    yAxisId="cost"
                                    tickFormatter={formatCostTick}
                                    tick={{ fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={72}
                                />

                                {/* Right Y-axis: calls */}
                                <YAxis
                                    yAxisId="calls"
                                    orientation="right"
                                    tick={{ fontSize: 11 }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={48}
                                />

                                <Tooltip
                                    formatter={(value: number, name: string) => {
                                        if (name === 'costUsd') {
                                            return [
                                                formatMicroUsd(Math.round(value * 1_000_000)),
                                                t('admin-pages.ai.usage.daily.legendEstCost')
                                            ];
                                        }
                                        return [
                                            value.toLocaleString(),
                                            t('admin-pages.ai.usage.daily.legendCalls')
                                        ];
                                    }}
                                    labelFormatter={formatXAxisTick}
                                />

                                <Legend
                                    formatter={(value: string) =>
                                        value === 'costUsd'
                                            ? t('admin-pages.ai.usage.daily.legendEstCost')
                                            : t('admin-pages.ai.usage.daily.legendCalls')
                                    }
                                />

                                <Area
                                    yAxisId="cost"
                                    type="monotone"
                                    dataKey="costUsd"
                                    name="costUsd"
                                    stroke="#2563eb"
                                    strokeWidth={2}
                                    fill="url(#costGradient)"
                                    dot={false}
                                    connectNulls={false}
                                />

                                <Line
                                    yAxisId="calls"
                                    type="monotone"
                                    dataKey="calls"
                                    name="calls"
                                    stroke="#16a34a"
                                    strokeWidth={1.5}
                                    dot={false}
                                    connectNulls={false}
                                    strokeDasharray="4 2"
                                />
                            </AreaChart>
                        </ResponsiveContainer>

                        {/* Truncation notice — MVP limitation: pageSize capped at 100.
                         * When the selected window contains more days than one page,
                         * only the first 100 days are shown. The user should narrow
                         * the window (month mode or shorter date-range) to see all days.
                         * Multi-page fetching is deferred to T-019. */}
                        {isTruncated && data && (
                            <p className="mt-2 text-center text-muted-foreground text-xs">
                                {t('admin-pages.ai.usage.daily.truncationNotice', {
                                    shown: MAX_DAILY_PAGE_SIZE,
                                    total: data.pagination.total.toLocaleString()
                                })}
                            </p>
                        )}
                    </>
                ) : (
                    <div className="py-10 text-center">
                        <p className="text-muted-foreground text-sm">
                            {t('admin-pages.ai.usage.daily.empty')}
                        </p>
                        <p className="mt-1 text-muted-foreground text-xs">
                            {t('admin-pages.ai.usage.daily.emptyHint')}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
