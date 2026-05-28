/**
 * widget-states.tsx — Shared loading / error / empty / unavailable states
 * for all dashboard widget renderers (SPEC-155 T-028).
 *
 * Every widget renderer (KpiWidget, ListWidget, ChartWidget, ChecklistWidget,
 * StatusWidget) was implemented with identical inline state components. This
 * module extracts them into a single shared location so changes propagate to
 * all renderers at once and there is no duplicated source.
 *
 * ## WidgetCard shell
 *
 * `WidgetCard` is the canonical card container. It renders the card border,
 * background, padding, and — crucially — the visible title header in ALL
 * states (loading, error, empty, unavailable, data). Renderers compose it as:
 *
 * ```tsx
 * <WidgetCard label={displayLabel} variant="kpi" dataTestId="kpi-widget">
 *   {isLoading ? <WidgetSkeletonBody variant="kpi" /> : <ActualData />}
 * </WidgetCard>
 * ```
 *
 * The `headerExtra` prop allows renderers to inject additional content (e.g.
 * the chart-type badge) into the header row alongside the title.
 *
 * ## Body-only state components
 *
 * `WidgetSkeletonBody`, `WidgetErrorBody`, `WidgetEmptyBody`, and
 * `WidgetUnavailableBody` render only the state content (no card wrapper, no
 * title). They are intended for use inside `WidgetCard`.
 *
 * ## Legacy full-card state components (kept for backward compatibility)
 *
 * `WidgetSkeleton`, `WidgetError`, `WidgetEmpty`, and `WidgetUnavailable`
 * continue to export so the existing widget-states tests pass unchanged. They
 * are thin wrappers that compose `WidgetCard` + the matching body component.
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
 * `WidgetSkeletonBody` accepts a `variant` that selects the appropriate inner
 * placeholder shape for each widget type:
 *
 * | variant      | Shape |
 * |-------------|-------|
 * | `kpi`        | Large value + small delta line |
 * | `list`       | 4 two-line list rows |
 * | `chart`      | 7 variable-height bars + 7 label ticks |
 * | `checklist`  | Progress hint + 5 icon-label rows |
 * | `status`     | Pill badge + description line |
 *
 * @module widget-states
 * @see apps/admin/src/components/dashboards/widgets/KpiWidget.tsx
 * @see apps/admin/src/components/dashboards/widgets/ListWidget.tsx
 * @see apps/admin/src/components/dashboards/widgets/ChartWidget.tsx
 * @see apps/admin/src/components/dashboards/widgets/ChecklistWidget.tsx
 * @see apps/admin/src/components/dashboards/widgets/StatusWidget.tsx
 */

import { AlertTriangleIcon } from '@repo/icons';
import type { ReactNode } from 'react';

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
// WIDGET CARD SHELL
// ============================================================================

/**
 * Props for {@link WidgetCard}.
 */
export interface WidgetCardProps {
    /**
     * Widget display label — always rendered as a visible title in the header,
     * regardless of the current state (loading / error / empty / data).
     */
    readonly label: string;
    /**
     * Widget type variant — used to derive the outer `data-testid`
     * (`{variant}-widget-card`). Renderers override this via `dataTestId`.
     */
    readonly variant: WidgetVariant;
    /**
     * Explicit `data-testid` for the root card element.
     * When omitted, falls back to `{variant}-widget-card`.
     */
    readonly dataTestId?: string;
    /**
     * Accessible label for the entire card.
     * When omitted, falls back to `label`.
     */
    readonly ariaLabel?: string;
    /**
     * Optional extra content rendered in the header row to the right of the
     * title (e.g. a chart-type badge).
     */
    readonly headerExtra?: ReactNode;
    /** State content to render below the header. */
    readonly children: ReactNode;
}

/**
 * Shared card shell for all dashboard widget renderers.
 *
 * Guarantees that the widget title (`label`) is ALWAYS visible — in loading,
 * error, empty, unavailable, AND data states — so users always know which
 * card they are looking at.
 *
 * Renderers should compose this as:
 *
 * ```tsx
 * <WidgetCard label={displayLabel} variant="kpi" dataTestId="kpi-widget">
 *   {isLoading
 *     ? <WidgetSkeletonBody variant="kpi" />
 *     : <ActualKpiContent ... />}
 * </WidgetCard>
 * ```
 *
 * @example
 * ```tsx
 * <WidgetCard label="Total alojamientos" variant="kpi" dataTestId="kpi-widget">
 *   <WidgetSkeletonBody variant="kpi" />
 * </WidgetCard>
 * ```
 */
export function WidgetCard({
    label,
    variant,
    dataTestId,
    ariaLabel,
    headerExtra,
    children
}: WidgetCardProps) {
    const testId = dataTestId ?? `${variant}-widget-card`;
    return (
        <div
            className="flex flex-col gap-3 rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm"
            data-testid={testId}
            aria-label={ariaLabel ?? label}
        >
            {/* Header: title always visible */}
            <div className="flex items-center justify-between">
                <span
                    className="text-muted-foreground text-sm"
                    data-testid={`${variant}-label`}
                >
                    {label}
                </span>
                {headerExtra}
            </div>

            {/* State or data content */}
            {children}
        </div>
    );
}

// ============================================================================
// SKELETON INNER SHAPES (body-only — header lives in WidgetCard)
// ============================================================================

/** KPI skeleton body: large value + small delta row. */
function KpiSkeletonInner() {
    return (
        <>
            <div className="h-9 w-20 rounded bg-muted" />
            <div className="mt-2 h-4 w-16 rounded bg-muted" />
        </>
    );
}

/** List skeleton body: 4 two-line rows. */
function ListSkeletonInner() {
    return (
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
    );
}

/** Chart skeleton body: 7 variable-height bars + tick labels. */
function ChartSkeletonInner() {
    return (
        <>
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

/** Checklist skeleton body: progress hint + 5 icon-label rows. */
function ChecklistSkeletonInner() {
    return (
        <>
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

/** Status skeleton body: pill badge + description line. */
function StatusSkeletonInner() {
    return (
        <>
            <div className="h-6 w-20 rounded-full bg-muted" />
            <div className="mt-2 h-3 w-32 rounded bg-muted" />
        </>
    );
}

// ============================================================================
// WIDGET SKELETON BODY (use inside WidgetCard)
// ============================================================================

/**
 * Props for {@link WidgetSkeletonBody}.
 */
export interface WidgetSkeletonBodyProps extends WidgetStateBaseProps {}

/**
 * Body-only loading skeleton for use INSIDE a {@link WidgetCard}.
 *
 * Renders only the pulse-animated content area (no card wrapper, no title).
 * Use this with `WidgetCard` so the title stays visible while loading.
 *
 * The wrapper has `data-testid="{variant}-widget-skeleton"` to maintain
 * backward compatibility with per-renderer tests.
 *
 * @example
 * ```tsx
 * <WidgetCard label={displayLabel} variant="kpi" dataTestId="kpi-widget">
 *   <WidgetSkeletonBody variant="kpi" />
 * </WidgetCard>
 * ```
 */
export function WidgetSkeletonBody({ variant }: WidgetSkeletonBodyProps) {
    return (
        <div
            className="animate-pulse"
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
// WIDGET SKELETON (legacy full-card — kept for widget-states.test.tsx compat)
// ============================================================================

/**
 * Props for {@link WidgetSkeleton}.
 */
export interface WidgetSkeletonProps extends WidgetStateBaseProps {}

/**
 * Loading skeleton for a dashboard widget card.
 *
 * @deprecated Prefer composing {@link WidgetCard} + {@link WidgetSkeletonBody}
 * so the widget title remains visible while loading. This full-card variant
 * is kept for backward compatibility with widget-states tests.
 *
 * The `data-testid` is `{variant}-widget-skeleton` to preserve backward
 * compatibility with existing per-renderer tests.
 *
 * @example
 * ```tsx
 * <WidgetSkeleton variant="kpi" />
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
            {/* Header placeholder — matches original per-variant counts so widget-states tests pass */}
            <div className="mb-3 h-4 w-24 rounded bg-muted" />
            {variant === 'kpi' && <KpiSkeletonInner />}
            {variant === 'list' && <ListSkeletonInner />}
            {variant === 'chart' && <ChartSkeletonInner />}
            {variant === 'checklist' && <ChecklistSkeletonInner />}
            {variant === 'status' && <StatusSkeletonInner />}
        </div>
    );
}

// ============================================================================
// WIDGET ERROR BODY (use inside WidgetCard)
// ============================================================================

/**
 * Props for {@link WidgetErrorBody}.
 */
export interface WidgetErrorBodyProps extends WidgetStateBaseProps {
    /** Callback invoked when the user clicks "Reintentar". */
    readonly onRetry: () => void;
}

/**
 * Body-only error state for use INSIDE a {@link WidgetCard}.
 *
 * Renders the alert icon, message, and retry button. The surrounding card
 * and title are provided by `WidgetCard` so they remain visible on error.
 *
 * The wrapper has `data-testid="{variant}-widget-error"` and `role="alert"`.
 *
 * @example
 * ```tsx
 * <WidgetCard label={displayLabel} variant="kpi" dataTestId="kpi-widget">
 *   <WidgetErrorBody variant="kpi" onRetry={() => void refetch()} />
 * </WidgetCard>
 * ```
 */
export function WidgetErrorBody({ variant, onRetry }: WidgetErrorBodyProps) {
    return (
        <div
            className="flex flex-col items-center justify-center gap-3 py-2"
            data-testid={`${variant}-widget-error`}
            role="alert"
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
// WIDGET ERROR (legacy full-card — kept for widget-states.test.tsx compat)
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
 * @deprecated Prefer composing {@link WidgetCard} + {@link WidgetErrorBody}
 * so the widget title remains visible on error. This full-card variant is kept
 * for backward compatibility with widget-states tests.
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
// WIDGET EMPTY BODY (use inside WidgetCard)
// ============================================================================

/**
 * Props for {@link WidgetEmptyBody}.
 */
export interface WidgetEmptyBodyProps extends WidgetStateBaseProps {
    /**
     * Optional text to display inside the empty state.
     * Defaults to `"—"` when not provided.
     */
    readonly text?: string;
}

/**
 * Body-only empty state for use INSIDE a {@link WidgetCard}.
 *
 * Renders only the "no data" message. The surrounding card and title are
 * provided by `WidgetCard` so they remain visible when empty.
 *
 * The wrapper has `data-testid="{variant}-widget-empty"`.
 *
 * @example
 * ```tsx
 * <WidgetCard label={displayLabel} variant="kpi" dataTestId="kpi-widget">
 *   <WidgetEmptyBody variant="kpi" />
 * </WidgetCard>
 * ```
 */
export function WidgetEmptyBody({ variant, text = '—' }: WidgetEmptyBodyProps) {
    return (
        <div
            className="flex items-center justify-center py-2 text-muted-foreground"
            data-testid={`${variant}-widget-empty`}
        >
            <span className="text-sm">{text}</span>
        </div>
    );
}

// ============================================================================
// WIDGET EMPTY (legacy full-card — kept for widget-states.test.tsx compat)
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
 * @deprecated Prefer composing {@link WidgetCard} + {@link WidgetEmptyBody}
 * so the widget title remains visible when empty. This full-card variant is
 * kept for backward compatibility with widget-states tests.
 *
 * The `data-testid` is `{variant}-widget-empty`.
 *
 * @example
 * ```tsx
 * <WidgetEmpty variant="kpi" />
 * <WidgetEmpty variant="list" text="Sin datos" />
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
// WIDGET UNAVAILABLE BODY (use inside WidgetCard)
// ============================================================================

/**
 * Props for {@link WidgetUnavailableBody}.
 */
export interface WidgetUnavailableBodyProps extends WidgetStateBaseProps {}

/**
 * Body-only unavailable state for use INSIDE a {@link WidgetCard}.
 *
 * Renders only the "Sin fuente de datos" message. The surrounding card and
 * title are provided by `WidgetCard` so users know which source is missing.
 *
 * The wrapper has `data-testid="{variant}-widget-unavailable"`.
 *
 * @example
 * ```tsx
 * <WidgetCard label={displayLabel} variant="kpi" dataTestId="kpi-widget">
 *   <WidgetUnavailableBody variant="kpi" />
 * </WidgetCard>
 * ```
 */
export function WidgetUnavailableBody({ variant }: WidgetUnavailableBodyProps) {
    return (
        <div
            className="flex items-center justify-center py-2 text-muted-foreground"
            data-testid={`${variant}-widget-unavailable`}
        >
            <span className="text-xs">Sin fuente de datos</span>
        </div>
    );
}

// ============================================================================
// WIDGET UNAVAILABLE (legacy full-card — kept for widget-states.test.tsx compat)
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
 * @deprecated Prefer composing {@link WidgetCard} + {@link WidgetUnavailableBody}
 * so the widget title remains visible when unavailable. This full-card variant
 * is kept for backward compatibility with widget-states tests.
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
