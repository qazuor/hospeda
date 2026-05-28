/**
 * ListWidget — Renderer for top-N list dashboard widgets (SPEC-155 T-024).
 *
 * Follows the canonical renderer pattern established by KpiWidget (T-023).
 * Each item in the list can optionally surface a per-row action (AC-7): a
 * button or link driven by `widget.config.actionPerItem`.
 *
 * ## Renderer pattern (identical to KpiWidget)
 *
 * 1. Accept `widget: Widget` as the only prop.
 * 2. Pull `source` from `widget.config?.source as string ?? ''`.
 * 3. Call `useDashboardResolver()` to get `resolveForScope`.
 * 4. Call `resolveForScope(sourceId, widget.scope)` — ALWAYS before `useQuery`.
 * 5. Call `useQuery(options)`.
 * 6. `!found`      → `<WidgetUnavailable>`.
 * 7. `isLoading`   → `<ListSkeleton>`.
 * 8. `error`       → `<WidgetError>`.
 * 9. `data == null` → `<WidgetEmpty>`.
 * 10. Otherwise render the list.
 *
 * ## Data shape
 *
 * The resolver's `queryFn` must return an array of `ListItem` objects (or null).
 * Each item carries at minimum a `label`. Optional fields: `meta`, `href`, `badge`.
 *
 * ## actionPerItem config
 *
 * ```json
 * {
 *   "source": "admin.recent.consultations",
 *   "actionPerItem": {
 *     "label": "Responder",
 *     "hrefTemplate": "/admin/conversations/{id}"
 *   }
 * }
 * ```
 *
 * When `hrefTemplate` is present the action renders as an `<a>` element using the
 * item's `id` (or index as fallback) interpolated into the template. When absent
 * but a `label` is still provided the action renders as a `<button>`.
 * The item's own `href` field (from the data payload) takes precedence over the
 * template when both are present.
 *
 * @module ListWidget
 * @see apps/admin/src/components/dashboards/widgets/KpiWidget.tsx — T-023 pilot
 * @see apps/admin/src/lib/dashboard-sources.ts
 * @see apps/admin/src/contexts/dashboard-resolver-context.tsx
 * @see apps/admin/src/config/ia/schema.ts
 */

import type { I18nLabel, Widget } from '@/config/ia/schema';
import { useDashboardResolver } from '@/contexts/dashboard-resolver-context';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import {
    WidgetCard,
    WidgetEmptyBody,
    WidgetErrorBody,
    WidgetSkeletonBody,
    WidgetUnavailableBody
} from './widget-states';

// ============================================================================
// LIST DATA SHAPES
// ============================================================================

/**
 * Shape of a single item in a list widget's data payload.
 *
 * `label` is the only required field. Everything else degrades gracefully when
 * absent. The renderer never crashes on partially-shaped items.
 */
export interface ListItem {
    /** Unique identifier for the item — used in action href interpolation. */
    readonly id?: string;
    /**
     * Primary display text. Required. Accepts a plain string or a tri-locale
     * {@link I18nLabel} object (resolved to the `es` locale at render time).
     */
    readonly label: string | I18nLabel;
    /** Secondary text rendered below the label (subtitle, date, status…). */
    readonly meta?: string;
    /**
     * Optional direct navigation URL for the item row itself.
     * Takes precedence over the config-level `hrefTemplate` when present.
     */
    readonly href?: string;
    /** Optional badge/count to show on the right side of the row. */
    readonly badge?: string | number;
}

// ============================================================================
// WIDGET-SPECIFIC CONFIG SHAPE
// ============================================================================

/**
 * Per-item action config (AC-7).
 *
 * Drives a button or link rendered at the end of each row.
 * - `hrefTemplate` present → `<a>` navigating to the interpolated URL.
 * - `hrefTemplate` absent  → `<button>` (caller wires an `onClick` via a
 *   future callback config key; for V1 it is a no-op placeholder).
 */
export interface ListWidgetActionConfig {
    /**
     * Text label for the action button/link. Accepts a plain string or a
     * tri-locale {@link I18nLabel} (dashboard configs use the latter, e.g.
     * `{ es: 'Ver', en: 'View', pt: 'Ver' }`); resolved to `es` at render time.
     */
    readonly label: string | I18nLabel;
    /**
     * URL template with `{id}` as the interpolation token.
     * Example: `"/admin/conversations/{id}"`.
     * When absent the action renders as a button.
     */
    readonly hrefTemplate?: string;
}

/**
 * List-widget-specific fields that may live inside `widget.config`.
 *
 * All fields are optional — the renderer degrades gracefully when absent.
 */
export interface ListWidgetConfig {
    /** Source ID for the resolver registry. */
    readonly source?: string;
    /**
     * Maximum number of items to render.
     * When present, the list is sliced to this many items.
     * When absent, all items returned by the resolver are rendered.
     */
    readonly maxItems?: number;
    /**
     * Optional per-item action configuration (AC-7).
     * Drives a button or link appended to each list row.
     */
    readonly actionPerItem?: ListWidgetActionConfig;
}

// ============================================================================
// PROPS
// ============================================================================

/**
 * Props for the ListWidget renderer.
 * Follows the RO-RO pattern — single readonly object.
 */
export interface ListWidgetProps {
    /**
     * Full widget definition from the IA config (validated by `WidgetSchema`).
     * The renderer reads `widget.config.source`, `widget.scope`, `widget.label`,
     * and `widget.config.actionPerItem` from this object.
     */
    readonly widget: Widget;
}

// ============================================================================
// PER-ITEM ACTION
// ============================================================================

/**
 * Resolves the href for a given item using the action config's `hrefTemplate`.
 *
 * Interpolates `{id}` with the item's `id` field (or a numeric index fallback).
 * The item's own `href` always takes precedence over the template.
 */
function resolveItemHref(
    item: ListItem,
    index: number,
    action: ListWidgetActionConfig
): string | undefined {
    if (item.href) return item.href;
    if (!action.hrefTemplate) return undefined;
    const token = item.id ?? String(index);
    return action.hrefTemplate.replace('{id}', token);
}

/**
 * Resolves a label that may be a plain string or a tri-locale {@link I18nLabel}
 * to display text. Renders the `es` locale (consistent with the rest of the
 * dashboard until T-034 threads the active locale through). Returns `''` for
 * nullish input so callers can apply their own fallback.
 *
 * Prevents the "Objects are not valid as a React child" crash when a config
 * supplies an `{ es, en, pt }` object where a string is rendered.
 */
function resolveLabelText(value: string | I18nLabel | undefined): string {
    if (value == null) return '';
    return typeof value === 'string' ? value : (value.es ?? '');
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * ListWidget — renders a top-N list of items for the dashboard.
 *
 * Reads data from the resolver registry via `useDashboardResolver` and
 * `useQuery`. Handles all four states: loading, error, empty, and data.
 * Optionally surfaces a per-row action (AC-7) as a link or button.
 *
 * Config shape expected in `widget.config`:
 * ```json
 * {
 *   "source": "admin.recent.consultations",
 *   "maxItems": 5,
 *   "actionPerItem": {
 *     "label": "Responder",
 *     "hrefTemplate": "/admin/conversations/{id}"
 *   }
 * }
 * ```
 *
 * Data shape expected from the resolver's `queryFn`:
 * ```json
 * [
 *   { "id": "1", "label": "Consulta sobre cabaña", "meta": "hace 2h", "badge": "nuevo" },
 *   { "id": "2", "label": "Reserva pendiente",     "meta": "ayer" }
 * ]
 * ```
 *
 * @example
 * ```tsx
 * <ListWidget widget={widget} />
 * ```
 */
export function ListWidget({ widget }: ListWidgetProps) {
    // -- 1. Extract source id and config overrides ---------------------------
    const config = (widget.config ?? {}) as ListWidgetConfig;
    const sourceId = config.source ?? '';

    // -- 2. Resolve to query options (always — hooks cannot be conditional) --
    const { resolveForScope } = useDashboardResolver();
    const { found, options } = resolveForScope(sourceId, widget.scope);

    // -- 3. Fetch with TanStack Query ----------------------------------------
    const { data, isLoading, error, refetch } = useQuery(options);

    // Derive display label (admin locale = 'es').
    const displayLabel = widget.label.es;

    // -- 4. Unavailable (source not registered) ------------------------------
    if (!found) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="list"
                dataTestId="list-widget"
            >
                <WidgetUnavailableBody variant="list" />
            </WidgetCard>
        );
    }

    // -- 5. Loading ----------------------------------------------------------
    if (isLoading) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="list"
                dataTestId="list-widget"
            >
                <WidgetSkeletonBody variant="list" />
            </WidgetCard>
        );
    }

    // -- 6. Error ------------------------------------------------------------
    if (error) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="list"
                dataTestId="list-widget"
            >
                <WidgetErrorBody
                    variant="list"
                    onRetry={() => void refetch()}
                />
            </WidgetCard>
        );
    }

    // -- 7. Empty (null / undefined / empty array / non-array shape) ----------
    if (data == null || !Array.isArray(data) || data.length === 0) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="list"
                dataTestId="list-widget"
            >
                <WidgetEmptyBody
                    variant="list"
                    text="Sin datos"
                />
            </WidgetCard>
        );
    }

    // -- 8. Data — narrow to ListItem[] shape --------------------------------
    const rawItems = data as ListItem[];
    const items = config.maxItems !== undefined ? rawItems.slice(0, config.maxItems) : rawItems;

    const actionCfg = config.actionPerItem;

    return (
        <WidgetCard
            label={displayLabel}
            variant="list"
            dataTestId="list-widget"
        >
            {/* Item list */}
            <ul
                className="divide-y divide-border"
                data-testid="list-items"
            >
                {items.map((item, index) => {
                    const itemKey = item.id ?? String(index);
                    const href = actionCfg ? resolveItemHref(item, index, actionCfg) : undefined;
                    const labelText = resolveLabelText(item.label);
                    const actionLabelText = resolveLabelText(actionCfg?.label);

                    return (
                        <li
                            key={itemKey}
                            className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                            data-testid="list-item"
                        >
                            {/* Left: label + meta */}
                            <div className="min-w-0 flex-1">
                                <p
                                    className="truncate font-medium text-foreground text-sm"
                                    data-testid="list-item-label"
                                >
                                    {labelText || '—'}
                                </p>
                                {item.meta && (
                                    <p
                                        className="truncate text-muted-foreground text-xs"
                                        data-testid="list-item-meta"
                                    >
                                        {item.meta}
                                    </p>
                                )}
                            </div>

                            {/* Right: badge + optional action */}
                            <div className="flex shrink-0 items-center gap-2">
                                {item.badge !== undefined && (
                                    <span
                                        className={cn(
                                            'rounded-full px-2 py-0.5 font-medium text-xs',
                                            'bg-muted text-muted-foreground'
                                        )}
                                        data-testid="list-item-badge"
                                    >
                                        {item.badge}
                                    </span>
                                )}

                                {actionCfg && href && (
                                    <a
                                        href={href}
                                        className="rounded-md border px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground"
                                        data-testid="list-item-action-link"
                                        aria-label={`${actionLabelText}: ${labelText}`}
                                    >
                                        {actionLabelText}
                                    </a>
                                )}

                                {actionCfg && !href && (
                                    <button
                                        type="button"
                                        className="rounded-md border px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground"
                                        data-testid="list-item-action-button"
                                        aria-label={`${actionLabelText}: ${labelText}`}
                                    >
                                        {actionLabelText}
                                    </button>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </WidgetCard>
    );
}
