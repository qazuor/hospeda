/**
 * KpiWidget — Pilot renderer for dashboard widget system (SPEC-155 T-023).
 *
 * This is the reference implementation that T-024 (ListWidget), T-025
 * (ChartWidget), T-026 (ChecklistWidget), and T-027 (StatusWidget) must follow.
 *
 * ## Renderer pattern (canonical, copy verbatim for T-024..T-027)
 *
 * 1. Accept `widget: Widget` (from schema.ts) as the only prop.
 * 2. Pull `source` from `widget.config?.source as string ?? ''`.
 * 3. Call `useDashboardResolver()` to get `resolveForScope`.
 * 4. Call `resolveForScope(sourceId, widget.scope)` — ALWAYS before `useQuery`
 *    (hooks cannot be called conditionally). Capture `{ found, options }`.
 * 5. Call `useQuery(options)` with those options.
 * 6. If `!found` → render `<WidgetUnavailable>`.
 * 7. If `isLoading` → render the widget-specific skeleton.
 * 8. If `error` → render `<WidgetError>` with `refetch` as the retry handler.
 * 9. If data is null/undefined → render `<WidgetEmpty>`.
 * 10. Otherwise render the widget content.
 *
 * ## States that T-028 extracts
 *
 * `WidgetSkeleton`, `WidgetError`, `WidgetEmpty`, and `WidgetUnavailable` are
 * implemented inline here and intentionally left small so T-028 can generalise
 * them into a shared `widget-states.tsx` without touching KpiWidget.
 *
 * @module KpiWidget
 * @see apps/admin/src/lib/dashboard-sources.ts
 * @see apps/admin/src/contexts/dashboard-resolver-context.tsx
 * @see apps/admin/src/config/ia/schema.ts
 */

import type { Widget } from '@/config/ia/schema';
import { useDashboardResolver } from '@/contexts/dashboard-resolver-context';
import { cn } from '@/lib/utils';
import { AlertTriangleIcon, TrendingDownIcon, TrendingUpIcon } from '@repo/icons';
import { useQuery } from '@tanstack/react-query';

// ============================================================================
// KPI DATA SHAPE
// ============================================================================

/**
 * Expected data shape returned by a KPI resolver's `queryFn`.
 *
 * Fields are intentionally optional — a resolver may omit delta / unit details.
 * The renderer degrades gracefully when they are absent.
 */
export interface KpiData {
    /**
     * The primary numeric value to display.
     * Use a number so the renderer can apply locale formatting.
     */
    readonly value: number;
    /**
     * Optional percentage change (positive = up, negative = down).
     * When provided, a trend icon and color badge are shown.
     */
    readonly delta?: number;
    /** Optional prefix placed before the value (e.g. "$", "ARS"). */
    readonly unitPrefix?: string;
    /** Optional suffix placed after the value (e.g. "%", "users"). */
    readonly unitSuffix?: string;
}

// ============================================================================
// WIDGET-SPECIFIC CONFIG SHAPE
// ============================================================================

/**
 * KPI-specific fields that may live inside `widget.config`.
 *
 * All fields are optional — the renderer never crashes when they are absent.
 */
export interface KpiWidgetConfig {
    /** Source ID for the resolver registry. */
    readonly source?: string;
    /** Override unit prefix (takes precedence over data.unitPrefix). */
    readonly unitPrefix?: string;
    /** Override unit suffix (takes precedence over data.unitSuffix). */
    readonly unitSuffix?: string;
}

// ============================================================================
// PROPS
// ============================================================================

/**
 * Props for the KpiWidget renderer.
 * Follows the RO-RO pattern — single readonly object.
 */
export interface KpiWidgetProps {
    /**
     * Full widget definition from the IA config (validated by `WidgetSchema`).
     * The renderer reads `widget.config.source`, `widget.scope`, and
     * `widget.label` from this object.
     */
    readonly widget: Widget;
}

// ============================================================================
// INLINE SHARED STATES (T-028 extracts these)
// ============================================================================

/**
 * Loading skeleton for a KPI card.
 * Mirrors the pulse card pattern from `DashboardSkeleton` in PageSkeleton.tsx.
 *
 * T-028: extract to `widget-states.tsx` as `<WidgetSkeleton variant="kpi" />`.
 */
function KpiSkeleton() {
    return (
        <div
            className="animate-pulse rounded-lg border bg-card p-4"
            data-testid="kpi-widget-skeleton"
            aria-busy="true"
            aria-label="Loading"
        >
            <div className="mb-3 h-4 w-24 rounded bg-muted" />
            <div className="h-9 w-20 rounded bg-muted" />
            <div className="mt-2 h-4 w-16 rounded bg-muted" />
        </div>
    );
}

/**
 * Error state for a widget that failed to fetch its data.
 *
 * T-028: extract to `widget-states.tsx` as `<WidgetError onRetry={fn} />`.
 */
interface WidgetErrorProps {
    readonly onRetry: () => void;
    readonly label: string;
}

function WidgetError({ onRetry, label }: WidgetErrorProps) {
    return (
        <div
            className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-card p-4"
            data-testid="kpi-widget-error"
            role="alert"
            aria-label={`Error loading ${label}`}
        >
            <div className="text-destructive">
                <AlertTriangleIcon
                    className="h-5 w-5"
                    aria-hidden="true"
                />
            </div>
            <p className="text-muted-foreground text-xs">Error al cargar datos</p>
            <button
                type="button"
                onClick={onRetry}
                className="rounded-md border px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
            >
                Reintentar
            </button>
        </div>
    );
}

/**
 * Empty state for a KPI that resolved but returned no data.
 *
 * T-028: extract to `widget-states.tsx` as `<WidgetEmpty />`.
 */
function WidgetEmpty() {
    return (
        <div
            className="flex items-center justify-center rounded-lg border bg-card p-4 text-muted-foreground"
            data-testid="kpi-widget-empty"
        >
            <span className="text-sm">—</span>
        </div>
    );
}

/**
 * Fallback when the source ID is not registered in the resolver registry.
 *
 * T-028: extract to `widget-states.tsx` as `<WidgetUnavailable />`.
 */
interface WidgetUnavailableProps {
    readonly label: string;
}

function WidgetUnavailable({ label }: WidgetUnavailableProps) {
    return (
        <div
            className="flex items-center justify-center rounded-lg border border-dashed bg-card p-4 text-muted-foreground"
            data-testid="kpi-widget-unavailable"
            aria-label={`${label} — data source unavailable`}
        >
            <span className="text-xs">Sin fuente de datos</span>
        </div>
    );
}

// ============================================================================
// DELTA BADGE
// ============================================================================

/**
 * Renders the optional delta (trend) badge for a KPI.
 * Positive delta → green up-arrow. Negative delta → red down-arrow.
 * Zero delta → neutral muted display.
 */
interface DeltaBadgeProps {
    readonly delta: number;
}

function DeltaBadge({ delta }: DeltaBadgeProps) {
    const isPositive = delta > 0;
    const isNegative = delta < 0;

    const colorClass = isPositive
        ? 'text-green-600'
        : isNegative
          ? 'text-destructive'
          : 'text-muted-foreground';

    const absValue = Math.abs(delta);

    return (
        <span
            className={cn('flex items-center gap-0.5 font-medium text-xs', colorClass)}
            data-testid="kpi-delta"
            aria-label={`${isPositive ? 'Up' : isNegative ? 'Down' : 'No change'} ${absValue}%`}
        >
            {isPositive && (
                <TrendingUpIcon
                    className="h-3 w-3"
                    aria-hidden="true"
                />
            )}
            {isNegative && (
                <TrendingDownIcon
                    className="h-3 w-3"
                    aria-hidden="true"
                />
            )}
            {delta > 0 ? '+' : ''}
            {delta.toFixed(1)}%
        </span>
    );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * KpiWidget — renders a single KPI card for the dashboard.
 *
 * Reads data from the resolver registry via `useDashboardResolver` and
 * `useQuery`. Handles all four states: loading, error, empty, and data.
 *
 * Config shape expected in `widget.config`:
 * ```json
 * {
 *   "source": "admin.entities.counts",
 *   "unitSuffix": "items"
 * }
 * ```
 *
 * Data shape expected from the resolver's `queryFn`:
 * ```json
 * { "value": 1234, "delta": 12.5, "unitPrefix": "$", "unitSuffix": "ARS" }
 * ```
 *
 * @example
 * ```tsx
 * <KpiWidget widget={widget} />
 * ```
 */
export function KpiWidget({ widget }: KpiWidgetProps) {
    // -- 1. Extract source id and config overrides ---------------------------
    const config = (widget.config ?? {}) as KpiWidgetConfig;
    const sourceId = config.source ?? '';

    // -- 2. Resolve to query options (always — hooks cannot be conditional) --
    const { resolveForScope } = useDashboardResolver();
    const { found, options } = resolveForScope(sourceId, widget.scope);

    // -- 3. Fetch with TanStack Query ----------------------------------------
    const { data, isLoading, error, refetch } = useQuery(options);

    // Derive display label from the widget's i18n label (admin locale = 'es').
    // T-034 (page renderer) will pass the active locale; for now we default to 'es'.
    const displayLabel = widget.label.es;

    // -- 4. Unavailable (source not registered) ------------------------------
    if (!found) {
        return <WidgetUnavailable label={displayLabel} />;
    }

    // -- 5. Loading ----------------------------------------------------------
    if (isLoading) {
        return <KpiSkeleton />;
    }

    // -- 6. Error ------------------------------------------------------------
    if (error) {
        return (
            <WidgetError
                label={displayLabel}
                onRetry={() => void refetch()}
            />
        );
    }

    // -- 7. Empty (null / undefined data) ------------------------------------
    if (data == null) {
        return <WidgetEmpty />;
    }

    // -- 8. Data — narrow to KpiData shape -----------------------------------
    const kpi = data as KpiData;

    // Config-level unit overrides take precedence over resolver-provided units.
    const prefix = config.unitPrefix ?? kpi.unitPrefix;
    const suffix = config.unitSuffix ?? kpi.unitSuffix;

    // Format value with locale separators (es-AR uses "." as thousands separator).
    const formattedValue = kpi.value.toLocaleString('es-AR');

    return (
        <div
            className="flex flex-col gap-3 rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm"
            data-testid="kpi-widget"
            aria-label={`${displayLabel}: ${formattedValue}`}
        >
            {/* Header: label */}
            <div className="flex items-center justify-between">
                <span
                    className="text-muted-foreground text-sm"
                    data-testid="kpi-label"
                >
                    {displayLabel}
                </span>
            </div>

            {/* Value row: prefix + value + suffix + optional delta */}
            <div className="flex items-end justify-between gap-2">
                <div
                    className="flex items-baseline gap-1"
                    data-testid="kpi-value-row"
                >
                    {prefix && (
                        <span
                            className="text-muted-foreground text-sm"
                            data-testid="kpi-unit-prefix"
                        >
                            {prefix}
                        </span>
                    )}
                    <span
                        className="font-semibold text-3xl text-foreground tabular-nums"
                        data-testid="kpi-value"
                    >
                        {formattedValue}
                    </span>
                    {suffix && (
                        <span
                            className="text-muted-foreground text-sm"
                            data-testid="kpi-unit-suffix"
                        >
                            {suffix}
                        </span>
                    )}
                </div>

                {/* Delta badge (optional) */}
                {kpi.delta !== undefined && <DeltaBadge delta={kpi.delta} />}
            </div>
        </div>
    );
}
