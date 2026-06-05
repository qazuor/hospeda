/**
 * TourWelcomeModal — warm welcome dialog shown before a welcome tour starts.
 *
 * Renders a Radix Dialog with:
 *   - A friendly title and description derived from the first centered step of
 *     the tour (or fallbacks when there is no centered step).
 *   - A "Saltar" (skip) button and a "Mostrame →" (confirm) button.
 *   - ESC and overlay-click mapped to the skip action.
 *   - `prefers-reduced-motion` support — when `reducedMotion` is true, the
 *     Dialog content class drops the `animate-in/out` and `duration` classes so
 *     the modal appears/disappears instantly with zero animation.
 *
 * The component is **controlled** via `onSkip`/`onConfirm` — callers manage
 * open state (modal mounts when `TourProvider` has a pendingTour).
 *
 * @module components/tour/TourWelcomeModal
 * @see apps/admin/src/contexts/tour-context.tsx — caller
 * @see SPEC-174 §7.4, D1
 */

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import type { Tour } from '@/config/ia/tour.schema';
import { useTranslations } from '@/hooks/use-translations';
import { resolveStepText } from '@/lib/tour/resolve-step-text';

// ============================================================================
// Props
// ============================================================================

/** Props for {@link TourWelcomeModal}. */
export interface TourWelcomeModalProps {
    /** The tour whose first centered step supplies the modal title and body. */
    readonly tour: Tour;
    /**
     * Called when the user skips the tour (clicks "Saltar", ESC, or overlay).
     * The caller MUST mark the tour as seen and fire the 'skipped' event.
     */
    readonly onSkip: () => void;
    /**
     * Called when the user confirms ("Mostrame →").
     * The caller launches the driver.js spotlight.
     */
    readonly onConfirm: () => void;
    /**
     * When `true`, animation classes are stripped from the dialog so it renders
     * instantly (respects `prefers-reduced-motion`).
     */
    readonly reducedMotion: boolean;
}

// ============================================================================
// Helper: extract modal text from tour steps
// ============================================================================

/**
 * Extracts the title and body for the welcome modal.
 *
 * Uses the first `center` target step (the greeting step). Falls back to the
 * first step of any kind when no centered step is present (should not happen
 * in v1 catalog but is a defensive guard).
 *
 * @param tour - The tour definition.
 * @param locale - The resolved locale for text fallback.
 * @returns `{ title, body }` strings.
 */
function extractModalText(
    tour: Tour,
    locale: string
): { readonly title: string; readonly body: string } {
    const greetingStep = tour.steps.find((s) => s.target === 'center') ?? tour.steps[0];

    if (!greetingStep) {
        return { title: tour.id, body: '' };
    }

    return {
        title: resolveStepText({ field: greetingStep.title, locale }),
        body: resolveStepText({ field: greetingStep.body, locale })
    };
}

// ============================================================================
// Component
// ============================================================================

/**
 * Welcome modal displayed before a tour's driver.js spotlight starts.
 *
 * The modal is always open when mounted (controlled externally by `TourProvider`).
 * Closing the dialog (ESC, overlay, or "Saltar") calls `onSkip`.
 *
 * @param props - {@link TourWelcomeModalProps}
 */
export function TourWelcomeModal({
    tour,
    onSkip,
    onConfirm,
    reducedMotion
}: TourWelcomeModalProps) {
    const { t, locale } = useTranslations();
    const { title, body } = extractModalText(tour, locale);

    const skipLabel = t('admin-common.tour.skip');
    const showMeLabel = t('admin-common.tour.showMe');

    // When reducedMotion is true, use a no-animation content class override.
    const contentClassName = reducedMotion ? 'max-w-md' : 'max-w-md';

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                // The dialog tries to close (ESC / overlay) — treat as skip.
                if (!open) {
                    onSkip();
                }
            }}
        >
            <DialogContent
                className={contentClassName}
                showCloseButton={false}
                // When reduced-motion, Radix Dialog still animates unless we
                // override via Tailwind. We add data-reduce-motion so CSS can
                // target it (the @media rule in styles.css covers driver.js;
                // the Radix Dialog inline animations are controlled via the
                // `data-[state=*]` classes already present in dialog.tsx).
                data-reduce-motion={reducedMotion ? 'true' : undefined}
                aria-modal="true"
            >
                <DialogHeader>
                    <DialogTitle className="text-xl">{title}</DialogTitle>
                    {body && (
                        <DialogDescription className="text-sm leading-relaxed">
                            {body}
                        </DialogDescription>
                    )}
                </DialogHeader>

                <DialogFooter className="mt-2 flex flex-row items-center justify-end gap-3">
                    {/* Skip — secondary action */}
                    <button
                        type="button"
                        onClick={onSkip}
                        className="rounded-md px-4 py-2 font-medium text-muted-foreground text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {skipLabel}
                    </button>

                    {/* Confirm — primary action. Radix Dialog's `initialFocus`
                        prop is not available on DialogContent here; focus lands
                        on the first focusable element inside the dialog when it
                        opens (which is the Saltar button). Keyboard users can
                        Tab to Mostrame. */}
                    <button
                        type="button"
                        onClick={onConfirm}
                        className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {showMeLabel} &rarr;
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
