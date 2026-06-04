/**
 * Integration tests for TourProvider / useTour (SPEC-174 T-010).
 *
 * Covers the scenarios in the T-010 spec:
 * 1. startTour without showWelcomeModal → driver started immediately (no modal).
 * 2. startTour with showWelcomeModal → modal shown; clicking Mostrame → driver started.
 * 3. startTour with showWelcomeModal → modal shown; clicking Saltar → markSeen +
 *    skipped event fired, driver NOT started.
 * 4. Manual source (source='manual-page') bypasses modal → driver started directly.
 * 5. Finish path → markSeen + completed event fired.
 * 6. Reduced-motion → driver receives animate: false.
 * 7. stopTour → destroys driver instance.
 * 8. startTour with unknown tourId → no-op (logs warning).
 *
 * ## Mocking strategy
 * - `driver.js` is mocked via `vi.mock('driver.js')` — the module exports a
 *   factory `driver(config)` that returns an object with `drive()`, `destroy()`,
 *   and `hasNextStep()`.
 * - `useAuthContext` is mocked to return a HOST user.
 * - `useUserPermissions` is mocked to return empty permissions.
 * - `useAdminTourState` is mocked to expose `markSeen` as a spy.
 * - `trackEvent` is mocked to capture PostHog calls.
 * - `@/config/ia/validate` is mocked to return a minimal catalog with two tours:
 *   one welcome (showWelcomeModal: true) and one contextual (showWelcomeModal: false).
 * - `matchMedia` is stubbed for prefers-reduced-motion tests.
 *
 * @see apps/admin/src/contexts/tour-context.tsx — subject
 * @see SPEC-174 §7.4
 */

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TourProvider, useTour } from '../tour-context';

// ---------------------------------------------------------------------------
// Mock driver.js (the dynamic import target)
// ---------------------------------------------------------------------------

const mockDrive = vi.fn();
const mockDestroy = vi.fn();
const mockHasNextStep = vi.fn();
const mockDriverInstance = {
    drive: mockDrive,
    destroy: mockDestroy,
    hasNextStep: mockHasNextStep
};
const mockDriverFactory = vi.fn(() => mockDriverInstance);

vi.mock('driver.js', () => ({
    driver: mockDriverFactory
}));

// ---------------------------------------------------------------------------
// Mock analytics
// ---------------------------------------------------------------------------

vi.mock('@/lib/analytics/posthog-client', () => ({
    trackEvent: vi.fn()
}));

import { trackEvent } from '@/lib/analytics/posthog-client';
const mockedTrackEvent = vi.mocked(trackEvent);

// ---------------------------------------------------------------------------
// Mock useTranslations
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key.split('.').pop() ?? key,
        locale: 'es'
    })
}));

// ---------------------------------------------------------------------------
// Mock useAuthContext
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => ({
        user: { id: 'user_1', role: 'HOST' },
        isLoading: false,
        isAuthenticated: true,
        error: null,
        refreshSession: vi.fn(),
        clearSession: vi.fn(),
        signOut: vi.fn()
    })
}));

// ---------------------------------------------------------------------------
// Mock useUserPermissions
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: () => []
}));

// ---------------------------------------------------------------------------
// Mock useAdminTourState
// ---------------------------------------------------------------------------

const mockMarkSeen = vi.fn();

vi.mock('@/hooks/use-admin-tour-state', () => ({
    useAdminTourState: () => ({
        isLoading: false,
        error: null,
        hasSeen: () => false,
        markSeen: mockMarkSeen
    })
}));

// ---------------------------------------------------------------------------
// Minimal tour catalog — defined with vi.hoisted so the mock factory can
// reference them (vi.mock is hoisted to the top of the file before const defs)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Test consumer component
// ---------------------------------------------------------------------------

interface ConsumerProps {
    readonly onMount?: (ctx: ReturnType<typeof useTour>) => void;
}

function Consumer({ onMount }: ConsumerProps) {
    const ctx = useTour();
    // Expose ctx via onMount callback so tests can call startTour/stopTour.
    if (onMount) onMount(ctx);
    return (
        <div>
            <span data-testid="running">{String(ctx.isRunning)}</span>
            <span data-testid="activeTourId">{ctx.activeTourId ?? 'none'}</span>
        </div>
    );
}

function renderWithProvider(props: ConsumerProps = {}) {
    const result = render(
        <TourProvider>
            <Consumer {...props} />
        </TourProvider>
    );
    return result;
}

// ---------------------------------------------------------------------------
// matchMedia stub
// ---------------------------------------------------------------------------

function mockMatchMedia(reducedMotion: boolean) {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
            matches: query.includes('prefers-reduced-motion') && reducedMotion,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn()
        })
    });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TourProvider / useTour', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMatchMedia(false);
        // Default: hasNextStep returns false (tour finished)
        mockHasNextStep.mockReturnValue(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('startTour — contextual tour (no modal)', () => {
        it('starts driver immediately when showWelcomeModal is false', async () => {
            // Arrange
            let tourCtx!: ReturnType<typeof useTour>;
            renderWithProvider({
                onMount: (ctx) => {
                    tourCtx = ctx;
                }
            });

            // Act
            await act(async () => {
                tourCtx.startTour({ tourId: 'host.misAlojamientos' });
            });

            // Assert — driver factory called; no modal rendered
            await waitFor(() => {
                expect(mockDriverFactory).toHaveBeenCalledOnce();
            });
            expect(mockDrive).toHaveBeenCalledOnce();
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });

        it('fires the shown trackEvent', async () => {
            // Arrange
            let tourCtx!: ReturnType<typeof useTour>;
            renderWithProvider({
                onMount: (ctx) => {
                    tourCtx = ctx;
                }
            });

            // Act
            await act(async () => {
                tourCtx.startTour({ tourId: 'host.misAlojamientos', source: 'auto' });
            });

            // Assert
            expect(mockedTrackEvent).toHaveBeenCalledWith('admin.tour.shown', {
                tourId: 'host.misAlojamientos',
                role: 'HOST',
                source: 'auto'
            });
        });
    });

    describe('startTour — welcome tour (with modal)', () => {
        it('shows the welcome modal without starting driver', async () => {
            // Arrange
            let tourCtx!: ReturnType<typeof useTour>;
            renderWithProvider({
                onMount: (ctx) => {
                    tourCtx = ctx;
                }
            });

            // Act
            await act(async () => {
                tourCtx.startTour({ tourId: 'host.welcome' });
            });

            // Assert — modal visible; driver NOT started yet
            expect(screen.getByRole('dialog')).toBeInTheDocument();
            expect(mockDriverFactory).not.toHaveBeenCalled();
        });

        it('clicking Mostrame starts driver and closes modal', async () => {
            // Arrange
            const user = userEvent.setup();
            let tourCtx!: ReturnType<typeof useTour>;
            renderWithProvider({
                onMount: (ctx) => {
                    tourCtx = ctx;
                }
            });

            await act(async () => {
                tourCtx.startTour({ tourId: 'host.welcome' });
            });
            expect(screen.getByRole('dialog')).toBeInTheDocument();

            // Act — click Mostrame
            await user.click(screen.getByRole('button', { name: /showMe/i }));

            // Assert — driver started
            await waitFor(() => {
                expect(mockDriverFactory).toHaveBeenCalledOnce();
            });
            expect(mockDrive).toHaveBeenCalledOnce();
        });

        it('clicking Saltar calls markSeen and fires skipped event without starting driver', async () => {
            // Arrange
            const user = userEvent.setup();
            let tourCtx!: ReturnType<typeof useTour>;
            renderWithProvider({
                onMount: (ctx) => {
                    tourCtx = ctx;
                }
            });

            await act(async () => {
                tourCtx.startTour({ tourId: 'host.welcome' });
            });

            // Act — click Saltar
            await user.click(screen.getByRole('button', { name: /skip/i }));

            // Assert
            expect(mockMarkSeen).toHaveBeenCalledWith({ tourId: 'host.welcome', version: 1 });
            expect(mockedTrackEvent).toHaveBeenCalledWith(
                'admin.tour.skipped',
                expect.objectContaining({
                    tourId: 'host.welcome'
                })
            );
            expect(mockDriverFactory).not.toHaveBeenCalled();
        });
    });

    describe('startTour — manual-page source bypasses modal', () => {
        it('goes straight to driver when source is manual-page', async () => {
            // Arrange
            let tourCtx!: ReturnType<typeof useTour>;
            renderWithProvider({
                onMount: (ctx) => {
                    tourCtx = ctx;
                }
            });

            // Act — even for a welcome tour, manual-page skips the modal
            await act(async () => {
                tourCtx.startTour({ tourId: 'host.welcome', source: 'manual-page' });
            });

            // Assert — no modal; driver starts directly
            await waitFor(() => {
                expect(mockDriverFactory).toHaveBeenCalledOnce();
            });
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    describe('finish path', () => {
        it('calls markSeen and fires completed event when driver finishes', async () => {
            // Arrange
            let tourCtx!: ReturnType<typeof useTour>;
            renderWithProvider({
                onMount: (ctx) => {
                    tourCtx = ctx;
                }
            });

            // hasNextStep = false means driver finished (last step shown).
            mockHasNextStep.mockReturnValue(false);

            // Capture the onDestroyStarted callback from the driver config.
            let onDestroyStarted: (() => void) | undefined;
            mockDriverFactory.mockImplementation((config: Record<string, unknown>) => {
                onDestroyStarted = config.onDestroyStarted as (() => void) | undefined;
                return mockDriverInstance;
            });

            // Act — start a contextual tour (no modal)
            await act(async () => {
                tourCtx.startTour({ tourId: 'host.misAlojamientos' });
            });

            await waitFor(() => expect(mockDriverFactory).toHaveBeenCalledOnce());

            // Simulate driver finishing (onDestroyStarted called by driver.js)
            await act(async () => {
                onDestroyStarted?.();
            });

            // Assert
            expect(mockMarkSeen).toHaveBeenCalledWith({
                tourId: 'host.misAlojamientos',
                version: 1
            });
            expect(mockedTrackEvent).toHaveBeenCalledWith(
                'admin.tour.completed',
                expect.objectContaining({
                    tourId: 'host.misAlojamientos'
                })
            );
        });
    });

    describe('reduced-motion', () => {
        it('passes animate: false to driver factory when prefers-reduced-motion', async () => {
            // Arrange
            mockMatchMedia(true); // reduced motion ON
            let tourCtx!: ReturnType<typeof useTour>;
            renderWithProvider({
                onMount: (ctx) => {
                    tourCtx = ctx;
                }
            });

            // Act
            await act(async () => {
                tourCtx.startTour({ tourId: 'host.misAlojamientos' });
            });

            await waitFor(() => expect(mockDriverFactory).toHaveBeenCalledOnce());

            // Assert
            const calls = mockDriverFactory.mock.calls as unknown as Array<
                [Record<string, unknown>]
            >;
            const config = calls[0]?.[0] ?? {};
            expect(config.animate).toBe(false);
            expect(config.smoothScroll).toBe(false);
        });

        it('passes animate: true when no prefers-reduced-motion', async () => {
            // Arrange
            mockMatchMedia(false);
            let tourCtx!: ReturnType<typeof useTour>;
            renderWithProvider({
                onMount: (ctx) => {
                    tourCtx = ctx;
                }
            });

            // Act
            await act(async () => {
                tourCtx.startTour({ tourId: 'host.misAlojamientos' });
            });

            await waitFor(() => expect(mockDriverFactory).toHaveBeenCalledOnce());

            // Assert
            const calls = mockDriverFactory.mock.calls as unknown as Array<
                [Record<string, unknown>]
            >;
            const config = calls[0]?.[0] ?? {};
            expect(config.animate).toBe(true);
        });
    });

    describe('stopTour', () => {
        it('destroys the driver instance', async () => {
            // Arrange
            let tourCtx!: ReturnType<typeof useTour>;
            renderWithProvider({
                onMount: (ctx) => {
                    tourCtx = ctx;
                }
            });

            await act(async () => {
                tourCtx.startTour({ tourId: 'host.misAlojamientos' });
            });
            await waitFor(() => expect(mockDriverFactory).toHaveBeenCalledOnce());

            // Act
            act(() => {
                tourCtx.stopTour();
            });

            // Assert
            expect(mockDestroy).toHaveBeenCalledOnce();
        });
    });

    describe('unknown tourId', () => {
        it('does nothing when tourId is not in the catalog', async () => {
            // Arrange
            let tourCtx!: ReturnType<typeof useTour>;
            renderWithProvider({
                onMount: (ctx) => {
                    tourCtx = ctx;
                }
            });

            // Act — unknown id
            act(() => {
                tourCtx.startTour({ tourId: 'nonexistent.tour' });
            });

            // Assert — no modal, no driver, no events
            await waitFor(() => {
                expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
                expect(mockDriverFactory).not.toHaveBeenCalled();
                expect(mockedTrackEvent).not.toHaveBeenCalled();
            });
        });
    });
});
