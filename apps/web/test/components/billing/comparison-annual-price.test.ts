import { describe, expect, it } from 'vitest';
import { getComparisonAnnualPrice } from '@/components/billing/plan-comparison-table.helpers';

describe('comparison annual price from catalog', () => {
    it('uses the annual catalog amount and yearly period when available', () => {
        expect(
            getComparisonAnnualPrice({
                plan: { monthlyPriceArs: 1800000, annualPriceArs: 18000000 }
            })
        ).toEqual({ cents: 18000000, period: 'year' });
    });

    it.each([
        null,
        0,
        -1
    ])('keeps the monthly amount and period for an unavailable annual price (%s)', (annualPriceArs) => {
        expect(
            getComparisonAnnualPrice({ plan: { monthlyPriceArs: 1800000, annualPriceArs } })
        ).toEqual({ cents: 1800000, period: 'month' });
    });

    it('keeps a free plan free when there is no annual price', () => {
        expect(
            getComparisonAnnualPrice({ plan: { monthlyPriceArs: 0, annualPriceArs: null } })
        ).toEqual({ cents: 0, period: 'month' });
    });
});
