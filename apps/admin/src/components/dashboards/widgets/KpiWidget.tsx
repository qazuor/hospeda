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

import type { I18nLabel, Widget } from '@/config/ia/schema';
import { useDashboardResolver } from '@/contexts/dashboard-resolver-context';
import { cn } from '@/lib/utils';
import { TrendingDownIcon, TrendingUpIcon } from '@repo/icons';
import { useQuery } from '@tanstack/react-query';
import { accentVars, resolveDashboardIcon } from '../dashboard-accents';
import {
    WidgetCard,
    WidgetEmptyBody,
    WidgetErrorBody,
    WidgetSkeletonBody,
    WidgetUnavailableBody
} from './widget-states';

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
    /**
     * Optional multi-KPI breakdown. When present and non-empty, the renderer
     * switches to GRID MODE: instead of one big number, it renders one mini-KPI
     * per entry (value + label, optionally clickable). Used by the ADMIN
     * "Estadísticas de entidades" card so all entity counts are visible at once
     * rather than collapsed into a single sum (SPEC-155 follow-up).
     *
     * Resolvers that only provide a single `value` (e.g. moderation pending,
     * host accommodation count) MUST NOT set this — they keep single-value mode.
     */
    readonly kpis?: ReadonlyArray<KpiGridItem>;
}

/**
 * A single mini-KPI entry rendered in GRID MODE (see {@link KpiData.kpis}).
 *
 * The label is a tri-locale {@link I18nLabel}; the renderer displays the `es`
 * locale (consistent with the rest of the dashboard until T-034 threads the
 * active locale through). When `href` is set the whole tile is a navigation
 * link to the matching admin list.
 */
export interface KpiGridItem {
    /** Stable key used for the React list key (e.g. the entity name). */
    readonly key: string;
    /** Tri-locale display label for this metric. */
    readonly label: I18nLabel;
    /** Numeric value for this metric. */
    readonly value: number;
    /** Optional internal link to the matching list page. */
    readonly href?: string;
    /**
     * Optional accent palette name (SPEC-155 redesign). Tints the tile's value
     * + chip so each entry in the grid reads in its own color.
     */
    readonly accent?: string;
    /**
     * Optional dashboard icon name (e.g. `'buildings'`). Rendered in a chip on
     * the left of the tile. Resolved via `resolveDashboardIcon`.
     */
    readonly icon?: string;
    /** Optional prefix shown before the value (e.g. `'$'`). */
    readonly unitPrefix?: string;
    /** Optional suffix shown after the value (e.g. `'%'`). */
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
    /** Accent palette name for the card icon chip (SPEC-155 redesign). */
    readonly accent?: string;
    /** `@repo/icons` name for the card icon chip (SPEC-155 redesign). */
    readonly icon?: string;
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

    // Pill style (refs): tinted background + colored text, not just colored text.
    const pillClass = isPositive
        ? 'bg-success/10 text-success'
        : isNegative
          ? 'bg-destructive/10 text-destructive'
          : 'bg-muted text-muted-foreground';

    const absValue = Math.abs(delta);

    return (
        <span
            className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium text-xs',
                pillClass
            )}
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
// GRID TILE
// ============================================================================

/**
 * Renders a single mini-KPI tile in GRID MODE.
 *
 * When `item.href` is set the tile is a navigation link to the matching admin
 * list; otherwise it is a plain, non-interactive tile. Extracted as its own
 * component so the `key` lives on the element returned by `.map()` (and so the
 * value/label fragment is encapsulated rather than emitted inside the loop).
 */
interface KpiGridTileProps {
    readonly item: KpiGridItem;
}

function KpiGridTile({ item }: KpiGridTileProps) {
    const itemLabel = typeof item.label === 'string' ? item.label : item.label.es;
    const itemValue = typeof item.value === 'number' ? item.value.toLocaleString('es-AR') : '—';
    const vars = accentVars(item.accent);
    const ItemIcon = resolveDashboardIcon(item.icon);

    // Horizontal compact layout: chip on the left, value + label stacked on the
    // right. Halves the tile height vs the previous columnar layout and removes
    // the decorative microbar (no real trend series to back it).
    const body = (
        <>
            {ItemIcon ? (
                <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: vars.chip }}
                    aria-hidden="true"
                >
                    <ItemIcon
                        size={22}
                        weight="duotone"
                        color={vars.fg}
                        duotoneColor={vars.solid}
                    />
                </span>
            ) : (
                <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: vars.solid }}
                    aria-hidden="true"
                />
            )}

            <div className="flex min-w-0 flex-col">
                <span
                    className="font-semibold text-2xl tabular-nums leading-none tracking-tight"
                    style={{ color: vars.fg, fontFamily: 'var(--font-heading)' }}
                    data-testid="kpi-grid-item-value"
                >
                    {item.unitPrefix && (
                        <span className="text-base opacity-70">{item.unitPrefix}</span>
                    )}
                    {itemValue}
                    {item.unitSuffix && (
                        <span className="ml-0.5 text-base opacity-70">{item.unitSuffix}</span>
                    )}
                </span>
                <span
                    className="mt-1 line-clamp-2 font-medium text-muted-foreground text-xs leading-tight"
                    data-testid="kpi-grid-item-label"
                >
                    {itemLabel}
                </span>
            </div>
        </>
    );

    return item.href ? (
        <a
            href={item.href}
            className="hover:-translate-y-0.5 flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-border/40 transition-all duration-200 hover:shadow-sm hover:ring-border/60"
            data-testid="kpi-grid-item"
            aria-label={`${itemLabel}: ${itemValue}`}
        >
            {body}
        </a>
    ) : (
        <div
            className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-border/40"
            data-testid="kpi-grid-item"
        >
            {body}
        </div>
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
        return (
            <WidgetCard
                label={displayLabel}
                variant="kpi"
                dataTestId="kpi-widget"
                accent={config.accent}
                icon={config.icon}
            >
                <WidgetUnavailableBody variant="kpi" />
            </WidgetCard>
        );
    }

    // -- 5. Loading ----------------------------------------------------------
    if (isLoading) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="kpi"
                dataTestId="kpi-widget"
                accent={config.accent}
                icon={config.icon}
            >
                <WidgetSkeletonBody variant="kpi" />
            </WidgetCard>
        );
    }

    // -- 6. Error ------------------------------------------------------------
    if (error) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="kpi"
                dataTestId="kpi-widget"
                accent={config.accent}
                icon={config.icon}
            >
                <WidgetErrorBody
                    variant="kpi"
                    onRetry={() => void refetch()}
                />
            </WidgetCard>
        );
    }

    // -- 7. Empty (null / undefined data) ------------------------------------
    if (data == null) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="kpi"
                dataTestId="kpi-widget"
                accent={config.accent}
                icon={config.icon}
            >
                <WidgetEmptyBody variant="kpi" />
            </WidgetCard>
        );
    }

    // -- 8. Data — narrow to KpiData shape -----------------------------------
    const kpi = data as KpiData;

    // -- 8a. Grid mode — multiple mini-KPIs ----------------------------------
    // When the resolver provides a non-empty `kpis` array, render one tile per
    // metric instead of a single big number. Evaluated BEFORE the single-value
    // guard so a resolver may omit the top-level `value` in grid mode.
    if (Array.isArray(kpi.kpis) && kpi.kpis.length > 0) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="kpi"
                dataTestId="kpi-widget"
                accent={config.accent}
                icon={config.icon}
            >
                <div
                    className="grid grid-cols-2 gap-3 sm:grid-cols-3"
                    data-testid="kpi-grid"
                >
                    {kpi.kpis.map((item) => (
                        <KpiGridTile
                            key={item.key}
                            item={item}
                        />
                    ))}
                </div>
            </WidgetCard>
        );
    }

    // Defensive guard: if the resolver returned an unexpected shape (e.g. an
    // array or an object without `value`), fall back to the empty state instead
    // of crashing with "kpi.value.toLocaleString is not a function".
    if (typeof kpi.value !== 'number') {
        return (
            <WidgetCard
                label={displayLabel}
                variant="kpi"
                dataTestId="kpi-widget"
                accent={config.accent}
                icon={config.icon}
            >
                <WidgetEmptyBody variant="kpi" />
            </WidgetCard>
        );
    }

    // Config-level unit overrides take precedence over resolver-provided units.
    const prefix = config.unitPrefix ?? kpi.unitPrefix;
    const suffix = config.unitSuffix ?? kpi.unitSuffix;

    // Format value with locale separators (es-AR uses "." as thousands separator).
    const formattedValue = kpi.value.toLocaleString('es-AR');

    return (
        <WidgetCard
            label={displayLabel}
            variant="kpi"
            dataTestId="kpi-widget"
            accent={config.accent}
            icon={config.icon}
            ariaLabel={`${displayLabel}: ${formattedValue}`}
        >
            <div className="flex flex-col gap-4">
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
                            className="font-semibold text-5xl text-foreground tabular-nums leading-none tracking-tighter"
                            style={{ fontFamily: 'var(--font-heading)' }}
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
        </WidgetCard>
    );
}
