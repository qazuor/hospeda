/**
 * Smoke tests for Accommodations module routes.
 *
 * Verifies that each accommodation page renders without crashing.
 * These are NOT functional tests -- they only check that the component
 * tree mounts successfully with mocked dependencies.
 */

import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../helpers/render-with-providers';

// Re-mock router with test-specific useParams (synchronous, no vi.importActual)
vi.mock('@tanstack/react-router', () => ({
    useRouter: () => ({
        navigate: vi.fn(),
        history: { push: vi.fn(), replace: vi.fn() }
    }),
    useNavigate: () => vi.fn(),
    useSearch: () => ({ page: 1, pageSize: 20 }),
    useParams: () => ({ id: 'acc-test-001' }),
    useLocation: () => ({ pathname: '/accommodations', search: '', hash: '' }),
    useRouterState: () => ({ location: { pathname: '/accommodations', search: '', hash: '' } }),
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
            useParams: vi.fn(() => ({ id: 'acc-test-001' })),
            useLoaderData: vi.fn(() => null)
        })
}));

import { Route as AccommodationViewRoute } from '@/routes/_authed/accommodations/$id';
import { Route as AccommodationAmenitiesRoute } from '@/routes/_authed/accommodations/$id_.amenities';
import { Route as AccommodationEditRoute } from '@/routes/_authed/accommodations/$id_.edit';
import { Route as AccommodationGalleryRoute } from '@/routes/_authed/accommodations/$id_.gallery';
import { Route as AccommodationPricingRoute } from '@/routes/_authed/accommodations/$id_.pricing';
import { Route as AccommodationReviewsRoute } from '@/routes/_authed/accommodations/$id_.reviews';
// Import route modules AFTER mocks are set up
import { Route as AccommodationsListRoute } from '@/routes/_authed/accommodations/index';
import { Route as AccommodationNewRoute } from '@/routes/_authed/accommodations/new';

describe('Accommodations smoke tests', () => {
    it('renders accommodations list page without crashing', async () => {
        const Page = AccommodationsListRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders accommodation create page without crashing', async () => {
        const Page = AccommodationNewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders accommodation view page without crashing', async () => {
        const Page = AccommodationViewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders accommodation edit page without crashing', async () => {
        const Page = AccommodationEditRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders accommodation amenities page without crashing', async () => {
        const Page = AccommodationAmenitiesRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders accommodation gallery page without crashing', async () => {
        const Page = AccommodationGalleryRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders accommodation pricing page without crashing', async () => {
        const Page = AccommodationPricingRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders accommodation reviews page without crashing', async () => {
        const Page = AccommodationReviewsRoute.options.component;
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
