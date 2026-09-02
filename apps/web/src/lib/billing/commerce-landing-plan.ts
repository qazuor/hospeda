/**
 * @file billing/commerce-landing-plan.ts
 * @description The offer the two commerce landings advertise —
 * `/publicar-restaurante/` (gastronomy) and `/publicar-experiencia/`
 * (experience) — derived from ONE `GET /api/v1/public/plans?domain=…`
 * response.
 *
 * ## Why this exists (HOS-941 R-2)
 *
 * Both landings used to fetch the vertical's plan for the PRICE and then print
 * the trial length from a locale string: `commerce.landing.<vertical>.price.trial`
 * literally read "30 días de prueba gratis", and the FAQ answer repeated the
 * same "30" inside a sentence. Twelve strings across two verticals and three
 * locales asserted a number that nothing compared against
 * `billing_plans.metadata.trialDays`. The database says 30 today, so the copy
 * happened to be right — which is the dangerous version of the bug, because it
 * looks correct and stays correct only by coincidence. The moment an operator
 * edits the plan in admin, the landings promise a trial the checkout will not
 * grant. That is HOS-525 verbatim: marketing promised hosts 30 days while the
 * product handed them 14.
 *
 * ## One fetch, one plan, both readings
 *
 * The price and the trial are two readings of the SAME plan object, taken from
 * the SAME response — not two fetches, and not even two selections over one
 * response. A second request would open a window in which the amount and the
 * trial describe different snapshots of the catalogue; selecting twice would
 * let them describe different plans within one snapshot. The landings render a
 * single price card, so there is exactly one plan to describe and this module
 * returns it alongside its trial length.
 *
 * ## Why `computeMinimumTrialDays` for a single plan
 *
 * Reusing it is not about the minimum — over one plan the minimum is that
 * plan's own value. It is about the ELIGIBILITY rule that comes with it:
 * `isActive && hasTrial && trialDays > 0`, else `null`. That is precisely the
 * rule these pages need, it is already the rule every other trial-advertising
 * surface obeys (the plan index, the pricing cards, the owner surfaces since
 * H-98), and re-deriving it here would be a second, subtly different copy of it
 * — exactly what `generic-trial-days.ts` was generalised to prevent.
 *
 * `null` is therefore returned for four distinct situations that must all
 * render identically (no trial sentence at all): the fetch failed, the vertical
 * has no active plan, the plan carries no trial, and the plan carries a
 * zero-day trial. Zero is deliberately unrepresentable — "0 días de prueba" is
 * a worse statement than silence, and a number inherited from another vertical
 * or from a constant is the bug this module removes.
 *
 * SSR-only: it reaches `@repo/billing` transitively through
 * `generic-trial-days.ts`, so nothing a client island imports may import this
 * (see `apps/web/test/static-guards/billing-barrel-client-isolation.test.ts`).
 */

import type { FetchPlansResult, PublicPlanData } from '@/lib/billing/fetch-plans';
import { filterPlansByCategory } from '@/lib/billing/fetch-plans';
import { computeMinimumTrialDays } from '@/lib/billing/generic-trial-days';

/** Input for {@link resolveCommerceLandingOffer}. */
export interface ResolveCommerceLandingOfferParams {
    /**
     * The already-resolved `fetchPublicPlans({ domain })` result for ONE
     * commerce vertical. Passed in rather than fetched here so the caller keeps
     * a single request per page and so every degraded path is testable without
     * a network.
     */
    readonly plansResult: FetchPlansResult;
}

/** Everything one commerce landing advertises about its plan. */
export interface CommerceLandingOffer {
    /**
     * The vertical's single sellable tier, or `null` when the fetch failed or
     * the vertical currently has no active plan. `null` is what makes the page
     * render its `price.unavailable` state.
     */
    readonly plan: PublicPlanData | null;
    /**
     * The trial length that may be advertised, in days, or `null` when none
     * may be. Never `0`.
     */
    readonly trialDays: number | null;
}

/**
 * Resolve a commerce landing's price plan and its advertisable trial length
 * from one plans payload.
 *
 * `category` is filtered on `'owner'` only to satisfy `PlanCategory`'s type —
 * the real discriminator is `product_domain`, already applied server-side by
 * the `?domain=` query param, so this narrows nothing beyond `isActive` and the
 * `sortOrder` ordering that picks the first tier.
 *
 * @param params - RO-RO input, see {@link ResolveCommerceLandingOfferParams}.
 * @returns The plan to price and the trial days to promise; either may be
 *   `null`, and neither is ever invented.
 */
export function resolveCommerceLandingOffer({
    plansResult
}: ResolveCommerceLandingOfferParams): CommerceLandingOffer {
    if (!plansResult.ok) {
        return { plan: null, trialDays: null };
    }

    const plan = filterPlansByCategory(plansResult.plans, 'owner')[0] ?? null;

    if (plan === null) {
        return { plan: null, trialDays: null };
    }

    // Over the ONE plan the card prices — so the number promised can only ever
    // belong to the plan whose price is shown next to it.
    return { plan, trialDays: computeMinimumTrialDays({ plans: [plan] }) };
}
