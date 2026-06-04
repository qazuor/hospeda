/**
 * Tour Engine Context — SPEC-174 T-010 §7.4
 *
 * Provides the runtime tour engine for the admin panel. Exposes a `TourProvider`
 * that manages driver.js lifecycle and a `useTour()` consumer hook.
 *
 * ## Responsibilities
 * - Lazy-load driver.js (`const { driver } = await import('driver.js')`) — the JS
 *   runtime is NEVER statically imported; only its CSS lives in styles.css.
 * - Show `TourWelcomeModal` (Radix Dialog) when `tour.showWelcomeModal === true`.
 * - Build driver.js steps via `buildDriverSteps` (already pure, no React).
 * - Fire PostHog events: shown, completed, skipped.
 * - Persist `markSeen` on finish/skip via `useAdminTourState`.
 * - Destroy the driver instance on unmount and on `stopTour()`.
 * - Respect `prefers-reduced-motion` → `animate: false` + no Dialog animation.
 *
 * ## `source` semantics (§7.8 / D1)
 * - `'auto'` (default): welcome tours show the modal; contextual go straight to driver.
 * - `'manual'`         : welcome tours also show modal (user explicitly clicked "Ver guía").
 * - `'manual-page'`    : contextual replay — no modal, straight to driver.
 *
 * @module contexts/tour-context
 * @see apps/admin/src/components/tour/TourWelcomeModal.tsx — the welcome Dialog
 * @see apps/admin/src/lib/tour/build-driver-steps.ts       — step builder
 * @see apps/admin/src/hooks/use-admin-tour-state.ts        — persistence
 * @see SPEC-174 §7.4
 */

import { TourWelcomeModal } from '@/components/tour/TourWelcomeModal';
import type { Tour } from '@/config/ia/tour.schema';
import { validatedConfig } from '@/config/ia/validate';
import { useAdminTourState } from '@/hooks/use-admin-tour-state';
import { useAuthContext } from '@/hooks/use-auth-context';
import { useTranslations } from '@/hooks/use-translations';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { trackEvent } from '@/lib/analytics/posthog-client';
import { buildDriverSteps } from '@/lib/tour/build-driver-steps';
import { adminLogger } from '@/utils/logger';
import {
    type ReactNode,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from 'react';

// ============================================================================
// Types
// ============================================================================

/**
 * Source that triggered the tour — determines whether to show the welcome modal.
 *
 * - `'auto'`        — automatic trigger (first visit, auto-trigger).
 * - `'manual'`      — user clicked "Ver guía" in the avatar dropdown.
 * - `'manual-page'` — user clicked "Ver guía de esta página" (contextual replay).
 */
export type TourSource = 'auto' | 'manual' | 'manual-page';

/** Input for {@link TourContextValue.startTour}. */
export interface StartTourInput {
    /** Catalog id of the tour to start (e.g. `'host.welcome'`). */
    readonly tourId: string;
    /**
     * Source that triggered the tour.
     * Defaults to `'auto'` when omitted.
     */
    readonly source?: TourSource;
}

/** Value exposed by the TourContext. */
export interface TourContextValue {
    /** Whether a tour is currently running. */
    readonly isRunning: boolean;
    /** The tour id of the currently active tour, or `null` when none. */
    readonly activeTourId: string | null;
    /**
     * Start a tour by id.
     * Shows the welcome modal when `tour.showWelcomeModal === true` and
     * source is `'auto'` or `'manual'`. For `'manual-page'` source the driver
     * starts immediately without a modal.
     */
    readonly startTour: (input: StartTourInput) => void;
    /** Destroy the active driver instance and reset running state. */
    readonly stopTour: () => void;
}

// ============================================================================
// Context
// ============================================================================

const TourContext = createContext<TourContextValue | undefined>(undefined);

/**
 * Consume the TourContext. Must be used within `TourProvider`.
 *
 * @throws {Error} when called outside of a `TourProvider`.
 */
export function useTour(): TourContextValue {
    const ctx = useContext(TourContext);
    if (!ctx) {
        throw new Error('useTour must be used within TourProvider');
    }
    return ctx;
}

// ============================================================================
// Internal hook — reduced-motion check
// ============================================================================

/** Returns `true` when the user prefers reduced motion. */
function usePrefersReducedMotion(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ============================================================================
// Internal driver launcher
// ============================================================================

/** Props for the internal driver launcher function. */
interface LaunchDriverParams {
    readonly tour: Tour;
    readonly locale: string;
    readonly userPermissions: readonly import('@repo/schemas').PermissionEnum[];
    readonly reducedMotion: boolean;
    readonly nextLabel: string;
    readonly prevLabel: string;
    readonly doneLabel: string;
    readonly onComplete: () => void;
    readonly onSkip: () => void;
    /** Ref to store the running driver instance for cleanup. */
    readonly driverRef: React.MutableRefObject<{ destroy: () => void } | null>;
}

/** Lazily imports driver.js and starts the spotlight. */
async function launchDriver({
    tour,
    locale,
    userPermissions,
    reducedMotion,
    nextLabel,
    prevLabel,
    doneLabel,
    onComplete,
    onSkip,
    driverRef
}: LaunchDriverParams): Promise<void> {
    const steps = buildDriverSteps({ tour, locale, userPermissions });

    if (steps.length === 0) {
        adminLogger.warn(
            `[tour] No steps to show for tour '${tour.id}' — all filtered by permissions`
        );
        onSkip();
        return;
    }

    // Lazy-load the driver.js runtime (CSS is already in styles.css).
    const { driver } = await import('driver.js');

    // Destroy any previous instance before starting a new one.
    if (driverRef.current) {
        driverRef.current.destroy();
        driverRef.current = null;
    }

    const instance = driver({
        showProgress: true,
        allowClose: true,
        smoothScroll: !reducedMotion,
        animate: !reducedMotion,
        nextBtnText: nextLabel,
        prevBtnText: prevLabel,
        doneBtnText: doneLabel,
        onDestroyStarted: () => {
            // Check if all steps have been shown (driver is on last step or beyond).
            if (instance.hasNextStep()) {
                onSkip();
            } else {
                onComplete();
            }
            instance.destroy();
            driverRef.current = null;
        },
        steps
    });

    driverRef.current = instance;
    instance.drive();
}

// ============================================================================
// Provider
// ============================================================================

/** Props for {@link TourProvider}. */
export interface TourProviderProps {
    readonly children: ReactNode;
}

/**
 * Tour engine provider. Mount inside `AppLayout` below Auth/QueryClient/i18n.
 *
 * Provides `useTour()` to all descendant components.
 */
export function TourProvider({ children }: TourProviderProps) {
    const { user } = useAuthContext();
    const userPermissions = useUserPermissions();
    const { markSeen } = useAdminTourState();
    const { t, locale } = useTranslations();
    const reducedMotion = usePrefersReducedMotion();

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    const [isRunning, setIsRunning] = useState(false);
    const [activeTourId, setActiveTourId] = useState<string | null>(null);

    /**
     * When non-null, the welcome modal is open for this pending tour.
     * The actual driver launch is deferred until the user clicks "Mostrame".
     */
    const [pendingTour, setPendingTour] = useState<{
        tour: Tour;
        source: TourSource;
    } | null>(null);

    // Driver instance ref — allows cleanup on unmount / stopTour.
    const driverRef = useRef<{ destroy: () => void } | null>(null);

    // -------------------------------------------------------------------------
    // i18n chrome labels
    // -------------------------------------------------------------------------

    const nextLabel = t('admin-common.tour.next');
    const prevLabel = t('admin-common.tour.prev');
    const doneLabel = t('admin-common.tour.done');

    // -------------------------------------------------------------------------
    // Internal: run the spotlight after modal confirmation or directly
    // -------------------------------------------------------------------------

    const runDriver = useCallback(
        async (tour: Tour): Promise<void> => {
            setIsRunning(true);
            setActiveTourId(tour.id);

            await launchDriver({
                tour,
                locale,
                userPermissions,
                reducedMotion,
                nextLabel,
                prevLabel,
                doneLabel,
                onComplete: () => {
                    markSeen({ tourId: tour.id, version: tour.version });
                    trackEvent('admin.tour.completed', {
                        tourId: tour.id,
                        role: user?.role ?? 'unknown'
                    });
                    setIsRunning(false);
                    setActiveTourId(null);
                },
                onSkip: () => {
                    markSeen({ tourId: tour.id, version: tour.version });
                    trackEvent('admin.tour.skipped', {
                        tourId: tour.id,
                        role: user?.role ?? 'unknown'
                    });
                    setIsRunning(false);
                    setActiveTourId(null);
                },
                driverRef
            });
        },
        [
            locale,
            userPermissions,
            reducedMotion,
            nextLabel,
            prevLabel,
            doneLabel,
            markSeen,
            user?.role
        ]
    );

    // -------------------------------------------------------------------------
    // startTour
    // -------------------------------------------------------------------------

    /**
     * Start a tour. Resolves the tour config, fires PostHog shown event,
     * and either shows the welcome modal (when applicable) or starts driver.js.
     */
    const startTour = useCallback(
        (input: StartTourInput): void => {
            const { tourId, source = 'auto' } = input;

            // validatedConfig is statically imported — always available at call time.
            const tour = validatedConfig.tours[tourId];

            if (!tour) {
                adminLogger.warn(`[tour] startTour called for unknown tourId: '${tourId}'`);
                return;
            }

            // Track 'shown' event before any modal or driver.
            trackEvent('admin.tour.shown', {
                tourId,
                role: user?.role ?? 'unknown',
                source
            });

            // Decide whether to show the welcome modal.
            // Welcome modal appears for: welcome-kind tours when source is 'auto' or 'manual'.
            // 'manual-page' always goes straight to driver (contextual replays).
            const shouldShowModal = tour.showWelcomeModal && source !== 'manual-page';

            if (shouldShowModal) {
                setPendingTour({ tour, source });
            } else {
                void runDriver(tour);
            }
        },
        [user?.role, runDriver]
    );

    // -------------------------------------------------------------------------
    // Modal callbacks
    // -------------------------------------------------------------------------

    const handleModalSkip = useCallback(() => {
        if (!pendingTour) return;
        const { tour } = pendingTour;
        markSeen({ tourId: tour.id, version: tour.version });
        trackEvent('admin.tour.skipped', {
            tourId: tour.id,
            role: user?.role ?? 'unknown',
            source: 'modal-skip'
        });
        setPendingTour(null);
    }, [pendingTour, markSeen, user?.role]);

    const handleModalConfirm = useCallback(() => {
        if (!pendingTour) return;
        const { tour } = pendingTour;
        setPendingTour(null);
        void runDriver(tour);
    }, [pendingTour, runDriver]);

    // -------------------------------------------------------------------------
    // stopTour
    // -------------------------------------------------------------------------

    const stopTour = useCallback((): void => {
        if (driverRef.current) {
            driverRef.current.destroy();
            driverRef.current = null;
        }
        setIsRunning(false);
        setActiveTourId(null);
        setPendingTour(null);
    }, []);

    // -------------------------------------------------------------------------
    // Cleanup on unmount
    // -------------------------------------------------------------------------

    // Destroy any active driver instance on provider unmount (e.g. sign-out
    // mid-tour) so driver.js DOM/keyboard listeners never leak. Strict-mode
    // double-mount is safe: on the first synthetic unmount driverRef.current
    // is null (no tour can have started yet), so the cleanup is a no-op.
    useEffect(() => {
        return () => {
            if (driverRef.current) {
                driverRef.current.destroy();
                driverRef.current = null;
            }
        };
    }, []);

    // -------------------------------------------------------------------------
    // Context value
    // -------------------------------------------------------------------------

    const value = useMemo(
        (): TourContextValue => ({ isRunning, activeTourId, startTour, stopTour }),
        [isRunning, activeTourId, startTour, stopTour]
    );

    return (
        <TourContext.Provider value={value}>
            {children}
            {/* Welcome modal — rendered here (outside children) so it is always
                above the page content but inside the provider tree. */}
            {pendingTour !== null && (
                <TourWelcomeModal
                    tour={pendingTour.tour}
                    onSkip={handleModalSkip}
                    onConfirm={handleModalConfirm}
                    reducedMotion={reducedMotion}
                />
            )}
        </TourContext.Provider>
    );
}
