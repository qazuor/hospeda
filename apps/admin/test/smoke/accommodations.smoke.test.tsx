/**
 * Smoke tests for Accommodations module routes.
 *
 * Verifies that each accommodation page renders without crashing.
 * These are NOT functional tests -- they only check that the component
 * tree mounts successfully with mocked dependencies.
 */

import { screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockAccommodation } from '../fixtures';
import { renderWithProviders } from '../helpers/render-with-providers';
import { server } from '../mocks/server';

vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => ({
        user: {
            id: 'test_user_id',
            name: 'Test User',
            email: 'test@example.com',
            roles: ['ADMIN'],
            permissions: ['accommodation.viewAll', 'accommodation.update.any']
        },
        isAuthenticated: true,
        isLoading: false
    })
}));

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
    let effectiveSetRequests = 0;

    beforeEach(() => {
        effectiveSetRequests = 0;
        server.use(
            http.get('http://localhost:3001/api/v1/admin/accommodations/:id', () =>
                HttpResponse.json({ success: true, data: mockAccommodation })
            ),
            http.get('http://localhost:3001/api/v1/admin/users/:id/effective-set', () => {
                effectiveSetRequests += 1;
                return HttpResponse.json({
                    success: true,
                    data: {
                        userId: mockAccommodation.ownerId,
                        vertical: 'accommodation',
                        hasLiveNonTrialTitle: false,
                        entitlements: {},
                        limits: {}
                    }
                });
            })
        );
    });
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

        expect(
            (await screen.findAllByRole('heading', { name: mockAccommodation.name })).some(
                (heading) => !heading.classList.contains('sr-only')
            )
        ).toBe(true);
        await waitFor(() => expect(effectiveSetRequests).toBeGreaterThan(0));
    });

    it('keeps the view page rendered when the effective set read fails', async () => {
        server.use(
            http.get('http://localhost:3001/api/v1/admin/users/:id/effective-set', () => {
                effectiveSetRequests += 1;
                return HttpResponse.json({ error: 'read failed' }, { status: 503 });
            })
        );
        const Page = AccommodationViewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        const { queryClient } = renderWithProviders(<Page />);

        await waitFor(
            () =>
                expect(
                    queryClient.getQueryState([
                        'billing',
                        'effective-set',
                        mockAccommodation.ownerId,
                        'accommodation'
                    ])?.status
                ).toBe('error'),
            { timeout: 3000 }
        );
        expect(
            screen.getAllByRole('heading', { name: mockAccommodation.name }).length
        ).toBeGreaterThan(0);
        expect(screen.queryByText('Algo salió mal')).not.toBeInTheDocument();
    });

    it('renders accommodation edit page without crashing', async () => {
        const Page = AccommodationEditRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        expect(await screen.findByRole('tablist')).toBeInTheDocument();
        await waitFor(() => expect(effectiveSetRequests).toBeGreaterThan(0));
        expect(screen.queryByText('Algo salió mal')).not.toBeInTheDocument();
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

    // The gallery page hangs in jsdom because the Cloudinary media-handler
    // integration polls a remote endpoint that MSW does not stub. Skip until
    // a proper MSW handler is wired up for the gallery route.
    it.skip('renders accommodation gallery page without crashing', async () => {
        const Page = AccommodationGalleryRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 15000 }
        );
    }, 20000);

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
