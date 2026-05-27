/**
 * ChartWidget — Placeholder renderer for chart-type dashboard widgets (SPEC-155 T-025).
 *
 * ## Chart library finding
 *
 * NO charting library (recharts, chart.js, visx, nivo, tremor, etc.) is present in
 * `apps/admin/package.json`. Adding a new dependency requires owner approval.
 *
 * This component therefore renders a **CSS/SVG placeholder** for V1:
 * - `'line'` → an SVG polyline connecting data points.
 * - `'area'` → an SVG polygon fill under the same polyline.
 * - `'bar'`  → horizontal flex bars (div-based, Tailwind only).
 *
 * The placeholders are functional enough to verify data wiring end-to-end.
 * Replace with a real chart library once the owner approves a dependency choice.
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
 * 10. Otherwise render the placeholder chart.
 *
 * ## Expected data shape from resolvers
 *
 * ```ts
 * type ChartPoint = { label: string; value: number };
 * type ChartData  = { series: ChartPoint[] };
 * ```
 *
 * The `label` on each point is used as a tick label (month name, date, etc.).
 * The `value` is the numeric magnitude.
 *
 * @module ChartWidget
 * @see apps/admin/src/components/dashboards/widgets/KpiWidget.tsx — canonical pattern
 * @see apps/admin/src/lib/dashboard-sources.ts
 * @see apps/admin/src/contexts/dashboard-resolver-context.tsx
 * @see apps/admin/src/config/ia/schema.ts
 */

import type { Widget } from '@/config/ia/schema';
import { useDashboardResolver } from '@/contexts/dashboard-resolver-context';
import { useQuery } from '@tanstack/react-query';
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
 * - `'line'`  → SVG polyline connecting data points.
 * - `'bar'`   → Div-based horizontal bars.
 * - `'area'`  → SVG polygon fill (area under the line).
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
// PLACEHOLDER CHART RENDERERS
// ============================================================================

/**
 * SVG dimensions used for line and area chart placeholders.
 * Fixed viewport makes percentage-based point coordinates deterministic.
 */
const SVG_WIDTH = 300;
const SVG_HEIGHT = 80;
/** Horizontal padding (left + right) so points don't clip at the edge. */
const SVG_PAD_X = 8;
/** Vertical padding so the topmost point isn't flush with the SVG top. */
const SVG_PAD_Y = 6;

/**
 * Normalises a series of `ChartPoint` values to (x, y) pairs within the SVG
 * viewport, accounting for padding.
 *
 * @param series - Ordered data points.
 * @returns Array of `{ x, y }` pixel coords (relative to the SVG viewport).
 */
function normaliseSeries(
    series: readonly ChartPoint[]
): { readonly x: number; readonly y: number }[] {
    if (series.length === 0) return [];

    const values = series.map((p) => p.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min === 0 ? 1 : max - min;

    const usableW = SVG_WIDTH - SVG_PAD_X * 2;
    const usableH = SVG_HEIGHT - SVG_PAD_Y * 2;

    return series.map((p, i) => ({
        x: SVG_PAD_X + (i / Math.max(series.length - 1, 1)) * usableW,
        // Invert Y: higher value = lower y coordinate in SVG.
        y: SVG_PAD_Y + (1 - (p.value - min) / range) * usableH
    }));
}

// ============================================================================
// CHART TYPE PROP
// ============================================================================

interface ChartPlaceholderProps {
    readonly chartType: ChartType;
    readonly series: readonly ChartPoint[];
    readonly label: string;
}

/**
 * Renders the appropriate placeholder visualisation for the given `chartType`.
 *
 * ## IMPORTANT — replace with a real chart library
 *
 * This is a placeholder only. When a charting library is approved and added as
 * a dependency (recharts, visx, nivo, etc.), delete this component and wire the
 * real chart renderer here. The rest of ChartWidget (resolver, useQuery, states)
 * stays unchanged.
 */
function ChartPlaceholder({ chartType, series, label }: ChartPlaceholderProps) {
    const points = normaliseSeries(series);
    const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

    // ── Tick labels (shared across all types) ────────────────────────────────
    const TickLabels = (
        <div
            className="mt-1 flex justify-between px-0"
            aria-hidden="true"
        >
            {series.map((p) => (
                <span
                    key={p.label}
                    className="truncate text-center text-[10px] text-muted-foreground leading-none"
                    style={{ width: `${100 / series.length}%` }}
                >
                    {p.label}
                </span>
            ))}
        </div>
    );

    if (chartType === 'bar') {
        const max = Math.max(...series.map((p) => p.value), 1);
        return (
            <figure
                aria-label={label}
                className="w-full"
            >
                <div
                    className="flex h-20 items-end gap-1 overflow-hidden"
                    data-testid="chart-bars"
                    role="img"
                    aria-label={`${label} — bar chart`}
                >
                    {series.map((p) => (
                        <div
                            key={p.label}
                            className="flex-1 rounded-t bg-primary/60 transition-all"
                            style={{ height: `${(p.value / max) * 100}%` }}
                            title={`${p.label}: ${p.value}`}
                            data-testid={`bar-${p.label}`}
                        />
                    ))}
                </div>
                {TickLabels}
            </figure>
        );
    }

    // line or area — SVG-based
    const bottomY = SVG_HEIGHT - SVG_PAD_Y;
    const leftX = SVG_PAD_X;
    const rightX = SVG_WIDTH - SVG_PAD_X;

    return (
        <figure
            aria-label={label}
            className="w-full"
        >
            <svg
                viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
                className="h-20 w-full overflow-visible"
                data-testid={chartType === 'area' ? 'chart-area' : 'chart-line'}
                aria-label={`${label} — ${chartType} chart`}
                role="img"
            >
                {chartType === 'area' && points.length > 0 && (
                    <polygon
                        points={`${leftX},${bottomY} ${polylinePoints} ${rightX},${bottomY}`}
                        className="fill-primary/20"
                        data-testid="area-fill"
                    />
                )}
                {points.length > 0 && (
                    <polyline
                        points={polylinePoints}
                        className="fill-none stroke-[2] stroke-primary"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        data-testid="line-path"
                    />
                )}
                {/* Data point dots */}
                {points.map((pt, i) => (
                    <circle
                        // biome-ignore lint/suspicious/noArrayIndexKey: stable SVG dots indexed by position
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r={3}
                        className="fill-primary"
                        data-testid={`chart-dot-${series[i].label}`}
                    />
                ))}
            </svg>
            {TickLabels}
        </figure>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * ChartWidget — renders a placeholder line/bar/area chart for the dashboard.
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
 * ## PLACEHOLDER WARNING
 *
 * This widget uses a pure CSS/SVG placeholder because no charting library is
 * installed in the admin app. Before shipping charts to production, the team
 * should decide on a library (recharts, visx, nivo, etc.) and replace the
 * `ChartPlaceholder` sub-component with a real renderer. The resolver/useQuery
 * wiring does NOT need to change.
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

    // An empty series is treated as "no data" rather than an error.
    if (!chartData.series || chartData.series.length === 0) {
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

            {/* Chart area */}
            <ChartPlaceholder
                chartType={chartType}
                series={chartData.series}
                label={displayLabel}
            />
        </div>
    );
}
