/**
 * widget-states.tsx — Shared loading / error / empty / unavailable states
 * for all dashboard widget renderers (SPEC-155 T-028).
 *
 * Every widget renderer (KpiWidget, ListWidget, ChartWidget, ChecklistWidget,
 * StatusWidget) was implemented with identical inline state components. This
 * module extracts them into a single shared location so changes propagate to
 * all renderers at once and there is no duplicated source.
 *
 * ## data-testid convention
 *
 * All state components accept a `variant` string that is interpolated into
 * `data-testid` attributes so the existing renderer tests continue to match
 * their widget-specific testids without modification:
 *
 * ```
 * variant="kpi"       → data-testid="kpi-widget-skeleton"
 * variant="list"      → data-testid="list-widget-skeleton"
 * variant="chart"     → data-testid="chart-widget-skeleton"
 * variant="checklist" → data-testid="checklist-widget-skeleton"
 * variant="status"    → data-testid="status-widget-skeleton"
 * ```
 *
 * ## Skeleton shapes
 *
 * `WidgetSkeleton` accepts a `variant` that selects the appropriate inner
 * placeholder shape for each widget type:
 *
 * | variant      | Shape |
 * |-------------|-------|
 * | `kpi`        | Label line + large value + small delta line |
 * | `list`       | Header + 4 two-line list rows |
 * | `chart`      | Header + 7 variable-height bars + 7 label ticks |
 * | `checklist`  | Header + progress hint + 5 icon-label rows |
 * | `status`     | Label line + pill badge + description line |
 *
 * @module widget-states
 * @see apps/admin/src/components/dashboards/widgets/KpiWidget.tsx
 * @see apps/admin/src/components/dashboards/widgets/ListWidget.tsx
 * @see apps/admin/src/components/dashboards/widgets/ChartWidget.tsx
 * @see apps/admin/src/components/dashboards/widgets/ChecklistWidget.tsx
 * @see apps/admin/src/components/dashboards/widgets/StatusWidget.tsx
 */

import { AlertTriangleIcon } from '@repo/icons';

// ============================================================================
// VARIANT TYPE
// ============================================================================

/**
 * Widget type variants. Used to derive per-widget `data-testid` strings so
 * the existing per-renderer tests continue to match without modification.
 */
export type WidgetVariant = 'kpi' | 'list' | 'chart' | 'checklist' | 'status';

// ============================================================================
// SHARED PROPS
// ============================================================================

/**
 * Base props shared by all state components.
 *
 * `variant` drives the `data-testid` to `{variant}-widget-{state}`.
 */
interface WidgetStateBaseProps {
    /** Widget type — used to derive the `data-testid`. */
    readonly variant: WidgetVariant;
}

// ============================================================================
// SKELETON INNER SHAPES
// ============================================================================

/** KPI skeleton inner: label + large value + small delta row. */
function KpiSkeletonInner() {
    return (
        <>
            <div className="mb-3 h-4 w-24 rounded bg-muted" />
            <div className="h-9 w-20 rounded bg-muted" />
            <div className="mt-2 h-4 w-16 rounded bg-muted" />
        </>
    );
}

/** List skeleton inner: header + 4 two-line rows. */
function ListSkeletonInner() {
    return (
        <>
            <div className="mb-3 h-4 w-32 rounded bg-muted" />
            <ul className="space-y-2">
                {(['s1', 's2', 's3', 's4'] as const).map((skeletonId) => (
                    <li
                        key={skeletonId}
                        className="flex items-center justify-between"
                    >
                        <div className="space-y-1">
                            <div className="h-3.5 w-40 rounded bg-muted" />
                            <div className="h-3 w-24 rounded bg-muted" />
                        </div>
                        <div className="h-3 w-10 rounded bg-muted" />
                    </li>
                ))}
            </ul>
        </>
    );
}

/** Chart skeleton inner: header + 7 variable-height bars + tick labels. */
function ChartSkeletonInner() {
    return (
        <>
            <div className="mb-3 h-4 w-32 rounded bg-muted" />
            <div className="flex h-24 items-end gap-1">
                {[40, 60, 45, 80, 55, 70, 50].map((pct, i) => (
                    <div
                        // biome-ignore lint/suspicious/noArrayIndexKey: stable skeleton, index is fine
                        key={i}
                        className="flex-1 rounded bg-muted"
                        style={{ height: `${pct}%` }}
                    />
                ))}
            </div>
            <div className="mt-2 flex justify-between">
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <div
                        key={i}
                        className="h-3 w-6 rounded bg-muted"
                    />
                ))}
            </div>
        </>
    );
}

/** Checklist skeleton inner: header + progress hint + 5 icon-label rows. */
function ChecklistSkeletonInner() {
    return (
        <>
            <div className="mb-4 h-4 w-32 rounded bg-muted" />
            <div className="mb-3 h-3 w-24 rounded bg-muted" />
            <div className="flex flex-col gap-2">
                {(['c1', 'c2', 'c3', 'c4', 'c5'] as const).map((skeletonId) => (
                    <div
                        key={skeletonId}
                        className="flex items-center gap-2"
                    >
                        <div className="h-4 w-4 rounded-full bg-muted" />
                        <div className="h-3 flex-1 rounded bg-muted" />
                    </div>
                ))}
            </div>
        </>
    );
}

/** Status skeleton inner: label + pill badge + description line. */
function StatusSkeletonInner() {
    return (
        <>
            <div className="mb-3 h-4 w-24 rounded bg-muted" />
            <div className="h-6 w-20 rounded-full bg-muted" />
            <div className="mt-2 h-3 w-32 rounded bg-muted" />
        </>
    );
}

// ============================================================================
// WIDGET SKELETON
// ============================================================================

/**
 * Props for {@link WidgetSkeleton}.
 */
export interface WidgetSkeletonProps extends WidgetStateBaseProps {}

/**
 * Loading skeleton for a dashboard widget card.
 *
 * Renders the pulse animation container common to all variants and delegates
 * the inner shape to the per-variant sub-component so each widget type gets
 * an appropriate placeholder that matches its real content density.
 *
 * The `data-testid` is `{variant}-widget-skeleton` to preserve backward
 * compatibility with existing per-renderer tests.
 *
 * @example
 * ```tsx
 * <WidgetSkeleton variant="kpi" />
 * <WidgetSkeleton variant="list" />
 * <WidgetSkeleton variant="chart" />
 * ```
 */
export function WidgetSkeleton({ variant }: WidgetSkeletonProps) {
    return (
        <div
            className="animate-pulse rounded-lg border bg-card p-4"
            data-testid={`${variant}-widget-skeleton`}
            aria-busy="true"
            aria-label="Loading"
        >
            {variant === 'kpi' && <KpiSkeletonInner />}
            {variant === 'list' && <ListSkeletonInner />}
            {variant === 'chart' && <ChartSkeletonInner />}
            {variant === 'checklist' && <ChecklistSkeletonInner />}
            {variant === 'status' && <StatusSkeletonInner />}
        </div>
    );
}

// ============================================================================
// WIDGET ERROR
// ============================================================================

/**
 * Props for {@link WidgetError}.
 */
export interface WidgetErrorProps extends WidgetStateBaseProps {
    /** Callback invoked when the user clicks "Reintentar". */
    readonly onRetry: () => void;
    /** Display label used in the `aria-label` (`Error loading {label}`). */
    readonly label: string;
}

/**
 * Error state for a widget that failed to fetch its data.
 *
 * Renders an alert card with an `AlertTriangleIcon`, a message, and a retry
 * button. The `data-testid` is `{variant}-widget-error`.
 *
 * @example
 * ```tsx
 * <WidgetError variant="kpi" label="Total alojamientos" onRetry={() => void refetch()} />
 * ```
 */
export function WidgetError({ variant, onRetry, label }: WidgetErrorProps) {
    return (
        <div
            className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-card p-4"
            data-testid={`${variant}-widget-error`}
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

// ============================================================================
// WIDGET EMPTY
// ============================================================================

/**
 * Props for {@link WidgetEmpty}.
 */
export interface WidgetEmptyProps extends WidgetStateBaseProps {
    /**
     * Optional text to display inside the empty state.
     * Different widget types use different copy (e.g. "—" vs "Sin datos").
     * Defaults to `"—"` when not provided.
     */
    readonly text?: string;
}

/**
 * Empty state for a widget that resolved but returned no data.
 *
 * The `data-testid` is `{variant}-widget-empty`.
 *
 * @example
 * ```tsx
 * <WidgetEmpty variant="kpi" />
 * <WidgetEmpty variant="list" text="Sin datos" />
 * <WidgetEmpty variant="checklist" text="Sin datos disponibles" />
 * ```
 */
export function WidgetEmpty({ variant, text = '—' }: WidgetEmptyProps) {
    return (
        <div
            className="flex items-center justify-center rounded-lg border bg-card p-4 text-muted-foreground"
            data-testid={`${variant}-widget-empty`}
        >
            <span className="text-sm">{text}</span>
        </div>
    );
}

// ============================================================================
// WIDGET UNAVAILABLE
// ============================================================================

/**
 * Props for {@link WidgetUnavailable}.
 */
export interface WidgetUnavailableProps extends WidgetStateBaseProps {
    /** Widget label used in the `aria-label` (`{label} — data source unavailable`). */
    readonly label: string;
}

/**
 * Fallback when the source ID is not registered in the resolver registry.
 *
 * The `data-testid` is `{variant}-widget-unavailable`.
 *
 * @example
 * ```tsx
 * <WidgetUnavailable variant="kpi" label="Total alojamientos" />
 * ```
 */
export function WidgetUnavailable({ variant, label }: WidgetUnavailableProps) {
    return (
        <div
            className="flex items-center justify-center rounded-lg border border-dashed bg-card p-4 text-muted-foreground"
            data-testid={`${variant}-widget-unavailable`}
            aria-label={`${label} — data source unavailable`}
        >
            <span className="text-xs">Sin fuente de datos</span>
        </div>
    );
}
