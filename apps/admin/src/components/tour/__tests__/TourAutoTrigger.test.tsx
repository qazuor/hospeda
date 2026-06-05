// @vitest-environment jsdom
/**
 * Tests for TourAutoTrigger (SPEC-174 T-013, §7.6, D9, D13).
 *
 * Covers:
 * 1. Does not fire while `isLoading` is true.
 * 2. Does not fire while `isRunning` is true.
 * 3. Does not fire when `role` is null.
 * 4. Welcome tour fires (double-rAF + startTour) when on the dashboard.
 * 5. Welcome-redirect navigates to /dashboard when NOT on dashboard; does NOT
 *    call startTour pre-redirect (D13).
 * 6. Does NOT redirect when welcome tour has already been seen (D9).
 * 7. Contextual tour fires when welcome is seen and route has a matching tour.
 * 8. Per-pathname latch prevents double-fire (strict-mode guard).
 *
 * ## Mocking strategy
 * - `useLocation` → returns a configurable pathname.
 * - `useRouter`   → `navigate` is a spy.
 * - `useAuthContext` → configurable user/role.
 * - `useAdminTourState` → configurable isLoading/hasSeen.
 * - `useTour` → `startTour` is a spy; `isRunning` is configurable.
 * - `decideAutoTrigger` → real function (not mocked; tour catalog is minimal).
 * - `validatedConfig` → minimal catalog with one welcome + one contextual tour.
 *
 * @see apps/admin/src/components/tour/TourAutoTrigger.tsx — subject
 * @see SPEC-174 §7.6, D9, D13
 */

import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TourAutoTrigger } from '../TourAutoTrigger';

// ---------------------------------------------------------------------------
// Mutable state shared across mocks
// ---------------------------------------------------------------------------

const mockState = {
    pathname: '/dashboard',
    isLoading: false,
    hasSeen: (_input: { tourId: string; version: number }) => false,
    isRunning: false,
    role: 'HOST' as string | null,
    navigate: vi.fn()
};

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@tanstack/react-router', () => ({
    useLocation: () => ({ pathname: mockState.pathname }),
    useRouter: () => ({ navigate: mockState.navigate })
}));

vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => ({
        user: mockState.role ? { id: 'user_1', role: mockState.role } : null,
        isLoading: false,
        isAuthenticated: Boolean(mockState.role)
    })
}));

vi.mock('@/hooks/use-admin-tour-state', () => ({
    useAdminTourState: () => ({
        isLoading: mockState.isLoading,
        error: null,
        hasSeen: mockState.hasSeen,
        markSeen: vi.fn()
    })
}));

vi.mock('@/contexts/tour-context', () => ({
    useTour: () => ({
        isRunning: mockState.isRunning,
        activeTourId: null,
        startTour: mockStartTour,
        stopTour: vi.fn()
    })
}));

// Minimal catalog — hoisted so vi.mock factory can reference it.
const { WELCOME_TOUR, CONTEXTUAL_TOUR } = vi.hoisted(() => {
    const WELCOME: import('@/config/ia/tour.schema').Tour = {
        id: 'host.welcome',
        roles: ['HOST'],
        kind: 'welcome',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: true,
        steps: [
            {
                id: 'greeting',
                target: 'center',
                title: { es: 'Bienvenido', en: 'Welcome', pt: 'Bem-vindo' },
                body: { es: 'Descripción', en: 'Description', pt: 'Descrição' }
            }
        ]
    };

    const CONTEXTUAL: import('@/config/ia/tour.schema').Tour = {
        id: 'host.misAlojamientos',
        roles: ['HOST'],
        kind: 'contextual',
        route: '/me/accommodations',
        version: 1,
        trigger: 'auto-first-visit',
        showWelcomeModal: false,
        steps: [
            {
                id: 'list',
                target: 'data-tour:sidebar',
                title: { es: 'Tu listado', en: 'Your list', pt: 'Sua lista' },
                body: { es: 'Descripción', en: 'Description', pt: 'Descrição' }
            }
        ]
    };

    return { WELCOME_TOUR: WELCOME, CONTEXTUAL_TOUR: CONTEXTUAL };
});

vi.mock('@/config/ia/validate', () => ({
    validatedConfig: {
        tours: {
            'host.welcome': WELCOME_TOUR,
            'host.misAlojamientos': CONTEXTUAL_TOUR
        }
    }
}));

// startTour spy — defined outside so tests can assert on it.
const mockStartTour = vi.fn();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Advance two animation frames. */
async function flushDoubleRaf(): Promise<void> {
    await act(async () => {
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TourAutoTrigger', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mutable state to defaults.
        mockState.pathname = '/dashboard';
        mockState.isLoading = false;
        mockState.hasSeen = () => false;
        mockState.isRunning = false;
        mockState.role = 'HOST';
        mockState.navigate = vi.fn();
    });

    // -------------------------------------------------------------------------
    // Guard conditions
    // -------------------------------------------------------------------------

    describe('guard conditions — no fire', () => {
        it('does not call startTour while isLoading is true', async () => {
            mockState.isLoading = true;

            render(<TourAutoTrigger />);
            await flushDoubleRaf();

            expect(mockStartTour).not.toHaveBeenCalled();
            expect(mockState.navigate).not.toHaveBeenCalled();
        });

        it('does not call startTour while isRunning is true', async () => {
            mockState.isRunning = true;

            render(<TourAutoTrigger />);
            await flushDoubleRaf();

            expect(mockStartTour).not.toHaveBeenCalled();
        });

        it('does not call startTour when role is null', async () => {
            mockState.role = null;

            render(<TourAutoTrigger />);
            await flushDoubleRaf();

            expect(mockStartTour).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Welcome tour — on dashboard
    // -------------------------------------------------------------------------

    describe('welcome tour on dashboard', () => {
        it('calls startTour with the welcome tourId and source auto', async () => {
            mockState.pathname = '/dashboard';
            mockState.hasSeen = () => false;

            render(<TourAutoTrigger />);
            await flushDoubleRaf();

            await waitFor(() => {
                expect(mockStartTour).toHaveBeenCalledWith({
                    tourId: 'host.welcome',
                    source: 'auto'
                });
            });
        });

        it('does NOT navigate when already on the dashboard', async () => {
            mockState.pathname = '/dashboard';

            render(<TourAutoTrigger />);
            await flushDoubleRaf();

            expect(mockState.navigate).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Welcome-redirect (D13)
    // -------------------------------------------------------------------------

    describe('welcome-redirect (D13)', () => {
        it('navigates to /dashboard when welcome is unseen and NOT on dashboard', async () => {
            mockState.pathname = '/me/accommodations';
            mockState.hasSeen = () => false;

            render(<TourAutoTrigger />);

            await waitFor(() => {
                expect(mockState.navigate).toHaveBeenCalledWith({ to: '/dashboard' });
            });
        });

        it('does NOT call startTour before the redirect', async () => {
            mockState.pathname = '/me/accommodations';
            mockState.hasSeen = () => false;

            render(<TourAutoTrigger />);

            // Give rAFs time to run.
            await flushDoubleRaf();

            // navigate was called but startTour was NOT (pre-redirect).
            expect(mockState.navigate).toHaveBeenCalled();
            expect(mockStartTour).not.toHaveBeenCalled();
        });

        it('does NOT redirect when welcome tour has already been seen', async () => {
            mockState.pathname = '/me/accommodations';
            // Welcome tour seen — only contextual is eligible, not redirect.
            mockState.hasSeen = ({ tourId }) => tourId === 'host.welcome';

            render(<TourAutoTrigger />);
            await flushDoubleRaf();

            expect(mockState.navigate).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // Contextual tour
    // -------------------------------------------------------------------------

    describe('contextual tour', () => {
        it('fires the contextual tour when welcome is seen and on its route', async () => {
            mockState.pathname = '/me/accommodations';
            // Welcome seen → only contextual eligible.
            mockState.hasSeen = ({ tourId }) => tourId === 'host.welcome';

            render(<TourAutoTrigger />);
            await flushDoubleRaf();

            await waitFor(() => {
                expect(mockStartTour).toHaveBeenCalledWith({
                    tourId: 'host.misAlojamientos',
                    source: 'auto'
                });
            });
        });
    });

    // -------------------------------------------------------------------------
    // Per-pathname latch (strict-mode double-fire guard)
    // -------------------------------------------------------------------------

    describe('latch prevents double-fire', () => {
        it('calls startTour exactly once even when the effect re-runs with same pathname', async () => {
            mockState.pathname = '/dashboard';
            mockState.hasSeen = () => false;

            const { rerender } = render(<TourAutoTrigger />);
            await flushDoubleRaf();

            // Simulate a re-render (same pathname, same state).
            rerender(<TourAutoTrigger />);
            await flushDoubleRaf();

            // startTour must have been called at most once.
            expect(mockStartTour).toHaveBeenCalledTimes(1);
        });
    });
});
