// @vitest-environment jsdom
/**
 * Tests for DashboardRenderer component (SPEC-155 T-034).
 *
 * Strategy:
 * - Provide an explicit `dashboard` + `role` prop so the component bypasses
 *   the `useCurrentRoleConfig` / `useAuthContext` hooks entirely.
 * - Mock all widget components so tests assert dispatch only, not renderer internals.
 * - Mock `DashboardResolverProvider` as a transparent passthrough wrapper.
 * - Mock `useQueryClient` to spy on `invalidateQueries`.
 * - Mock `useTranslations` so i18n is side-effect-free.
 * - Mock `useCurrentRoleConfig` and `useAuthContext` to control the role-config
 *   resolution path for the "no explicit props" flow tests.
 *
 * Covers (per T-034 spec):
 * - Given a config with kpi/list/chart/checklist widgets → each renders
 *   the correct component.
 * - Deferred types (feed, callout, shortcut, map, calendar) → render DeferredWidget.
 * - Unknown/unsupported type → renders DeferredWidget without crashing.
 * - phaseSpec badge text derived from `widget.config.phaseSpec` when present.
 * - phaseSpec fallback to 'SPEC-155 Phase 2' when config has no phaseSpec.
 * - The Actualizar button calls invalidateQueries with ['dashboard', role].
 * - Returns null when no explicit dashboard AND role config is disabled/missing.
 * - Returns null when dashboard key is not in validatedConfig.
 *
 * @see apps/admin/src/components/dashboards/DashboardRenderer.tsx — SUT
 * @see SPEC-155 T-034
 */

import type { Dashboard, Widget } from '@/config/ia/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardRenderer } from '../DashboardRenderer';

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

// -- QueryClient spy --------------------------------------------------------
const mockInvalidateQueries = vi.fn();
vi.mock('@tanstack/react-query', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@tanstack/react-query')>();
    return {
        ...actual,
        useQueryClient: () => ({
            invalidateQueries: mockInvalidateQueries
        })
    };
});

// -- Widget renderers — thin stubs that expose a data-testid -----------------
vi.mock('../widgets', () => ({
    KpiWidget: ({ widget }: { widget: Widget }) => (
        <div
            data-testid="kpi-widget"
            data-widget-id={widget.id}
        />
    ),
    ListWidget: ({ widget }: { widget: Widget }) => (
        <div
            data-testid="list-widget"
            data-widget-id={widget.id}
        />
    ),
    ChartWidget: ({ widget }: { widget: Widget }) => (
        <div
            data-testid="chart-widget"
            data-widget-id={widget.id}
        />
    ),
    ChecklistWidget: ({ widget }: { widget: Widget }) => (
        <div
            data-testid="checklist-widget"
            data-widget-id={widget.id}
        />
    ),
    StatusWidget: ({ widget }: { widget: Widget }) => (
        <div
            data-testid="status-widget"
            data-widget-id={widget.id}
        />
    ),
    CommentsFeedCard: ({ widget }: { widget: Widget }) => (
        <div
            data-testid="feed-card"
            data-widget-id={widget.id}
        />
    ),
    DeferredWidget: ({
        phaseSpec,
        title
    }: {
        phaseSpec: string;
        title?: string;
    }) => (
        <div
            data-testid="deferred-widget"
            data-phase-spec={phaseSpec}
            data-title={title}
        />
    )
}));

// -- DashboardResolverProvider — transparent passthrough ---------------------
vi.mock('@/contexts/dashboard-resolver-context', () => ({
    DashboardResolverProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
    useDashboardResolver: () => ({
        resolveForScope: vi.fn().mockReturnValue({
            found: false,
            options: {
                queryKey: ['dashboard', 'noop'],
                queryFn: () => Promise.resolve(null),
                staleTime: Number.POSITIVE_INFINITY,
                enabled: false
            }
        }),
        buildContextForScope: vi.fn(),
        role: 'ADMIN',
        isAuthenticated: true
    })
}));

// -- Auth context -----------------------------------------------------------
const mockUseAuthContext = vi.fn();
vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => mockUseAuthContext()
}));

// -- Current role config hook -----------------------------------------------
const mockUseCurrentRoleConfig = vi.fn();
vi.mock('@/hooks/use-current-role-config', () => ({
    useCurrentRoleConfig: () => mockUseCurrentRoleConfig()
}));

// -- validatedConfig — minimal stub with a known dashboard ------------------
vi.mock('@/config/ia/validate', () => ({
    validatedConfig: {
        dashboards: {
            testDashboard: {
                widgets: [
                    {
                        id: 'w-kpi',
                        type: 'kpi',
                        label: { es: 'KPI', en: 'KPI', pt: 'KPI' },
                        scope: 'all',
                        onMissing: 'disable',
                        config: { source: 'test.source' }
                    }
                ]
            }
        },
        roles: {},
        sections: {},
        sidebars: {},
        tabs: {},
        createActions: {}
    }
}));

// -- Translations -----------------------------------------------------------
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        locale: 'es',
        tPlural: (key: string) => key
    })
}));

// -- Icons ------------------------------------------------------------------
vi.mock('@repo/icons', () => ({
    RefreshIcon: ({ className }: { className?: string }) => (
        <svg
            data-testid="refresh-icon"
            className={className}
            aria-hidden="true"
        />
    )
}));

// -- Dashboard sources side-effect import -----------------------------------
vi.mock('@/lib/dashboard-sources/index', () => ({}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, refetchOnWindowFocus: false, refetchOnMount: false }
        }
    });
}

function TestWrapper({ children }: { readonly children: ReactNode }) {
    const queryClient = makeQueryClient();
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/**
 * Builds a minimal valid Widget fixture.
 */
function makeWidget(overrides: Partial<Widget>): Widget {
    return {
        id: `w-${overrides.type ?? 'kpi'}`,
        type: 'kpi',
        label: { es: 'Label ES', en: 'Label EN', pt: 'Label PT' },
        scope: 'all',
        onMissing: 'disable',
        ...overrides
    };
}

/**
 * Builds a minimal Dashboard with the given widgets.
 */
function makeDashboard(widgets: Widget[]): Dashboard {
    return { widgets };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DashboardRenderer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: authenticated ADMIN user.
        mockUseAuthContext.mockReturnValue({ user: { role: 'ADMIN' }, isAuthenticated: true });
        mockUseCurrentRoleConfig.mockReturnValue(undefined);
    });

    // ── Widget type dispatch ────────────────────────────────────────────────

    it('renders KpiWidget for type=kpi', () => {
        const dashboard = makeDashboard([makeWidget({ id: 'k1', type: 'kpi' })]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="ADMIN"
                />
            </TestWrapper>
        );
        expect(screen.getByTestId('kpi-widget')).toBeInTheDocument();
        expect(screen.getByTestId('kpi-widget')).toHaveAttribute('data-widget-id', 'k1');
    });

    it('renders ListWidget for type=list', () => {
        const dashboard = makeDashboard([makeWidget({ id: 'l1', type: 'list' })]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="ADMIN"
                />
            </TestWrapper>
        );
        expect(screen.getByTestId('list-widget')).toBeInTheDocument();
        expect(screen.getByTestId('list-widget')).toHaveAttribute('data-widget-id', 'l1');
    });

    it('renders ChartWidget for type=chart', () => {
        const dashboard = makeDashboard([makeWidget({ id: 'c1', type: 'chart' })]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="ADMIN"
                />
            </TestWrapper>
        );
        expect(screen.getByTestId('chart-widget')).toBeInTheDocument();
    });

    it('renders ChecklistWidget for type=checklist', () => {
        const dashboard = makeDashboard([makeWidget({ id: 'ch1', type: 'checklist' })]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="ADMIN"
                />
            </TestWrapper>
        );
        expect(screen.getByTestId('checklist-widget')).toBeInTheDocument();
    });

    it('renders StatusWidget for type=status', () => {
        const dashboard = makeDashboard([makeWidget({ id: 's1', type: 'status' })]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="ADMIN"
                />
            </TestWrapper>
        );
        expect(screen.getByTestId('status-widget')).toBeInTheDocument();
        expect(screen.getByTestId('status-widget')).toHaveAttribute('data-widget-id', 's1');
    });

    it('does NOT render DeferredWidget for type=status', () => {
        const dashboard = makeDashboard([makeWidget({ id: 's1', type: 'status' })]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="ADMIN"
                />
            </TestWrapper>
        );
        expect(screen.queryByTestId('deferred-widget')).not.toBeInTheDocument();
        expect(screen.getByTestId('status-widget')).toBeInTheDocument();
    });

    // ── Deferred / phase-2 types ────────────────────────────────────────────

    it('renders CommentsFeedCard for type=feed (live renderer, SPEC-165 T-016)', () => {
        const dashboard = makeDashboard([makeWidget({ id: 'f1', type: 'feed' })]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="ADMIN"
                />
            </TestWrapper>
        );
        expect(screen.getByTestId('feed-card')).toBeInTheDocument();
        expect(screen.queryByTestId('deferred-widget')).not.toBeInTheDocument();
    });

    it('renders DeferredWidget for type=callout (phase-2 slot)', () => {
        const dashboard = makeDashboard([makeWidget({ id: 'co1', type: 'callout' })]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="ADMIN"
                />
            </TestWrapper>
        );
        expect(screen.getByTestId('deferred-widget')).toBeInTheDocument();
    });

    it('renders DeferredWidget for type=shortcut (phase-2 slot)', () => {
        const dashboard = makeDashboard([makeWidget({ id: 'sc1', type: 'shortcut' })]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="ADMIN"
                />
            </TestWrapper>
        );
        expect(screen.getByTestId('deferred-widget')).toBeInTheDocument();
    });

    it('renders DeferredWidget for type=map (phase-2 slot)', () => {
        const dashboard = makeDashboard([makeWidget({ id: 'm1', type: 'map' })]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="ADMIN"
                />
            </TestWrapper>
        );
        expect(screen.getByTestId('deferred-widget')).toBeInTheDocument();
    });

    it('renders DeferredWidget for type=calendar (phase-2 slot)', () => {
        const dashboard = makeDashboard([makeWidget({ id: 'cal1', type: 'calendar' })]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="ADMIN"
                />
            </TestWrapper>
        );
        expect(screen.getByTestId('deferred-widget')).toBeInTheDocument();
    });

    // ── Deferred widget phaseSpec ────────────────────────────────────────────

    it('uses widget.config.phaseSpec as phaseSpec badge when present', () => {
        // 'callout' is a deferred type — dispatches to DeferredWidget with the supplied phaseSpec.
        const dashboard = makeDashboard([
            makeWidget({ id: 'co1', type: 'callout', config: { phaseSpec: 'SPEC-162' } })
        ]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="ADMIN"
                />
            </TestWrapper>
        );
        expect(screen.getByTestId('deferred-widget')).toHaveAttribute(
            'data-phase-spec',
            'SPEC-162'
        );
    });

    it('falls back to "SPEC-155 Phase 2" when phaseSpec is not in config', () => {
        // 'callout' is a deferred type — dispatches to DeferredWidget with the fallback label.
        const dashboard = makeDashboard([makeWidget({ id: 'co1', type: 'callout' })]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="ADMIN"
                />
            </TestWrapper>
        );
        expect(screen.getByTestId('deferred-widget')).toHaveAttribute(
            'data-phase-spec',
            'SPEC-155 Phase 2'
        );
    });

    // ── Mixed widget types ──────────────────────────────────────────────────

    it('renders all widget types in a mixed config without crashing', () => {
        // 'feed' is now a live type (SPEC-165 T-016) → CommentsFeedCard.
        // Only 'callout' is deferred here.
        const dashboard = makeDashboard([
            makeWidget({ id: 'k1', type: 'kpi' }),
            makeWidget({ id: 'l1', type: 'list' }),
            makeWidget({ id: 'ch1', type: 'chart' }),
            makeWidget({ id: 'ck1', type: 'checklist' }),
            makeWidget({ id: 'st1', type: 'status' }),
            makeWidget({ id: 'f1', type: 'feed' }),
            makeWidget({ id: 'co1', type: 'callout' })
        ]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="ADMIN"
                />
            </TestWrapper>
        );
        expect(screen.getByTestId('kpi-widget')).toBeInTheDocument();
        expect(screen.getByTestId('list-widget')).toBeInTheDocument();
        expect(screen.getByTestId('chart-widget')).toBeInTheDocument();
        expect(screen.getByTestId('checklist-widget')).toBeInTheDocument();
        expect(screen.getByTestId('status-widget')).toBeInTheDocument();
        expect(screen.getByTestId('feed-card')).toBeInTheDocument();
        expect(screen.getAllByTestId('deferred-widget')).toHaveLength(1);
    });

    // ── Actualizar button ───────────────────────────────────────────────────

    it('calls invalidateQueries with ["dashboard", role] when Actualizar is clicked', () => {
        const dashboard = makeDashboard([makeWidget({ id: 'k1', type: 'kpi' })]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="SUPER_ADMIN"
                />
            </TestWrapper>
        );

        const refreshButton = screen.getByTestId('dashboard-refresh-button');
        fireEvent.click(refreshButton);

        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: ['dashboard', 'SUPER_ADMIN']
        });
    });

    it('uses the provided role prop for query invalidation', () => {
        const dashboard = makeDashboard([makeWidget({ id: 'k1', type: 'kpi' })]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="HOST"
                />
            </TestWrapper>
        );

        fireEvent.click(screen.getByTestId('dashboard-refresh-button'));

        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: ['dashboard', 'HOST']
        });
    });

    // ── Returns null when no config ─────────────────────────────────────────

    it('returns null when no explicit dashboard and roleConfig is undefined', () => {
        mockUseCurrentRoleConfig.mockReturnValue(undefined);

        const { container } = render(
            <TestWrapper>
                <DashboardRenderer />
            </TestWrapper>
        );

        expect(container.firstChild).toBeNull();
    });

    it('returns null when roleConfig has enabled=false', () => {
        mockUseCurrentRoleConfig.mockReturnValue({
            enabled: false,
            label: { es: 'Test', en: 'Test', pt: 'Test' },
            labelOverrides: {}
        });

        const { container } = render(
            <TestWrapper>
                <DashboardRenderer />
            </TestWrapper>
        );

        expect(container.firstChild).toBeNull();
    });

    it('returns null when roleConfig.dashboard does not resolve in validatedConfig', () => {
        mockUseCurrentRoleConfig.mockReturnValue({
            enabled: true,
            label: { es: 'Test', en: 'Test', pt: 'Test' },
            dashboard: 'nonExistentDashboard',
            mainMenu: ['inicio'],
            topbar: { showSearch: false, showQuickCreate: null, accountInMenu: false },
            mobile: { bottomNav: ['inicio', 'fin'], fab: null },
            labelOverrides: {}
        });

        const { container } = render(
            <TestWrapper>
                <DashboardRenderer />
            </TestWrapper>
        );

        expect(container.firstChild).toBeNull();
    });

    // ── Role-config resolution path ─────────────────────────────────────────

    it('renders the dashboard from roleConfig when no explicit dashboard is given', () => {
        mockUseCurrentRoleConfig.mockReturnValue({
            enabled: true,
            label: { es: 'Test', en: 'Test', pt: 'Test' },
            dashboard: 'testDashboard',
            mainMenu: ['inicio'],
            topbar: { showSearch: false, showQuickCreate: null, accountInMenu: false },
            mobile: { bottomNav: ['inicio', 'fin'], fab: null },
            labelOverrides: {}
        });

        render(
            <TestWrapper>
                <DashboardRenderer />
            </TestWrapper>
        );

        // testDashboard has one kpi widget (w-kpi) per the validatedConfig mock
        expect(screen.getByTestId('kpi-widget')).toBeInTheDocument();
    });

    it('uses user role from auth context for query invalidation when role prop is omitted', () => {
        mockUseAuthContext.mockReturnValue({ user: { role: 'EDITOR' }, isAuthenticated: true });
        const dashboard = makeDashboard([makeWidget({ id: 'k1', type: 'kpi' })]);

        render(
            <TestWrapper>
                <DashboardRenderer dashboard={dashboard} />
            </TestWrapper>
        );

        fireEvent.click(screen.getByTestId('dashboard-refresh-button'));

        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: ['dashboard', 'EDITOR']
        });
    });

    // ── Rendering container ─────────────────────────────────────────────────

    it('renders the dashboard-renderer container element', () => {
        const dashboard = makeDashboard([makeWidget({ id: 'k1', type: 'kpi' })]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="ADMIN"
                />
            </TestWrapper>
        );
        expect(screen.getByTestId('dashboard-renderer')).toBeInTheDocument();
    });

    it('renders the refresh button', () => {
        const dashboard = makeDashboard([makeWidget({ id: 'k1', type: 'kpi' })]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="ADMIN"
                />
            </TestWrapper>
        );
        expect(screen.getByTestId('dashboard-refresh-button')).toBeInTheDocument();
    });
});
