/**
 * @file tour-driver.ts
 * @description Shared helpers for the two components that run a driver.js tour
 * (`TourController` on first visit, `RestartTour` from Preferences), so both
 * hand driver.js the same translated labels and the same set of steps
 * (HOS-2448).
 */

/** Minimal translation function the helpers need. */
type TourTranslate = (key: string, fallback?: string) => string;

/** Translated labels driver.js renders in the popover. */
export interface TourDriverTexts {
    readonly showProgress: true;
    /**
     * Progress counter. driver.js substitutes `{{current}}` and `{{total}}`
     * itself; its built-in default is the English "{{current}} of {{total}}".
     */
    readonly progressText: string;
    readonly nextBtnText: string;
    readonly prevBtnText: string;
    readonly doneBtnText: string;
    /** Hide, rather than disable, Previous on the first visible step. */
    readonly onPopoverRender: (
        popover: { readonly previousButton: HTMLButtonElement },
        options: { readonly index?: number }
    ) => void;
}

/**
 * Builds the translated popover labels for a tour.
 *
 * @param params - Object with the translation function.
 * @param params.t - Translation function bound to the active locale.
 * @returns The labels to spread into the driver.js config.
 */
export function buildTourDriverTexts({ t }: { readonly t: TourTranslate }): TourDriverTexts {
    return {
        showProgress: true,
        progressText: t('account.welcomeTour.step', 'Paso {{current}} de {{total}}'),
        nextBtnText: t('account.welcomeTour.next', 'Siguiente'),
        prevBtnText: t('account.welcomeTour.prev', 'Anterior'),
        doneBtnText: t('account.welcomeTour.done', 'Finalizar'),
        onPopoverRender: (popover, { index }) => {
            popover.previousButton.hidden = index === 0;
        }
    };
}

/**
 * Drops the steps whose destination is not on the current page.
 *
 * driver.js does not fail on a missing element: it silently floats the popover
 * in the centre of the screen, so a step pointing at something absent would be
 * shown anyway. `center` steps have no destination by design and always stay.
 *
 * @param params - Object with the steps and the document to look targets up in.
 * @param params.steps - Candidate steps, each carrying a CSS selector or `center`.
 * @param params.doc - The document holding the page's tour anchors.
 * @returns The steps that can actually be shown here.
 */
export function filterStepsPresentOnPage<TStep extends { readonly target: string }>({
    steps,
    doc
}: {
    readonly steps: ReadonlyArray<TStep>;
    readonly doc: Document;
}): ReadonlyArray<TStep> {
    return steps.filter(
        (step) => step.target === 'center' || doc.querySelector(step.target) !== null
    );
}
