/**
 * Dashboard Resolver Context
 *
 * Provides the {@link ResolverContext} to any component in the React tree that
 * needs to call {@link resolveDataSource}. This eliminates prop-drilling: widget
 * renderers (T-034) call `useDashboardResolver()` to obtain the context and pass
 * it straight to `resolveDataSource`.
 *
 * ## Usage
 *
 * Wrap the dashboard page (or the admin shell) with `DashboardResolverProvider`.
 * It reads the current user's role, ID, and permissions from the existing
 * `useAuthContext()` — no duplication of auth state.
 *
 * The `scope` in the context is the widget's configured scope from the IA config.
 * Each widget renderer passes its own widget's scope when it calls
 * `resolveDataSource` (see T-034). The provider exposes a helper
 * `buildContextForScope` so renderers don't have to construct the context manually.
 *
 * ## Fallback
 *
 * When called outside the provider (e.g. in tests without a wrapper),
 * `useDashboardResolver` returns a safe no-auth context that produces no-op
 * query options — the widget renders as "unavailable" rather than crashing.
 *
 * @module dashboard-resolver-context
 * @see apps/admin/src/lib/dashboard-sources.ts — resolver registry + resolveDataSource
 * @see apps/admin/src/contexts/auth-context.tsx — auth state source
 * @see SPEC-155 T-017
 */

import type { WidgetScope } from '@/config/ia/schema';
import { useAuthContext } from '@/hooks/use-auth-context';
import type { DashboardQueryOptions, ResolverContext } from '@/lib/dashboard-sources';
import { resolveDataSource } from '@/lib/dashboard-sources';
import { type ReactNode, createContext, useCallback, useContext, useMemo } from 'react';

// ============================================================================
// CONTEXT VALUE
// ============================================================================

/**
 * Value exposed by the dashboard resolver context.
 *
 * Consumers call `buildContextForScope(scope)` with the widget's configured
 * scope to get a full {@link ResolverContext}, then pass it to
 * `resolveDataSource`.
 *
 * Alternatively, for cases where the scope is already known, call
 * `resolveForScope(sourceId, scope)` as a one-shot helper.
 */
export interface DashboardResolverContextValue {
    /**
     * Constructs a {@link ResolverContext} for the given scope.
     * Resolvers that need the context for scope-aware URL parameters use this.
     *
     * @param scope - The widget's configured scope.
     */
    buildContextForScope: (scope: WidgetScope) => ResolverContext;

    /**
     * One-shot helper: resolves a source to query options for the given scope.
     * This is what the widget renderer (T-034) calls per widget.
     *
     * @param sourceId - The `source` value from `widget.config.source`.
     * @param scope    - The widget's configured scope.
     * @returns TanStack Query options (always defined — never throws).
     */
    resolveForScope: (
        sourceId: string,
        scope: WidgetScope
    ) => { readonly found: boolean; readonly options: DashboardQueryOptions };

    /** The current user's role string (read-only, for display purposes). */
    readonly role: string;
    /** Whether the context has a valid authenticated user. */
    readonly isAuthenticated: boolean;
}

// ============================================================================
// CONTEXT
// ============================================================================

const DashboardResolverContext = createContext<DashboardResolverContextValue | null>(null);

DashboardResolverContext.displayName = 'DashboardResolverContext';

// ============================================================================
// PROVIDER
// ============================================================================

/**
 * Props for {@link DashboardResolverProvider}.
 */
interface DashboardResolverProviderProps {
    readonly children: ReactNode;
}

/**
 * Provides the dashboard resolver context to the React tree.
 *
 * Place this at the dashboard page level (or higher in the admin shell) so
 * all widget renderers can call `useDashboardResolver()` without prop-drilling.
 *
 * Auth data is sourced from `useAuthContext()` — this provider is a thin
 * bridge between the existing auth state and the resolver registry.
 *
 * @example
 * ```tsx
 * // In the dashboard route component:
 * function DashboardPage() {
 *   return (
 *     <DashboardResolverProvider>
 *       <DashboardRenderer widgets={widgets} />
 *     </DashboardResolverProvider>
 *   );
 * }
 * ```
 */
export function DashboardResolverProvider({ children }: DashboardResolverProviderProps) {
    const { user, isAuthenticated } = useAuthContext();

    // Stable base values — only recomputed when auth state changes.
    const role = user?.role ?? '';
    const userId = user?.id ?? '';
    const permissions = useMemo<readonly string[]>(
        () => user?.permissions ?? [],
        [user?.permissions]
    );

    const buildContextForScope = useCallback(
        (scope: WidgetScope): ResolverContext => ({
            role,
            userId,
            permissions,
            scope
        }),
        [role, userId, permissions]
    );

    const resolveForScope = useCallback(
        (sourceId: string, scope: WidgetScope) => {
            const ctx = buildContextForScope(scope);
            return resolveDataSource(sourceId, ctx);
        },
        [buildContextForScope]
    );

    const value = useMemo<DashboardResolverContextValue>(
        () => ({
            buildContextForScope,
            resolveForScope,
            role,
            isAuthenticated
        }),
        [buildContextForScope, resolveForScope, role, isAuthenticated]
    );

    return (
        <DashboardResolverContext.Provider value={value}>
            {children}
        </DashboardResolverContext.Provider>
    );
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Returns the dashboard resolver context value.
 *
 * Must be called inside a `DashboardResolverProvider`. If called outside the
 * provider (e.g. in isolated tests), returns a safe no-op fallback so widgets
 * render as "unavailable" rather than throwing.
 *
 * @returns The {@link DashboardResolverContextValue} from the nearest provider.
 *
 * @example
 * ```tsx
 * // Inside a widget renderer (T-034):
 * function KpiWidget({ widget }: { widget: Widget }) {
 *   const { resolveForScope } = useDashboardResolver();
 *   const sourceId = widget.config?.source as string ?? '';
 *   const { found, options } = resolveForScope(sourceId, widget.scope);
 *   const { data, isLoading } = useQuery(options);
 *
 *   if (!found) return <UnavailableWidget label={widget.label} />;
 *   if (isLoading) return <KpiSkeleton />;
 *   return <KpiCard data={data} />;
 * }
 * ```
 */
export function useDashboardResolver(): DashboardResolverContextValue {
    const ctx = useContext(DashboardResolverContext);

    if (!ctx) {
        // Safe fallback — never crash. Widgets will render as "unavailable".
        const noopCtx: DashboardResolverContextValue = {
            buildContextForScope: (scope) => ({
                role: '',
                userId: '',
                permissions: [],
                scope
            }),
            resolveForScope: (sourceId, scope) =>
                resolveDataSource(sourceId, {
                    role: '',
                    userId: '',
                    permissions: [],
                    scope
                }),
            role: '',
            isAuthenticated: false
        };
        return noopCtx;
    }

    return ctx;
}
