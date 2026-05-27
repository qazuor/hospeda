/**
 * StatusWidget — Health/badge-style status renderer for dashboard widget system (SPEC-155 T-027).
 *
 * Follows the exact resolver+useQuery+states pattern established by KpiWidget (T-023).
 * Use cases (per SPEC-155 §03c):
 *   - HOST card B: subscription status badge (active / expiring / expired)
 *   - ADMIN card E: system health (db / redis / api — up / degraded / down)
 *
 * ## Variant mapping
 *
 * The widget's `config.variantMap` drives the badge color/variant for each
 * status string value. Keys are the exact strings the resolver's `queryFn`
 * returns as `StatusData.status`. Values map to a `StatusVariant` which in
 * turn maps to a Tailwind color set:
 *
 * ```json
 * {
 *   "variantMap": {
 *     "active":    "success",
 *     "expiring":  "warning",
 *     "expired":   "destructive",
 *     "up":        "success",
 *     "degraded":  "warning",
 *     "down":      "destructive"
 *   }
 * }
 * ```
 *
 * Any status string NOT found in the map falls back to `"neutral"` (muted grey).
 *
 * ## Renderer pattern (identical to KpiWidget — copy verbatim)
 *
 * 1. Accept `widget: Widget` as the only prop.
 * 2. Pull `source` from `widget.config?.source as string ?? ''`.
 * 3. Call `useDashboardResolver()` to get `resolveForScope`.
 * 4. Call `resolveForScope(sourceId, widget.scope)` — ALWAYS before `useQuery`
 *    (hooks cannot be called conditionally). Capture `{ found, options }`.
 * 5. Call `useQuery(options)`.
 * 6. If `!found` → render `<StatusWidgetUnavailable>`.
 * 7. If `isLoading` → render `<StatusSkeleton>`.
 * 8. If `error` → render `<StatusWidgetError>` with `refetch` as retry.
 * 9. If data is null/undefined → render `<StatusWidgetEmpty>`.
 * 10. Otherwise render the status badge card.
 *
 * @module StatusWidget
 * @see apps/admin/src/components/dashboards/widgets/KpiWidget.tsx — pilot pattern (T-023)
 * @see apps/admin/src/lib/dashboard-sources.ts
 * @see apps/admin/src/contexts/dashboard-resolver-context.tsx
 * @see apps/admin/src/config/ia/schema.ts
 */

import { Badge } from '@/components/ui-wrapped/Badge';
import type { Widget } from '@/config/ia/schema';
import { useDashboardResolver } from '@/contexts/dashboard-resolver-context';
import { AlertTriangleIcon } from '@repo/icons';
import { useQuery } from '@tanstack/react-query';

// ============================================================================
// STATUS DATA SHAPE
// ============================================================================

/**
 * Expected data shape returned by a status resolver's `queryFn`.
 *
 * `status` is the canonical string value (e.g. `"active"`, `"up"`, `"down"`).
 * `label` is an optional human-readable override displayed inside the badge.
 * `description` is an optional line rendered below the badge for extra context.
 */
export interface StatusData {
    /** The canonical status string — matched against `variantMap` for coloring. */
    readonly status: string;
    /**
     * Optional human-readable label shown inside the badge.
     * Falls back to `status` (capitalised) when absent.
     */
    readonly label?: string;
    /**
     * Optional description rendered below the badge (e.g. "Checked 2 min ago").
     */
    readonly description?: string;
}

// ============================================================================
// VARIANT SYSTEM
// ============================================================================

/**
 * Named semantic variants for status badges.
 *
 * - `success`     — green (healthy / active)
 * - `warning`     — amber (degraded / expiring)
 * - `destructive` — red (down / expired)
 * - `neutral`     — grey (unknown / default fallback)
 */
export type StatusVariant = 'success' | 'warning' | 'destructive' | 'neutral';

/**
 * Mapping from variant name to Tailwind utility classes for the badge background,
 * text, and border.
 *
 * These are kept outside the render function so they are defined once and shared
 * by the status indicator dot and the badge.
 */
const VARIANT_CLASSES: Readonly<Record<StatusVariant, string>> = {
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    destructive: 'bg-destructive/10 text-destructive border-destructive/20',
    neutral: 'bg-muted text-muted-foreground border-border'
} as const;

/**
 * Tailwind classes for the small status indicator dot next to the badge.
 */
const DOT_CLASSES: Readonly<Record<StatusVariant, string>> = {
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    destructive: 'bg-destructive',
    neutral: 'bg-muted-foreground'
} as const;

// ============================================================================
// WIDGET-SPECIFIC CONFIG SHAPE
// ============================================================================

/**
 * Status-widget-specific fields that may live inside `widget.config`.
 *
 * All fields are optional — the renderer never crashes when they are absent.
 */
export interface StatusWidgetConfig {
    /** Source ID for the resolver registry. */
    readonly source?: string;
    /**
     * Map from status string value → `StatusVariant`.
     * Entries not present in this map render with the `neutral` fallback.
     *
     * @example
     * ```json
     * {
     *   "active":   "success",
     *   "expiring": "warning",
     *   "expired":  "destructive"
     * }
     * ```
     */
    readonly variantMap?: Readonly<Record<string, StatusVariant>>;
}

// ============================================================================
// PROPS
// ============================================================================

/**
 * Props for the StatusWidget renderer.
 * Follows the RO-RO pattern — single readonly object.
 */
export interface StatusWidgetProps {
    /**
     * Full widget definition from the IA config (validated by `WidgetSchema`).
     * The renderer reads `widget.config.source`, `widget.config.variantMap`,
     * `widget.scope`, and `widget.label` from this object.
     */
    readonly widget: Widget;
}

// ============================================================================
// INLINE SHARED STATES (T-028 extracts these)
// ============================================================================

/**
 * Loading skeleton for a status card.
 * Mirrors the pulse card pattern used in KpiWidget's KpiSkeleton.
 *
 * T-028: extract to `widget-states.tsx` as `<WidgetSkeleton variant="status" />`.
 */
function StatusSkeleton() {
    return (
        <div
            className="animate-pulse rounded-lg border bg-card p-4"
            data-testid="status-widget-skeleton"
            aria-busy="true"
            aria-label="Loading"
        >
            <div className="mb-3 h-4 w-24 rounded bg-muted" />
            <div className="h-6 w-20 rounded-full bg-muted" />
            <div className="mt-2 h-3 w-32 rounded bg-muted" />
        </div>
    );
}

/**
 * Error state for a status widget that failed to fetch its data.
 *
 * T-028: extract to `widget-states.tsx` as `<WidgetError onRetry={fn} />`.
 */
interface StatusWidgetErrorProps {
    readonly onRetry: () => void;
    readonly label: string;
}

function StatusWidgetError({ onRetry, label }: StatusWidgetErrorProps) {
    return (
        <div
            className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-card p-4"
            data-testid="status-widget-error"
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
 * Empty state for a status widget that resolved but returned no data.
 *
 * T-028: extract to `widget-states.tsx` as `<WidgetEmpty />`.
 */
function StatusWidgetEmpty() {
    return (
        <div
            className="flex items-center justify-center rounded-lg border bg-card p-4 text-muted-foreground"
            data-testid="status-widget-empty"
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
interface StatusWidgetUnavailableProps {
    readonly label: string;
}

function StatusWidgetUnavailable({ label }: StatusWidgetUnavailableProps) {
    return (
        <div
            className="flex items-center justify-center rounded-lg border border-dashed bg-card p-4 text-muted-foreground"
            data-testid="status-widget-unavailable"
            aria-label={`${label} — data source unavailable`}
        >
            <span className="text-xs">Sin fuente de datos</span>
        </div>
    );
}

// ============================================================================
// VARIANT RESOLUTION HELPER
// ============================================================================

/**
 * Resolves a status string to its {@link StatusVariant} using the configured
 * `variantMap`. Falls back to `"neutral"` when the status is not mapped.
 *
 * @param status     - The canonical status string from the resolver data.
 * @param variantMap - The variant map from `widget.config.variantMap`.
 * @returns The resolved {@link StatusVariant}.
 */
function resolveVariant(
    status: string,
    variantMap: Readonly<Record<string, StatusVariant>> | undefined
): StatusVariant {
    if (!variantMap) return 'neutral';
    return variantMap[status] ?? 'neutral';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * StatusWidget — renders a single health/badge-style status card for the dashboard.
 *
 * Reads data from the resolver registry via `useDashboardResolver` and
 * `useQuery`. Handles all four states: loading, error, empty, and data.
 * Applies a config-driven variant mapping to color the status badge.
 *
 * Config shape expected in `widget.config`:
 * ```json
 * {
 *   "source": "admin.system.health",
 *   "variantMap": {
 *     "up":       "success",
 *     "degraded": "warning",
 *     "down":     "destructive"
 *   }
 * }
 * ```
 *
 * Data shape expected from the resolver's `queryFn`:
 * ```json
 * { "status": "up", "label": "Healthy", "description": "All systems operational" }
 * ```
 *
 * @example
 * ```tsx
 * <StatusWidget widget={widget} />
 * ```
 */
export function StatusWidget({ widget }: StatusWidgetProps) {
    // -- 1. Extract source id and config overrides ---------------------------
    const config = (widget.config ?? {}) as StatusWidgetConfig;
    const sourceId = config.source ?? '';

    // -- 2. Resolve to query options (always — hooks cannot be conditional) --
    const { resolveForScope } = useDashboardResolver();
    const { found, options } = resolveForScope(sourceId, widget.scope);

    // -- 3. Fetch with TanStack Query ----------------------------------------
    const { data, isLoading, error, refetch } = useQuery(options);

    // Derive display label from the widget's i18n label (admin locale = 'es').
    // T-034 (page renderer) will pass the active locale; for now default to 'es'.
    const displayLabel = widget.label.es;

    // -- 4. Unavailable (source not registered) ------------------------------
    if (!found) {
        return <StatusWidgetUnavailable label={displayLabel} />;
    }

    // -- 5. Loading ----------------------------------------------------------
    if (isLoading) {
        return <StatusSkeleton />;
    }

    // -- 6. Error ------------------------------------------------------------
    if (error) {
        return (
            <StatusWidgetError
                label={displayLabel}
                onRetry={() => void refetch()}
            />
        );
    }

    // -- 7. Empty (null / undefined data) ------------------------------------
    if (data == null) {
        return <StatusWidgetEmpty />;
    }

    // -- 8. Data — narrow to StatusData shape --------------------------------
    const statusData = data as StatusData;
    const variant = resolveVariant(statusData.status, config.variantMap);
    const badgeLabel = statusData.label ?? capitalize(statusData.status);

    return (
        <div
            className="flex flex-col gap-3 rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm"
            data-testid="status-widget"
            aria-label={`${displayLabel}: ${badgeLabel}`}
        >
            {/* Header: label */}
            <span
                className="text-muted-foreground text-sm"
                data-testid="status-label"
            >
                {displayLabel}
            </span>

            {/* Status badge row */}
            <div
                className="flex items-center gap-2"
                data-testid="status-badge-row"
            >
                {/* Indicator dot */}
                <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${DOT_CLASSES[variant]}`}
                    data-testid="status-indicator-dot"
                    aria-hidden="true"
                />

                {/* Badge */}
                <Badge
                    className={VARIANT_CLASSES[variant]}
                    data-testid="status-badge"
                    data-variant={variant}
                    aria-label={`Status: ${badgeLabel}`}
                >
                    {badgeLabel}
                </Badge>
            </div>

            {/* Optional description */}
            {statusData.description && (
                <p
                    className="text-muted-foreground text-xs"
                    data-testid="status-description"
                >
                    {statusData.description}
                </p>
            )}
        </div>
    );
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Capitalises the first character of a string.
 * Used as a fallback label when the resolver omits `data.label`.
 *
 * @param value - The string to capitalise.
 * @returns The string with its first character uppercased.
 */
function capitalize(value: string): string {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
}
