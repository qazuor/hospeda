/**
 * AiUsageFeatureModelChart — Cost by feature × model grouped bar chart (SPEC-260 T-016).
 *
 * Visualizes which model dominates cost within each feature, using a grouped
 * bar chart (one group per feature, one bar per model).
 *
 * ## Data pivot
 *
 * The API returns flat rows: `[{ feature, model, calls, tokensIn, tokensOut, costMicroUsd }]`.
 * Recharts grouped BarChart needs one object per X-axis tick with each series
 * as a named key:
 *
 * ```
 * // Flat API rows:
 * [
 *   { feature: 'chat', model: 'gpt-4o-mini',  costMicroUsd: 120000 },
 *   { feature: 'chat', model: 'claude-haiku',  costMicroUsd:  80000 },
 *   { feature: 'search', model: 'gpt-4o-mini', costMicroUsd:  45000 },
 * ]
 *
 * // Pivoted for recharts:
 * [
 *   { feature: 'chat',   'gpt-4o-mini': 0.12, 'claude-haiku': 0.08 },
 *   { feature: 'search', 'gpt-4o-mini': 0.045 },
 * ]
 * ```
 *
 * Cost values are converted from µUSD to USD (÷ 1,000,000) for the Y-axis
 * tick labels. The tooltip shows the original formatted value via `formatMicroUsd`.
 *
 * ## Charting approach
 *
 * Mirrors `apps/admin/src/routes/_authed/analytics/views.tsx`: uses raw recharts
 * primitives (`ResponsiveContainer`, `BarChart`, `Bar`, `XAxis`, `YAxis`,
 * `Tooltip`, `Legend`) imported directly from `recharts`. No `ChartContainer`
 * wrapper — that is the established pattern for data-driven charts in this codebase.
 *
 * Colors are taken from a fixed palette (6 entries). If there are more than
 * 6 distinct models, subsequent models re-use the palette cyclically.
 *
 * ## Cache sharing
 *
 * Uses `useAiUsageByFeatureModelQuery` with `pageSize: 100` and the same
 * window/userId derived from `search` — identical to `AiUsageByFeatureTable`
 * (T-015) and `AiUsageByFeatureModelTable` (T-016 table), so all three
 * components share one TanStack Query cache entry.
 *
 * @module features/ai-usage/components/AiUsageFeatureModelChart
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAiUsageByFeatureModelQuery } from '@/features/ai-usage/hooks';
import type { AiUsageDailySearch } from '@/features/ai-usage/types';
import { LoaderIcon } from '@repo/icons';
import type { AiUsageByFeatureModelRow } from '@repo/schemas';
import { formatMicroUsd } from '@repo/utils';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/**
 * Props for {@link AiUsageFeatureModelChart}.
 */
export interface AiUsageFeatureModelChartProps {
    /** Current resolved search params from `Route.useSearch()`. */
    readonly search: AiUsageDailySearch;
}

// ---------------------------------------------------------------------------
// Chart color palette
// ---------------------------------------------------------------------------

/**
 * Fixed palette for model series.
 * Sufficient for the known model universe; wraps cyclically beyond 6 entries.
 */
const MODEL_COLORS: readonly string[] = [
    '#2563eb', // blue-600
    '#16a34a', // green-600
    '#d97706', // amber-600
    '#9333ea', // purple-600
    '#dc2626', // red-600
    '#0891b2' // cyan-600
];

/**
 * Returns a consistent color for a model by its index in the ordered model set.
 *
 * @param index - Zero-based position of the model in the sorted model set.
 * @returns A CSS color string.
 */
function modelColor(index: number): string {
    return MODEL_COLORS[index % MODEL_COLORS.length] as string;
}

// ---------------------------------------------------------------------------
// Pivot helpers
// ---------------------------------------------------------------------------

/**
 * A pivoted feature entry for recharts' grouped BarChart.
 * The `feature` key is the X-axis label; all other keys are model identifiers
 * whose values are cost in USD (float, µUSD ÷ 1,000,000).
 */
interface PivotedFeatureEntry {
    readonly feature: string;
    readonly [model: string]: string | number;
}

/**
 * Pivot the flat feature×model rows into recharts' grouped-bar data shape.
 *
 * Steps:
 * 1. Build a `Map<feature, Map<model, costUsd>>` from all rows.
 * 2. Collect the ordered distinct model set (sorted alphabetically for
 *    consistent legend/bar ordering).
 * 3. Map each feature to `{ feature, [model]: costUsd }` — missing model
 *    entries default to 0 so all groups have the same keys.
 * 4. Sort features alphabetically for a stable X-axis order.
 *
 * @param rows - Items from the by-feature-model paginated response.
 * @returns Tuple of (pivoted chart data, ordered model names).
 */
function pivotFeatureModelRows(
    rows: readonly AiUsageByFeatureModelRow[]
): readonly [readonly PivotedFeatureEntry[], readonly string[]] {
    if (rows.length === 0) {
        return [[], []] as const;
    }

    // Step 1: feature → model → total µUSD (aggregate duplicate pairs if any)
    const featureMap = new Map<string, Map<string, number>>();
    const modelSet = new Set<string>();

    for (const row of rows) {
        modelSet.add(row.model);
        let modelMap = featureMap.get(row.feature);
        if (!modelMap) {
            modelMap = new Map<string, number>();
            featureMap.set(row.feature, modelMap);
        }
        modelMap.set(row.model, (modelMap.get(row.model) ?? 0) + row.costMicroUsd);
    }

    // Step 2: sorted, stable model order
    const models = [...modelSet].sort();

    // Step 3: pivot into recharts shape — cost in USD (µUSD / 1_000_000)
    const pivoted: PivotedFeatureEntry[] = [...featureMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([feature, modelMap]) => {
            const entry: Record<string, string | number> = { feature };
            for (const model of models) {
                entry[model] = (modelMap.get(model) ?? 0) / 1_000_000;
            }
            return entry as PivotedFeatureEntry;
        });

    return [pivoted, models] as const;
}

// ---------------------------------------------------------------------------
// Tooltip formatter
// ---------------------------------------------------------------------------

/**
 * Formats a tooltip value from USD (float) back to a µUSD display string.
 * Used so the axis shows compact USD while the tooltip shows the full precision.
 *
 * @param value - The Y value in USD (float).
 * @returns Formatted cost string via `formatMicroUsd`.
 */
function tooltipFormatter(value: number): string {
    return formatMicroUsd(Math.round(value * 1_000_000));
}

/**
 * Formats a Y-axis tick label: USD float → compact "$X.XX" string.
 *
 * @param value - The tick value in USD.
 * @returns Short dollar string.
 */
function yAxisTickFormatter(value: number): string {
    if (value === 0) return '$0';
    return `$${value.toFixed(4).replace(/\.?0+$/, '')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Grouped bar chart showing estimated cost per feature, broken down by model.
 *
 * X axis: feature identifier.
 * Y axis: estimated cost in USD.
 * Bars: one bar group per feature, one bar per model, colored from the fixed palette.
 *
 * @param props - {@link AiUsageFeatureModelChartProps}
 */
export function AiUsageFeatureModelChart({ search }: AiUsageFeatureModelChartProps) {
    // Same query key as AiUsageByFeatureTable + AiUsageByFeatureModelTable → cache hit.
    const { data, isLoading, isError } = useAiUsageByFeatureModelQuery({
        year: search.year,
        month: search.month,
        since: search.since,
        until: search.until,
        userId: search.userId,
        page: 1,
        pageSize: 100
    });

    const [chartData, models] = data ? pivotFeatureModelRows(data.items) : ([[], []] as const);

    const hasData = chartData.length > 0 && models.length > 0;

    const description = isLoading
        ? 'Loading...'
        : isError
          ? 'Failed to load data'
          : hasData
            ? `Cost distribution across ${chartData.length} feature${chartData.length === 1 ? '' : 's'} and ${models.length} model${models.length === 1 ? '' : 's'}`
            : 'No data for the selected window';

    return (
        <Card>
            <CardHeader>
                <CardTitle>Cost by Feature × Model</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="py-10 text-center">
                        <LoaderIcon className="mx-auto h-6 w-6 animate-spin text-primary" />
                        <p className="mt-3 text-muted-foreground text-sm">Loading chart data…</p>
                    </div>
                ) : isError ? (
                    <div className="py-10 text-center">
                        <p className="text-destructive text-sm">Failed to load chart data.</p>
                        <p className="mt-1 text-muted-foreground text-xs">
                            Verify the API is reachable and try again.
                        </p>
                    </div>
                ) : hasData ? (
                    <ResponsiveContainer
                        width="100%"
                        height={300}
                    >
                        <BarChart
                            data={[...chartData] as Record<string, string | number>[]}
                            margin={{ top: 8, right: 16, left: 8, bottom: 4 }}
                        >
                            <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="feature"
                                tick={{ fontSize: 11 }}
                                tickLine={false}
                            />
                            <YAxis
                                tickFormatter={yAxisTickFormatter}
                                tick={{ fontSize: 11 }}
                                tickLine={false}
                                axisLine={false}
                                width={72}
                            />
                            <Tooltip
                                formatter={(value: number, name: string) => [
                                    tooltipFormatter(value),
                                    name
                                ]}
                                labelStyle={{ fontWeight: 600 }}
                            />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            {models.map((model, i) => (
                                <Bar
                                    key={model}
                                    dataKey={model}
                                    name={model}
                                    fill={modelColor(i)}
                                    radius={[2, 2, 0, 0]}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="py-10 text-center">
                        <p className="text-muted-foreground text-sm">
                            No cost data for the selected filters.
                        </p>
                        <p className="mt-1 text-muted-foreground text-xs">
                            Adjust the time window or remove filters to see the chart.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
