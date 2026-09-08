/**
 * @file publish-trial-callout.ts
 * @description Decides whether `/publicar/`'s hero offers the free trial
 * (HOS-1183 F-6).
 *
 * Extracted as a pure function for the same reason `shouldShowNeedsPlanBanner`
 * was: the decision has four states and one of them is unreachable from a page
 * test, so leaving it inline in `.astro` frontmatter means it is never
 * exercised.
 */

/** Inputs to {@link shouldShowPublishTrialCallout}. */
export interface PublishTrialCalloutInput {
    /**
     * Whether the owner's trial has already expired, from
     * `GET /protected/billing/trial/status`.
     */
    readonly isTrialExpired: boolean;
    /**
     * Whether publishing would grant this owner a trial, from
     * `GET /protected/accommodations/publish-eligibility` (`startsTrial`).
     *
     * `null` means UNRESOLVED, not "no": a signed-out visitor, or a read that
     * failed. The two are deliberately one value, because the callout treats
     * them the same way and collapsing an unknown into `false` is what would
     * strip the hero for the page's largest audience.
     */
    readonly trialEligibility: boolean | null;
}

/**
 * Should the hero render the "probá gratis N días" callout?
 *
 * ## Why the old condition was wrong
 *
 * The callout was the `else` of `isTrialExpired`, which asks "did the trial
 * expire?" rather than "is this owner eligible for one?". Those differ for
 * anybody who never had an expired trial but is no longer eligible: an owner on
 * a paid plan, or one whose trial converted. `isExpired` is `false` for them, so
 * they fell into the `else` and were offered a free trial they could not get.
 *
 * Measured with `host-basico@local.test` (plan `owner-basico` active, 1 of 1
 * properties used): the page rendered "Probá Hospeda gratis por 30 días, sin
 * tarjeta" in the hero and "Llegaste al límite de tu plan" in the slot directly
 * below it, on one screen.
 *
 * ## Unresolved fails OPEN, and that is a product decision
 *
 * A signed-out visitor is eligible by definition and this callout is the page's
 * main draw, so narrowing it to "only signed-in eligible owners" would strip the
 * hero for almost everyone who sees it. A failed read degrades to the same
 * place, which is exactly the behaviour that shipped before this fix — strictly
 * no worse, and only on the error path.
 *
 * @param input - See {@link PublishTrialCalloutInput}.
 * @returns `true` when the hero should offer the trial.
 */
export function shouldShowPublishTrialCallout({
    isTrialExpired,
    trialEligibility
}: PublishTrialCalloutInput): boolean {
    // An expired trial has its own block, and it wins. F-6 is about the state
    // that fell through NEITHER branch, not about the branch that works.
    if (isTrialExpired) {
        return false;
    }
    return trialEligibility ?? true;
}
