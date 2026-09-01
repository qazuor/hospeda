/**
 * @file pricing-card-view.test.ts
 * @description Executes the whole card build — the piece that used to live in
 * `PricingCardsGrid.astro`'s frontmatter and could therefore only ever be
 * asserted by reading source text.
 *
 * Two behaviours here are the owner's review items and are worth stating
 * plainly, because a source-reading guard cannot tell either of them apart from
 * its opposite:
 *
 * - a card cut to five lines still CARRIES the rest, and the "ver todo" label
 *   counts what is actually hidden;
 * - the annual discount is phrased for the MONTHLY state, and a tier without an
 *   annual price says nothing at all instead of inventing a number.
 */

import { describe, expect, it } from 'vitest';
import { PRICING_CARD_VISIBLE_ITEMS } from '@/components/billing/pricing-card-items';
import type { PricingPlan } from '@/components/billing/pricing-card-view';
import { buildPricingCardViews } from '@/components/billing/pricing-card-view';
import type { TranslationFn } from '@/lib/i18n';

/**
 * A translator that returns the caller's fallback, which is what the real one
 * does for any key with no locale entry. Keeps these assertions about the
 * BUILD, not about the Spanish copy (that is the locale guards' job).
 */
const t: TranslationFn = (_key, fallback) => fallback ?? '';

function plan(input: Partial<PricingPlan> & Pick<PricingPlan, 'slug'>): PricingPlan {
    return {
        name: input.slug,
        description: '',
        monthlyPriceArs: 1000,
        annualPriceArs: null,
        hasTrial: false,
        trialDays: 0,
        sortOrder: 1,
        isActive: true,
        entitlements: [],
        limits: {},
        ...input
    };
}

/** `n` distinct entitlement keys, enough to overflow the summary. */
function entitlements(n: number): string[] {
    return Array.from({ length: n }, (_, i) => `feature_${i}`);
}

function build(plans: readonly PricingPlan[]) {
    return buildPricingCardViews({ plans, audience: 'tourist', intlLocale: 'es-AR', t });
}

describe('buildPricingCardViews — the summary/disclosure cut', () => {
    it('cuts a long card to the summary size and hides the remainder', () => {
        const { cards } = build([plan({ slug: 'big', entitlements: entitlements(12) })]);
        const card = cards[0];

        expect(card?.visibleItems).toHaveLength(PRICING_CARD_VISIBLE_ITEMS);
        expect(card?.hiddenItems).toHaveLength(12 - PRICING_CARD_VISIBLE_ITEMS);
    });

    it('labels the disclosure with the number of lines it actually hides', () => {
        // The count is the only thing telling the reader the card is truncated;
        // a stale or hardcoded number is a lie about the offer.
        const { cards } = build([plan({ slug: 'big', entitlements: entitlements(12) })]);

        expect(cards[0]?.seeAllLabel).toContain(String(12 - PRICING_CARD_VISIBLE_ITEMS));
    });

    it('hides nothing on a short card, so no disclosure is rendered', () => {
        const { cards } = build([plan({ slug: 'small', entitlements: entitlements(3) })]);

        expect(cards[0]?.visibleItems).toHaveLength(3);
        expect(cards[0]?.hiddenItems).toEqual([]);
    });

    it('keeps every line reachable — nothing is dropped by the cut', () => {
        const { cards } = build([plan({ slug: 'big', entitlements: entitlements(9) })]);
        const card = cards[0];
        const ids = [...(card?.visibleItems ?? []), ...(card?.hiddenItems ?? [])].map(
            (item) => item.id
        );

        expect(ids).toEqual(entitlements(9));
    });
});

describe('buildPricingCardViews — the annual discount', () => {
    it('states the saving while MONTHLY is selected, not only under the annual toggle', () => {
        // The owner's point: "ya debería saberse que tiene descuento". The
        // monthly-state hint and the annual-state label are both populated from
        // the same computed percentage.
        const { cards } = build([
            plan({ slug: 'pro', monthlyPriceArs: 1000, annualPriceArs: 10_000 })
        ]);

        expect(cards[0]?.annualHintLabel).toContain('17');
        expect(cards[0]?.savingLabel).toContain('17');
        expect(cards[0]?.savingPercent).toBe(17);
    });

    it('says nothing about a discount on a monthly-only tier', () => {
        const { cards } = build([
            plan({ slug: 'basic', monthlyPriceArs: 1000, annualPriceArs: null })
        ]);

        expect(cards[0]?.annualHintLabel).toBe('');
        expect(cards[0]?.savingLabel).toBe('');
        expect(cards[0]?.savingPercent).toBeNull();
        expect(cards[0]?.hasAnnualPrice).toBe(false);
    });

    it('says nothing when the annual price is not cheaper than twelve months', () => {
        const { cards } = build([
            plan({ slug: 'odd', monthlyPriceArs: 1000, annualPriceArs: 13_000 })
        ]);

        expect(cards[0]?.annualHintLabel).toBe('');
    });

    it('advertises the best tier discount on the toggle, ignoring tiers without one', () => {
        const { maxAnnualSavingPercent } = build([
            plan({ slug: 'free', monthlyPriceArs: 0, annualPriceArs: null, sortOrder: 1 }),
            plan({ slug: 'a', monthlyPriceArs: 1000, annualPriceArs: 11_000, sortOrder: 2 }),
            plan({ slug: 'b', monthlyPriceArs: 2000, annualPriceArs: 19_200, sortOrder: 3 })
        ]);

        expect(maxAnnualSavingPercent).toBe(20);
    });

    it('advertises no toggle discount when the whole grid is monthly-only', () => {
        const { maxAnnualSavingPercent } = build([
            plan({ slug: 'a' }),
            plan({ slug: 'b', sortOrder: 2 })
        ]);

        expect(maxAnnualSavingPercent).toBeNull();
    });
});

describe('buildPricingCardViews — the rest of the card', () => {
    it('gives every card a selection radio id and an accessible name', () => {
        // Card selection is keyboard-operable because it is a real radio group;
        // that only holds if each card carries a distinct id and a real name.
        const { cards } = build([plan({ slug: 'a' }), plan({ slug: 'b', sortOrder: 2 })]);

        expect(cards[0]?.selectId).not.toBe(cards[1]?.selectId);
        expect(cards[0]?.selectAriaLabel.length).toBeGreaterThan(0);
        expect(cards[0]?.selectAriaLabel).not.toContain('{plan}');
    });

    it('never renders "everything in plan undefined, plus:" on the first tier', () => {
        const { cards } = build([plan({ slug: 'only', entitlements: ['x'] })]);

        expect(cards[0]?.deltaHeading).toBe('Este plan incluye:');
    });

    it('names the previous tier on a card that builds on one', () => {
        const { cards } = build([
            plan({ slug: 'base', entitlements: ['a'], sortOrder: 1 }),
            plan({ slug: 'upper', entitlements: ['a', 'b'], sortOrder: 2 })
        ]);

        expect(cards[1]?.deltaHeading).toContain('base');
    });

    it('renders a zero monthly price as the free label, not as "$0"', () => {
        const { cards } = build([plan({ slug: 'free', monthlyPriceArs: 0 })]);

        expect(cards[0]?.monthlyFormatted).toBe('Gratis');
    });
});
