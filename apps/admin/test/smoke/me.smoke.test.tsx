/**
 * Smoke tests for "Me" (user profile) routes.
 *
 * Covers profile, settings, change-password, and my accommodations.
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
    useParams: () => ({}),
    useLocation: () => ({ pathname: '/me', search: '', hash: '' }),
    useRouterState: () => ({ location: { pathname: '/me', search: '', hash: '' } }),
    useRouteContext: () => ({
        user: {
            id: 'test_user_id',
            name: 'Test User',
            email: 'test@example.com',
            role: 'ADMIN'
        },
        isAuthenticated: true
    }),
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

import { Route as MyAccommodationsRoute } from '@/routes/_authed/me/accommodations/index';
import { Route as ChangePasswordRoute } from '@/routes/_authed/me/change-password';
// Import route modules AFTER mocks are set up
import { Route as ProfileRoute } from '@/routes/_authed/me/profile';
import { Route as SettingsRoute } from '@/routes/_authed/me/settings';

describe('Me (user profile) smoke tests', () => {
    it('renders profile page without crashing', async () => {
        const Page = ProfileRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders settings page without crashing', async () => {
        const Page = SettingsRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders change password page without crashing', async () => {
        const Page = ChangePasswordRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders my accommodations page without crashing', async () => {
        const Page = MyAccommodationsRoute.options.component;
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
