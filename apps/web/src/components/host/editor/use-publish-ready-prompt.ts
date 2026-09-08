/**
 * @file use-publish-ready-prompt.ts
 * @description Opens the "your listing is ready to publish" dialog on the save
 * that makes it so (HOS-1183, second owner request).
 *
 * ## Only two of the eleven editor routes can trigger this
 *
 * Every blocking publish requirement declares the section that owns it, and
 * across the whole list there are exactly two: `capacityPricing` (guests,
 * bedrooms, bathrooms, minimum nights) and `photos` (the main image). A save on
 * SEO, contact or location cannot change publish readiness, so wiring this into
 * the shared form hook for all of them would run the check on every save to
 * learn nothing.
 *
 * That set is derived, not assumed:
 * `test/lib/editor/publish-ready-prompt-wiring.guard.test.ts` fails if a sixth
 * requirement lands in a third section, because the prompt would then silently
 * never fire for the owner who completes their listing there.
 *
 * ## The billing read happens LATE, and that is the point
 *
 * Publishability has two halves: the listing's completeness (local, already in
 * the editor's hands) and the owner's billing verdict (a request). Plumbing the
 * verdict through eleven routes would put a billing read on every section page
 * load for an answer almost none of them use. So the local half is evaluated
 * first, for free, and the verdict is fetched only on the one save that crosses
 * the line.
 */

import type { AccommodationPublishReadinessInput } from '@repo/schemas';
import { useCallback, useMemo, useState } from 'react';
import { publishApi } from '@/lib/api/endpoints-protected';
import { shouldPromptPublishReady } from '@/lib/editor/publish-ready-prompt';
import { webLogger as logger } from '@/lib/logger';

/** What the hook hands back to a section component. */
export interface PublishReadyPrompt {
    /** Whether the dialog should be open. */
    readonly isOpen: boolean;
    /** Whether publishing would start the owner's free trial. */
    readonly startsTrial: boolean;
    /** Dismisses the dialog. */
    readonly close: () => void;
    /**
     * Evaluates a just-completed change. Safe to call after every save: it
     * returns immediately unless this one crossed the line.
     */
    readonly evaluate: (input: {
        readonly before: AccommodationPublishReadinessInput;
        readonly after: AccommodationPublishReadinessInput;
        readonly isDraft: boolean;
    }) => Promise<void>;
}

/**
 * Drives the post-save publish prompt for one accommodation.
 *
 * @returns The prompt handle.
 */
export function usePublishReadyPrompt(): PublishReadyPrompt {
    const [isOpen, setIsOpen] = useState(false);
    const [startsTrial, setStartsTrial] = useState(false);

    const close = useCallback(() => setIsOpen(false), []);

    const evaluate = useCallback(
        async ({
            before,
            after,
            isDraft
        }: {
            readonly before: AccommodationPublishReadinessInput;
            readonly after: AccommodationPublishReadinessInput;
            readonly isDraft: boolean;
        }) => {
            // The free half first. `canPublish: true` here is a placeholder for
            // the verdict we have not asked for yet — it lets the local
            // transition rule short-circuit without a request, and the real
            // verdict is applied below before anything is shown.
            if (!shouldPromptPublishReady({ before, after, isDraft, canPublish: true })) {
                return;
            }

            const eligibility = await publishApi.accommodationEligibility();
            if (!eligibility.ok) {
                // Fails CLOSED, unlike the publish button. Hiding a button
                // strands an owner who could publish; opening an unrequested
                // dialog that then fails is worse than staying quiet, and the
                // card on the properties page still offers Publish either way.
                logger.warn('publish-ready-prompt: eligibility read failed', {
                    error: eligibility.error
                });
                return;
            }

            if (!eligibility.data.canPublish) {
                return;
            }

            setStartsTrial(eligibility.data.startsTrial);
            setIsOpen(true);
        },
        []
    );

    // Memoised because `PhotoSection` puts this handle in a `useEffect`
    // dependency array. A fresh object every render would re-run that effect on
    // every render — harmless, since its refs short-circuit, but it makes "when
    // does this fire" impossible to answer by reading it.
    return useMemo(
        () => ({ isOpen, startsTrial, close, evaluate }),
        [isOpen, startsTrial, close, evaluate]
    );
}
