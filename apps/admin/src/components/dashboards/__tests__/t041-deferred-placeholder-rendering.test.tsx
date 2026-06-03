// @vitest-environment jsdom
/**
 * T-041 — Deferred placeholder rendering (SPEC-155)
 *
 * Asserts that:
 * 1. Each 🔴 deferred slot renders DeferredWidget without error.
 * 2. Live widget slots in the same dashboard card are unaffected by adjacent
 *    deferred slots (mixed live + deferred renders both correctly).
 * 3. A config with only deferred widgets renders all DeferredWidgets without crash.
 * 4. DeferredWidget shows its phaseSpec value (badge text).
 * 5. DeferredWidget shows the widget label as title forwarded from DashboardRenderer.
 * 6. The `data-testid="deferred-widget"` is present so consumers can assert the
 *    deferred slot was rendered.
 * 7. The `aria-label` on the DeferredWidget contains both title and phaseSpec so
 *    screen readers can identify the slot.
 * 8. The real DeferredWidget component renders correctly with all prop combinations.
 *
 * Strategy:
 * - Provide explicit `dashboard` + `userRole` props to DashboardRenderer so it
 *   bypasses the `useCurrentRoleConfig` / `useAuthContext` hooks entirely.
 * - Mock widget renderers (live types) with thin stubs that expose a data-testid.
 * - Mock DeferredWidget to expose phaseSpec and title as data attributes — this
 *   lets us assert dispatcher output without depending on i18n/icons/styling.
 * - Mock DashboardResolverProvider as a transparent passthrough.
 * - For the real DeferredWidget unit assertions (badge, title, aria-label), render
 *   the component directly in a separate describe block.
 *
 * @see apps/admin/src/components/dashboards/widgets/DeferredWidget.tsx — SUT
 * @see apps/admin/src/components/dashboards/DashboardRenderer.tsx — dispatcher
 * @see SPEC-155 T-041, AC-T-041
 */

import type { Dashboard, Widget } from '@/config/ia/schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardRenderer } from '../DashboardRenderer';
import { DeferredWidget } from '../widgets/DeferredWidget';

// ============================================================================
// MODULE-LEVEL MOCKS
// ============================================================================

// -- QueryClient spy (refresh button test) ----------------------------------
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

// -- Live widget renderers — thin stubs exposing a data-testid --------------
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
    /**
     * CommentsFeedCard stub — 'feed' is a live type (SPEC-165 T-016).
     */
    CommentsFeedCard: ({ widget }: { widget: Widget }) => (
        <div
            data-testid="feed-card"
            data-widget-id={widget.id}
        />
    ),
    /**
     * DeferredWidget stub — exposes phaseSpec and title as data attributes
     * so assertions remain independent of i18n output and icon rendering.
     */
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
            data-title={title ?? ''}
            aria-label={`${title ?? 'Próximamente'} — ${phaseSpec}`}
        />
    )
}));

// -- DashboardResolverProvider — transparent passthrough --------------------
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

// -- Role config hook -------------------------------------------------------
vi.mock('@/hooks/use-current-role-config', () => ({
    useCurrentRoleConfig: () => undefined
}));

// -- validatedConfig stub ---------------------------------------------------
vi.mock('@/config/ia/validate', () => ({
    validatedConfig: {
        dashboards: {},
        roles: {},
        sections: {},
        sidebars: {},
        tabs: {},
        createActions: {}
    }
}));

// -- Translations (already mocked in setup.tsx — re-declare for explicitness) -
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        locale: 'es',
        tPlural: (key: string) => key
    })
}));

// -- Dashboard sources side-effect import -----------------------------------
vi.mock('@/lib/dashboard-sources/index', () => ({}));

// ============================================================================
// HELPERS
// ============================================================================

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

function makeDashboard(widgets: Widget[]): Dashboard {
    return { widgets };
}

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthContext.mockReturnValue({ user: { role: 'ADMIN' }, isAuthenticated: true });
});

// ============================================================================
// T-041 — Deferred slot types render DeferredWidget without error
// ============================================================================

describe('T-041 deferred slot rendering — each deferred type renders DeferredWidget', () => {
    it('type=callout (card H — Audit Logs) renders DeferredWidget without error', () => {
        const dashboard = makeDashboard([
            makeWidget({ id: 'w-callout', type: 'callout', onMissing: 'hide' })
        ]);

        expect(() =>
            render(
                <TestWrapper>
                    <DashboardRenderer
                        dashboard={dashboard}
                        userRole="SUPER_ADMIN"
                    />
                </TestWrapper>
            )
        ).not.toThrow();

        expect(screen.getByTestId('deferred-widget')).toBeInTheDocument();
    });

    it('type=feed renders CommentsFeedCard without error (live renderer, SPEC-165 T-016)', () => {
        // 'feed' graduated from deferred to live in SPEC-165 T-016.
        const dashboard = makeDashboard([makeWidget({ id: 'w-feed', type: 'feed' })]);
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

    it('type=shortcut renders DeferredWidget without error', () => {
        const dashboard = makeDashboard([makeWidget({ id: 'w-shortcut', type: 'shortcut' })]);
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

    it('type=map renders DeferredWidget without error', () => {
        const dashboard = makeDashboard([makeWidget({ id: 'w-map', type: 'map' })]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="EDITOR"
                />
            </TestWrapper>
        );
        expect(screen.getByTestId('deferred-widget')).toBeInTheDocument();
    });

    it('type=calendar renders DeferredWidget without error', () => {
        const dashboard = makeDashboard([makeWidget({ id: 'w-calendar', type: 'calendar' })]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="EDITOR"
                />
            </TestWrapper>
        );
        expect(screen.getByTestId('deferred-widget')).toBeInTheDocument();
    });
});

// ============================================================================
// T-041 — Live slots in the same card are unaffected by deferred sibling slots
// ============================================================================

describe('T-041 deferred slot rendering — live slots unaffected by deferred siblings', () => {
    it('dashboard with live kpi + deferred callout renders both without error', () => {
        const dashboard = makeDashboard([
            makeWidget({ id: 'live-kpi', type: 'kpi' }),
            makeWidget({ id: 'deferred-callout', type: 'callout' })
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
        expect(screen.getByTestId('deferred-widget')).toBeInTheDocument();
    });

    it('dashboard with live list + live feed renders both correctly (SPEC-165 T-016)', () => {
        // 'feed' is a live type dispatched to CommentsFeedCard — not deferred.
        const dashboard = makeDashboard([
            makeWidget({ id: 'live-list', type: 'list' }),
            makeWidget({ id: 'live-feed', type: 'feed' })
        ]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="ADMIN"
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('list-widget')).toBeInTheDocument();
        expect(screen.getByTestId('feed-card')).toBeInTheDocument();
        expect(screen.queryByTestId('deferred-widget')).not.toBeInTheDocument();
    });

    it('mixed config: kpi+list+chart+checklist+status+callout+feed — all render', () => {
        // 'feed' is a live type (SPEC-165 T-016) → CommentsFeedCard.
        // Only 'callout' is deferred.
        const dashboard = makeDashboard([
            makeWidget({ id: 'k', type: 'kpi' }),
            makeWidget({ id: 'l', type: 'list' }),
            makeWidget({ id: 'c', type: 'chart' }),
            makeWidget({ id: 'ck', type: 'checklist' }),
            makeWidget({ id: 'st', type: 'status' }),
            makeWidget({ id: 'co', type: 'callout' }),
            makeWidget({ id: 'f', type: 'feed' })
        ]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="SUPER_ADMIN"
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('kpi-widget')).toBeInTheDocument();
        expect(screen.getByTestId('list-widget')).toBeInTheDocument();
        expect(screen.getByTestId('chart-widget')).toBeInTheDocument();
        expect(screen.getByTestId('checklist-widget')).toBeInTheDocument();
        expect(screen.getByTestId('status-widget')).toBeInTheDocument();
        expect(screen.getByTestId('feed-card')).toBeInTheDocument();
        // Only callout goes to DeferredWidget.
        expect(screen.getAllByTestId('deferred-widget')).toHaveLength(1);
    });

    it('live widgets are not replaced by DeferredWidget when adjacent deferred slots exist', () => {
        const dashboard = makeDashboard([
            makeWidget({ id: 'live-chart', type: 'chart' }),
            makeWidget({ id: 'deferred-map', type: 'map' }),
            makeWidget({ id: 'live-status', type: 'status' })
        ]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="ADMIN"
                />
            </TestWrapper>
        );

        // Live widgets rendered.
        expect(screen.getByTestId('chart-widget')).toBeInTheDocument();
        expect(screen.getByTestId('status-widget')).toBeInTheDocument();
        // Exactly one deferred widget.
        expect(screen.getAllByTestId('deferred-widget')).toHaveLength(1);
    });
});

// ============================================================================
// T-041 — DeferredWidget shows its phaseSpec (via DashboardRenderer dispatch)
// ============================================================================

describe('T-041 deferred slot rendering — phaseSpec propagation', () => {
    it('phaseSpec from widget.config.phaseSpec appears in DeferredWidget', () => {
        const dashboard = makeDashboard([
            makeWidget({
                id: 'w-super-h',
                type: 'callout',
                config: { phaseSpec: 'SPEC-162' }
            })
        ]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="SUPER_ADMIN"
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('deferred-widget')).toHaveAttribute(
            'data-phase-spec',
            'SPEC-162'
        );
    });

    it('phaseSpec falls back to "SPEC-155 Phase 2" when widget.config has no phaseSpec', () => {
        // Use a truly deferred type ('callout') — 'feed' is live since SPEC-165 T-016.
        const dashboard = makeDashboard([makeWidget({ id: 'w-nophase', type: 'callout' })]);
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

    it('widget label (es) is forwarded as title to DeferredWidget', () => {
        const dashboard = makeDashboard([
            makeWidget({
                id: 'w-audit',
                type: 'callout',
                label: { es: 'Audit Logs', en: 'Audit Logs', pt: 'Audit Logs' },
                config: { phaseSpec: 'SPEC-162' }
            })
        ]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="SUPER_ADMIN"
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('deferred-widget')).toHaveAttribute('data-title', 'Audit Logs');
    });

    it('multiple deferred widgets each display their own phaseSpec independently', () => {
        // 'feed' is live since SPEC-165 T-016 — use 'map' instead to keep 3 deferred slots.
        const dashboard = makeDashboard([
            makeWidget({
                id: 'w-spec162',
                type: 'callout',
                config: { phaseSpec: 'SPEC-162' }
            }),
            makeWidget({
                id: 'w-spec159',
                type: 'map',
                config: { phaseSpec: 'SPEC-159' }
            }),
            makeWidget({
                id: 'w-spec165',
                type: 'shortcut',
                config: { phaseSpec: 'SPEC-165' }
            })
        ]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="SUPER_ADMIN"
                />
            </TestWrapper>
        );

        const deferredWidgets = screen.getAllByTestId('deferred-widget');
        expect(deferredWidgets).toHaveLength(3);

        const specs = deferredWidgets.map((w) => w.getAttribute('data-phase-spec'));
        expect(specs).toContain('SPEC-162');
        expect(specs).toContain('SPEC-159');
        expect(specs).toContain('SPEC-165');
    });
});

// ============================================================================
// T-041 — All-deferred dashboard renders without error
// ============================================================================

describe('T-041 deferred slot rendering — all-deferred dashboard', () => {
    it('a dashboard with only deferred widgets renders all DeferredWidgets without error', () => {
        // 'feed' is live (SPEC-165 T-016) — use 'calendar' to keep 3 truly-deferred slots.
        const dashboard = makeDashboard([
            makeWidget({ id: 'd1', type: 'callout', config: { phaseSpec: 'SPEC-162' } }),
            makeWidget({ id: 'd2', type: 'calendar', config: { phaseSpec: 'SPEC-159' } }),
            makeWidget({ id: 'd3', type: 'shortcut', config: { phaseSpec: 'SPEC-163' } })
        ]);

        expect(() =>
            render(
                <TestWrapper>
                    <DashboardRenderer
                        dashboard={dashboard}
                        userRole="SUPER_ADMIN"
                    />
                </TestWrapper>
            )
        ).not.toThrow();

        expect(screen.getAllByTestId('deferred-widget')).toHaveLength(3);
    });

    it('no live widget testids appear in an all-deferred dashboard', () => {
        // 'feed' is live (SPEC-165 T-016) — use 'map' instead as a deferred slot.
        const dashboard = makeDashboard([
            makeWidget({ id: 'd1', type: 'callout' }),
            makeWidget({ id: 'd2', type: 'map' })
        ]);
        render(
            <TestWrapper>
                <DashboardRenderer
                    dashboard={dashboard}
                    userRole="ADMIN"
                />
            </TestWrapper>
        );

        expect(screen.queryByTestId('kpi-widget')).not.toBeInTheDocument();
        expect(screen.queryByTestId('list-widget')).not.toBeInTheDocument();
        expect(screen.queryByTestId('chart-widget')).not.toBeInTheDocument();
        expect(screen.queryByTestId('checklist-widget')).not.toBeInTheDocument();
        expect(screen.queryByTestId('status-widget')).not.toBeInTheDocument();
        expect(screen.queryByTestId('feed-card')).not.toBeInTheDocument();
        expect(screen.getAllByTestId('deferred-widget')).toHaveLength(2);
    });
});

// ============================================================================
// T-041 — DeferredWidget component direct tests (real component, no dispatcher)
// ============================================================================

describe('T-041 DeferredWidget component — real component unit assertions', () => {
    // These tests render the real DeferredWidget directly (not via DashboardRenderer),
    // using the setup.tsx global mocks for useTranslations and @repo/icons.

    it('renders without error with only the required phaseSpec prop', () => {
        expect(() => render(<DeferredWidget phaseSpec="SPEC-159" />)).not.toThrow();
    });

    it('exposes data-testid="deferred-widget" on the root container', () => {
        render(<DeferredWidget phaseSpec="SPEC-162" />);
        expect(screen.getByTestId('deferred-widget')).toBeInTheDocument();
    });

    it('renders the phaseSpec value inside the spec badge', () => {
        render(<DeferredWidget phaseSpec="SPEC-163" />);
        const badge = screen.getByTestId('deferred-widget-spec-badge');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveTextContent('SPEC-163');
    });

    it('renders a custom title when provided', () => {
        render(
            <DeferredWidget
                phaseSpec="SPEC-162"
                title="Audit Logs"
            />
        );
        expect(screen.getByText('Audit Logs')).toBeInTheDocument();
    });

    it('renders a custom description when provided', () => {
        render(
            <DeferredWidget
                phaseSpec="SPEC-162"
                description="Available after SPEC-162 ships."
            />
        );
        expect(screen.getByText('Available after SPEC-162 ships.')).toBeInTheDocument();
    });

    it('has an accessible aria-label containing both title and phaseSpec', () => {
        render(
            <DeferredWidget
                phaseSpec="SPEC-165"
                title="Comentarios"
            />
        );
        const widget = screen.getByTestId('deferred-widget');
        expect(widget.getAttribute('aria-label')).toContain('SPEC-165');
        expect(widget.getAttribute('aria-label')).toContain('Comentarios');
    });

    it('renders the default coming-soon title key when title is omitted', () => {
        render(<DeferredWidget phaseSpec="SPEC-159" />);
        // setup.tsx mocks useTranslations to return keys as-is.
        expect(screen.getByText('admin-common.comingSoon.title')).toBeInTheDocument();
    });

    it('renders the default coming-soon description key when description is omitted', () => {
        render(<DeferredWidget phaseSpec="SPEC-159" />);
        expect(screen.getByText('admin-common.comingSoon.description')).toBeInTheDocument();
    });

    it('card H scenario: three deferred slots render independently without error', () => {
        // Simulate the three sub-slots of super-card-h (Audit Logs).
        const slots = [
            { phaseSpec: 'SPEC-162', title: 'Admin actions audit log' },
            { phaseSpec: 'SPEC-162', title: 'Security log' },
            { phaseSpec: 'SPEC-163', title: 'Sentry errors 24h' }
        ];

        const { container } = render(
            <div>
                {slots.map(({ phaseSpec, title }) => (
                    <DeferredWidget
                        key={title}
                        phaseSpec={phaseSpec}
                        title={title}
                    />
                ))}
            </div>
        );

        const deferredEls = container.querySelectorAll('[data-testid="deferred-widget"]');
        expect(deferredEls).toHaveLength(3);

        // Each badge contains the correct spec.
        const badges = container.querySelectorAll('[data-testid="deferred-widget-spec-badge"]');
        expect(badges[0]).toHaveTextContent('SPEC-162');
        expect(badges[1]).toHaveTextContent('SPEC-162');
        expect(badges[2]).toHaveTextContent('SPEC-163');
    });
});
