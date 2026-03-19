/**
 * Smoke tests for Posts module routes.
 *
 * Verifies that each post page renders without crashing.
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
    useParams: () => ({ id: 'post-test-001' }),
    useLocation: () => ({ pathname: '/posts', search: '', hash: '' }),
    useRouterState: () => ({ location: { pathname: '/posts', search: '', hash: '' } }),
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
            useParams: vi.fn(() => ({ id: 'post-test-001' })),
            useLoaderData: vi.fn(() => null)
        })
}));

import { Route as PostViewRoute } from '@/routes/_authed/posts/$id';
import { Route as PostEditRoute } from '@/routes/_authed/posts/$id_.edit';
import { Route as PostSeoRoute } from '@/routes/_authed/posts/$id_.seo';
import { Route as PostSponsorshipRoute } from '@/routes/_authed/posts/$id_.sponsorship';
// Import route modules AFTER mocks are set up
import { Route as PostsListRoute } from '@/routes/_authed/posts/index';
import { Route as PostNewRoute } from '@/routes/_authed/posts/new';

describe('Posts smoke tests', () => {
    it('renders posts list page without crashing', async () => {
        const Page = PostsListRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders post create page without crashing', async () => {
        const Page = PostNewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders post view page without crashing', async () => {
        const Page = PostViewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders post edit page without crashing', async () => {
        const Page = PostEditRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders post SEO page without crashing', async () => {
        const Page = PostSeoRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders post sponsorship page without crashing', async () => {
        const Page = PostSponsorshipRoute.options.component;
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
