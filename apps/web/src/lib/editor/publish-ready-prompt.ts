/**
 * @file publish-ready-prompt.ts
 * @description Decides whether a save just made an accommodation publishable,
 * and therefore whether to offer publishing right there (HOS-1183, second
 * owner request).
 *
 * ## The trigger is a TRANSITION, not a counter
 *
 * The owner asked for this once, on the first save — not on every save. That
 * could have been a persisted "already prompted" flag, and it is not: the
 * condition is that the listing was NOT publishable before this save and IS
 * publishable after it. Crossing a line happens once by construction, so there
 * is no flag to store, to migrate, or to get out of sync with what the owner
 * actually sees.
 *
 * It also cannot fire on a save that leaves work behind. A prompt that offered
 * "Publicar ahora" while the main photo was still missing would open a dialog
 * promising the listing goes live and then fail on confirm — which is H-99,
 * rebuilt one screen over.
 *
 * ## What it deliberately does NOT fire on
 *
 * - **A listing that was already publishable when the editor opened.** No
 *   line is crossed, so no prompt. That owner is not stranded: the card in
 *   `/mi-cuenta/propiedades/` offers Publish, and the editor hub shows every
 *   requirement met. A prompt here would have to be driven by a stored flag,
 *   which is exactly what "transition" buys us out of.
 * - **An owner billing would refuse.** The issue asks for a dialog that
 *   "ofrezca el CTA de publicar", and for `subscription_required` there is no
 *   such CTA to offer. Their card already links to the plans page; a paywall
 *   popup fired the moment they finish working is a worse place to learn it.
 */

import {
    type AccommodationPublishReadinessInput,
    resolveMissingPublishRequirements
} from '@repo/schemas';

/** Inputs to {@link shouldPromptPublishReady}. */
export interface PublishReadyPromptInput {
    /** Publish readiness as it stood BEFORE the save that just succeeded. */
    readonly before: AccommodationPublishReadinessInput;
    /** Publish readiness as it stands AFTER it. */
    readonly after: AccommodationPublishReadinessInput;
    /**
     * Whether the listing is still a draft. An ACTIVE listing has nothing to
     * offer — it is already live — and an INACTIVE one was deliberately
     * unpublished, so re-offering publication on a routine edit would be
     * arguing with a decision the owner already made.
     */
    readonly isDraft: boolean;
    /**
     * Whether the server would accept a publish for this owner right now, from
     * `GET /protected/accommodations/publish-eligibility`.
     *
     * Read at the moment the transition happens rather than plumbed through the
     * editor's eleven routes: it is one request, on the one save that can use
     * it, instead of a billing read on every section page load.
     */
    readonly canPublish: boolean;
}

/** Whether a readiness snapshot satisfies every blocking publish requirement. */
function isPublishReady(input: AccommodationPublishReadinessInput): boolean {
    return resolveMissingPublishRequirements({ input }).length === 0;
}

/**
 * Did this save just make the listing publishable?
 *
 * @param input - See {@link PublishReadyPromptInput}.
 * @returns `true` when the owner should be offered to publish now.
 */
export function shouldPromptPublishReady({
    before,
    after,
    isDraft,
    canPublish
}: PublishReadyPromptInput): boolean {
    if (!isDraft || !canPublish) {
        return false;
    }
    // Both halves are load-bearing. Without `!isPublishReady(before)` the
    // prompt fires on every subsequent save of a complete draft; without
    // `isPublishReady(after)` it fires on a save that left the listing still
    // incomplete, and offers a publish that cannot succeed.
    return !isPublishReady(before) && isPublishReady(after);
}
