/**
 * @file billing/pricing-page-content.test.ts
 * @description Unit tests for what the five `/planes/<audiencia>/precios/`
 * pages resolve out of one module.
 *
 * ## Why this file exists (HOS-1212)
 *
 * It did not, and that was the gap. `/planes/aliados/precios/` used to pass the
 * literal `priceMode="consult"` — ugly, but visible in the page's own diff.
 * HOS-1212 replaced it with a derivation, which is correct and moved the point
 * of failure somewhere nothing executed: `resolvePricingPageContent` had no
 * importer in any test in the repo.
 *
 * The failure that shape allows: someone edits `priceMode: resolvePriceMode(…)`
 * to `priceMode: 'amount'` and `/es/planes/aliados/precios/` publishes ARS
 * 15.000 again, with the whole suite green. The static guard passes (the page
 * still destructures and still passes an expression — it checks syntax, not
 * value), `price-on-request-audiences.test.ts` passes (it exercises the
 * predicate in isolation), and `audience-plans.test.ts` passes (that is the
 * other rail, the index's).
 *
 * So the assertions here are about the COMPOSITION: this module reading the
 * predicate. Consolidating N expressions into one predicate needs a test per
 * surface that reads it, not only a test of the predicate.
 */

import { describe, expect, it, vi } from 'vitest';
import type { PublicPlanData } from '@/lib/billing/fetch-plans';
import type { PricingPageTranslators } from '@/lib/billing/pricing-page-content';
import { resolvePricingPageContent } from '@/lib/billing/pricing-page-content';
import type { PricingAudience } from '@/lib/billing-i18n';

vi.mock('@/lib/env', () => ({
    getApiUrl: vi.fn(() => 'http://api.test')
}));

/** Echoes the key, so an assertion can name the key a branch reached for. */
const translators: PricingPageTranslators = {
    t: ((key: string) => key) as PricingPageTranslators['t'],
    tPlural: ((key: string, count: number) =>
        `${key}:${count}`) as PricingPageTranslators['tPlural']
};

const PRICED_AUDIENCES: readonly PricingAudience[] = [
    'owner',
    'tourist',
    'gastronomy',
    'experience'
] as const;

const makePlan = (overrides: Partial<PublicPlanData> = {}): PublicPlanData =>
    ({
        slug: 'plan',
        name: 'Plan',
        description: '',
        category: 'owner',
        monthlyPriceArs: 1_500_000,
        annualPriceArs: null,
        hasTrial: false,
        trialDays: 0,
        isActive: true,
        sortOrder: 1,
        entitlements: [],
        limits: [],
        ...overrides
    }) as PublicPlanData;

describe('resolvePricingPageContent — priceMode (HOS-1212)', () => {
    it('withholds the amount on the aliados page', () => {
        // THE regression test for this surface. The plans handed in carry a real
        // ARS 15.000 price — exactly the figure the page must not print — so a
        // mode resolved to `'amount'` would be a page publishing it.
        const content = resolvePricingPageContent({
            audience: 'partner',
            plans: [makePlan({ slug: 'partner-silver', monthlyPriceArs: 1_500_000 })],
            translators
        });

        expect(content.priceMode).toBe('consult');
    });

    it('prints the amount for the four audiences that publish one', () => {
        // The other direction: a gate that over-applies would silently take the
        // price off four pricing pages, which is the same bug facing the other
        // way and would not be caught by the assertion above.
        for (const audience of PRICED_AUDIENCES) {
            const content = resolvePricingPageContent({
                audience,
                plans: [makePlan()],
                translators
            });

            expect(content.priceMode).toBe('amount');
        }
    });

    it('resolves a mode with no plans at all', () => {
        // A failed fetch and an audience with no sellable plan both arrive here
        // as an empty list. The mode is a property of the AUDIENCE, never of the
        // catalogue, so it must answer regardless — a page that fell back to
        // `undefined` would render an amount by the component's default.
        for (const audience of [...PRICED_AUDIENCES, 'partner' as const]) {
            const content = resolvePricingPageContent({ audience, plans: [], translators });

            expect(['amount', 'consult']).toContain(content.priceMode);
        }

        expect(
            resolvePricingPageContent({ audience: 'partner', plans: [], translators }).priceMode
        ).toBe('consult');
    });
});

describe('resolvePricingPageContent — the billing FAQ reads the same predicate', () => {
    it('asks why there is no price on the aliados page', () => {
        const { faqs } = resolvePricingPageContent({
            audience: 'partner',
            plans: [makePlan({ hasTrial: true, trialDays: 30 })],
            translators
        });

        // Note the fixture offers a 30-day trial: the branch must be chosen by
        // the audience, not by whether a trial happens to exist.
        expect(faqs[0]?.q).toBe('pricing.billingFaq.partnerPriceQ');
    });

    it('asks about the trial everywhere else', () => {
        for (const audience of PRICED_AUDIENCES) {
            const { faqs } = resolvePricingPageContent({
                audience,
                plans: [makePlan({ hasTrial: true, trialDays: 30 })],
                translators
            });

            expect(faqs[0]?.q).toBe('pricing.billingFaq.trialQ');
        }
    });
});
