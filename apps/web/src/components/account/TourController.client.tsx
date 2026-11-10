import { useCallback, useEffect, useRef, useState } from 'react';
import { getNextPendingWelcomeTour, type TourPage } from '@/config/tours';
import { useTourState } from '@/hooks/use-tour-state';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';

interface TourControllerProps {
    readonly locale: SupportedLocale;
    /** Every role the user holds (`Astro.locals.user.roles`) — HOS-296. */
    readonly userRoles: readonly string[];
    /** The account page this controller is mounted on (HOS-1856). */
    readonly page: TourPage;
}

type DriverInstance = {
    destroy: () => void;
    drive: () => void;
    hasNextStep: () => boolean;
};

export function TourController({ locale, userRoles, page }: TourControllerProps) {
    const { t } = createTranslations(locale);
    const { isLoading, hasSeen, markSeen } = useTourState();
    // HOS-1856: "is running" lives in a ref, not in state. As state it was a
    // dependency of the effect that starts the tour, so `setIsRunning(true)`
    // right before `drive()` changed the deps, React ran that effect's
    // cleanup, and the cleanup destroyed the driver before it could render.
    const isRunningRef = useRef(false);
    const [shouldStart, setShouldStart] = useState(false);
    const driverRef = useRef<DriverInstance | null>(null);

    // HOS-788: already filtered to "not yet seen" — see `getNextPendingWelcomeTour`.
    // Recomputed every render, so once `markSeen` (below) flips `hasSeen`'s
    // identity, this naturally advances to the NEXT pending tour, chaining
    // them one at a time instead of requiring a fresh page load.
    const tour = getNextPendingWelcomeTour({ roles: userRoles, hasSeen, page });

    useEffect(() => {
        if (isLoading || !tour) return;
        setShouldStart(true);
    }, [isLoading, tour]);

    const handleComplete = useCallback(() => {
        if (!tour) return;
        markSeen({ tourId: tour.id, version: tour.version });
        isRunningRef.current = false;
        setShouldStart(false);
    }, [tour, markSeen]);

    const handleSkip = useCallback(() => {
        if (!tour) return;
        markSeen({ tourId: tour.id, version: tour.version });
        isRunningRef.current = false;
        setShouldStart(false);
    }, [tour, markSeen]);

    useEffect(() => {
        if (!shouldStart || !tour || isRunningRef.current) return;

        const activeTour = tour;

        let cancelled = false;

        async function startTour(): Promise<void> {
            if (cancelled) return;

            // HOS-1856: a step whose destination is not on THIS page has no
            // target to point at. driver.js does not fail on a missing element —
            // it silently floats the popover in the centre — so the step would
            // be shown anyway. Drop it before the tour starts.
            const visibleSteps = activeTour.steps.filter(
                (step) => step.target === 'center' || document.querySelector(step.target) !== null
            );

            // Nothing left to show: do not start, and do not mark the tour as
            // seen — it stays pending for a page where its targets exist.
            if (visibleSteps.length === 0) {
                setShouldStart(false);
                return;
            }

            // `@/lib/load-driver` re-exports driver.js and pulls in its
            // stylesheet, so both land in the same async chunk (HOS-369 W3-4).
            const { driver } = await import('@/lib/load-driver');

            if (cancelled) return;

            isRunningRef.current = true;
            setShouldStart(false);

            const handleDestroy = () => {
                if (driverRef.current && !driverRef.current.hasNextStep()) {
                    handleComplete();
                } else {
                    handleSkip();
                }
                driverRef.current?.destroy();
                driverRef.current = null;
            };

            driverRef.current = driver({
                showProgress: true,
                allowClose: true,
                smoothScroll: true,
                animate: true,
                nextBtnText: t('account.welcomeTour.next', 'Siguiente'),
                prevBtnText: t('account.welcomeTour.prev', 'Anterior'),
                doneBtnText: t('account.welcomeTour.done', 'Finalizar'),
                onDestroyStarted: handleDestroy,
                steps: visibleSteps.map((step) => {
                    // HOS-2073: use the menu-neutral copy when the step's
                    // companion anchor is not on the page.
                    const bodyKey =
                        step.bodyWhenAnchorAbsent &&
                        document.querySelector(step.bodyWhenAnchorAbsent.anchor) === null
                            ? step.bodyWhenAnchorAbsent.body
                            : step.body;
                    const stepDef: Record<string, unknown> = {
                        popover: {
                            title: t(step.title, step.title),
                            description: t(bodyKey, bodyKey),
                            side: step.side ?? 'bottom',
                            align: step.align ?? 'center'
                        }
                    };
                    if (step.target !== 'center') {
                        stepDef.element = step.target;
                    }
                    return stepDef;
                })
            });

            driverRef.current.drive();
        }

        void startTour();

        // HOS-1856: this cleanup only cancels an in-flight start. Destroying
        // here killed the tour the moment `shouldStart` flipped to false right
        // after `drive()`; the driver is torn down by `onDestroyStarted` or by
        // the unmount-only effect below.
        return () => {
            cancelled = true;
        };
    }, [shouldStart, tour, handleComplete, handleSkip, t]);

    // HOS-1856: the driver must survive effect re-runs and only die with the
    // component. Empty deps so this runs on unmount only.
    useEffect(() => {
        return () => {
            driverRef.current?.destroy();
            driverRef.current = null;
        };
    }, []);

    return null;
}
