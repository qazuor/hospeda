/**
 * Smoke tests for Sponsors module routes.
 *
 * Covers both admin sponsor management (4 routes) and
 * sponsor dashboard (4 routes).
 *
 * Verifies that each page renders without crashing.
 * These are NOT functional tests -- they only check that the component
 * tree mounts successfully with mocked dependencies.
 */

import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../helpers/render-with-providers';

// Override the global @tanstack/react-router mock to include createFileRoute
vi.mock('@tanstack/react-router', () => ({
    useRouter: () => ({
        navigate: vi.fn(),
        history: { push: vi.fn(), replace: vi.fn() }
    }),
    useNavigate: () => vi.fn(),
    useSearch: () => ({ page: 1, pageSize: 20 }),
    useParams: () => ({ id: 'sponsor-test-001' }),
    useLocation: () => ({ pathname: '/sponsors', search: '', hash: '' }),
    useRouterState: () => ({ location: { pathname: '/sponsors', search: '', hash: '' } }),
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
            useParams: vi.fn(() => ({ id: 'sponsor-test-001' })),
            useLoaderData: vi.fn(() => null)
        })
}));

// Import route modules AFTER mocks are set up

import { Route as SponsorViewRoute } from '@/routes/_authed/sponsors/$id';
import { Route as SponsorEditRoute } from '@/routes/_authed/sponsors/$id_.edit';
// Admin sponsor management routes
import { Route as SponsorsListRoute } from '@/routes/_authed/sponsors/index';
import { Route as SponsorNewRoute } from '@/routes/_authed/sponsors/new';

import { Route as SponsorAnalyticsRoute } from '@/routes/_authed/sponsor/analytics';
// Sponsor dashboard routes
import { Route as SponsorDashboardRoute } from '@/routes/_authed/sponsor/index';
import { Route as SponsorInvoicesRoute } from '@/routes/_authed/sponsor/invoices';
import { Route as SponsorSponsorshipsRoute } from '@/routes/_authed/sponsor/sponsorships';

describe('Sponsors smoke tests', () => {
    // --- Admin sponsor management ---

    it('renders sponsors list page without crashing', async () => {
        const Page = SponsorsListRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders sponsor create page without crashing', async () => {
        const Page = SponsorNewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders sponsor view page without crashing', async () => {
        const Page = SponsorViewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders sponsor edit page without crashing', async () => {
        const Page = SponsorEditRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    // --- Sponsor dashboard ---

    it('renders sponsor dashboard page without crashing', async () => {
        const Page = SponsorDashboardRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders sponsor sponsorships page without crashing', async () => {
        const Page = SponsorSponsorshipsRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders sponsor invoices page without crashing', async () => {
        const Page = SponsorInvoicesRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders sponsor analytics page without crashing', async () => {
        const Page = SponsorAnalyticsRoute.options.component;
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
