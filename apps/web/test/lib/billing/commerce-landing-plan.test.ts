/**
 * @file commerce-landing-plan.test.ts
 * @description HOS-941 R-2 — what the two commerce landings advertise, and
 * every way it can degrade.
 *
 * The point of these is the `null` column. Before this change the trial length
 * was a locale string ("30 días de prueba gratis") that could not degrade at
 * all: it printed 30 whether the catalogue said 30, said 14, said nothing, or
 * failed to load. Every case below is one the page previously could not
 * express.
 */

import { describe, expect, it } from 'vitest';
import { resolveCommerceLandingOffer } from '@/lib/billing/commerce-landing-plan';
import type { FetchPlansResult, PublicPlanData } from '@/lib/billing/fetch-plans';

/** Minimal `PublicPlanData` fixture, shaped like the live commerce tiers. */
function apiPlan(input: Partial<PublicPlanData> & Pick<PublicPlanData, 'slug'>): PublicPlanData {
    return {
        id: `id-${input.slug}`,
        slug: input.slug,
        name: input.slug,
        description: '',
        // The commerce verticals really do carry `category: 'owner'` — the
        // discriminator is `product_domain`, applied server-side by `?domain=`.
        category: 'owner',
        monthlyPriceArs: 1_500_000,
        annualPriceArs: null,
        monthlyPriceUsdRef: 15,
        hasTrial: true,
        trialDays: 30,
        isDefault: false,
        sortOrder: 1,
        isActive: true,
        entitlements: [],
        limits: {},
        createdAt: '',
        updatedAt: '',
        ...input
    };
}

/** Wrap plans in the success shape `fetchPublicPlans` returns. */
function ok(plans: readonly PublicPlanData[]): FetchPlansResult {
    return { ok: true, plans };
}

describe('resolveCommerceLandingOffer', () => {
    it('reads the trial length off the plan, not off a constant', () => {
        // The live catalogue value today. It is asserted as a READING, not as
        // the number 30 being correct: the very next test changes it and the
        // result follows.
        const { plan, trialDays } = resolveCommerceLandingOffer({
            plansResult: ok([apiPlan({ slug: 'gastronomy-basico', trialDays: 30 })])
        });

        expect(plan?.slug).toBe('gastronomy-basico');
        expect(trialDays).toBe(30);
    });

    it('follows the catalogue when the operator changes the trial length', () => {
        // This is HOS-525 in one assertion: marketing said 30, the product
        // granted 14. Nothing here may keep saying 30.
        const { trialDays } = resolveCommerceLandingOffer({
            plansResult: ok([apiPlan({ slug: 'experience-basico', trialDays: 14 })])
        });

        expect(trialDays).toBe(14);
    });

    it('reports a one-day trial as 1, so the copy can say "1 día"', () => {
        const { trialDays } = resolveCommerceLandingOffer({
            plansResult: ok([apiPlan({ slug: 'gastronomy-basico', trialDays: 1 })])
        });

        expect(trialDays).toBe(1);
    });

    it('returns null — never 0 — when the plan carries a zero-day trial', () => {
        // "0 días de prueba gratis" is a worse statement than silence, so the
        // page must be told to render nothing rather than to render a zero.
        const { plan, trialDays } = resolveCommerceLandingOffer({
            plansResult: ok([apiPlan({ slug: 'gastronomy-basico', hasTrial: true, trialDays: 0 })])
        });

        expect(plan).not.toBeNull();
        expect(trialDays).toBeNull();
    });

    it('returns null when the plan offers no trial, while still pricing it', () => {
        // The price line and the trial line fail independently: a plan without
        // a trial is a perfectly sellable plan.
        const { plan, trialDays } = resolveCommerceLandingOffer({
            plansResult: ok([
                apiPlan({ slug: 'experience-basico', hasTrial: false, trialDays: 30 })
            ])
        });

        expect(plan?.slug).toBe('experience-basico');
        expect(plan?.monthlyPriceArs).toBe(1_500_000);
        expect(trialDays).toBeNull();
    });

    it('returns nulls when the fetch failed — no inherited number', () => {
        const { plan, trialDays } = resolveCommerceLandingOffer({
            plansResult: { ok: false, error: 'Public plans endpoint returned HTTP 503' }
        });

        expect(plan).toBeNull();
        expect(trialDays).toBeNull();
    });

    it('returns nulls when the vertical has no plan at all', () => {
        const { plan, trialDays } = resolveCommerceLandingOffer({ plansResult: ok([]) });

        expect(plan).toBeNull();
        expect(trialDays).toBeNull();
    });

    it('ignores an inactive plan entirely, rather than pricing or promising it', () => {
        const { plan, trialDays } = resolveCommerceLandingOffer({
            plansResult: ok([apiPlan({ slug: 'gastronomy-retired', isActive: false })])
        });

        expect(plan).toBeNull();
        expect(trialDays).toBeNull();
    });

    it('promises the trial of the very plan it prices, when several are active', () => {
        // The landing renders ONE price card, so the number next to the price
        // must belong to the plan whose price is shown. Taking a minimum across
        // the vertical would advertise the second tier's shorter trial beside
        // the first tier's amount.
        const { plan, trialDays } = resolveCommerceLandingOffer({
            plansResult: ok([
                apiPlan({ slug: 'gastronomy-pro', sortOrder: 2, trialDays: 7 }),
                apiPlan({ slug: 'gastronomy-basico', sortOrder: 1, trialDays: 30 })
            ])
        });

        expect(plan?.slug).toBe('gastronomy-basico');
        expect(trialDays).toBe(30);
    });
});
