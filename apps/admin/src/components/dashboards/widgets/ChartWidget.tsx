/**
 * ChartWidget — Real chart renderer using shadcn/ui Charts + Recharts (SPEC-155 T-025).
 *
 * ## Chart library
 *
 * Uses `recharts` (shadcn/ui Charts peer dependency) with the shared
 * `ChartContainer` / `ChartTooltip` / `ChartTooltipContent` primitives from
 * `@/components/ui/chart`. Colors are driven by the admin design tokens:
 * `--color-chart-1` (river-500) is the primary series hue.
 *
 * ## Renderer pattern (follows KpiWidget T-023 canonical steps exactly)
 *
 * 1. Accept `widget: Widget` as the only prop.
 * 2. Pull `source` from `widget.config?.source as string ?? ''`.
 * 3. Call `useDashboardResolver()` to get `resolveForScope`.
 * 4. Call `resolveForScope(sourceId, widget.scope)` — ALWAYS before `useQuery`.
 * 5. Call `useQuery(options)`.
 * 6. If `!found` → render `<WidgetUnavailable>`.
 * 7. If `isLoading` → render skeleton.
 * 8. If `error` → render `<WidgetError>` with `refetch`.
 * 9. If data is null/undefined → render `<WidgetEmpty>`.
 * 10. Otherwise render the real chart.
 *
 * ## Expected data shape from resolvers
 *
 * ```ts
 * type ChartPoint = { label: string; value: number };
 * type ChartData  = { series: ChartPoint[] };
 * ```
 *
 * The `label` on each point is used as the X-axis tick.
 * The `value` is the numeric magnitude.
 *
 * @module ChartWidget
 * @see apps/admin/src/components/dashboards/widgets/KpiWidget.tsx — canonical pattern
 * @see apps/admin/src/components/ui/chart.tsx — shadcn chart primitives
 * @see apps/admin/src/lib/dashboard-sources.ts
 * @see apps/admin/src/contexts/dashboard-resolver-context.tsx
 * @see apps/admin/src/config/ia/schema.ts
 */

import {
    type ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent
} from '@/components/ui/chart';
import type { Widget } from '@/config/ia/schema';
import { useDashboardResolver } from '@/contexts/dashboard-resolver-context';
import { useQuery } from '@tanstack/react-query';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    XAxis,
    YAxis
} from 'recharts';
import { WidgetEmpty, WidgetError, WidgetSkeleton, WidgetUnavailable } from './widget-states';

// ============================================================================
// CHART DATA SHAPES
// ============================================================================

/**
 * A single data point in a chart series.
 *
 * @example
 * ```ts
 * const point: ChartPoint = { label: 'Ene', value: 42 };
 * ```
 */
export interface ChartPoint {
    /** Tick label shown on the X-axis (e.g. month abbreviation, date). */
    readonly label: string;
    /** Numeric value for this point. */
    readonly value: number;
}

/**
 * Data shape expected from a chart resolver's `queryFn`.
 *
 * The `series` array should be ordered chronologically or categorically;
 * the renderer preserves the input order.
 *
 * @example
 * ```ts
 * const data: ChartData = {
 *   series: [
 *     { label: 'Ene', value: 10 },
 *     { label: 'Feb', value: 15 },
 *   ],
 * };
 * ```
 */
export interface ChartData {
    /** Ordered data points for the chart. */
    readonly series: readonly ChartPoint[];
}

// ============================================================================
// CHART-TYPE CONSTANTS
// ============================================================================

/**
 * Supported chart render modes for ChartWidget.
 *
 * - `'line'`  → LineChart with a smooth Line series.
 * - `'bar'`   → BarChart with rounded Bar columns.
 * - `'area'`  → AreaChart with a filled Area series.
 *
 * When omitted from `widget.config.chartType`, the renderer defaults to `'bar'`.
 */
export type ChartType = 'line' | 'bar' | 'area';

// ============================================================================
// WIDGET-SPECIFIC CONFIG SHAPE
// ============================================================================

/**
 * Chart-specific fields that may live inside `widget.config`.
 *
 * All fields are optional — the renderer never crashes when they are absent.
 */
export interface ChartWidgetConfig {
    /** Source ID for the resolver registry. */
    readonly source?: string;
    /**
     * Chart render mode.
     * Defaults to `'bar'` when omitted.
     */
    readonly chartType?: ChartType;
}

// ============================================================================
// PROPS
// ============================================================================

/**
 * Props for the ChartWidget renderer.
 * Follows the RO-RO pattern — single readonly object.
 */
export interface ChartWidgetProps {
    /**
     * Full widget definition from the IA config (validated by `WidgetSchema`).
     * The renderer reads `widget.config.source`, `widget.config.chartType`,
     * `widget.scope`, and `widget.label` from this object.
     */
    readonly widget: Widget;
}

// ============================================================================
// CHART CONFIG (shadcn ChartConfig for color injection)
// ============================================================================

/**
 * Static ChartConfig that wires `value` series to the admin's first chart
 * token (`--color-chart-1` = river-500). The CSS var is injected by
 * ChartContainer's `<ChartStyle>` into the container's scope.
 */
const SERIES_CHART_CONFIG = {
    value: {
        label: 'Valor',
        color: 'var(--color-chart-1)'
    }
} satisfies ChartConfig;

// ============================================================================
// CHART TYPE RENDERERS
// ============================================================================

interface ChartRendererProps {
    readonly chartType: ChartType;
    readonly data: readonly ChartPoint[];
    readonly label: string;
}

/**
 * Renders the appropriate Recharts chart for the given `chartType`.
 * All three variants share the same data format and ChartContainer wrapper.
 */
function ChartRenderer({ chartType, data, label }: ChartRendererProps) {
    // Recharts expects plain mutable objects; the readonly cast is safe here.
    const rechartsData = data as ChartPoint[];

    const commonXAxis = (
        <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 10 }}
        />
    );

    const commonYAxis = (
        <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            width={28}
            tick={{ fontSize: 10 }}
        />
    );

    const commonGrid = (
        <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
        />
    );

    const tooltip = (
        <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
        />
    );

    if (chartType === 'bar') {
        return (
            <ChartContainer
                config={SERIES_CHART_CONFIG}
                className="h-20 w-full"
                data-testid="chart-bars"
                aria-label={`${label} — bar chart`}
            >
                <BarChart
                    accessibilityLayer
                    data={rechartsData}
                    margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                >
                    {commonGrid}
                    {commonXAxis}
                    {commonYAxis}
                    {tooltip}
                    <Bar
                        dataKey="value"
                        fill="var(--color-value)"
                        radius={[4, 4, 0, 0]}
                    />
                </BarChart>
            </ChartContainer>
        );
    }

    if (chartType === 'area') {
        return (
            <ChartContainer
                config={SERIES_CHART_CONFIG}
                className="h-20 w-full"
                data-testid="chart-area"
                aria-label={`${label} — area chart`}
            >
                <AreaChart
                    accessibilityLayer
                    data={rechartsData}
                    margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                >
                    {commonGrid}
                    {commonXAxis}
                    {commonYAxis}
                    {tooltip}
                    <Area
                        dataKey="value"
                        type="natural"
                        fill="var(--color-value)"
                        fillOpacity={0.2}
                        stroke="var(--color-value)"
                        strokeWidth={2}
                    />
                </AreaChart>
            </ChartContainer>
        );
    }

    // Default: line
    return (
        <ChartContainer
            config={SERIES_CHART_CONFIG}
            className="h-20 w-full"
            data-testid="chart-line"
            aria-label={`${label} — line chart`}
        >
            <LineChart
                accessibilityLayer
                data={rechartsData}
                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            >
                {commonGrid}
                {commonXAxis}
                {commonYAxis}
                {tooltip}
                <Line
                    dataKey="value"
                    type="natural"
                    stroke="var(--color-value)"
                    strokeWidth={2}
                    dot={{ fill: 'var(--color-value)', r: 3 }}
                    activeDot={{ r: 4 }}
                />
            </LineChart>
        </ChartContainer>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * ChartWidget — renders a real line/bar/area chart for the dashboard.
 *
 * Uses shadcn/ui Chart primitives (ChartContainer, ChartTooltip) backed by
 * Recharts. Colors are driven by `--color-chart-1` from the admin design
 * tokens (river-500 palette).
 *
 * Reads data from the resolver registry via `useDashboardResolver` and
 * `useQuery`. Handles all four states: loading, error, empty, and data.
 *
 * Config shape expected in `widget.config`:
 * ```json
 * {
 *   "source": "admin.users.newUsersTrend",
 *   "chartType": "line"
 * }
 * ```
 *
 * Data shape expected from the resolver's `queryFn`:
 * ```json
 * {
 *   "series": [
 *     { "label": "Ene", "value": 12 },
 *     { "label": "Feb", "value": 18 }
 *   ]
 * }
 * ```
 *
 * @example
 * ```tsx
 * <ChartWidget widget={widget} />
 * ```
 */
export function ChartWidget({ widget }: ChartWidgetProps) {
    // -- 1. Extract source id and config overrides ---------------------------
    const config = (widget.config ?? {}) as ChartWidgetConfig;
    const sourceId = config.source ?? '';
    const chartType: ChartType = config.chartType ?? 'bar';

    // -- 2. Resolve to query options (always — hooks cannot be conditional) --
    const { resolveForScope } = useDashboardResolver();
    const { found, options } = resolveForScope(sourceId, widget.scope);

    // -- 3. Fetch with TanStack Query ----------------------------------------
    const { data, isLoading, error, refetch } = useQuery(options);

    // Derive display label from the widget's i18n label (admin locale = 'es').
    const displayLabel = widget.label.es;

    // -- 4. Unavailable (source not registered) ------------------------------
    if (!found) {
        return (
            <WidgetUnavailable
                variant="chart"
                label={displayLabel}
            />
        );
    }

    // -- 5. Loading ----------------------------------------------------------
    if (isLoading) {
        return <WidgetSkeleton variant="chart" />;
    }

    // -- 6. Error ------------------------------------------------------------
    if (error) {
        return (
            <WidgetError
                variant="chart"
                label={displayLabel}
                onRetry={() => void refetch()}
            />
        );
    }

    // -- 7. Empty (null / undefined data) ------------------------------------
    if (data == null) {
        return <WidgetEmpty variant="chart" />;
    }

    // -- 8. Data — narrow to ChartData shape ---------------------------------
    const chartData = data as ChartData;

    // Defensive guard: if the resolver returned an unexpected shape (e.g. an
    // object without `series`, or a raw array instead of { series }), fall
    // back to the empty state instead of crashing in ChartRenderer.
    if (
        !chartData ||
        typeof chartData !== 'object' ||
        !('series' in chartData) ||
        !Array.isArray(chartData.series) ||
        chartData.series.length === 0
    ) {
        return <WidgetEmpty variant="chart" />;
    }

    return (
        <div
            className="flex flex-col gap-3 rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm"
            data-testid="chart-widget"
            aria-label={displayLabel}
        >
            {/* Header: label + chart type badge */}
            <div className="flex items-center justify-between">
                <span
                    className="text-muted-foreground text-sm"
                    data-testid="chart-label"
                >
                    {displayLabel}
                </span>
                <span
                    className="text-muted-foreground/60 text-xs"
                    data-testid="chart-type-badge"
                    aria-label={`Chart type: ${chartType}`}
                >
                    {chartType}
                </span>
            </div>

            {/* Chart area — real Recharts chart */}
            <ChartRenderer
                chartType={chartType}
                data={chartData.series}
                label={displayLabel}
            />
        </div>
    );
}
