/**
 * Smoke tests for Dashboard and Analytics routes.
 *
 * Covers the lazy-loaded dashboard page and 3 analytics routes.
 *
 * Verifies that each page renders without crashing.
 * These are NOT functional tests -- they only check that the component
 * tree mounts successfully with mocked dependencies.
 *
 * ## T-035 change
 *
 * The dashboard smoke test now additionally asserts that the config-driven
 * `DashboardRenderer` is present in the rendered output (via the
 * `data-testid="dashboard-renderer"` attribute set by `DashboardGrid`).
 * This confirms that the page has been wired to the new renderer and that
 * the hard-coded KPI layout is no longer used.
 */

import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../helpers/render-with-providers';

// Mock DashboardResolverProvider — the context it provides is tested in
// unit tests; here we only care that DashboardRenderer mounts without crashing.
vi.mock('@/contexts/dashboard-resolver-context', () => ({
    DashboardResolverProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useDashboardResolver: () => ({ resolveForScope: vi.fn() })
}));

// Mock the widget components so DashboardGrid renders without real API calls.
vi.mock('@/components/dashboards/widgets', () => ({
    KpiWidget: ({ widget }: { widget: { id: string; label: { es: string } } }) => (
        <div data-testid={`kpi-widget-${widget.id}`}>{widget.label.es}</div>
    ),
    ListWidget: ({ widget }: { widget: { id: string; label: { es: string } } }) => (
        <div data-testid={`list-widget-${widget.id}`}>{widget.label.es}</div>
    ),
    ChartWidget: ({ widget }: { widget: { id: string; label: { es: string } } }) => (
        <div data-testid={`chart-widget-${widget.id}`}>{widget.label.es}</div>
    ),
    ChecklistWidget: ({ widget }: { widget: { id: string; label: { es: string } } }) => (
        <div data-testid={`checklist-widget-${widget.id}`}>{widget.label.es}</div>
    ),
    StatusWidget: ({ widget }: { widget: { id: string; label: { es: string } } }) => (
        <div data-testid={`status-widget-${widget.id}`}>{widget.label.es}</div>
    ),
    DeferredWidget: ({ title }: { title: string; phaseSpec: string }) => (
        <div data-testid="deferred-widget">{title}</div>
    ),
    CommentsFeedCard: ({ widget }: { widget: { id: string; label: { es: string } } }) => (
        <div data-testid={`feed-widget-${widget.id}`}>{widget.label.es}</div>
    ),
    ViewsWidget: ({ widget }: { widget: { id: string; label: { es: string } } }) => (
        <div data-testid={`views-widget-${widget.id}`}>{widget.label.es}</div>
    )
}));

// Override the global @tanstack/react-router mock to include createFileRoute
// and createLazyFileRoute (dashboard uses lazy loading)
vi.mock('@tanstack/react-router', () => ({
    useRouter: () => ({
        navigate: vi.fn(),
        history: { push: vi.fn(), replace: vi.fn() }
    }),
    useNavigate: () => vi.fn(),
    useSearch: () => ({ page: 1, pageSize: 20 }),
    useParams: () => ({}),
    useLocation: () => ({ pathname: '/dashboard', search: '', hash: '' }),
    useRouterState: () => ({ location: { pathname: '/dashboard', search: '', hash: '' } }),
    Link: ({ children, to, ...props }: Record<string, unknown>) => (
        <a
            href={to as string}
            {...props}
        >
            {children as React.ReactNode}
        </a>
    ),
    Outlet: () => null,
    createRouter: vi.fn(),
    createRoute: vi.fn(),
    createRootRoute: vi.fn(),
    createLazyFileRoute:
        (_path: string) =>
        (routeOptions: { component: React.ComponentType; [key: string]: unknown }) => ({
            options: routeOptions
        }),
    createFileRoute:
        (_path: string) =>
        (routeOptions: { component: React.ComponentType; [key: string]: unknown }) => ({
            options: routeOptions,
            useSearch: vi.fn(() => ({ page: 1, pageSize: 20 })),
            useParams: vi.fn(() => ({})),
            useLoaderData: vi.fn(() => null)
        })
}));

import { Route as AnalyticsBusinessRoute } from '@/routes/_authed/analytics/business';
import { Route as AnalyticsDebugRoute } from '@/routes/_authed/analytics/debug';
import { Route as AnalyticsUsageRoute } from '@/routes/_authed/analytics/usage';
// Import route modules AFTER mocks are set up
import { Route as DashboardRoute } from '@/routes/_authed/dashboard.lazy';

describe('Dashboard & Analytics smoke tests', () => {
    it('renders dashboard page without crashing and mounts DashboardRenderer', async () => {
        const Page = DashboardRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        const { getByTestId } = renderWithProviders(<Page />);

        // T-035: DashboardGrid sets data-testid="dashboard-renderer" — verifies
        // that the config-driven renderer replaced the hard-coded KPI layout.
        await waitFor(
            () => {
                expect(getByTestId('dashboard-renderer')).toBeInTheDocument();
            },
            { timeout: 5000 }
        );
    });

    it('renders analytics usage page without crashing', async () => {
        const Page = AnalyticsUsageRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders analytics business page without crashing', async () => {
        const Page = AnalyticsBusinessRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders analytics debug page without crashing', async () => {
        const Page = AnalyticsDebugRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });
});
