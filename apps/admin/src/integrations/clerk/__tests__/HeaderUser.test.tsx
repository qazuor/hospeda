// @vitest-environment jsdom
/**
 * Tests for HeaderUser — tour entry points (SPEC-174 T-014, §7.8, D8).
 *
 * Covers:
 * 1. "Ver guía" is rendered when the user's role has a welcome tour.
 * 2. "Ver guía de esta página" is rendered when a contextual tour exists for
 *    the current route.
 * 3. "Ver guía de esta página" is NOT rendered on routes without a contextual tour.
 * 4. "Ver guía" is NOT rendered when no welcome tour exists for the role.
 * 5. Clicking "Ver guía" calls startTour with source 'manual' and the welcome tourId.
 * 6. Clicking "Ver guía de esta página" calls startTour with source 'manual-page'
 *    and the contextual tourId.
 * 7. Pre-existing menu items (Profile, Settings, Sign out) are still rendered.
 * 8. A11y: tour buttons have aria-label attributes.
 *
 * ## Mocking strategy
 * - `useAuthContext` — HOST user with avatar.
 * - `useTour` — `startTour` spy.
 * - `useWelcomeTourForRole` — returns configurable welcome tour or undefined.
 * - `useContextualTourForRoute` — returns configurable contextual tour or undefined.
 * - `useTranslations` — returns fixed chrome strings.
 * - `useLocation` — configurable pathname.
 * - `useRouter` — navigate spy.
 * - `@repo/media` — stubbed getMediaUrl.
 * - `@repo/icons` — stubbed CompassIcon / MapIcon to simple text sentinels.
 * - `signOut` — vi.fn().
 *
 * @see apps/admin/src/integrations/clerk/header-user.tsx — subject
 * @see SPEC-174 §7.8, D8
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HeaderUser } from '../header-user';

// ---------------------------------------------------------------------------
// Configurable mock state
// ---------------------------------------------------------------------------

const mockTourState = {
    welcomeTourId: 'host.welcome' as string | null,
    contextualTourId: 'host.misAlojamientos' as string | null
};

const mockStartTour = vi.fn();

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => ({
        user: {
            id: 'user_1',
            role: 'HOST',
            displayName: 'Ana Host',
            email: 'ana@host.test',
            avatar: null
        },
        isLoading: false,
        isAuthenticated: true
    })
}));

vi.mock('@/lib/auth-client', () => ({
    signOut: vi.fn()
}));

vi.mock('@repo/media', () => ({
    getMediaUrl: (_src: unknown) => '/test-avatar.jpg'
}));

vi.mock('@/lib/avatar-utils', () => ({
    getInitialsFromName: () => ({ initials: 'AH' })
}));

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => {
            const map: Record<string, string> = {
                'admin-common.tour.replay': 'Ver guía',
                'admin-common.tour.replayPage': 'Ver guía de esta página'
            };
            return map[key] ?? key;
        },
        locale: 'es'
    })
}));

vi.mock('@tanstack/react-router', () => ({
    useLocation: () => ({ pathname: '/me/accommodations' }),
    useRouter: () => ({ navigate: vi.fn() })
}));

vi.mock('@/contexts/tour-context', () => ({
    useTour: () => ({
        isRunning: false,
        activeTourId: null,
        startTour: mockStartTour,
        stopTour: vi.fn()
    })
}));

vi.mock('@/hooks/use-tours', () => ({
    useWelcomeTourForRole: ({ role }: { role: string | null }) => {
        if (!role || !mockTourState.welcomeTourId) return undefined;
        return {
            id: mockTourState.welcomeTourId,
            kind: 'welcome',
            roles: ['HOST'],
            version: 1,
            trigger: 'auto-first-visit',
            showWelcomeModal: true,
            steps: []
        };
    },
    useContextualTourForRoute: ({ pathname: _p }: { pathname: string }) => {
        if (!mockTourState.contextualTourId) return undefined;
        return {
            id: mockTourState.contextualTourId,
            kind: 'contextual',
            route: '/me/accommodations',
            roles: ['HOST'],
            version: 1,
            trigger: 'auto-first-visit',
            showWelcomeModal: false,
            steps: []
        };
    }
}));

// Stub icons to text sentinels — avoids SVG rendering complexity.
vi.mock('@repo/icons', () => ({
    CompassIcon: () => <span data-testid="compass-icon" />,
    MapIcon: () => <span data-testid="map-icon" />
}));

// ---------------------------------------------------------------------------
// Helper — open the dropdown
// ---------------------------------------------------------------------------

async function openMenu(): Promise<void> {
    const user = userEvent.setup();
    const trigger = screen.getByRole('button', { name: /user menu/i });
    await user.click(trigger);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HeaderUser — tour entry points', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockTourState.welcomeTourId = 'host.welcome';
        mockTourState.contextualTourId = 'host.misAlojamientos';
    });

    // -------------------------------------------------------------------------
    // Pre-existing items still present
    // -------------------------------------------------------------------------

    describe('pre-existing menu items', () => {
        it('renders Profile, Settings, and Sign out', async () => {
            render(<HeaderUser />);
            await openMenu();

            expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------------
    // "Ver guía" renders when welcome tour exists
    // -------------------------------------------------------------------------

    describe('"Ver guía" visibility', () => {
        it('renders "Ver guía" when the role has a welcome tour', async () => {
            render(<HeaderUser />);
            await openMenu();

            expect(screen.getByRole('button', { name: 'Ver guía' })).toBeInTheDocument();
        });

        it('does NOT render "Ver guía" when no welcome tour exists for the role', async () => {
            mockTourState.welcomeTourId = null;

            render(<HeaderUser />);
            await openMenu();

            expect(screen.queryByRole('button', { name: 'Ver guía' })).not.toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------------
    // "Ver guía de esta página" renders only when contextual tour exists
    // -------------------------------------------------------------------------

    describe('"Ver guía de esta página" visibility', () => {
        it('renders "Ver guía de esta página" when contextual tour exists for the route', async () => {
            render(<HeaderUser />);
            await openMenu();

            expect(
                screen.getByRole('button', { name: 'Ver guía de esta página' })
            ).toBeInTheDocument();
        });

        it('does NOT render "Ver guía de esta página" when no contextual tour for the route', async () => {
            mockTourState.contextualTourId = null;

            render(<HeaderUser />);
            await openMenu();

            expect(
                screen.queryByRole('button', { name: 'Ver guía de esta página' })
            ).not.toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------------
    // Click handlers
    // -------------------------------------------------------------------------

    describe('click handlers', () => {
        it('calls startTour with tourId and source "manual" when "Ver guía" is clicked', async () => {
            const user = userEvent.setup();
            render(<HeaderUser />);
            await openMenu();

            await user.click(screen.getByRole('button', { name: 'Ver guía' }));

            expect(mockStartTour).toHaveBeenCalledWith({
                tourId: 'host.welcome',
                source: 'manual'
            });
        });

        it('calls startTour with tourId and source "manual-page" when "Ver guía de esta página" is clicked', async () => {
            const user = userEvent.setup();
            render(<HeaderUser />);
            await openMenu();

            await user.click(screen.getByRole('button', { name: 'Ver guía de esta página' }));

            expect(mockStartTour).toHaveBeenCalledWith({
                tourId: 'host.misAlojamientos',
                source: 'manual-page'
            });
        });

        it('closes the dropdown after clicking "Ver guía"', async () => {
            const user = userEvent.setup();
            render(<HeaderUser />);
            await openMenu();

            // Menu is visible
            expect(screen.getByRole('button', { name: 'Ver guía' })).toBeInTheDocument();

            await user.click(screen.getByRole('button', { name: 'Ver guía' }));

            // Menu should be closed (button no longer visible)
            expect(screen.queryByRole('button', { name: 'Ver guía' })).not.toBeInTheDocument();
        });

        it('closes the dropdown after clicking "Ver guía de esta página"', async () => {
            const user = userEvent.setup();
            render(<HeaderUser />);
            await openMenu();

            await user.click(screen.getByRole('button', { name: 'Ver guía de esta página' }));

            expect(
                screen.queryByRole('button', { name: 'Ver guía de esta página' })
            ).not.toBeInTheDocument();
        });
    });

    // -------------------------------------------------------------------------
    // A11y
    // -------------------------------------------------------------------------

    describe('accessibility', () => {
        it('"Ver guía" button has aria-label', async () => {
            render(<HeaderUser />);
            await openMenu();

            const btn = screen.getByRole('button', { name: 'Ver guía' });
            expect(btn).toHaveAttribute('aria-label', 'Ver guía');
        });

        it('"Ver guía de esta página" button has aria-label', async () => {
            render(<HeaderUser />);
            await openMenu();

            const btn = screen.getByRole('button', { name: 'Ver guía de esta página' });
            expect(btn).toHaveAttribute('aria-label', 'Ver guía de esta página');
        });

        it('tour icon sentinels are rendered inside tour buttons', async () => {
            render(<HeaderUser />);
            await openMenu();

            expect(screen.getByTestId('compass-icon')).toBeInTheDocument();
            expect(screen.getByTestId('map-icon')).toBeInTheDocument();
        });
    });
});
