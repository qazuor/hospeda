// @vitest-environment jsdom
/**
 * A11y regression tests for the tour system (SPEC-174 T-015, §7.9).
 *
 * Documents and asserts the accessibility semantics of:
 * 1. ESC in driver.js → triggers onSkip (markSeen + skipped event) via
 *    onDestroyStarted. VERIFIED via existing tour-context.test.tsx scenarios.
 *    This file adds a regression assertion for the onDestroyStarted path.
 * 2. Overlay click → same behavior as ESC (allowClose: true → onDestroyStarted).
 * 3. prefers-reduced-motion propagates animate: false to the driver factory.
 *    (Regression test to guard against future regressions in the TourProvider.)
 * 4. Welcome modal focus trap: Radix Dialog handles this natively. The dialog
 *    element is present with role="dialog" when the modal is open.
 * 5. Welcome modal ESC → calls onSkip (via Dialog onOpenChange(false)).
 * 6. Driver popover buttons receive localized labels (nextLabel, prevLabel,
 *    doneLabel passed to driver factory config).
 *
 * ## Findings summary (T-015 audit)
 *
 * - ESC + overlay click on driver: ALREADY CORRECT. `onDestroyStarted` fires for
 *   both; `hasNextStep()` distinguishes completed vs. skipped path. markSeen +
 *   skipped event fire correctly in both cases.
 * - Welcome modal focus trap + restore: ALREADY CORRECT. Radix Dialog provides
 *   this natively (focus trap on mount, restore on unmount).
 * - prefers-reduced-motion: ALREADY CORRECT. `animate: false` and
 *   `smoothScroll: false` are passed to the driver when the media query matches.
 *   This file adds a standalone regression assertion.
 * - Driver button labels: ALREADY CORRECT. `nextBtnText`, `prevBtnText`,
 *   `doneBtnText` are passed from i18n keys in `launchDriver`.
 * - aria-modal on TourWelcomeModal: ALREADY CORRECT (attribute present on
 *   DialogContent, covered by TourWelcomeModal.test.tsx).
 *
 * No real code gaps were found — this task lands as tests + documentation.
 *
 * @see apps/admin/src/contexts/tour-context.tsx — driver a11y config
 * @see apps/admin/src/components/tour/TourWelcomeModal.tsx — modal a11y
 * @see SPEC-174 §7.9
 */

import { TourProvider, useTour } from '@/contexts/tour-context';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock driver.js
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
        t: (key: string) => {
            const map: Record<string, string> = {
                'admin-common.tour.next': 'Siguiente',
                'admin-common.tour.prev': 'Anterior',
                'admin-common.tour.done': 'Listo',
                'admin-common.tour.skip': 'Saltar',
                'admin-common.tour.showMe': 'Mostrame'
            };
            return map[key] ?? key;
        },
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
        isAuthenticated: true
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
// Minimal catalog
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
// Test consumer
// ---------------------------------------------------------------------------

interface ConsumerProps {
    readonly onMount?: (ctx: ReturnType<typeof useTour>) => void;
}

function Consumer({ onMount }: ConsumerProps) {
    const ctx = useTour();
    if (onMount) onMount(ctx);
    return (
        <div>
            <span data-testid="running">{String(ctx.isRunning)}</span>
        </div>
    );
}

function renderWithProvider(props: ConsumerProps = {}) {
    return render(
        <TourProvider>
            <Consumer {...props} />
        </TourProvider>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Tour system — a11y regression (SPEC-174 T-015)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMatchMedia(false);
        mockHasNextStep.mockReturnValue(false);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -------------------------------------------------------------------------
    // ESC / overlay click → onDestroyStarted → skip semantics
    // -------------------------------------------------------------------------

    describe('ESC / overlay click → skip semantics preserved', () => {
        it('calls markSeen and fires skipped event when driver is destroyed mid-tour (ESC/overlay)', async () => {
            // Arrange: hasNextStep = true → user is mid-tour, not finished.
            mockHasNextStep.mockReturnValue(true);

            let onDestroyStarted: (() => void) | undefined;
            mockDriverFactory.mockImplementation((config: Record<string, unknown>) => {
                onDestroyStarted = config.onDestroyStarted as (() => void) | undefined;
                return mockDriverInstance;
            });

            let tourCtx!: ReturnType<typeof useTour>;
            renderWithProvider({
                onMount: (ctx) => {
                    tourCtx = ctx;
                }
            });

            // Act — start a contextual tour (no modal) then simulate ESC/overlay.
            await act(async () => {
                tourCtx.startTour({ tourId: 'host.misAlojamientos' });
            });
            await waitFor(() => expect(mockDriverFactory).toHaveBeenCalledOnce());

            // Simulate ESC / overlay close (driver calls onDestroyStarted).
            await act(async () => {
                onDestroyStarted?.();
            });

            // Assert: markSeen fired + skipped event (not completed).
            expect(mockMarkSeen).toHaveBeenCalledWith({
                tourId: 'host.misAlojamientos',
                version: 1
            });
            expect(mockedTrackEvent).toHaveBeenCalledWith(
                'admin.tour.skipped',
                expect.objectContaining({ tourId: 'host.misAlojamientos' })
            );
            expect(mockedTrackEvent).not.toHaveBeenCalledWith(
                'admin.tour.completed',
                expect.anything()
            );
        });

        it('calls markSeen and fires COMPLETED event when driver finishes the last step', async () => {
            // Arrange: hasNextStep = false → driver is on last step (finished).
            mockHasNextStep.mockReturnValue(false);

            let onDestroyStarted: (() => void) | undefined;
            mockDriverFactory.mockImplementation((config: Record<string, unknown>) => {
                onDestroyStarted = config.onDestroyStarted as (() => void) | undefined;
                return mockDriverInstance;
            });

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

            await act(async () => {
                onDestroyStarted?.();
            });

            expect(mockedTrackEvent).toHaveBeenCalledWith(
                'admin.tour.completed',
                expect.objectContaining({ tourId: 'host.misAlojamientos' })
            );
            expect(mockedTrackEvent).not.toHaveBeenCalledWith(
                'admin.tour.skipped',
                expect.anything()
            );
        });
    });

    // -------------------------------------------------------------------------
    // Welcome modal — focus trap and ESC
    // -------------------------------------------------------------------------

    describe('welcome modal — accessibility', () => {
        it('renders the dialog with role="dialog" (Radix focus trap is active)', async () => {
            // Arrange
            let tourCtx!: ReturnType<typeof useTour>;
            renderWithProvider({
                onMount: (ctx) => {
                    tourCtx = ctx;
                }
            });

            // Act — open the welcome modal.
            await act(async () => {
                tourCtx.startTour({ tourId: 'host.welcome' });
            });

            // Assert — dialog role is present (Radix Dialog mounts with role=dialog).
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        it('pressing ESC on the welcome modal calls onSkip (markSeen + skipped)', async () => {
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

            // Dialog must be open.
            expect(screen.getByRole('dialog')).toBeInTheDocument();

            // Act — press ESC.
            await user.keyboard('{Escape}');

            // Assert — markSeen called (skip semantics preserved).
            expect(mockMarkSeen).toHaveBeenCalledWith({ tourId: 'host.welcome', version: 1 });
            expect(mockedTrackEvent).toHaveBeenCalledWith(
                'admin.tour.skipped',
                expect.objectContaining({ tourId: 'host.welcome' })
            );

            // Driver must NOT have started.
            expect(mockDriverFactory).not.toHaveBeenCalled();
        });
    });

    // -------------------------------------------------------------------------
    // prefers-reduced-motion regression
    // -------------------------------------------------------------------------

    describe('prefers-reduced-motion → animate: false', () => {
        it('passes animate: false and smoothScroll: false to driver when prefers-reduced-motion', async () => {
            // Arrange
            mockMatchMedia(true);
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

        it('passes animate: true and smoothScroll: true when no reduced-motion preference', async () => {
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
            expect(config.smoothScroll).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // Driver button localized labels
    // -------------------------------------------------------------------------

    describe('driver button labels are localized', () => {
        it('passes nextBtnText, prevBtnText, doneBtnText from i18n to the driver factory', async () => {
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
            await waitFor(() => expect(mockDriverFactory).toHaveBeenCalledOnce());

            // Assert
            const calls = mockDriverFactory.mock.calls as unknown as Array<
                [Record<string, unknown>]
            >;
            const config = calls[0]?.[0] ?? {};
            expect(config.nextBtnText).toBe('Siguiente');
            expect(config.prevBtnText).toBe('Anterior');
            expect(config.doneBtnText).toBe('Listo');
        });
    });

    // -------------------------------------------------------------------------
    // allowClose: true is set (keyboard nav + overlay close enabled)
    // -------------------------------------------------------------------------

    describe('allowClose and keyboard control', () => {
        it('driver is initialized with allowClose: true', async () => {
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
            await waitFor(() => expect(mockDriverFactory).toHaveBeenCalledOnce());

            // Assert
            const calls = mockDriverFactory.mock.calls as unknown as Array<
                [Record<string, unknown>]
            >;
            const config = calls[0]?.[0] ?? {};
            expect(config.allowClose).toBe(true);
        });
    });
});
