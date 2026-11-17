/**
 * @file UmamiPageviews.test.tsx
 * @description HOS-2119: the admin counts its pages from the router (the
 * tracker's auto pageview is off): one pageview on the initial resolved
 * location and one per later navigation, each with the current URL, title and
 * the previous page as referrer. The first one waits for the identity only
 * under the authenticated layout.
 */

import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeRouterState {
    resolvedLocation?: { readonly href: string };
    matches: ReadonlyArray<{ readonly routeId: string }>;
}

const routerState: FakeRouterState = { matches: [] };
const mockTrackPageview = vi.fn();

vi.mock('@tanstack/react-router', () => ({
    useRouterState: ({ select }: { select: (state: FakeRouterState) => unknown }) =>
        select(routerState)
}));

vi.mock('@/lib/analytics/umami-client', () => ({
    trackPageview: (...args: unknown[]) => mockTrackPageview(...args)
}));

import { UmamiPageviews } from '@/components/analytics/UmamiPageviews';

const ORIGIN = window.location.origin;
const AUTHED_MATCHES = [{ routeId: '__root__' }, { routeId: '/_authed' }] as const;

/** The router resolved `path` (URL and title already updated). */
function resolve({
    path,
    title,
    matches = AUTHED_MATCHES
}: {
    readonly path: string;
    readonly title: string;
    readonly matches?: FakeRouterState['matches'];
}): void {
    window.history.pushState({}, '', path);
    document.title = title;
    routerState.resolvedLocation = { href: path };
    routerState.matches = matches;
}

beforeEach(() => {
    mockTrackPageview.mockClear();
    routerState.resolvedLocation = undefined;
    routerState.matches = [];
});

afterEach(() => {
    window.history.replaceState({}, '', '/');
});

describe('UmamiPageviews', () => {
    it('sends nothing before the initial location resolves', () => {
        // Arrange / Act
        render(<UmamiPageviews />);

        // Assert
        expect(mockTrackPageview).not.toHaveBeenCalled();
    });

    it('counts the initial page, waiting for the identity under the authenticated layout', () => {
        // Arrange
        resolve({ path: '/dashboard', title: 'Panel · Hospeda Admin' });

        // Act
        render(<UmamiPageviews />);

        // Assert: no referrer key, the tracker keeps document.referrer
        expect(mockTrackPageview.mock.calls).toEqual([
            [{ url: `${ORIGIN}/dashboard`, title: 'Panel · Hospeda Admin', awaitIdentity: true }]
        ]);
    });

    it('counts each navigation with the previous page as referrer', () => {
        // Arrange
        resolve({ path: '/dashboard', title: 'Panel' });
        const { rerender } = render(<UmamiPageviews />);

        // Act
        resolve({ path: '/users?page=2', title: 'Usuarios' });
        rerender(<UmamiPageviews />);

        // Assert
        expect(mockTrackPageview).toHaveBeenCalledTimes(2);
        expect(mockTrackPageview.mock.calls[1]).toEqual([
            {
                url: `${ORIGIN}/users?page=2`,
                title: 'Usuarios',
                referrer: '/dashboard',
                awaitIdentity: true
            }
        ]);
    });

    it('does not count the same location twice on a re-render', () => {
        // Arrange
        resolve({ path: '/dashboard', title: 'Panel' });
        const { rerender } = render(<UmamiPageviews />);

        // Act
        rerender(<UmamiPageviews />);

        // Assert
        expect(mockTrackPageview).toHaveBeenCalledTimes(1);
    });

    it('does not wait for the identity outside the authenticated layout', () => {
        // Arrange
        resolve({
            path: '/auth/change-password',
            title: 'Cambiar contraseña',
            matches: [{ routeId: '__root__' }, { routeId: '/auth/change-password' }]
        });

        // Act
        render(<UmamiPageviews />);

        // Assert
        expect(mockTrackPageview.mock.calls[0]?.[0]).toEqual({
            url: `${ORIGIN}/auth/change-password`,
            title: 'Cambiar contraseña',
            awaitIdentity: false
        });
    });
});
