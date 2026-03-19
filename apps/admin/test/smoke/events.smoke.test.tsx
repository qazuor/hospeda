/**
 * Smoke tests for Events module main routes.
 *
 * Verifies that each event page renders without crashing.
 * These are NOT functional tests -- they only check that the component
 * tree mounts successfully with mocked dependencies.
 */

import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../helpers/render-with-providers';

// Override @tanstack/react-router to include event-specific id in useParams
// and add useLocation + useRouterState required by view/edit pages.
vi.mock('@tanstack/react-router', () => ({
    useRouter: () => ({
        navigate: vi.fn(),
        history: { push: vi.fn(), replace: vi.fn() }
    }),
    useNavigate: () => vi.fn(),
    useSearch: () => ({ page: 1, pageSize: 20 }),
    useParams: () => ({ id: 'evt-test-001' }),
    useLocation: () => ({ pathname: '/events/evt-test-001', search: '', hash: '' }),
    useRouterState: () => ({
        location: { pathname: '/events/evt-test-001', search: '', hash: '' }
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
        (routeOptions: {
            component: React.ComponentType;
            pendingComponent?: React.ComponentType;
            [key: string]: unknown;
        }) => ({
            options: routeOptions
        }),
    createFileRoute:
        (_path: string) =>
        (routeOptions: {
            component: React.ComponentType;
            pendingComponent?: React.ComponentType;
            [key: string]: unknown;
        }) => ({
            options: routeOptions,
            useSearch: vi.fn(() => ({ page: 1, pageSize: 20 })),
            useParams: vi.fn(() => ({ id: 'evt-test-001' })),
            useLoaderData: vi.fn(() => null)
        })
}));

import { Route as EventViewRoute } from '@/routes/_authed/events/$id';
import { Route as EventAttendeesRoute } from '@/routes/_authed/events/$id_.attendees';
import { Route as EventEditRoute } from '@/routes/_authed/events/$id_.edit';
import { Route as EventTicketsRoute } from '@/routes/_authed/events/$id_.tickets';
// Import route modules AFTER mocks are set up
import { Route as EventsListRoute } from '@/routes/_authed/events/index';
import { Route as EventLocationViewRoute } from '@/routes/_authed/events/locations/$id';
import { Route as EventLocationEditRoute } from '@/routes/_authed/events/locations/$id_.edit';
import { Route as EventLocationEventsRoute } from '@/routes/_authed/events/locations/$id_.events';
import { Route as EventLocationsListRoute } from '@/routes/_authed/events/locations/index';
import { Route as EventLocationNewRoute } from '@/routes/_authed/events/locations/new';
import { Route as EventNewRoute } from '@/routes/_authed/events/new';
import { Route as EventOrganizerViewRoute } from '@/routes/_authed/events/organizers/$id';
import { Route as EventOrganizerContactRoute } from '@/routes/_authed/events/organizers/$id_.contact';
import { Route as EventOrganizerEditRoute } from '@/routes/_authed/events/organizers/$id_.edit';
import { Route as EventOrganizerEventsRoute } from '@/routes/_authed/events/organizers/$id_.events';
import { Route as EventOrganizersListRoute } from '@/routes/_authed/events/organizers/index';
import { Route as EventOrganizerNewRoute } from '@/routes/_authed/events/organizers/new';

describe('Events smoke tests', () => {
    it('renders events list page without crashing', async () => {
        const Page = EventsListRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders event create page without crashing', async () => {
        const Page = EventNewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders event view page without crashing', async () => {
        const Page = EventViewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders event edit page without crashing', async () => {
        const Page = EventEditRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders event attendees page without crashing', async () => {
        const Page = EventAttendeesRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders event tickets page without crashing', async () => {
        const Page = EventTicketsRoute.options.component;
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

describe('Event Locations smoke tests', () => {
    it('renders event locations list page without crashing', async () => {
        const Page = EventLocationsListRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders event location create page without crashing', async () => {
        const Page = EventLocationNewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders event location view page without crashing', async () => {
        const Page = EventLocationViewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders event location edit page without crashing', async () => {
        const Page = EventLocationEditRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders event location events page without crashing', async () => {
        const Page = EventLocationEventsRoute.options.component;
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

describe('Event Organizers smoke tests', () => {
    it('renders event organizers list page without crashing', async () => {
        const Page = EventOrganizersListRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders event organizer create page without crashing', async () => {
        const Page = EventOrganizerNewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders event organizer view page without crashing', async () => {
        const Page = EventOrganizerViewRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders event organizer edit page without crashing', async () => {
        const Page = EventOrganizerEditRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders event organizer events page without crashing', async () => {
        const Page = EventOrganizerEventsRoute.options.component;
        if (!Page) throw new Error('Component not found in Route.options');

        renderWithProviders(<Page />);

        await waitFor(
            () => {
                expect(document.body.textContent?.length).toBeGreaterThan(0);
            },
            { timeout: 5000 }
        );
    });

    it('renders event organizer contact page without crashing', async () => {
        const Page = EventOrganizerContactRoute.options.component;
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
