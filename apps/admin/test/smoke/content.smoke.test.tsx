/**
 * Smoke tests for Content module routes.
 *
 * Verifies that each content page renders without crashing.
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
    useParams: () => ({ id: 'content-test-001' }),
    useLocation: () => ({ pathname: '/content', search: '', hash: '' }),
    useRouterState: () => ({ location: { pathname: '/content', search: '', hash: '' } }),
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
            useParams: vi.fn(() => ({ id: 'content-test-001' })),
            useLoaderData: vi.fn(() => null)
        })
}));

import { Route as AmenityViewRoute } from '@/routes/_authed/content/accommodation-amenities/$id';
import { Route as AmenityEditRoute } from '@/routes/_authed/content/accommodation-amenities/$id_.edit';
// Import route modules AFTER mocks are set up
import { Route as AmenitiesListRoute } from '@/routes/_authed/content/accommodation-amenities/index';
import { Route as AmenityNewRoute } from '@/routes/_authed/content/accommodation-amenities/new';
import { Route as FeatureViewRoute } from '@/routes/_authed/content/accommodation-features/$id';
import { Route as FeatureEditRoute } from '@/routes/_authed/content/accommodation-features/$id_.edit';
import { Route as FeaturesListRoute } from '@/routes/_authed/content/accommodation-features/index';
import { Route as FeatureNewRoute } from '@/routes/_authed/content/accommodation-features/new';
import { Route as AttractionViewRoute } from '@/routes/_authed/content/destination-attractions/$id';
import { Route as AttractionEditRoute } from '@/routes/_authed/content/destination-attractions/$id_.edit';
import { Route as AttractionsListRoute } from '@/routes/_authed/content/destination-attractions/index';
import { Route as AttractionNewRoute } from '@/routes/_authed/content/destination-attractions/new';

describe('Content module smoke tests', () => {
    // --- Accommodation Amenities ---

    it('renders amenities list page without crashing', async () => {
        const Page = AmenitiesListRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders amenity create page without crashing', async () => {
        const Page = AmenityNewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders amenity view page without crashing', async () => {
        const Page = AmenityViewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders amenity edit page without crashing', async () => {
        const Page = AmenityEditRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    // --- Accommodation Features ---

    it('renders features list page without crashing', async () => {
        const Page = FeaturesListRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders feature create page without crashing', async () => {
        const Page = FeatureNewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders feature view page without crashing', async () => {
        const Page = FeatureViewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders feature edit page without crashing', async () => {
        const Page = FeatureEditRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    // --- Destination Attractions ---

    it('renders attractions list page without crashing', async () => {
        const Page = AttractionsListRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders attraction create page without crashing', async () => {
        const Page = AttractionNewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders attraction view page without crashing', async () => {
        const Page = AttractionViewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders attraction edit page without crashing', async () => {
        const Page = AttractionEditRoute.options.component;
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
