/**
 * Dashboard Data-Source Resolver Registry
 *
 * This module is the central registry that maps widget `source` IDs
 * (stored in `widget.config.source`) to TanStack Query options factories.
 *
 * ## Architecture
 *
 * Each entry in the registry is a `DataSourceResolver` — a function that
 * receives a {@link ResolverContext} and returns a `UseQueryOptions`-compatible
 * object. The renderer (T-034) calls `resolveDataSource(sourceId, ctx)` to
 * obtain the options and passes them directly to `useQuery` / `useSuspenseQuery`.
 *
 * ## Extension points for T-018..T-021
 *
 * Per-role registration files call `registerDataSource(sourceId, resolver)` once
 * at module load time. This is intentionally a one-liner:
 *
 * ```ts
 * registerDataSource('admin.users.stats', ({ role, scope }) =>
 *   adminUsersStatsQueryOptions({ role, scope })
 * );
 * ```
 *
 * ## Query conventions baked in (SPEC-155)
 *
 * - `staleTime`: 60 000 ms (1 minute) for all dashboard widgets.
 * - `refetchOnWindowFocus`: `true` (TanStack Query default — not overridden).
 * - `queryKey` scheme: `['dashboard', sourceId, role, scope, ...extras]`
 *   — guarantees cache isolation per role and per scope while deduplicating
 *   widgets that hit the same source with identical context.
 * - `'own'`-scoped sources include `userId` in the key so the cache is
 *   user-specific and never leaks cross-user data.
 *
 * @module dashboard-sources
 * @see apps/admin/src/contexts/dashboard-resolver-context.tsx — ResolverContext provider
 * @see apps/admin/src/config/ia/schema.ts — Widget / WidgetScope types
 * @see SPEC-155 T-017 (skeleton), T-018..T-021 (per-role registration)
 */

import type { WidgetScope } from '@/config/ia/schema';
import { fetchApi } from '@/lib/api/client';

// ============================================================================
// QUERY CONVENTIONS
// ============================================================================

/**
 * Default stale time for all dashboard widget queries: 60 seconds.
 *
 * Individual resolvers MAY override this for sources that need longer
 * or shorter freshness windows, but the default should remain 60 s.
 */
export const DASHBOARD_STALE_TIME_MS = 60_000;

/**
 * Root namespace for all dashboard query keys.
 * Guarantees these keys never collide with entity CRUD keys.
 */
export const DASHBOARD_QUERY_KEY_ROOT = 'dashboard' as const;

// ============================================================================
// RESOLVER CONTEXT
// ============================================================================

/**
 * Context object passed to every {@link DataSourceResolver} call.
 *
 * The resolver uses this to:
 * - Scope query keys to the current role (cache isolation between roles).
 * - Include `userId` in the key for `'own'`-scoped sources (user-specific cache).
 * - Apply scope-aware URL parameters (e.g., `?userId=<id>` for HOST own data).
 *
 * Provided by {@link DashboardResolverProvider} in the React tree —
 * sourced from the existing `useAuthContext()` so there is no duplication.
 *
 * @example
 * ```ts
 * const ctx: ResolverContext = {
 *   role: 'HOST',
 *   userId: 'usr_abc123',
 *   permissions: ['ACCOMMODATION_VIEW_OWN'],
 *   scope: 'own',
 * };
 * ```
 */
export interface ResolverContext {
    /** Current user's role string (e.g. `'HOST'`, `'ADMIN'`, `'SUPER_ADMIN'`). */
    readonly role: string;
    /** Current user's ID. Required for `'own'`-scoped sources. */
    readonly userId: string;
    /** Flat list of permission strings held by the current user. */
    readonly permissions: readonly string[];
    /**
     * The widget's configured scope (`'own' | 'all' | 'toggle'`).
     * When `'toggle'`, the resolver should default to `'all'`; the renderer
     * is responsible for passing the user-selected value at runtime (T-034).
     */
    readonly scope: WidgetScope;
}

// ============================================================================
// QUERY OPTIONS SHAPE
// ============================================================================

/**
 * The minimal subset of TanStack Query `UseQueryOptions` that every resolver
 * must return. The renderer passes this directly to `useQuery`.
 *
 * Additional options (`retry`, `enabled`, `select`, etc.) may be included —
 * TypeScript will accept them because this type uses `& Record<string, unknown>`
 * to stay open without losing strict typing on the required fields.
 */
export interface DashboardQueryOptions {
    /**
     * Hierarchical cache key: `['dashboard', sourceId, role, scope?, userId?]`.
     * Must include enough discriminators to avoid cross-user/cross-role leaks.
     */
    readonly queryKey: readonly unknown[];
    /**
     * Async function that fetches and returns the widget data.
     * Must be stable (no inline closures that change identity on every render).
     */
    readonly queryFn: () => Promise<unknown>;
    /** Stale time in milliseconds. Defaults to {@link DASHBOARD_STALE_TIME_MS}. */
    readonly staleTime: number;
    /** Allow resolvers to include additional TanStack Query options. */
    readonly [key: string]: unknown;
}

// ============================================================================
// RESOLVER INTERFACE
// ============================================================================

/**
 * A data-source resolver function.
 *
 * Given a {@link ResolverContext}, returns the TanStack Query options that the
 * renderer uses to fetch widget data. Must NOT call React hooks — it is a
 * pure factory function called inside a hook.
 *
 * @param ctx - The resolver context supplied by the React provider.
 * @returns TanStack Query options for this source.
 *
 * @example
 * ```ts
 * const myResolver: DataSourceResolver = (ctx) => ({
 *   queryKey: buildDashboardQueryKey('my.source', ctx),
 *   queryFn: () => fetchMyData(ctx),
 *   staleTime: DASHBOARD_STALE_TIME_MS,
 * });
 * ```
 */
export type DataSourceResolver = (ctx: ResolverContext) => DashboardQueryOptions;

// ============================================================================
// QUERY KEY HELPERS
// ============================================================================

/**
 * Builds a canonical dashboard query key for a given source + context.
 *
 * Scheme: `['dashboard', sourceId, role, scope, ...scopedExtras]`
 *
 * For `'own'`-scoped sources, `userId` is appended so the cache is
 * user-specific and never leaks cross-user data on a shared browser session.
 *
 * @param sourceId - The registered source ID (e.g. `'admin.users.stats'`).
 * @param ctx      - The resolver context from the React provider.
 * @param extras   - Optional extra discriminators (e.g. time-range strings).
 * @returns An immutable tuple suitable as a TanStack Query key.
 *
 * @example
 * ```ts
 * buildDashboardQueryKey('admin.users.stats', ctx);
 * // → ['dashboard', 'admin.users.stats', 'ADMIN', 'all']
 *
 * buildDashboardQueryKey('host.accommodations.count', { ...ctx, scope: 'own' });
 * // → ['dashboard', 'host.accommodations.count', 'HOST', 'own', 'usr_abc123']
 * ```
 */
export function buildDashboardQueryKey(
    sourceId: string,
    ctx: ResolverContext,
    ...extras: readonly unknown[]
): readonly unknown[] {
    const base = [DASHBOARD_QUERY_KEY_ROOT, sourceId, ctx.role, ctx.scope] as const;

    if (ctx.scope === 'own') {
        return [...base, ctx.userId, ...extras] as const;
    }

    return extras.length > 0 ? [...base, ...extras] : base;
}

// ============================================================================
// REGISTRY
// ============================================================================

/**
 * Internal registry map: sourceId → resolver.
 *
 * Not exported directly — use {@link registerDataSource} and
 * {@link resolveDataSource} instead, which provide validation and error handling.
 */
const registry = new Map<string, DataSourceResolver>();

/**
 * Registers a data-source resolver under the given `sourceId`.
 *
 * This is the **one-liner extension point** for T-018..T-021:
 *
 * ```ts
 * // In apps/admin/src/lib/dashboard-sources/admin.ts (T-020):
 * registerDataSource('admin.users.stats', (ctx) => ({
 *   queryKey: buildDashboardQueryKey('admin.users.stats', ctx),
 *   queryFn:  () => fetchAdminUsersStats(),
 *   staleTime: DASHBOARD_STALE_TIME_MS,
 * }));
 * ```
 *
 * Rules:
 * - Call this at module load time (top-level, outside components/hooks).
 * - Each `sourceId` MUST be unique. Duplicate registrations throw in
 *   development to catch config mistakes early; in production they are
 *   silently ignored (last writer wins should never happen in a well-typed
 *   codebase, but crashing prod over a config bug is worse).
 * - `sourceId` should follow the dot-namespace convention:
 *   `<role>.<entity>.<metric>` (e.g. `'admin.users.stats'`).
 *
 * @param sourceId - Unique source identifier matching `widget.config.source`.
 * @param resolver - Factory function returning TanStack Query options.
 */
export function registerDataSource(sourceId: string, resolver: DataSourceResolver): void {
    if (registry.has(sourceId)) {
        if (import.meta.env.DEV) {
            throw new Error(
                `[dashboard-sources] Duplicate source registration: "${sourceId}". Each source ID must be unique across all role registration files.`
            );
        }
        // In production silently skip — avoid crashing over a config mistake.
        return;
    }
    registry.set(sourceId, resolver);
}

/**
 * Result of a {@link resolveDataSource} call.
 *
 * On success, `found` is `true` and `options` contains the query options.
 * On failure, `found` is `false` and `options` is a no-op placeholder that
 * the renderer can use to show an "unavailable" state without crashing.
 */
export type ResolveResult =
    | { readonly found: true; readonly options: DashboardQueryOptions }
    | { readonly found: false; readonly options: DashboardQueryOptions };

/**
 * Resolves a widget's `source` ID to TanStack Query options using the current
 * resolver context. This is the **only function the widget renderer (T-034) calls**.
 *
 * Graceful degradation: if the source is not registered, returns a no-op
 * query (immediate resolve with `null`) so the renderer can show a "data
 * unavailable" state instead of throwing.
 *
 * @param sourceId - The `source` value from `widget.config.source`.
 * @param ctx      - The resolver context from {@link useDashboardResolver}.
 * @returns A {@link ResolveResult} — always defined, never throws.
 *
 * @example
 * ```ts
 * // Inside the widget renderer hook (T-034):
 * const ctx = useDashboardResolver();
 * const { found, options } = resolveDataSource(widget.config.source, ctx);
 * const { data, isLoading } = useQuery(options);
 * if (!found) return <UnavailableWidget />;
 * ```
 */
export function resolveDataSource(sourceId: string, ctx: ResolverContext): ResolveResult {
    const resolver = registry.get(sourceId);

    if (!resolver) {
        // Return a stable no-op query so the renderer doesn't need to branch
        // before calling useQuery (hooks cannot be called conditionally).
        const noopOptions: DashboardQueryOptions = {
            queryKey: [DASHBOARD_QUERY_KEY_ROOT, '__noop__', sourceId, ctx.role],
            queryFn: () => Promise.resolve(null),
            staleTime: Number.POSITIVE_INFINITY,
            enabled: false
        };
        return { found: false, options: noopOptions };
    }

    return { found: true, options: resolver(ctx) };
}

/**
 * Returns whether a source ID has been registered.
 * Useful for conditional rendering in tests and dev tooling.
 *
 * @param sourceId - The source ID to check.
 */
export function isSourceRegistered(sourceId: string): boolean {
    return registry.has(sourceId);
}

/**
 * Returns all currently registered source IDs.
 * Intended for dev tooling and test assertions — not for production use.
 */
export function getRegisteredSourceIds(): readonly string[] {
    return Array.from(registry.keys());
}

/**
 * Removes all registered sources from the registry.
 *
 * ONLY for use in tests — calling this in production will break all widgets.
 * Tests that register sources should call this in `afterEach` to isolate state.
 */
export function _clearRegistryForTesting(): void {
    registry.clear();
}

// ============================================================================
// EXAMPLE SOURCES (prove the pattern end-to-end)
// ============================================================================
// These two registrations demonstrate the full pattern and serve as the
// reference implementation for T-018..T-021.
// They are intentionally minimal — no business logic beyond fetching.

/**
 * API response shape for admin entity count endpoint.
 * Used by the `admin.entities.counts` example source.
 */
interface EntityCountApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly pagination?: { readonly total?: number };
    };
    readonly metadata?: { readonly total?: number };
}

/**
 * Returns the total count for a single entity from the admin list endpoint.
 * Reuses the same approach as the existing `useDashboardStats` hook.
 */
async function fetchEntityCount(endpoint: string): Promise<number> {
    const result = await fetchApi<EntityCountApiResponse>({
        path: `/api/v1${endpoint}?page=1&pageSize=1`
    });
    return result.data.data?.pagination?.total ?? result.data.metadata?.total ?? 0;
}

/**
 * Example source 1: admin entity KPI counts.
 *
 * Source ID: `'admin.entities.counts'`
 * Used by: admin-card-a in `adminBaseDashboard`.
 * Scope: `'all'` (global platform count).
 *
 * Fetches the total count of accommodations, destinations, events, posts,
 * and attractions in parallel — same data as `useDashboardStats` but now
 * routed through the resolver registry so the dashboard renderer can use it.
 *
 * Returns `{ value: totalAcrossAllEntities }` so KpiWidget can render the
 * aggregate count directly. Individual entity counts are included in
 * `breakdown` for any renderer that wants to show the per-entity detail.
 *
 * Card-A design decision: one kpi widget cannot meaningfully show 6 numbers.
 * The `value` is the SUM of all 6 entity counts (the "total platform entities"
 * KPI). The `breakdown` record is available for a future multi-KPI renderer.
 */
registerDataSource('admin.entities.counts', (ctx) => ({
    queryKey: buildDashboardQueryKey('admin.entities.counts', ctx),
    queryFn: async () => {
        const endpoints = [
            { name: 'accommodations', path: '/admin/accommodations' },
            { name: 'destinations', path: '/admin/destinations' },
            { name: 'events', path: '/admin/events' },
            { name: 'posts', path: '/admin/posts' },
            { name: 'attractions', path: '/admin/attractions' }
        ] as const;

        const counts = await Promise.all(
            endpoints.map(async (e) => ({
                name: e.name,
                count: await fetchEntityCount(e.path)
            }))
        );

        const breakdown: Record<string, number> = {};
        let total = 0;
        for (const entry of counts) {
            breakdown[entry.name] = entry.count;
            total += entry.count;
        }

        // Normalize to KpiData shape: value = total entities across all types.
        return { value: total, breakdown };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));

/**
 * API response shape for the admin users stats endpoint.
 * Matches GET /api/v1/admin/users/stats built in the prior API task.
 */
interface UsersStatsApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly total?: number;
        readonly byRole?: Record<string, number>;
        readonly recentSignups?: number;
    };
}

/**
 * Example source 2: admin users stats.
 *
 * Source ID: `'admin.users.stats'`
 * Used by: admin-card-g in `adminBaseDashboard`.
 * Scope: `'all'` (platform-wide, no user scoping needed).
 *
 * Calls GET /api/v1/admin/users/stats — one of the new routes built in the
 * prior API task. Normalizes to ChartData shape expected by ChartWidget:
 * `{ series: [{ label, value }] }` where each point is a role with its count.
 */
registerDataSource('admin.users.stats', (ctx) => ({
    queryKey: buildDashboardQueryKey('admin.users.stats', ctx),
    queryFn: async () => {
        const result = await fetchApi<UsersStatsApiResponse>({
            path: '/api/v1/admin/users/stats'
        });
        const data = result.data.data;
        if (!data) return null;

        // Normalize to ChartData shape for ChartWidget.
        // If byRole is present, use role breakdown as chart series.
        // Otherwise fall back to a single "total" data point.
        const byRole = data.byRole;
        if (byRole && Object.keys(byRole).length > 0) {
            const series = Object.entries(byRole).map(([role, count]) => ({
                label: role,
                value: count
            }));
            return { series };
        }

        // Fallback: single total point
        return { series: [{ label: 'Total', value: data.total ?? 0 }] };
    },
    staleTime: DASHBOARD_STALE_TIME_MS
}));
