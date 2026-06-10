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

import type { Widget } from '@/config/ia/schema';
import { useDashboardResolver } from '@/contexts/dashboard-resolver-context';
import { cn } from '@/lib/utils';
import { ArrowRightIcon, CalendarIcon, CheckIcon, ClockIcon } from '@repo/icons';
import { useQuery } from '@tanstack/react-query';
import { accentVars } from '../dashboard-accents';
import {
    WidgetCard,
    WidgetEmptyBody,
    WidgetErrorBody,
    WidgetSkeletonBody,
    WidgetUnavailableBody
} from './widget-states';

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
    /**
     * Optional multi-chip breakdown. When present and non-empty, the renderer
     * switches to GRID MODE: instead of one badge, it renders one chip per
     * sub-system (e.g. API / DB / Redis) with its own dot + status label.
     * Used by the system-health card so all dependencies read uniformly.
     */
    readonly items?: ReadonlyArray<StatusItem>;
    /**
     * Optional uptime in seconds (process.uptime() on the server). When set,
     * rendered as a humanised line below the chips ("Uptime: 3d 12h").
     */
    readonly uptime?: number;
    /**
     * Optional row of compact numeric stats rendered as small tiles under the
     * status chips (system-health card). When set, REPLACES the uptime footer
     * (uptime becomes one of the tiles instead).
     */
    readonly metrics?: StatusMetrics;
    /**
     * Optional usage / consumption bar shown below the badge. Used by HOST card
     * B to surface listing-quota usage ("3 de 5 alojamientos"). The bar fills
     * to `used / limit` and turns warning / destructive above the 80% / 100%
     * thresholds.
     */
    readonly usage?: StatusUsage;
    /**
     * Optional next-charge date as an ISO date string (e.g. `'2026-06-15'`).
     * Rendered below the badge as "Próximo cobro: dd MMM" when present.
     */
    readonly nextChargeDate?: string;
    /**
     * Optional trial expiration date as an ISO date string. When present and
     * still in the future, rendered as a "Quedan N días de prueba" line.
     */
    readonly trialEndsAt?: string;
    /**
     * Optional plan-quota tiles surfaced on HOST card B (e.g. "Alojamientos
     * 5", "Fotos / alojamiento 20", "Promos activas 3"). Each entry maps a
     * limit key from {@link EntitlementsApiResponse} to a short label + numeric
     * cap. Omit to hide the tile grid.
     */
    readonly limitTiles?: ReadonlyArray<StatusLimitTile>;
    /**
     * Optional URL for an "upgrade plan" call-to-action rendered at the foot
     * of the card. Built by the resolver so it can interpolate the site URL
     * (the admin lives on a different origin than the public web).
     */
    readonly upgradeHref?: string;
    /**
     * Optional list of plan-feature chips (HOST card B). Each entry maps an
     * active EntitlementKey to a short Spanish label. Rendered as a compact
     * pill row below the limit tiles so the host can see at a glance which
     * premium features are included in their current plan.
     */
    readonly featureChips?: ReadonlyArray<StatusFeatureChip>;
}

/**
 * A single plan-feature chip (HOST card B). Represents one active
 * EntitlementKey curated for consumer-facing display.
 */
export interface StatusFeatureChip {
    readonly key: string;
    readonly label: string;
}

/**
 * A single plan-quota tile (HOST card B). Rendered in a 3-col grid below the
 * usage bar so the user can see their plan's caps at a glance.
 *
 * `used` is optional — when set, the tile shows `used / value` plus a thin
 * progress bar coloured against the same thresholds as {@link UsageBar}
 * (≥100% destructive, ≥80% warning, otherwise the muted accent).
 */
export interface StatusLimitTile {
    readonly key: string;
    readonly label: string;
    readonly value: number;
    readonly used?: number;
}

/**
 * Usage / quota indicator (HOST card B — listing-quota gate).
 *
 * The renderer derives `pct = round(used / limit * 100)` and selects the bar
 * color from the threshold bands: ≥100% destructive, ≥80% warning, otherwise
 * success.
 */
export interface StatusUsage {
    readonly used: number;
    readonly limit: number;
    /** Optional human-readable label (e.g. `'alojamientos'`). */
    readonly label?: string;
}

/**
 * Compact server-side metrics surfaced as small tiles next to the status
 * chips (e.g. uptime, active connections, request count, error rate).
 */
export interface StatusMetrics {
    /** Server uptime in seconds (process.uptime). */
    readonly uptime?: number;
    /** In-flight HTTP connections (proxy for "users online" in dev). */
    readonly activeConnections?: number;
    /** Total requests served since the process started. */
    readonly totalRequests?: number;
    /** Global error rate as a decimal (0–1). */
    readonly errorRate?: number;
}

/**
 * A single sub-system status entry rendered in GRID MODE (see
 * {@link StatusData.items}). Each chip has its own dot + label + status text.
 */
export interface StatusItem {
    /** Stable key used for the React list key (e.g. `'api'`). */
    readonly key: string;
    /** Human-readable label (e.g. `'API'`, `'Base de datos'`). */
    readonly label: string;
    /** Status string — matched against `variantMap` for coloring. */
    readonly status: string;
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
 * Tailwind classes for the small status indicator dot next to the badge.
 */
const DOT_CLASSES: Readonly<Record<StatusVariant, string>> = {
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    destructive: 'bg-destructive',
    neutral: 'bg-muted-foreground'
} as const;

/**
 * Tailwind classes for the refined status pill rendered in the single-status
 * card hero (HOST card B redesign). Soft tinted background + matching ring so
 * it reads as a sub-label, not the primary visual element of the card.
 */
const STATUS_PILL_CLASSES: Readonly<Record<StatusVariant, string>> = {
    success: 'bg-green-50 text-green-700 ring-green-200/60',
    warning: 'bg-amber-50 text-amber-700 ring-amber-200/60',
    destructive: 'bg-rose-50 text-rose-700 ring-rose-200/60',
    neutral: 'bg-muted text-muted-foreground ring-border/60'
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
    /** Accent palette name for the card header chip (SPEC-155 redesign). */
    readonly accent?: string;
    /** Dashboard icon name for the card header chip (SPEC-155 redesign). */
    readonly icon?: string;
    /** Card-specific empty-state title. */
    readonly emptyText?: string;
    /** Card-specific empty-state description. */
    readonly emptyDescription?: string;
    /** Card-specific error-state title. */
    readonly errorText?: string;
    /** Card-specific error-state description. */
    readonly errorDescription?: string;
}

/**
 * Humanised Spanish labels for the canonical status strings. Used by the
 * multi-chip ("items") render mode so each chip reads as a sentence, not a
 * token.
 */
const STATUS_LABELS_ES: Readonly<Record<string, string>> = {
    up: 'Operativo',
    down: 'Caído',
    degraded: 'Degradado',
    unknown: 'Desconocido',
    connected: 'Conectado',
    disconnected: 'Desconectado'
};

/** Formats `process.uptime()` (seconds) as a compact "Xd Yh" / "Xh Ym" string. */
function formatUptime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '—';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
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
// BILLING SUB-BLOCKS — date helpers (legacy UsageBar dropped in HOST card B
// redesign; per-tile usage progress lives inside the limit-tile grid)
// ============================================================================

/**
 * Formats an ISO date string as `dd MMM` in Spanish locale (e.g. `15 jun`).
 * Returns the raw string when parsing fails so we never crash the widget.
 */
function formatShortDate(isoDate: string): string {
    const d = new Date(isoDate);
    if (Number.isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
}

/**
 * Computes whole days remaining between `now` and an ISO date string.
 * Returns `null` for invalid dates or past dates so callers can short-circuit.
 */
function daysUntil(isoDate: string): number | null {
    const target = new Date(isoDate);
    if (Number.isNaN(target.getTime())) return null;
    const diffMs = target.getTime() - Date.now();
    if (diffMs <= 0) return null;
    return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
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
        return (
            <WidgetCard
                label={displayLabel}
                variant="status"
                dataTestId="status-widget"
                accent={config.accent}
                icon={config.icon}
            >
                <WidgetUnavailableBody variant="status" />
            </WidgetCard>
        );
    }

    // -- 5. Loading ----------------------------------------------------------
    if (isLoading) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="status"
                dataTestId="status-widget"
                accent={config.accent}
                icon={config.icon}
            >
                <WidgetSkeletonBody variant="status" />
            </WidgetCard>
        );
    }

    // -- 6. Error ------------------------------------------------------------
    if (error) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="status"
                dataTestId="status-widget"
                accent={config.accent}
                icon={config.icon}
            >
                <WidgetErrorBody
                    variant="status"
                    onRetry={() => void refetch()}
                    text={config.errorText}
                    description={config.errorDescription}
                />
            </WidgetCard>
        );
    }

    // -- 7. Empty (null / undefined data) ------------------------------------
    if (data == null) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="status"
                dataTestId="status-widget"
                accent={config.accent}
                icon={config.icon}
            >
                <WidgetEmptyBody
                    variant="status"
                    text={config.emptyText ?? '—'}
                    description={config.emptyDescription}
                    icon={config.icon}
                />
            </WidgetCard>
        );
    }

    // -- 8. Data — narrow to StatusData shape --------------------------------
    const statusData = data as StatusData;

    // Defensive guard: if the resolver returned an unexpected shape (e.g. an
    // object without `status`, or a non-object), fall back to the empty state.
    if (!statusData || typeof statusData !== 'object' || typeof statusData.status !== 'string') {
        return (
            <WidgetCard
                label={displayLabel}
                variant="status"
                dataTestId="status-widget"
                accent={config.accent}
                icon={config.icon}
            >
                <WidgetEmptyBody
                    variant="status"
                    text={config.emptyText ?? '—'}
                    description={config.emptyDescription}
                    icon={config.icon}
                />
            </WidgetCard>
        );
    }

    // -- 8a. Multi-chip mode — uniform sub-system breakdown -------------------
    // When the resolver supplies an `items` array, render one chip per sub-system
    // (e.g. API / DB / Redis) so they read uniformly. The legacy single-badge
    // branch below is preserved for sources that don't provide items.
    if (Array.isArray(statusData.items) && statusData.items.length > 0) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="status"
                dataTestId="status-widget"
                accent={config.accent}
                icon={config.icon}
                ariaLabel={`${displayLabel}: ${statusData.status}`}
            >
                <div
                    className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
                    data-testid="status-items"
                >
                    {statusData.items.map((item) => {
                        const v = resolveVariant(item.status, config.variantMap);
                        const itemLabel = STATUS_LABELS_ES[item.status] ?? capitalize(item.status);
                        return (
                            <div
                                key={item.key}
                                className="flex flex-col gap-1.5 rounded-xl bg-card p-3 ring-1 ring-border/40"
                                data-testid="status-item"
                            >
                                <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
                                    {item.label}
                                </span>
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`size-2 shrink-0 rounded-full ${DOT_CLASSES[v]}`}
                                        aria-hidden="true"
                                    />
                                    <span className="font-semibold text-foreground text-sm">
                                        {itemLabel}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Metrics row — compact numeric tiles. Each chip pulls from
                    `metrics` first; falls back to `uptime` alone when no full
                    metrics object is present. */}
                {(statusData.metrics || typeof statusData.uptime === 'number') && (
                    <div
                        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                        data-testid="status-metrics"
                    >
                        {(() => {
                            const m = statusData.metrics ?? {};
                            const uptime = m.uptime ?? statusData.uptime;
                            const tiles: Array<{
                                key: string;
                                label: string;
                                value: string;
                            }> = [];
                            if (typeof uptime === 'number') {
                                tiles.push({
                                    key: 'uptime',
                                    label: 'Uptime',
                                    value: formatUptime(uptime)
                                });
                            }
                            if (typeof m.activeConnections === 'number') {
                                tiles.push({
                                    key: 'active',
                                    label: 'Conexiones',
                                    value: m.activeConnections.toLocaleString('es-AR')
                                });
                            }
                            if (typeof m.totalRequests === 'number') {
                                tiles.push({
                                    key: 'requests',
                                    label: 'Requests',
                                    value: m.totalRequests.toLocaleString('es-AR')
                                });
                            }
                            if (typeof m.errorRate === 'number') {
                                tiles.push({
                                    key: 'errors',
                                    label: 'Errores',
                                    value: `${(m.errorRate * 100).toFixed(1)}%`
                                });
                            }
                            return tiles.map((t) => (
                                <div
                                    key={t.key}
                                    className="flex flex-col gap-0.5 rounded-lg bg-card p-2.5 ring-1 ring-border/40"
                                    data-testid="status-metric"
                                >
                                    <span className="font-medium text-[0.65rem] text-muted-foreground uppercase tracking-wider">
                                        {t.label}
                                    </span>
                                    <span
                                        className="font-semibold text-foreground text-sm tabular-nums"
                                        style={{ fontFamily: 'var(--font-heading)' }}
                                    >
                                        {t.value}
                                    </span>
                                </div>
                            ));
                        })()}
                    </div>
                )}

                {/* Optional description (kept for back-compat) */}
                {statusData.description && (
                    <p
                        className="text-muted-foreground text-xs"
                        data-testid="status-description"
                    >
                        {statusData.description}
                    </p>
                )}
            </WidgetCard>
        );
    }

    const statusVariant = resolveVariant(statusData.status, config.variantMap);
    const badgeLabel = statusData.label ?? capitalize(statusData.status);
    const statusText = STATUS_LABELS_ES[statusData.status] ?? capitalize(statusData.status);
    const hasBillingMeta = statusData.nextChargeDate || statusData.trialEndsAt;

    return (
        <WidgetCard
            label={displayLabel}
            variant="status"
            dataTestId="status-widget"
            accent={config.accent}
            icon={config.icon}
            ariaLabel={`${displayLabel}: ${badgeLabel}`}
        >
            {/* Hero — "Plan actual" caption + plan name (Geologica) + status pill below */}
            <div
                className="flex flex-col gap-1"
                data-testid="status-badge-row"
            >
                <span
                    className="font-medium text-[0.65rem] text-muted-foreground uppercase tracking-wider"
                    data-testid="status-plan-caption"
                >
                    Plan actual
                </span>
                <span
                    className="mb-0.5 truncate font-semibold text-2xl text-foreground leading-tight tracking-tight"
                    style={{ fontFamily: 'var(--font-heading)' }}
                    data-testid="status-plan-name"
                >
                    {badgeLabel}
                </span>
                <span
                    className={cn(
                        'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium text-xs ring-1 ring-inset',
                        STATUS_PILL_CLASSES[statusVariant]
                    )}
                    data-testid="status-badge"
                    data-variant={statusVariant}
                    aria-label={`Status: ${statusText}`}
                >
                    <span
                        className={cn(
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            DOT_CLASSES[statusVariant]
                        )}
                        data-testid="status-indicator-dot"
                        aria-hidden="true"
                    />
                    {statusText}
                </span>
            </div>

            {/* Optional description (legacy line, free-text) */}
            {statusData.description && (
                <p
                    className="text-muted-foreground text-xs"
                    data-testid="status-description"
                >
                    {statusData.description}
                </p>
            )}

            {/* Billing sub-blocks (HOST card B) — plan-quota tiles, next charge, trial countdown.
                The legacy `UsageBar` is no longer rendered: the `max_accommodations`
                tile already surfaces `used / limit` plus a thin progress bar, so
                the big bar would be redundant. `statusData.usage` is still consumed
                by the resolver to feed the tile's `used` field. */}
            {statusData.limitTiles && statusData.limitTiles.length > 0 && (
                <div
                    className="grid grid-cols-3 gap-2"
                    data-testid="status-limit-tiles"
                >
                    {statusData.limitTiles.map((tile) => {
                        const hasUsage = typeof tile.used === 'number' && tile.value > 0;
                        const pct = hasUsage
                            ? Math.min(100, Math.round(((tile.used ?? 0) / tile.value) * 100))
                            : 0;
                        const barClass =
                            pct >= 100
                                ? 'bg-destructive'
                                : pct >= 80
                                  ? 'bg-amber-500'
                                  : 'bg-green-500';
                        return (
                            <div
                                key={tile.key}
                                className="flex flex-col items-start gap-1 rounded-lg bg-muted/40 p-2 ring-1 ring-border/30"
                                data-testid={`status-limit-tile-${tile.key}`}
                            >
                                <span
                                    className="font-semibold text-base text-foreground tabular-nums leading-none tracking-tight"
                                    style={{ fontFamily: 'var(--font-heading)' }}
                                >
                                    {hasUsage ? (
                                        <>
                                            {tile.used}
                                            <span className="text-muted-foreground/70"> / </span>
                                            {tile.value}
                                        </>
                                    ) : (
                                        tile.value
                                    )}
                                </span>
                                <span className="line-clamp-2 text-[0.65rem] text-muted-foreground leading-tight">
                                    {tile.label}
                                </span>
                                {hasUsage && (
                                    <div className="h-1 w-full overflow-hidden rounded-full bg-muted/60">
                                        {/* biome-ignore lint/a11y/useFocusableInteractive: presentational progress indicator */}
                                        <div
                                            className={cn(
                                                'h-full rounded-full transition-all duration-300',
                                                barClass
                                            )}
                                            style={{ width: `${pct}%` }}
                                            role="progressbar"
                                            aria-valuenow={pct}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {statusData.featureChips && statusData.featureChips.length > 0 && (
                <div
                    className="flex flex-wrap gap-1.5"
                    data-testid="status-feature-chips"
                >
                    {statusData.featureChips.map((chip) => (
                        <span
                            key={chip.key}
                            className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 font-medium text-[0.65rem] text-green-700 ring-1 ring-green-200/60 ring-inset"
                            data-testid={`status-feature-chip-${chip.key}`}
                        >
                            <CheckIcon
                                className="size-3"
                                aria-hidden="true"
                                weight="bold"
                            />
                            {chip.label}
                        </span>
                    ))}
                </div>
            )}

            {hasBillingMeta && (
                <div
                    className="mt-auto space-y-2 border-border/40 border-t pt-3 text-xs"
                    data-testid="status-billing-meta"
                >
                    {statusData.nextChargeDate && (
                        <div
                            className="flex items-center gap-2"
                            data-testid="status-next-charge"
                        >
                            <ClockIcon
                                className="size-4 shrink-0 text-muted-foreground/70"
                                aria-hidden="true"
                            />
                            <span className="text-muted-foreground">Próximo cobro</span>
                            <span className="ml-auto font-semibold text-foreground tabular-nums">
                                {formatShortDate(statusData.nextChargeDate)}
                            </span>
                        </div>
                    )}
                    {statusData.trialEndsAt &&
                        (() => {
                            const days = daysUntil(statusData.trialEndsAt);
                            if (days === null) return null;
                            return (
                                <div
                                    className="flex items-center gap-2"
                                    data-testid="status-trial-countdown"
                                >
                                    <CalendarIcon
                                        className="size-4 shrink-0 text-amber-500"
                                        aria-hidden="true"
                                    />
                                    <span className="text-muted-foreground">Período de prueba</span>
                                    <span className="ml-auto font-semibold text-amber-700 tabular-nums">
                                        {days === 1 ? 'Queda 1 día' : `Quedan ${days} días`}
                                    </span>
                                </div>
                            );
                        })()}
                </div>
            )}

            {/* Upgrade CTA — HOST card B. Link-style consistent with the
                ChecklistWidget foot CTA so the redesign reads uniformly. */}
            {statusData.upgradeHref && (
                <a
                    href={statusData.upgradeHref}
                    className="group/upgrade mt-auto inline-flex items-center gap-1 self-start font-medium text-xs transition-colors hover:underline hover:decoration-2 hover:underline-offset-4"
                    style={{ color: accentVars(config.accent).fg }}
                    data-testid="status-upgrade-cta"
                >
                    <span>Mejorar plan</span>
                    <ArrowRightIcon
                        className="size-3.5 transition-transform duration-200 group-hover/upgrade:translate-x-0.5"
                        aria-hidden="true"
                    />
                </a>
            )}
        </WidgetCard>
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
