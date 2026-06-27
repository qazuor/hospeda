import { getWelcomeTourForRole } from '@/config/tours';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';

interface RestartTourProps {
    readonly locale: SupportedLocale;
    readonly userRole: string | null;
}

type DriverInstance = {
    destroy: () => void;
    drive: () => void;
    hasNextStep: () => boolean;
};

export function RestartTour({ locale, userRole }: RestartTourProps) {
    const { t } = createTranslations(locale);
    const [isRunning, setIsRunning] = useState(false);
    const driverRef = useRef<DriverInstance | null>(null);

    const tour = getWelcomeTourForRole(userRole);

    useEffect(() => {
        return () => {
            if (driverRef.current) {
                driverRef.current.destroy();
                driverRef.current = null;
            }
        };
    }, []);

    const handleStart = useCallback(() => {
        if (!tour || isRunning) return;

        void (async () => {
            const { driver } = await import('driver.js');

            setIsRunning(true);

            const handleDestroy = () => {
                driverRef.current?.destroy();
                driverRef.current = null;
                setIsRunning(false);
            };

            const instance = driver({
                showProgress: true,
                allowClose: true,
                smoothScroll: true,
                animate: true,
                nextBtnText: t('account.welcomeTour.next', 'Siguiente'),
                prevBtnText: t('account.welcomeTour.prev', 'Anterior'),
                doneBtnText: t('account.welcomeTour.done', 'Finalizar'),
                onDestroyStarted: handleDestroy,
                steps: tour.steps.map((step) => ({
                    ...(step.target !== 'center' ? { element: step.target } : {}),
                    popover: {
                        title: t(step.title, step.title),
                        description: t(step.body, step.body),
                        side: step.side ?? 'bottom',
                        align: step.align ?? 'center'
                    }
                }))
            });

            driverRef.current = instance;
            instance.drive();
        })();
    }, [tour, isRunning, t]);

    if (!tour) return null;

    return (
        <div className="restart-tour">
            <h3 className="restart-tour__title">{t('account.nav.repeatTour', 'Repetir tour')}</h3>
            <p className="restart-tour__desc">
                {t(
                    'account.nav.repeatTourDesc',
                    'Volvé a ver el tour guiado por el panel de cuenta'
                )}
            </p>
            <button
                type="button"
                className="restart-tour__button"
                onClick={handleStart}
                disabled={isRunning}
            >
                {isRunning
                    ? t('account.welcomeTour.running', 'Tour en curso...')
                    : t('account.welcomeTour.restart', 'Ver tour')}
            </button>
        </div>
    );
}
