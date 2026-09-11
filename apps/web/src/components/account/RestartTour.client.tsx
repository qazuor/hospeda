import { useCallback, useEffect, useRef, useState } from 'react';
import type { TourConfig } from '@/config/tours';
import { getWelcomeToursForRoles } from '@/config/tours';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';

interface RestartTourProps {
    readonly locale: SupportedLocale;
    /** Every role the user holds (`Astro.locals.user.roles`) — HOS-296. */
    readonly userRoles: readonly string[];
}

type DriverInstance = {
    destroy: () => void;
    drive: () => void;
    hasNextStep: () => boolean;
};

export function RestartTour({ locale, userRoles }: RestartTourProps) {
    const { t } = createTranslations(locale);
    // HOS-788: a role set can now match SEVERAL welcome tours (e.g. tourist +
    // host), so this lists every one of them — not just the first — each with
    // its own replay button, in `WEB_TOURS` priority order.
    const [runningTourId, setRunningTourId] = useState<string | null>(null);
    const driverRef = useRef<DriverInstance | null>(null);

    const tours = getWelcomeToursForRoles({ roles: userRoles });

    useEffect(() => {
        return () => {
            if (driverRef.current) {
                driverRef.current.destroy();
                driverRef.current = null;
            }
        };
    }, []);

    const handleStart = useCallback(
        (tour: TourConfig) => {
            if (runningTourId !== null) return;

            void (async () => {
                // `@/lib/load-driver` re-exports driver.js and pulls in its
                // stylesheet, so both land in the same async chunk (HOS-369 W3-4).
                const { driver } = await import('@/lib/load-driver');

                setRunningTourId(tour.id);

                const handleDestroy = () => {
                    driverRef.current?.destroy();
                    driverRef.current = null;
                    setRunningTourId(null);
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
                        ...(step.target === 'center' ? {} : { element: step.target }),
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
        },
        [runningTourId, t]
    );

    if (tours.length === 0) return null;

    return (
        <div className="restart-tour">
            <h3 className="restart-tour__title">{t('account.nav.repeatTour')}</h3>
            <p className="restart-tour__desc">{t('account.nav.repeatTourDesc')}</p>
            <ul className="restart-tour__list">
                {tours.map((tour) => {
                    // Every tour's first step is its "greeting" (see
                    // `src/config/tours.ts`), so its title doubles as the
                    // tour's display name here — no extra i18n key needed.
                    const nameKey = tour.steps[0]?.title ?? tour.id;
                    const isRunning = runningTourId === tour.id;
                    return (
                        <li
                            key={tour.id}
                            className="restart-tour__item"
                        >
                            <span className="restart-tour__item-name">{t(nameKey, tour.id)}</span>
                            <button
                                type="button"
                                className="restart-tour__button"
                                onClick={() => handleStart(tour)}
                                disabled={runningTourId !== null}
                            >
                                {isRunning
                                    ? t('account.welcomeTour.running', 'Tour en curso...')
                                    : t('account.welcomeTour.restart', 'Ver tour')}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
