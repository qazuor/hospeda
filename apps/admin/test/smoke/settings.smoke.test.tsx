/**
 * Smoke tests for Settings module routes.
 *
 * Covers tag management (4 routes), critical settings, and SEO settings.
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
    useParams: () => ({ id: 'tag-test-001' }),
    useLocation: () => ({ pathname: '/settings', search: '', hash: '' }),
    useRouterState: () => ({ location: { pathname: '/settings', search: '', hash: '' } }),
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
            useParams: vi.fn(() => ({ id: 'tag-test-001' })),
            useLoaderData: vi.fn(() => null)
        })
}));

// Import route modules AFTER mocks are set up

import { Route as TagViewRoute } from '@/routes/_authed/settings/tags/$id';
import { Route as TagEditRoute } from '@/routes/_authed/settings/tags/$id_.edit';
// Tag routes
import { Route as TagsListRoute } from '@/routes/_authed/settings/tags/index';
import { Route as TagNewRoute } from '@/routes/_authed/settings/tags/new';

// Settings pages
import { Route as CriticalSettingsRoute } from '@/routes/_authed/settings/critical';
import { Route as SeoSettingsRoute } from '@/routes/_authed/settings/seo';

describe('Settings smoke tests', () => {
    // --- Tags ---

    it('renders tags list page without crashing', async () => {
        const Page = TagsListRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders tag create page without crashing', async () => {
        const Page = TagNewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders tag view page without crashing', async () => {
        const Page = TagViewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders tag edit page without crashing', async () => {
        const Page = TagEditRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    // --- Critical & SEO ---

    it('renders critical settings page without crashing', async () => {
        const Page = CriticalSettingsRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders SEO settings page without crashing', async () => {
        const Page = SeoSettingsRoute.options.component;
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
