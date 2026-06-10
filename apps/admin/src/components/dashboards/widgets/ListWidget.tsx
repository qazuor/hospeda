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
import { useWidgetActionHandlers } from '@/contexts/widget-action-handlers-context';
import { cn } from '@/lib/utils';
import { AlertTriangleIcon, ChevronDownIcon, ChevronRightIcon } from '@repo/icons';
import { useQuery } from '@tanstack/react-query';
import { Fragment, type ReactNode, useState } from 'react';
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
/** Semantic variants for the per-row status badge (SPEC-155 redesign). */
export type ListItemBadgeVariant = 'success' | 'warning' | 'destructive' | 'neutral';

export interface ListItem {
    /** Unique identifier for the item — used in action href interpolation. */
    readonly id?: string;
    /**
     * Optional group label. When consecutive items share a `group`, the list
     * renders a section header above the first item of each group. Items must
     * already be ordered by group (the widget does not re-sort). Omit on all
     * items for a flat, ungrouped list (backward-compatible default).
     */
    readonly group?: string;
    /**
     * Primary display text. Required. Accepts a plain string or a tri-locale
     * {@link I18nLabel} object (resolved to the `es` locale at render time).
     */
    readonly label: string | I18nLabel;
    /** Secondary text rendered below the label (subtitle, date, status…). */
    readonly meta?: string;
    /**
     * Optional muted text rendered inline on the SAME line as the label
     * (between the label and the status badge). Used to surface a compact
     * secondary descriptor without consuming a second line — e.g. cron card D
     * shows the human-readable schedule ("cada hora") next to the job name.
     * Truncates independently of the label so the name keeps priority.
     */
    readonly inlineMeta?: string;
    /**
     * Multi-line meta. When set, each entry renders as its own muted line
     * below the label so a row can carry hierarchical context (e.g. host
     * card J: "Destino: X" + "Tu rating 4.6 vs promedio 4.3"). Each entry
     * carries a stable `key` (so React reconciliation is deterministic) and
     * a `content` ReactNode (so resolvers can compose icon-aware lines).
     * Takes precedence over `meta` when both are present.
     */
    readonly metaLines?: ReadonlyArray<{ readonly key: string; readonly content: ReactNode }>;
    /**
     * Optional direct navigation URL for the item row itself.
     * Takes precedence over the config-level `hrefTemplate` when present.
     */
    readonly href?: string;
    /** Optional badge/count to show on the right side of the row. */
    readonly badge?: string | number;
    /**
     * Optional colored status pill (e.g. `'Activo'` / `'Borrador'`) rendered
     * next to the row label. Used to surface the entity's lifecycle state.
     */
    readonly statusBadge?: { readonly label: string; readonly variant: ListItemBadgeVariant };
    /**
     * Optional owner / author name rendered as a "by …" sub-row under the meta.
     * When `ownerHref` is also set, the name becomes a clickable link.
     */
    readonly ownerName?: string;
    /** Internal href for the owner / author link (e.g. `/access/users/{id}`). */
    readonly ownerHref?: string;
}

/** Tailwind classes per status-badge variant. Mirrors the StatusWidget palette. */
const STATUS_BADGE_CLASSES: Readonly<Record<ListItemBadgeVariant, string>> = {
    success: 'bg-success/10 text-success ring-success/20',
    warning: 'bg-warning/10 text-warning ring-warning/20',
    destructive: 'bg-destructive/10 text-destructive ring-destructive/20',
    neutral: 'bg-muted text-muted-foreground ring-border'
};

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
 * Footer link config for the list widget (SPEC-175 T-015).
 *
 * When present, renders a small "see all" link below the item list.
 * The `action` field is a declarative key — the renderer maps it to a
 * callback registered by the parent (e.g. `'whats-new-panel'`).
 *
 * @example
 * ```ts
 * footerLink: {
 *   label: { es: 'Ver todas', en: 'See all', pt: 'Ver todas' },
 *   action: 'whats-new-panel'
 * }
 * ```
 */
export interface ListWidgetFooterLinkConfig {
    /** Display label. Accepts plain string or tri-locale I18nLabel. */
    readonly label: string | I18nLabel;
    /**
     * Declarative action key resolved at render time via `onFooterLinkClick`.
     * The `ListWidget` component itself does not interpret this value — it
     * passes it to the `onFooterLinkClick` callback so callers can handle it.
     */
    readonly action: string;
}

/**
 * List-widget-specific fields that may live inside `widget.config`.
 *
 * All fields are optional — the renderer degrades gracefully when absent.
 *
 * ## Callback fields (SPEC-175 T-015)
 *
 * `onItemClick` and `onFooterLinkClick` are callback functions that cannot be
 * stored in a JSON-serializable config. They are valid here because `widget.config`
 * is TypeScript (not JSON-serialized), and Zod validates unknown values without
 * stripping function references. Dashboard configs in `dashboards.ts` may assign
 * these directly as function literals, or callers may inject them at render time
 * (e.g. via `ListWidget` when used standalone outside the `DashboardRenderer`).
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
     * Drives the PRIMARY button or link appended to each list row.
     */
    readonly actionPerItem?: ListWidgetActionConfig;
    /**
     * Optional secondary actions appended after the primary `actionPerItem`.
     * Each entry renders as its own button/link with the same per-id href
     * interpolation rules; useful when a row needs more than one CTA (e.g.
     * "Ver" + "Editar" on the host card J market comparison).
     */
    readonly additionalActionsPerItem?: ReadonlyArray<ListWidgetActionConfig>;
    /**
     * When true, group sections (driven by `item.group`) render as collapsible
     * panels instead of static headers. Each panel header shows the group name,
     * the item count, and a failure badge (`⚠ N`) counting non-successful rows
     * (status badge variant `destructive` or `warning`). All panels start
     * COLLAPSED. Opt-in — when absent, groups render as the legacy static
     * headers (backward-compatible). Used by cron card D (SPEC-161 UX).
     *
     * Requires items to already be ordered by group (the widget does not
     * re-sort) — same contract as the static-header rendering.
     */
    readonly collapsibleGroups?: boolean;
    /** Accent palette name for the card header chip (SPEC-155 redesign). */
    readonly accent?: string;
    /** Dashboard icon name for the card header chip (SPEC-155 redesign). */
    readonly icon?: string;
    /**
     * Optional rendering variant (SPEC-155 HOST redesign).
     *
     * - `'default'` (omitted) — plain badge per row.
     * - `'stars'` — interpret `item.badge` as a 0–5 rating and render visual
     *   ★★★★☆ stars per row + an averaged rating chip in the card header.
     * - `'pending-count'` — interpret `items[0].badge` as a total pending
     *   count and surface it as a chip in the card header (NOT on the row).
     */
    readonly variant?: 'default' | 'stars' | 'pending-count';
    /** Card-specific empty-state title (e.g. `'Sin reseñas todavía'`). */
    readonly emptyText?: string;
    /** Card-specific empty-state description (one-line hint). */
    readonly emptyDescription?: string;
    /** Card-specific error-state title. */
    readonly errorText?: string;
    /** Card-specific error-state description. */
    readonly errorDescription?: string;
    /**
     * Optional footer link rendered below the item list (SPEC-175 T-015).
     *
     * When present, a small "see all" button appears at the bottom of the card.
     * The `action` key is passed to `onFooterLinkClick` so callers can decide
     * what to do (e.g. open a sheet panel). Widgets without this config render
     * exactly as before — fully backward-compatible.
     */
    readonly footerLink?: ListWidgetFooterLinkConfig;
    /**
     * Optional callback fired when a list row button is clicked (SPEC-175 T-015).
     *
     * Only applies to `actionPerItem` entries whose `hrefTemplate` is absent
     * (the "button" case). When present, the row button calls this instead of
     * being a no-op. The `item` argument is the full `ListItem` for the row.
     *
     * Widgets without `onItemClick` remain fully backward-compatible — the
     * button renders as before with no visible change in behaviour.
     *
     * NOTE: This is a function reference. It cannot live in a JSON-serialized
     * config; assign it in TypeScript dashboard configs or inject it at render.
     */
    readonly onItemClick?: (item: ListItem) => void;
    /**
     * Optional callback fired when the footer link button is clicked (SPEC-175 T-015).
     *
     * Receives the `action` string from `footerLink.action` so one handler can
     * dispatch multiple actions. Widgets without `footerLink` never call this.
     *
     * NOTE: Function reference — same constraint as `onItemClick` above.
     */
    readonly onFooterLinkClick?: (action: string) => void;
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
// VARIANT HELPERS — stars + header pill
// ============================================================================

/**
 * Clamps and coerces an arbitrary value to a `0..5` numeric rating.
 * Returns `null` when the value cannot be interpreted as a number.
 */
function coerceRating(value: unknown): number | null {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(5, n));
}

/**
 * Renders a 5-star row matching the rating to one decimal (0–5).
 *
 * Filled portion is painted in the accent color via `currentColor`; the unfilled
 * portion stays as a low-opacity outline. The component is purely presentational
 * — pass a numeric `rating` (use {@link coerceRating} first).
 */
function StarRating({
    rating,
    ariaLabel
}: { readonly rating: number; readonly ariaLabel: string }) {
    const pct = Math.round((rating / 5) * 100);
    return (
        <span
            className="relative inline-flex shrink-0 select-none text-amber-500 leading-none"
            aria-label={ariaLabel}
            data-testid="list-item-stars"
        >
            <span
                aria-hidden="true"
                className="text-foreground/15"
            >
                ★★★★★
            </span>
            <span
                aria-hidden="true"
                className="absolute inset-0 overflow-hidden text-amber-500"
                style={{ width: `${pct}%` }}
            >
                ★★★★★
            </span>
        </span>
    );
}

/**
 * Computes the average of all numeric `item.badge` values, ignoring entries
 * whose badge is missing or non-numeric. Returns `null` when there is no
 * usable data.
 */
function averageRating(items: ReadonlyArray<ListItem>): { avg: number; count: number } | null {
    const ratings = items
        .map((it) => coerceRating(it.badge))
        .filter((v): v is number => v !== null);
    if (ratings.length === 0) return null;
    const sum = ratings.reduce((acc, n) => acc + n, 0);
    return { avg: sum / ratings.length, count: ratings.length };
}

/**
 * Header pill for the `'stars'` variant — shows `★ 4.6 · 12 reseñas`.
 */
function StarsHeaderPill({ avg, count }: { readonly avg: number; readonly count: number }) {
    return (
        <span
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-medium text-foreground text-xs tabular-nums"
            data-testid="list-header-stars"
        >
            <span
                className="text-amber-500"
                aria-hidden="true"
            >
                ★
            </span>
            {avg.toFixed(1)}
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
                {count} {count === 1 ? 'reseña' : 'reseñas'}
            </span>
        </span>
    );
}

/**
 * Header pill for the `'pending-count'` variant — shows e.g. `12 pendientes`.
 *
 * The value is taken from `items[0].badge` (the resolver convention used by
 * `host.conversations.pending`) and surfaced in the header so the count is
 * visible at a glance without consuming a list row.
 */
function PendingCountHeaderPill({ count }: { readonly count: number }) {
    return (
        <span
            className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-700 text-xs tabular-nums"
            data-testid="list-header-pending-count"
        >
            {count} {count === 1 ? 'pendiente' : 'pendientes'}
        </span>
    );
}

// ============================================================================
// ITEM ROW
// ============================================================================

/**
 * Renders a single list row. Extracted so both the flat (static-header) and the
 * collapsible-group rendering paths share the exact same row markup.
 *
 * The `index` is the item's position in the (already-sliced) source array — it
 * drives the `{id}` href interpolation fallback, so it must be stable across
 * both rendering modes.
 */
function ItemRow({
    item,
    index,
    actionCfg,
    variant,
    additionalActionsPerItem,
    onItemClick
}: {
    readonly item: ListItem;
    readonly index: number;
    readonly actionCfg?: ListWidgetActionConfig;
    readonly variant: 'default' | 'stars' | 'pending-count';
    readonly additionalActionsPerItem?: ReadonlyArray<ListWidgetActionConfig>;
    readonly onItemClick?: (item: ListItem) => void;
}) {
    const itemKey = item.id ?? String(index);
    const href = actionCfg ? resolveItemHref(item, index, actionCfg) : undefined;
    const labelText = resolveLabelText(item.label);
    const actionLabelText = resolveLabelText(actionCfg?.label);

    return (
        <li
            className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            data-testid="list-item"
        >
            {/* Left: label (with inline meta + status badge) + meta + owner */}
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p
                        className="truncate font-medium text-foreground text-sm"
                        data-testid="list-item-label"
                        title={labelText || undefined}
                    >
                        {labelText || '—'}
                    </p>
                    {item.inlineMeta && (
                        <span
                            className="shrink truncate text-muted-foreground text-xs"
                            data-testid="list-item-inline-meta"
                            title={item.inlineMeta}
                        >
                            {item.inlineMeta}
                        </span>
                    )}
                    {item.statusBadge && (
                        <span
                            className={cn(
                                'shrink-0 rounded-full px-2 py-0.5 font-semibold text-[0.65rem] uppercase tracking-wide ring-1 ring-inset',
                                STATUS_BADGE_CLASSES[item.statusBadge.variant]
                            )}
                            data-testid="list-item-status-badge"
                        >
                            {item.statusBadge.label}
                        </span>
                    )}
                </div>
                {item.metaLines && item.metaLines.length > 0 ? (
                    <div
                        className="mt-0.5 space-y-0.5"
                        data-testid="list-item-meta-lines"
                    >
                        {item.metaLines.map((line) => (
                            <div
                                key={`${itemKey}-meta-${line.key}`}
                                className="truncate text-muted-foreground text-xs"
                            >
                                {line.content}
                            </div>
                        ))}
                    </div>
                ) : (
                    item.meta && (
                        <p
                            className="truncate text-muted-foreground text-xs"
                            data-testid="list-item-meta"
                        >
                            {item.meta}
                        </p>
                    )
                )}
                {item.ownerName && (
                    <p
                        className="mt-0.5 truncate text-muted-foreground text-xs"
                        data-testid="list-item-owner"
                    >
                        <span className="opacity-70">por </span>
                        {item.ownerHref ? (
                            <a
                                href={item.ownerHref}
                                className="font-medium text-foreground/80 hover:underline"
                                data-testid="list-item-owner-link"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {item.ownerName}
                            </a>
                        ) : (
                            <span className="font-medium text-foreground/80">{item.ownerName}</span>
                        )}
                    </p>
                )}
            </div>

            {/* Right: badge + optional action */}
            <div className="flex shrink-0 items-center gap-2">
                {variant === 'stars' && item.badge !== undefined
                    ? (() => {
                          const r = coerceRating(item.badge);
                          if (r === null) return null;
                          return (
                              <StarRating
                                  rating={r}
                                  ariaLabel={`Rating ${r.toFixed(1)} de 5`}
                              />
                          );
                      })()
                    : item.badge !== undefined && (
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
                        onClick={onItemClick ? () => onItemClick(item) : undefined}
                    >
                        {actionLabelText}
                    </button>
                )}

                {/* Secondary actions — render each entry from
                    `config.additionalActionsPerItem` after the primary CTA. */}
                {(additionalActionsPerItem ?? []).map((extraAction) => {
                    const extraHref = resolveItemHref(item, index, extraAction);
                    const extraLabelText = resolveLabelText(extraAction.label);
                    const extraKey = `${itemKey}-extra-${extraLabelText}`;
                    if (extraHref) {
                        return (
                            <a
                                key={extraKey}
                                href={extraHref}
                                className="rounded-md border px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground"
                                data-testid="list-item-action-extra-link"
                                aria-label={`${extraLabelText}: ${labelText}`}
                            >
                                {extraLabelText}
                            </a>
                        );
                    }
                    return (
                        <button
                            key={extraKey}
                            type="button"
                            className="rounded-md border px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground"
                            data-testid="list-item-action-extra-button"
                            aria-label={`${extraLabelText}: ${labelText}`}
                        >
                            {extraLabelText}
                        </button>
                    );
                })}
            </div>
        </li>
    );
}

// ============================================================================
// COLLAPSIBLE GROUPS
// ============================================================================

/** A group of consecutive items sharing the same `group` label. */
interface ItemGroup {
    readonly group: string;
    /** Items paired with their original index in the sliced source array. */
    readonly entries: ReadonlyArray<{ readonly item: ListItem; readonly index: number }>;
    /** Count of rows with a non-successful status (destructive or warning). */
    readonly failureCount: number;
}

/**
 * Groups items by their `group` label, preserving source order (no re-sort).
 * Items without a `group` are bucketed under an empty-string key. Each group
 * carries a `failureCount` derived from the per-row status badge variant so the
 * collapsible header can surface problems without expanding.
 */
function buildItemGroups(items: ReadonlyArray<ListItem>): ReadonlyArray<ItemGroup> {
    const order: string[] = [];
    const buckets = new Map<string, Array<{ item: ListItem; index: number }>>();

    items.forEach((item, index) => {
        const key = item.group ?? '';
        if (!buckets.has(key)) {
            buckets.set(key, []);
            order.push(key);
        }
        buckets.get(key)?.push({ item, index });
    });

    return order.map((group) => {
        const entries = buckets.get(group) ?? [];
        const failureCount = entries.filter(
            ({ item }) =>
                item.statusBadge?.variant === 'destructive' ||
                item.statusBadge?.variant === 'warning'
        ).length;
        return { group, entries, failureCount };
    });
}

/**
 * Renders the list as collapsible group panels (SPEC-161 cron card D).
 *
 * All panels start collapsed; clicking a header toggles its open state. Each
 * header shows the group name, the item count, and a `⚠ N` failure badge when
 * any row in the group is non-successful.
 */
function CollapsibleGroupList({
    items,
    actionCfg,
    variant,
    additionalActionsPerItem,
    onItemClick
}: {
    readonly items: ReadonlyArray<ListItem>;
    readonly actionCfg?: ListWidgetActionConfig;
    readonly variant: 'default' | 'stars' | 'pending-count';
    readonly additionalActionsPerItem?: ReadonlyArray<ListWidgetActionConfig>;
    readonly onItemClick?: (item: ListItem) => void;
}) {
    const groups = buildItemGroups(items);
    // Open-panel state keyed by group label. Empty set ⇒ all collapsed (default).
    const [openGroups, setOpenGroups] = useState<ReadonlySet<string>>(new Set());

    const toggle = (group: string) => {
        setOpenGroups((prev) => {
            const next = new Set(prev);
            if (next.has(group)) next.delete(group);
            else next.add(group);
            return next;
        });
    };

    return (
        <div
            className="space-y-3"
            data-testid="list-collapsible-groups"
        >
            {groups.map(({ group, entries, failureCount }) => {
                const isOpen = openGroups.has(group);
                const panelId = `cron-group-${group}`;
                return (
                    <div
                        key={group || '__ungrouped'}
                        data-testid="list-group-panel"
                    >
                        <button
                            type="button"
                            onClick={() => toggle(group)}
                            aria-expanded={isOpen}
                            aria-controls={panelId}
                            className={cn(
                                'flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors',
                                // Open panels connect to their item list below — flatten
                                // the bottom corners; collapsed panels stay fully rounded.
                                isOpen
                                    ? 'rounded-t-md bg-muted'
                                    : 'rounded-md bg-muted/50 hover:bg-muted'
                            )}
                            data-testid="list-group-toggle"
                        >
                            {isOpen ? (
                                <ChevronDownIcon className="size-3.5 shrink-0 text-foreground/70" />
                            ) : (
                                <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <span className="font-semibold text-foreground text-xs uppercase tracking-wide">
                                {group}
                            </span>
                            <span
                                className="rounded-full bg-background px-1.5 py-0.5 font-medium text-[0.65rem] text-muted-foreground tabular-nums"
                                data-testid="list-group-count"
                            >
                                {entries.length}
                            </span>
                            {failureCount > 0 && (
                                <span
                                    className="ml-auto inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-[0.65rem] text-destructive tabular-nums ring-1 ring-destructive/20 ring-inset"
                                    data-testid="list-group-failure-badge"
                                    aria-label={`${failureCount} con fallas`}
                                >
                                    <AlertTriangleIcon
                                        className="size-3"
                                        aria-hidden="true"
                                    />
                                    {failureCount}
                                </span>
                            )}
                        </button>
                        {isOpen && (
                            <ul
                                id={panelId}
                                className="divide-y divide-border rounded-b-md bg-muted/30 px-3 py-1"
                                data-testid="list-group-items"
                            >
                                {entries.map(({ item, index }) => (
                                    <ItemRow
                                        key={item.id ?? String(index)}
                                        item={item}
                                        index={index}
                                        actionCfg={actionCfg}
                                        variant={variant}
                                        additionalActionsPerItem={additionalActionsPerItem}
                                        onItemClick={onItemClick}
                                    />
                                ))}
                            </ul>
                        )}
                    </div>
                );
            })}
        </div>
    );
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

    // -- 3b. Widget action handlers context (always before any early return) --
    // Callbacks for footerLink and onItemClick can come from:
    //   (1) explicit functions in config (direct assignment in dashboards.ts), or
    //   (2) WidgetActionHandlersContext (for action keys like 'whats-new-panel').
    // MUST be called unconditionally — Rules of Hooks.
    const actionHandlers = useWidgetActionHandlers();

    // Derive display label (admin locale = 'es').
    const displayLabel = widget.label.es;

    // -- 4. Unavailable (source not registered) ------------------------------
    if (!found) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="list"
                dataTestId="list-widget"
                accent={config.accent}
                icon={config.icon}
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
                accent={config.accent}
                icon={config.icon}
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
                accent={config.accent}
                icon={config.icon}
            >
                <WidgetErrorBody
                    variant="list"
                    onRetry={() => void refetch()}
                    text={config.errorText}
                    description={config.errorDescription}
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
                accent={config.accent}
                icon={config.icon}
            >
                <WidgetEmptyBody
                    variant="list"
                    text={config.emptyText ?? 'Sin datos'}
                    description={config.emptyDescription}
                    icon={config.icon}
                />
            </WidgetCard>
        );
    }

    // -- 8. Data — narrow to ListItem[] shape --------------------------------
    const rawItems = data as ListItem[];
    const slicedItems =
        config.maxItems !== undefined ? rawItems.slice(0, config.maxItems) : rawItems;

    const actionCfg = config.actionPerItem;
    const variant = config.variant ?? 'default';
    const footerLink = config.footerLink;

    // Explicit config functions take precedence over context handlers.
    const onItemClick =
        typeof config.onItemClick === 'function'
            ? config.onItemClick
            : config.actionPerItem && !config.actionPerItem.hrefTemplate
              ? actionHandlers.getItemHandler('whats-new-entry') // resolved by action key convention
              : undefined;

    const onFooterLinkClick =
        typeof config.onFooterLinkClick === 'function'
            ? config.onFooterLinkClick
            : footerLink
              ? actionHandlers.getFooterHandler(footerLink.action)
              : undefined;

    // Variant-specific transformations:
    //  - 'pending-count': lift items[0].badge into a header pill; strip the
    //    badge from that item so it does not render twice.
    //  - 'stars': compute an average from all numeric badges for the header.
    let items: ListItem[] = slicedItems;
    let headerExtra: ReactNode = null;

    if (variant === 'pending-count' && slicedItems.length > 0) {
        const first = slicedItems[0];
        const firstBadge = first?.badge;
        const numericBadge = typeof firstBadge === 'number' ? firstBadge : Number(firstBadge);
        if (first && Number.isFinite(numericBadge)) {
            headerExtra = <PendingCountHeaderPill count={numericBadge} />;
            // Remove the lifted badge from the first item so the row renders clean.
            const [{ badge: _stripped, ...rest }, ...others] = slicedItems;
            items = [{ ...(rest as ListItem) }, ...others];
        }
    } else if (variant === 'stars') {
        const avg = averageRating(slicedItems);
        if (avg) {
            headerExtra = (
                <StarsHeaderPill
                    avg={avg.avg}
                    count={avg.count}
                />
            );
        }
    }

    const footerLinkLabel = footerLink ? resolveLabelText(footerLink.label) : '';

    return (
        <WidgetCard
            label={displayLabel}
            variant="list"
            dataTestId="list-widget"
            accent={config.accent}
            icon={config.icon}
            headerExtra={headerExtra}
        >
            {/* Collapsible-group mode (opt-in via config.collapsibleGroups). */}
            {config.collapsibleGroups ? (
                <CollapsibleGroupList
                    items={items}
                    actionCfg={actionCfg}
                    variant={variant}
                    additionalActionsPerItem={config.additionalActionsPerItem}
                    onItemClick={onItemClick}
                />
            ) : (
                /* Flat list with optional static group headers (legacy default). */
                <ul
                    className="divide-y divide-border"
                    data-testid="list-items"
                >
                    {items.map((item, index) => {
                        const itemKey = item.id ?? String(index);
                        // Section header: rendered before the first item of each group.
                        const showGroupHeader =
                            item.group && item.group !== items[index - 1]?.group;

                        const row = (
                            <ItemRow
                                key={itemKey}
                                item={item}
                                index={index}
                                actionCfg={actionCfg}
                                variant={variant}
                                additionalActionsPerItem={config.additionalActionsPerItem}
                                onItemClick={onItemClick}
                            />
                        );

                        if (showGroupHeader) {
                            return (
                                <Fragment key={`group-${item.group}`}>
                                    <li
                                        className="pt-3 pb-1 font-semibold text-[0.65rem] text-muted-foreground uppercase tracking-wide first:pt-0"
                                        data-testid="list-group-header"
                                    >
                                        {item.group}
                                    </li>
                                    {row}
                                </Fragment>
                            );
                        }
                        return row;
                    })}
                </ul>
            )}

            {/* Footer link — optional "see all" CTA (SPEC-175 T-015). */}
            {footerLink && onFooterLinkClick && (
                <div
                    className="mt-2 flex justify-end border-border border-t pt-2"
                    data-testid="list-widget-footer"
                >
                    <button
                        type="button"
                        className="text-muted-foreground text-xs hover:text-foreground hover:underline"
                        data-testid="list-widget-footer-link"
                        aria-label={footerLinkLabel}
                        onClick={() => onFooterLinkClick(footerLink.action)}
                    >
                        {footerLinkLabel}
                    </button>
                </div>
            )}
        </WidgetCard>
    );
}
