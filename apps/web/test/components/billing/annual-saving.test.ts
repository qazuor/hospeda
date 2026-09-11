/**
 * @file annual-saving.test.ts
 * @description Executes the rule that decides whether — and how loudly — a
 * pricing card advertises an annual discount.
 *
 * The owner's ask was that the discount be legible BEFORE the reader switches
 * to annual, which means the percentage now appears in the monthly state too.
 * That doubles the cost of getting it wrong: a bad number, or a number invented
 * for a tier that has no annual price, is now on screen by default. Both are
 * decided here, so both are executed here rather than asserted by reading the
 * component's source.
 */

import { describe, expect, it } from 'vitest';
import {
    computeAnnualSavingPercent,
    resolveBestAnnualSavingPercent
} from '@/components/billing/annual-saving';

describe('computeAnnualSavingPercent', () => {
    it('computes the saving against twelve monthly cycles', () => {
        // Arrange: 12 × 1000 = 12 000 at monthly, 10 000 annual → 16.67% → 17.
        const plan = { monthlyPriceArs: 1000, annualPriceArs: 10_000 };

        // Act
        const percent = computeAnnualSavingPercent({ plan });

        // Assert
        expect(percent).toBe(17);
    });

    it('rounds to a whole percent', () => {
        // 12 × 2000 = 24 000 vs 19 200 → exactly 20%.
        expect(
            computeAnnualSavingPercent({ plan: { monthlyPriceArs: 2000, annualPriceArs: 19_200 } })
        ).toBe(20);
        // 12 × 100 = 1200 vs 1139 → 5.08% → 5.
        expect(
            computeAnnualSavingPercent({ plan: { monthlyPriceArs: 100, annualPriceArs: 1139 } })
        ).toBe(5);
    });

    it('advertises NOTHING for a monthly-only tier', () => {
        // The case the owner's ask makes dangerous: with the hint visible by
        // default, a tier with no annual price must render no hint at all.
        expect(
            computeAnnualSavingPercent({ plan: { monthlyPriceArs: 1000, annualPriceArs: null } })
        ).toBeNull();
    });

    it('advertises nothing for a zero or negative annual price', () => {
        expect(
            computeAnnualSavingPercent({ plan: { monthlyPriceArs: 1000, annualPriceArs: 0 } })
        ).toBeNull();
        expect(
            computeAnnualSavingPercent({ plan: { monthlyPriceArs: 1000, annualPriceArs: -500 } })
        ).toBeNull();
    });

    it('advertises nothing for a free tier — "ahorrá 100%" is nonsense', () => {
        expect(
            computeAnnualSavingPercent({ plan: { monthlyPriceArs: 0, annualPriceArs: 5000 } })
        ).toBeNull();
    });

    it('advertises nothing when paying yearly is not actually cheaper', () => {
        // A catalogue misconfiguration. Staying silent beats presenting a
        // negative saving as a discount.
        expect(
            computeAnnualSavingPercent({ plan: { monthlyPriceArs: 1000, annualPriceArs: 12_000 } })
        ).toBeNull();
        expect(
            computeAnnualSavingPercent({ plan: { monthlyPriceArs: 1000, annualPriceArs: 15_000 } })
        ).toBeNull();
    });

    it('reports a saving for an annual price one cent below the yearly total', () => {
        // The boundary of the "not actually cheaper" guard: strictly cheaper
        // counts, equal does not.
        expect(
            computeAnnualSavingPercent({ plan: { monthlyPriceArs: 1000, annualPriceArs: 11_999 } })
        ).toBe(0);
    });
});

describe('resolveBestAnnualSavingPercent', () => {
    it('takes the largest saving in the grid', () => {
        expect(resolveBestAnnualSavingPercent({ percents: [8, null, 20, 17] })).toBe(20);
    });

    it('returns null when no tier has a saving, so the toggle shows no badge', () => {
        expect(resolveBestAnnualSavingPercent({ percents: [null, null] })).toBeNull();
        expect(resolveBestAnnualSavingPercent({ percents: [] })).toBeNull();
    });

    it('ignores the nulls rather than treating them as zero', () => {
        expect(resolveBestAnnualSavingPercent({ percents: [null, 3, null] })).toBe(3);
    });
});
