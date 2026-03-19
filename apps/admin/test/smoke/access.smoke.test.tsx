/**
 * Smoke tests for Access module routes.
 *
 * Verifies that each access page renders without crashing.
 * These are NOT functional tests -- they only check that the component
 * tree mounts successfully with mocked dependencies.
 */

import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../helpers/render-with-providers';

// Re-mock router with useParams returning test user ID (must be synchronous, no vi.importActual)
vi.mock('@tanstack/react-router', () => ({
    useRouter: () => ({
        navigate: vi.fn(),
        history: { push: vi.fn(), replace: vi.fn() }
    }),
    useNavigate: () => vi.fn(),
    useSearch: () => ({ page: 1, pageSize: 20 }),
    useParams: () => ({ id: 'user-test-001' }),
    useLocation: () => ({ pathname: '/access/users', search: '', hash: '' }),
    useRouterState: () => ({ location: { pathname: '/access/users', search: '', hash: '' } }),
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
            useParams: vi.fn(() => ({ id: 'user-test-001' })),
            useLoaderData: vi.fn(() => null)
        })
}));

import { Route as PermissionsRoute } from '@/routes/_authed/access/permissions';
import { Route as RolesRoute } from '@/routes/_authed/access/roles';
import { Route as UserViewRoute } from '@/routes/_authed/access/users/$id';
import { Route as UserActivityRoute } from '@/routes/_authed/access/users/$id_.activity';
import { Route as UserEditRoute } from '@/routes/_authed/access/users/$id_.edit';
import { Route as UserPermissionsRoute } from '@/routes/_authed/access/users/$id_.permissions';
// Import route modules AFTER mocks are set up
import { Route as UsersListRoute } from '@/routes/_authed/access/users/index';
import { Route as UserNewRoute } from '@/routes/_authed/access/users/new';

describe('Access module smoke tests', () => {
    // --- Users ---

    it('renders users list page without crashing', async () => {
        const Page = UsersListRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders user create page without crashing', async () => {
        const Page = UserNewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders user view page without crashing', async () => {
        const Page = UserViewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders user edit page without crashing', async () => {
        const Page = UserEditRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders user activity page without crashing', async () => {
        const Page = UserActivityRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders user permissions page without crashing', async () => {
        const Page = UserPermissionsRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    // --- Roles & Permissions ---

    it('renders roles page without crashing', async () => {
        const Page = RolesRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders permissions page without crashing', async () => {
        const Page = PermissionsRoute.options.component;
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
