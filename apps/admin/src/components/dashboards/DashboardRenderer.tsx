/**
 * DashboardRenderer — Config-driven dashboard widget renderer (SPEC-155 T-034).
 *
 * Reads the current user's dashboard config via {@link useCurrentRoleConfig} and
 * {@link useAuthContext}, resolves each widget to the appropriate renderer by
 * type, and wraps everything in a {@link DashboardResolverProvider} so renderers
 * can call `useDashboardResolver()` without prop-drilling.
 *
 * ## Type → renderer dispatch map
 *
 * | Widget type  | Renderer          | Notes                          |
 * |-------------|-------------------|--------------------------------|
 * | `kpi`       | KpiWidget         | Single numeric KPI card        |
 * | `list`      | ListWidget        | Top-N list with optional CTA   |
 * | `chart`     | ChartWidget       | Line/bar/area placeholder      |
 * | `checklist` | ChecklistWidget   | Completeness health checklist  |
 * | `status`    | StatusWidget      | Health/badge-style status card |
 * | `feed`      | CommentsFeedCard  | Recent-comments feed (SPEC-165)|
 * | all others  | DeferredWidget    | Phase-2 slots (callout…)       |
 *
 * "All others" includes: `callout`, `shortcut`, `map`, `calendar`.
 * These are deferred widget types whose renderers ship in phase 2. Any widget
 * with an unrecognised type also falls here — the page never crashes.
 *
 * ## Deferred slot detection
 *
 * A widget is sent to {@link DeferredWidget} when its `type` is NOT in the set
 * `{ kpi, list, chart, checklist }`. The `phaseSpec` badge text is derived from
 * `widget.config?.phaseSpec` (an optional string that phase-5 stub configs may
 * supply) with a fallback of `'SPEC-155 Phase 2'`.
 *
 * ## "Actualizar" refresh button
 *
 * Calls `queryClient.invalidateQueries({ queryKey: ['dashboard', role] })` so
 * all widgets whose query keys start with `['dashboard', role]` are re-fetched
 * simultaneously. Each widget resolver builds its key following the
 * `[dashboard, sourceId, role, scope]` convention established in T-017/T-023.
 *
 * ## Source registration
 *
 * This file imports `@/lib/dashboard-sources/index` as a side effect to ensure
 * all per-role data sources are registered before the first `resolveForScope`
 * call happens inside a widget renderer.
 *
 * @module DashboardRenderer
 * @see apps/admin/src/contexts/dashboard-resolver-context.tsx — T-017 provider
 * @see apps/admin/src/components/dashboards/widgets/index.ts — widget barrel
 * @see apps/admin/src/hooks/use-current-role-config.ts — role config source
 * @see apps/admin/src/config/ia/schema.ts — Widget + Dashboard types
 * @see SPEC-155 T-034
 */

import type { Dashboard, Widget, WidgetType } from '@/config/ia/schema';
import { validatedConfig } from '@/config/ia/validate';
import { DashboardResolverProvider } from '@/contexts/dashboard-resolver-context';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useCurrentRoleConfig } from '@/hooks/use-current-role-config';
import { useTranslations } from '@/hooks/use-translations';
// Side-effect import — registers all per-role data sources at module load time.
import '@/lib/dashboard-sources/index';
import { RefreshIcon } from '@repo/icons';
import { useQueryClient } from '@tanstack/react-query';
import { gridSpanClasses } from './dashboard-grid';
import {
    ChartWidget,
    ChecklistWidget,
    CommentsFeedCard,
    DeferredWidget,
    KpiWidget,
    ListWidget,
    StatusWidget
} from './widgets';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * The set of widget types that have a live renderer in V1.
 * All other types in WidgetTypeSchema are deferred to phase 2.
 *
 * `'feed'` was added in SPEC-165 T-016 for the EDITOR recent-comments card H.
 * It dispatches to {@link CommentsFeedCard}.
 */
const LIVE_WIDGET_TYPES = new Set<WidgetType>([
    'kpi',
    'list',
    'chart',
    'checklist',
    'status',
    'feed'
]);

/**
 * Fallback phaseSpec badge label shown on deferred widgets when
 * `widget.config.phaseSpec` is not explicitly set.
 */
const DEFERRED_FALLBACK_SPEC = 'SPEC-155 Phase 2';

// ============================================================================
// WIDGET DISPATCHER
// ============================================================================

/**
 * Dispatches a single widget to its renderer by type.
 *
 * Routes V1 types (kpi, list, chart, checklist, status) to their respective
 * renderer components. Any other type — including phase-2 types (feed, callout,
 * shortcut, map, calendar) and any unknown types from malformed configs —
 * renders a {@link DeferredWidget} placeholder so the page never crashes.
 *
 * The `phaseSpec` for deferred slots is read from `widget.config.phaseSpec`
 * when present. Phase-5 task configs may supply this string to identify which
 * spec will deliver the live renderer.
 *
 * @param widget - Validated widget definition from the IA config.
 */
function WidgetDispatcher({ widget }: { readonly widget: Widget }) {
    if (!LIVE_WIDGET_TYPES.has(widget.type as WidgetType)) {
        const phaseSpec =
            typeof widget.config?.phaseSpec === 'string'
                ? widget.config.phaseSpec
                : DEFERRED_FALLBACK_SPEC;

        return (
            <DeferredWidget
                phaseSpec={phaseSpec}
                title={widget.label.es}
            />
        );
    }

    switch (widget.type) {
        case 'kpi':
            return <KpiWidget widget={widget} />;
        case 'list':
            return <ListWidget widget={widget} />;
        case 'chart':
            return <ChartWidget widget={widget} />;
        case 'checklist':
            return <ChecklistWidget widget={widget} />;
        case 'status':
            return <StatusWidget widget={widget} />;
        case 'feed':
            return <CommentsFeedCard widget={widget} />;
        default:
            // Safety net — TypeScript narrowing makes this unreachable given
            // the LIVE_WIDGET_TYPES guard above.
            return (
                <DeferredWidget
                    phaseSpec={DEFERRED_FALLBACK_SPEC}
                    title={widget.label.es}
                />
            );
    }
}

// ============================================================================
// REFRESH BUTTON
// ============================================================================

/**
 * Props for the {@link RefreshButton} component.
 */
interface RefreshButtonProps {
    /**
     * Current user role string — used as the second segment of the query key
     * prefix to invalidate (`['dashboard', userRole]`).
     */
    readonly userRole: string;
}

/**
 * "Actualizar" button that invalidates all dashboard queries for the current role.
 *
 * Calls `queryClient.invalidateQueries({ queryKey: ['dashboard', role] })` which
 * matches any TanStack Query key starting with `['dashboard', role]` — the
 * convention used by all widget resolvers registered in T-017..T-021.
 */
function RefreshButton({ userRole }: RefreshButtonProps) {
    const { t } = useTranslations();
    const queryClient = useQueryClient();

    const handleRefresh = () => {
        void queryClient.invalidateQueries({ queryKey: ['dashboard', userRole] });
    };

    return (
        <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            aria-label={t('admin-common.aria.refresh' as Parameters<typeof t>[0])}
            data-testid="dashboard-refresh-button"
        >
            <RefreshIcon
                className="h-4 w-4"
                aria-hidden="true"
            />
            {t('admin-dashboard.actions.refresh' as Parameters<typeof t>[0])}
        </button>
    );
}

// ============================================================================
// DASHBOARD GRID
// ============================================================================

/**
 * Props for the internal {@link DashboardGrid} component.
 */
interface DashboardGridProps {
    /** Validated dashboard definition whose widgets to render. */
    readonly dashboard: Dashboard;
    /** Current user role string — forwarded to {@link RefreshButton}. */
    readonly userRole: string;
}

/**
 * Renders the responsive bento widget grid and the global refresh button.
 *
 * Layout: 1 column on mobile, 2 columns on md, 3 columns on lg. Each widget
 * may opt into a larger cell via `widget.gridSpan` (see {@link gridSpanClasses}).
 * `grid-flow-dense` lets a later 1×1 widget back-fill a hole left by an earlier
 * row-span-2 card so the grid stays tightly packed.
 *
 * `auto-rows-[minmax(220px,auto)]` gives every implicit row a sensible floor so
 * a tall `row-span-2` card visibly doubles the height of a regular cell.
 *
 * All widgets fire their `useQuery` calls independently — TanStack Query
 * parallelises them.
 */
function DashboardGrid({ dashboard, userRole }: DashboardGridProps) {
    return (
        <div
            className="space-y-6"
            data-testid="dashboard-renderer"
        >
            {/* Widget grid — each widget fires its useQuery independently */}
            <div className="grid auto-rows-[minmax(220px,auto)] grid-cols-1 gap-4 md:grid-cols-2 lg:grid-flow-dense lg:grid-cols-6">
                {dashboard.widgets.map((widget) => {
                    const spanClasses = gridSpanClasses(widget.gridSpan);
                    const wrapperClass = spanClasses ? `h-full ${spanClasses}` : 'h-full';
                    return (
                        <div
                            key={widget.id}
                            className={wrapperClass}
                        >
                            <WidgetDispatcher widget={widget} />
                        </div>
                    );
                })}
            </div>

            {/* Global refresh button */}
            <div className="flex justify-end">
                <RefreshButton userRole={userRole} />
            </div>
        </div>
    );
}

// ============================================================================
// PUBLIC COMPONENT
// ============================================================================

/**
 * Props for the {@link DashboardRenderer} component.
 *
 * Both props are optional: when omitted the component derives the active
 * dashboard and role from the current user's role config and auth context.
 * Passing explicit values is useful in tests and for the T-035 page migration.
 */
export interface DashboardRendererProps {
    /**
     * Explicit dashboard definition to render.
     *
     * When provided, skips the role-config lookup entirely and renders this
     * dashboard directly. Useful for testing or for pages that already hold
     * the resolved config.
     */
    readonly dashboard?: Dashboard;
    /**
     * Explicit role string used for query invalidation (maps to the second
     * segment of the `['dashboard', userRole]` query key prefix).
     *
     * When omitted, the value is read from `useAuthContext().user?.role ?? ''`.
     */
    readonly userRole?: string;
}

/**
 * Config-driven dashboard widget renderer.
 *
 * Resolves the active dashboard (from props or from the current user's role
 * config), wraps all widget renderers in a {@link DashboardResolverProvider},
 * and displays a global "Actualizar" button that invalidates all dashboard
 * queries for the current role.
 *
 * Returns `null` when:
 * - No `dashboard` prop is given AND no enabled role config is available
 *   (unauthenticated user or a role with `enabled: false`).
 * - The role config's `dashboard` key does not resolve in `validatedConfig`.
 *
 * @example
 * ```tsx
 * // Automatic resolution from the current user's role config:
 * function MyDashboardPage() {
 *   return (
 *     <SidebarPageLayout title="Dashboard">
 *       <DashboardRenderer />
 *     </SidebarPageLayout>
 *   );
 * }
 *
 * // Explicit dashboard (e.g. for tests or role-preview):
 * function PreviewPage() {
 *   return <DashboardRenderer dashboard={myDashboard} role="ADMIN" />;
 * }
 * ```
 */
export function DashboardRenderer({
    dashboard: dashboardProp,
    userRole: userRoleProp
}: DashboardRendererProps = {}) {
    const { user } = useAuthContext();
    const roleConfig = useCurrentRoleConfig();

    // The role string drives query invalidation.
    // Prefer the explicit prop; fall back to the authenticated user's role.
    const activeRole = userRoleProp ?? user?.role ?? '';

    // Resolve the dashboard definition.
    let activeDashboard: Dashboard | undefined = dashboardProp;

    if (!activeDashboard) {
        // No explicit dashboard — derive from the role config.
        if (!roleConfig?.enabled || !roleConfig.dashboard) {
            return null;
        }
        activeDashboard = validatedConfig.dashboards[roleConfig.dashboard];
        if (!activeDashboard) {
            return null;
        }
    }

    return (
        <DashboardResolverProvider>
            <DashboardGrid
                dashboard={activeDashboard}
                userRole={activeRole}
            />
        </DashboardResolverProvider>
    );
}
