import { getWelcomeTourForRole } from '@/config/tours';
import { useTourState } from '@/hooks/use-tour-state';
import { type SupportedLocale, createTranslations } from '@/lib/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';

interface TourControllerProps {
    readonly locale: SupportedLocale;
    readonly userRole: string | null;
}

type DriverInstance = {
    destroy: () => void;
    drive: () => void;
    hasNextStep: () => boolean;
};

export function TourController({ locale, userRole }: TourControllerProps) {
    const { t } = createTranslations(locale);
    const { isLoading, hasSeen, markSeen } = useTourState();
    const [isRunning, setIsRunning] = useState(false);
    const [shouldStart, setShouldStart] = useState(false);
    const driverRef = useRef<DriverInstance | null>(null);

    const tour = getWelcomeTourForRole(userRole);

    useEffect(() => {
        if (isLoading || !tour) return;
        if (hasSeen({ tourId: tour.id, version: tour.version })) return;
        setShouldStart(true);
    }, [isLoading, tour, hasSeen]);

    const handleComplete = useCallback(() => {
        if (!tour) return;
        markSeen({ tourId: tour.id, version: tour.version });
        setIsRunning(false);
        setShouldStart(false);
    }, [tour, markSeen]);

    const handleSkip = useCallback(() => {
        if (!tour) return;
        markSeen({ tourId: tour.id, version: tour.version });
        setIsRunning(false);
        setShouldStart(false);
    }, [tour, markSeen]);

    useEffect(() => {
        if (!shouldStart || !tour || isRunning) return;

        const activeTour = tour;

        let cancelled = false;

        async function startTour(): Promise<void> {
            if (cancelled) return;

            const { driver } = await import('driver.js');

            if (cancelled) return;

            setIsRunning(true);
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
                steps: activeTour.steps.map((step) => {
                    const stepDef: Record<string, unknown> = {
                        popover: {
                            title: t(step.title, step.title),
                            description: t(step.body, step.body),
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

        return () => {
            cancelled = true;
            if (driverRef.current) {
                driverRef.current.destroy();
                driverRef.current = null;
            }
        };
    }, [shouldStart, tour, isRunning, handleComplete, handleSkip, t]);

    return null;
}
