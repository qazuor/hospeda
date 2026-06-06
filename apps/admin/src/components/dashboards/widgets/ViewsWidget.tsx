/**
 * ViewsWidget — Dashboard widget for view-count statistics (SPEC-197 T-013..T-015).
 *
 * Renders per-entity unique + total view counts with an independent
 * {@link WindowToggle} that re-fetches with the selected time window.
 *
 * ## Variants
 *
 * The widget handles three resolver payloads based on `config.viewsVariant`:
 *
 * | Variant           | Source                   | Shape                                    |
 * |-------------------|--------------------------|------------------------------------------|
 * | `'host'`          | `host.stats.views`       | `{ locked, items[] }` or `{ locked: true }` |
 * | `'editor-posts'`  | `editor.posts.views`     | `{ items[], window }`                    |
 * | `'editor-events'` | `editor.events.views`    | `{ items[], window }`                    |
 * | `'admin-summary'` | `admin.views.summary`    | `{ kpis[], window }`                     |
 *
 * ## Window state (AC-2/9/12)
 *
 * Each widget instance maintains its OWN `useState<TimeWindow>('30d')`. The window
 * value is included in the `useQuery` key so TanStack Query caches `7d` and `30d`
 * results independently. Changing the window triggers a re-fetch against the
 * endpoint with the new `?window=` param.
 *
 * The widget calls the resolver's `queryFn` via `resolveForScope` for the initial
 * 30d fetch, then builds a window-parameterized queryFn for the 7d case. Both
 * share the same data shape contract.
 *
 * ## Locked state (AC-3, AC-5, AC-6)
 *
 * For the `'host'` variant, when the resolver returns `{ locked: true }`:
 *  - Lock icon (`@repo/icons`)
 *  - `admin-dashboard.dashboard.host.views.locked.description` i18n copy
 *  - Focusable CTA `<a>` linking to `/billing/plans`
 *
 * 403 from the views endpoint is already converted to `{ locked: true }` by the
 * resolver — it surfaces here as locked data, NOT as an error state.
 *
 * @module ViewsWidget
 * @see apps/admin/src/components/views/WindowToggle.tsx — window toggle control
 * @see apps/admin/src/lib/dashboard-sources/host.ts     — host.stats.views resolver
 * @see apps/admin/src/lib/dashboard-sources/editor.ts   — editor views resolvers
 * @see apps/admin/src/lib/dashboard-sources/admin.ts    — admin.views.summary resolver
 * @see SPEC-197 T-013, T-014, T-015
 */

import type { Widget } from '@/config/ia/schema';
import { useDashboardResolver } from '@/contexts/dashboard-resolver-context';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useTranslations } from '@/hooks/use-translations';
import { fetchApi } from '@/lib/api/client';
import { ApiError } from '@/lib/errors';
import { LockIcon } from '@repo/icons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { type TimeWindow, WindowToggle } from '../../views/WindowToggle';
import {
    WidgetCard,
    WidgetEmptyBody,
    WidgetErrorBody,
    WidgetSkeletonBody,
    WidgetUnavailableBody
} from './widget-states';

// ============================================================================
// DATA SHAPES (from resolvers)
// ============================================================================

/**
 * Per-entity-row shape for host and editor views (list variant).
 * Carries both unique and total view counts plus a display name.
 */
export interface ViewsEntityRow {
    readonly entityId: string;
    readonly name: string;
    readonly unique: number;
    readonly total: number;
}

/**
 * Host resolver payload shape.
 *
 * `locked: true` → entitlement gate fired or 403 received (AC-3/AC-5/AC-6).
 * `locked: false, items[]` → happy path, per-accommodation stats.
 */
export type HostViewsData =
    | { readonly locked: true }
    | { readonly locked: false; readonly items: ReadonlyArray<ViewsEntityRow> };

/**
 * Editor resolver payload shape (posts or events).
 * Never locked — editors always have view access.
 */
export interface EditorViewsData {
    readonly items: ReadonlyArray<ViewsEntityRow>;
    readonly window: TimeWindow;
}

/**
 * KPI tile in the admin summary card.
 * `value` = total views; `extra.unique` = unique views.
 */
export interface AdminViewKpi {
    readonly key: string;
    readonly label: { readonly es: string; readonly en: string; readonly pt: string };
    readonly value: number;
    readonly accent: string;
    readonly icon: string;
    readonly extra: { readonly unique: number };
}

/**
 * Admin resolver payload shape.
 * Three KPI tiles (one per entity type) with window label.
 */
export interface AdminViewsData {
    readonly kpis: ReadonlyArray<AdminViewKpi>;
    readonly window: TimeWindow;
}

// ============================================================================
// CONFIG SHAPE
// ============================================================================

/**
 * Views-widget-specific config fields expected inside `widget.config`.
 */
export interface ViewsWidgetConfig {
    /** Source ID passed to the resolver registry. */
    readonly source?: string;
    /**
     * Selects the sub-renderer / data shape branch.
     * When absent, defaults to `'host'`.
     */
    readonly viewsVariant?: 'host' | 'editor-posts' | 'editor-events' | 'admin-summary';
    /** Optional accent palette name for the card header chip. */
    readonly accent?: string;
    /** Optional icon name for the card header chip. */
    readonly icon?: string;
    /** Card-specific empty-state text. */
    readonly emptyText?: string;
    /** Card-specific empty-state description. */
    readonly emptyDescription?: string;
    /** Card-specific error-state text. */
    readonly errorText?: string;
    /** Card-specific error-state description. */
    readonly errorDescription?: string;
}

// ============================================================================
// PROPS
// ============================================================================

/** Props for the ViewsWidget renderer (RO-RO pattern). */
export interface ViewsWidgetProps {
    /**
     * Full widget definition from the IA config.
     * The renderer reads `widget.config.source`, `widget.scope`, `widget.label`,
     * and `widget.config.viewsVariant`.
     */
    readonly widget: Widget;
}

// ============================================================================
// LOCKED STATE (AC-3)
// ============================================================================

/**
 * Locked-state body rendered when the host lacks the `view_basic_stats`
 * entitlement or when the views endpoint returns 403 (AC-3/AC-5/AC-6).
 *
 * Shows:
 * - Lock icon (from `@repo/icons`)
 * - `admin-dashboard.dashboard.host.views.locked.description` copy
 * - CTA anchor linking to `/billing/plans` (focusable, `aria-label`)
 */
function LockedStateBody() {
    const { t } = useTranslations();

    const description = t(
        'admin-dashboard.dashboard.host.views.locked.description' as Parameters<typeof t>[0]
    );
    const ctaLabel = t(
        'admin-dashboard.dashboard.host.views.locked.cta' as Parameters<typeof t>[0]
    );

    return (
        <div
            className="flex flex-col items-center justify-center gap-3 py-4 text-center"
            data-testid="views-widget-locked"
        >
            <span
                className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground/70"
                aria-hidden="true"
            >
                <LockIcon
                    size={20}
                    weight="duotone"
                />
            </span>
            <p className="font-medium text-foreground text-sm">{description}</p>
            <a
                href="/billing/plans"
                className="mt-1 rounded-md border px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="views-widget-locked-cta"
                aria-label={ctaLabel}
            >
                {ctaLabel}
            </a>
        </div>
    );
}

// ============================================================================
// HOST VIEWS LIST (per-accommodation rows)
// ============================================================================

/**
 * Renders the per-accommodation list of unique + total views for the HOST variant.
 */
function HostViewsList({
    items
}: {
    readonly items: ReadonlyArray<ViewsEntityRow>;
}) {
    return (
        <ul
            className="divide-y divide-border"
            data-testid="views-host-list"
        >
            {items.map((item) => (
                <li
                    key={item.entityId}
                    className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                    data-testid="views-host-row"
                >
                    <p className="truncate font-medium text-foreground text-sm">{item.name}</p>
                    <div className="flex shrink-0 items-center gap-3 text-muted-foreground text-xs tabular-nums">
                        <span data-testid="views-unique">{item.unique} únicos</span>
                        <span data-testid="views-total">{item.total} totales</span>
                    </div>
                </li>
            ))}
        </ul>
    );
}

// ============================================================================
// EDITOR VIEWS LIST (per-post / per-event rows)
// ============================================================================

/**
 * Renders the per-post or per-event list of unique + total views for the EDITOR variant.
 */
function EditorViewsList({
    items
}: {
    readonly items: ReadonlyArray<ViewsEntityRow>;
}) {
    return (
        <ul
            className="divide-y divide-border"
            data-testid="views-editor-list"
        >
            {items.map((item) => (
                <li
                    key={item.entityId}
                    className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                    data-testid="views-editor-row"
                >
                    <p className="truncate font-medium text-foreground text-sm">{item.name}</p>
                    <div className="flex shrink-0 items-center gap-3 text-muted-foreground text-xs tabular-nums">
                        <span data-testid="views-unique">{item.unique} únicos</span>
                        <span data-testid="views-total">{item.total} totales</span>
                    </div>
                </li>
            ))}
        </ul>
    );
}

// ============================================================================
// ADMIN SUMMARY ROWS (one row per entity type)
// ============================================================================

/** Spanish labels for entity types in the admin summary card. */
const ENTITY_TYPE_LABELS_ES: Readonly<Record<string, string>> = {
    ACCOMMODATION: 'Alojamientos',
    POST: 'Posts',
    EVENT: 'Eventos'
};

/**
 * Renders the platform-wide views summary for the ADMIN variant.
 * Three rows (ACCOMMODATION, POST, EVENT) each showing unique + total.
 */
function AdminViewsSummary({
    kpis
}: {
    readonly kpis: ReadonlyArray<AdminViewKpi>;
}) {
    return (
        <ul
            className="divide-y divide-border"
            data-testid="views-admin-summary"
        >
            {kpis.map((kpi) => (
                <li
                    key={kpi.key}
                    className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                    data-testid="views-admin-row"
                >
                    <p className="font-medium text-foreground text-sm">
                        {ENTITY_TYPE_LABELS_ES[kpi.key] ?? kpi.key}
                    </p>
                    <div className="flex shrink-0 items-center gap-3 text-muted-foreground text-xs tabular-nums">
                        <span data-testid="views-unique">{kpi.extra.unique} únicos</span>
                        <span data-testid="views-total">{kpi.value} totales</span>
                    </div>
                </li>
            ))}
        </ul>
    );
}

// ============================================================================
// FETCH HELPERS (window-parameterized)
// ============================================================================

/**
 * Response shape from GET /api/v1/protected/views/accommodations/me.
 * Raw data before normalization.
 */
interface RawAccommodationViewsResponse {
    readonly success: boolean;
    readonly data?: ReadonlyArray<{
        readonly entityId: string;
        readonly unique: number;
        readonly total: number;
    }>;
}

/** Response shape from GET /api/v1/protected/users/me/entitlements. */
interface RawEntitlementsResponse {
    readonly success: boolean;
    readonly data?: {
        readonly entitlements: ReadonlyArray<string>;
        readonly limits: Record<string, number>;
        readonly plan: {
            readonly slug: string;
            readonly name: string;
            readonly status: string;
        } | null;
        readonly asOf: string;
    };
}

/** Response shape from GET /api/v1/admin/posts (list). */
interface RawPostsListResponse {
    readonly success: boolean;
    readonly data?: {
        readonly items?: ReadonlyArray<{ readonly id: string; readonly title: string }>;
        readonly pagination?: { readonly total?: number };
    };
}

/** Response shape from GET /api/v1/admin/events (list). */
interface RawEventsListResponse {
    readonly success: boolean;
    readonly data?: {
        readonly items?: ReadonlyArray<{ readonly id: string; readonly name: string }>;
        readonly pagination?: { readonly total?: number };
    };
}

/** Response shape from views endpoints (posts or events). */
interface RawEditorViewsResponse {
    readonly success: boolean;
    readonly data?: ReadonlyArray<{
        readonly entityId: string;
        readonly unique: number;
        readonly total: number;
    }>;
}

/** Response shape from GET /api/v1/admin/views/summary. */
interface RawAdminViewsSummaryResponse {
    readonly success: boolean;
    readonly data?: ReadonlyArray<{
        readonly entityType: 'ACCOMMODATION' | 'POST' | 'EVENT';
        readonly unique: number;
        readonly total: number;
    }>;
}

/**
 * Fetches host accommodation views with entitlement check + 403 fallback.
 *
 * Checks `view_basic_stats` entitlement first; on 503 billing service errors,
 * attempts the views fetch optimistically and converts 403 to locked state.
 *
 * @param window - Time window to fetch (`'7d'` or `'30d'`).
 * @returns HostViewsData payload.
 */
async function fetchHostViews(window: TimeWindow): Promise<HostViewsData> {
    // Proactive entitlement check (mirrors host.stats.views resolver logic).
    let hasViewBasicStats = true;
    try {
        const entResult = await fetchApi<RawEntitlementsResponse>({
            path: '/api/v1/protected/users/me/entitlements'
        });
        const entitlements = entResult.data.data?.entitlements ?? [];
        hasViewBasicStats = entitlements.includes('view_basic_stats');
    } catch (_err) {
        // Both 503 (billing unavailable) and unknown errors fall through
        // optimistically: try the views endpoint and let the 403 guard below
        // handle the locked state if needed.
    }

    if (!hasViewBasicStats) {
        return { locked: true };
    }

    try {
        const result = await fetchApi<RawAccommodationViewsResponse>({
            path: `/api/v1/protected/views/accommodations/me?window=${window}`
        });
        const items = (result.data.data ?? []).map((row) => ({
            entityId: row.entityId,
            name: row.entityId, // name resolved by accommodation entity if available
            unique: row.unique,
            total: row.total
        }));
        return { locked: false, items };
    } catch (err) {
        // AC-6: 403 → locked state (NOT error callout).
        if (err instanceof ApiError && err.status === 403) {
            return { locked: true };
        }
        throw err;
    }
}

/**
 * Fetches editor post views for the given window.
 * Fetches the recent posts pool first, then joins with view stats.
 *
 * @param window - Time window to fetch.
 * @returns EditorViewsData payload.
 */
async function fetchEditorPostViews(window: TimeWindow): Promise<EditorViewsData> {
    const postsResult = await fetchApi<RawPostsListResponse>({
        path: '/api/v1/admin/posts?status=ACTIVE&pageSize=50&sort=publishedAt:desc'
    });
    const posts = postsResult.data.data?.items ?? [];
    const postIds = posts.map((p) => p.id);

    if (postIds.length === 0) {
        return { items: [], window };
    }

    const params = new URLSearchParams({ window });
    for (const id of postIds) {
        params.append('entityIds', id);
    }
    const viewsResult = await fetchApi<RawEditorViewsResponse>({
        path: `/api/v1/protected/views/posts?${params}`
    });
    const viewItems = viewsResult.data.data ?? [];
    const viewMap = new Map(viewItems.map((v) => [v.entityId, v]));

    const items = posts.map((post) => {
        const stats = viewMap.get(post.id);
        return {
            entityId: post.id,
            name: post.title,
            unique: stats?.unique ?? 0,
            total: stats?.total ?? 0
        };
    });
    items.sort((a, b) => b.total - a.total);

    return { items, window };
}

/**
 * Fetches editor event views for the given window.
 * Mirrors `fetchEditorPostViews` for the EVENT entity type.
 *
 * @param window - Time window to fetch.
 * @returns EditorViewsData payload.
 */
async function fetchEditorEventViews(window: TimeWindow): Promise<EditorViewsData> {
    const eventsResult = await fetchApi<RawEventsListResponse>({
        path: '/api/v1/admin/events?pageSize=50'
    });
    const events = eventsResult.data.data?.items ?? [];
    const eventIds = events.map((e) => e.id);

    if (eventIds.length === 0) {
        return { items: [], window };
    }

    const params = new URLSearchParams({ window });
    for (const id of eventIds) {
        params.append('entityIds', id);
    }
    const viewsResult = await fetchApi<RawEditorViewsResponse>({
        path: `/api/v1/protected/views/events?${params}`
    });
    const viewItems = viewsResult.data.data ?? [];
    const viewMap = new Map(viewItems.map((v) => [v.entityId, v]));

    const items = events.map((event) => {
        const stats = viewMap.get(event.id);
        return {
            entityId: event.id,
            name: event.name,
            unique: stats?.unique ?? 0,
            total: stats?.total ?? 0
        };
    });
    items.sort((a, b) => b.total - a.total);

    return { items, window };
}

/**
 * Fetches admin platform views summary for the given window.
 *
 * @param window - Time window to fetch.
 * @returns AdminViewsData payload.
 */
async function fetchAdminViewsSummary(window: TimeWindow): Promise<AdminViewsData> {
    const result = await fetchApi<RawAdminViewsSummaryResponse>({
        path: `/api/v1/admin/views/summary?window=${window}`
    });
    const items = result.data.data ?? [];

    const ORDER: ReadonlyArray<'ACCOMMODATION' | 'POST' | 'EVENT'> = [
        'ACCOMMODATION',
        'POST',
        'EVENT'
    ];
    const byType = new Map(items.map((item) => [item.entityType, item]));

    const kpis = ORDER.map((entityType) => {
        const stat = byType.get(entityType);
        return {
            key: entityType,
            label: {
                es:
                    entityType === 'ACCOMMODATION'
                        ? 'Alojamientos'
                        : entityType === 'POST'
                          ? 'Posts'
                          : 'Eventos',
                en:
                    entityType === 'ACCOMMODATION'
                        ? 'Accommodations'
                        : entityType === 'POST'
                          ? 'Posts'
                          : 'Events',
                pt:
                    entityType === 'ACCOMMODATION'
                        ? 'Acomodações'
                        : entityType === 'POST'
                          ? 'Posts'
                          : 'Eventos'
            },
            value: stat?.total ?? 0,
            accent:
                entityType === 'ACCOMMODATION'
                    ? 'river'
                    : entityType === 'POST'
                      ? 'success'
                      : 'warning',
            icon:
                entityType === 'ACCOMMODATION'
                    ? 'buildings'
                    : entityType === 'POST'
                      ? 'article'
                      : 'calendar',
            extra: { unique: stat?.unique ?? 0 }
        };
    });

    return { kpis, window };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * ViewsWidget — config-driven views statistics widget.
 *
 * Renders per-entity view counts (unique + total) with an independent
 * WindowToggle (AC-2/9/12). Each widget instance owns its window state;
 * changing the window re-fetches the correct endpoint with `?window=`.
 *
 * Handles four variants: host (with locked state), editor-posts,
 * editor-events, and admin-summary.
 *
 * @example
 * ```tsx
 * <ViewsWidget widget={widget} />
 * ```
 */
export function ViewsWidget({ widget }: ViewsWidgetProps) {
    const config = (widget.config ?? {}) as ViewsWidgetConfig;
    const sourceId = config.source ?? '';
    const variant = config.viewsVariant ?? 'host';

    // Independent window state per widget instance (AC-2/9/12).
    const [currentWindow, setCurrentWindow] = useState<TimeWindow>('30d');

    // resolveForScope is still needed for the `found` check (source registration guard).
    const { resolveForScope } = useDashboardResolver();
    const { user } = useAuthContext();
    const userId = user?.id ?? '';

    const { found, options } = resolveForScope(sourceId, widget.scope);

    // Build a window-aware query key so TanStack Query caches 7d/30d independently.
    // Key: ['dashboard', sourceId, role, scope, userId?, window].
    const baseKey = options.queryKey as readonly unknown[];
    const windowAwareKey = [...baseKey, currentWindow];

    // Window-parameterized queryFn — calls the correct endpoint with ?window=.
    // This replaces the resolver's hardcoded ?window=30d for all windows.
    const windowAwareFn = async () => {
        switch (variant) {
            case 'host':
                return fetchHostViews(currentWindow);
            case 'editor-posts':
                return fetchEditorPostViews(currentWindow);
            case 'editor-events':
                return fetchEditorEventViews(currentWindow);
            case 'admin-summary':
                return fetchAdminViewsSummary(currentWindow);
            default: {
                // Safety net — TypeScript narrowing makes this unreachable.
                const exhaustive: never = variant;
                throw new Error(`Unknown views variant: ${String(exhaustive)}`);
            }
        }
    };

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: windowAwareKey,
        queryFn: windowAwareFn,
        enabled: found,
        staleTime: 60_000
    });

    // Suppress unused variable warning (userId is in the key via baseKey for own-scoped sources)
    void userId;

    const displayLabel = widget.label.es;

    const windowToggle = (
        <WindowToggle
            value={currentWindow}
            onChange={setCurrentWindow}
            disabled={isLoading}
        />
    );

    // -- Unavailable (source not registered) ---------------------------------
    if (!found) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="list"
                dataTestId="views-widget"
                accent={config.accent}
                icon={config.icon}
            >
                <WidgetUnavailableBody variant="list" />
            </WidgetCard>
        );
    }

    // -- Loading -------------------------------------------------------------
    if (isLoading) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="list"
                dataTestId="views-widget"
                accent={config.accent}
                icon={config.icon}
                headerExtra={windowToggle}
            >
                <WidgetSkeletonBody variant="list" />
            </WidgetCard>
        );
    }

    // -- Error ---------------------------------------------------------------
    // Note: 403 is converted to { locked: true } by the host fetch helper — it
    // never surfaces here as an error. Only 5xx / network errors land here.
    if (error) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="list"
                dataTestId="views-widget"
                accent={config.accent}
                icon={config.icon}
                headerExtra={windowToggle}
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

    // -- Locked (host only — AC-3/AC-5/AC-6) ---------------------------------
    if (variant === 'host') {
        const hostData = data as HostViewsData | null | undefined;
        if (hostData?.locked === true) {
            return (
                <WidgetCard
                    label={displayLabel}
                    variant="list"
                    dataTestId="views-widget"
                    accent={config.accent}
                    icon={config.icon}
                >
                    <LockedStateBody />
                </WidgetCard>
            );
        }
    }

    // -- Empty (no data in this period) --------------------------------------
    const isEmpty = (() => {
        if (data == null) return true;
        if (variant === 'host') {
            const d = data as HostViewsData;
            return d.locked === false && d.items.length === 0;
        }
        if (variant === 'admin-summary') {
            const d = data as AdminViewsData;
            return !d.kpis || d.kpis.length === 0;
        }
        // editor-posts / editor-events
        const d = data as EditorViewsData;
        return !d.items || d.items.length === 0;
    })();

    if (isEmpty) {
        return (
            <WidgetCard
                label={displayLabel}
                variant="list"
                dataTestId="views-widget"
                accent={config.accent}
                icon={config.icon}
                headerExtra={windowToggle}
            >
                <WidgetEmptyBody
                    variant="list"
                    text={config.emptyText ?? 'Sin vistas en este período.'}
                    description={config.emptyDescription}
                    icon={config.icon}
                />
            </WidgetCard>
        );
    }

    // -- Data ----------------------------------------------------------------
    return (
        <WidgetCard
            label={displayLabel}
            variant="list"
            dataTestId="views-widget"
            accent={config.accent}
            icon={config.icon}
            headerExtra={windowToggle}
        >
            {variant === 'host' &&
                (() => {
                    const d = data as HostViewsData;
                    if (d.locked === false) {
                        return <HostViewsList items={d.items} />;
                    }
                    return null;
                })()}

            {(variant === 'editor-posts' || variant === 'editor-events') &&
                (() => {
                    const d = data as EditorViewsData;
                    return <EditorViewsList items={d.items} />;
                })()}

            {variant === 'admin-summary' &&
                (() => {
                    const d = data as AdminViewsData;
                    return <AdminViewsSummary kpis={d.kpis} />;
                })()}
        </WidgetCard>
    );
}
