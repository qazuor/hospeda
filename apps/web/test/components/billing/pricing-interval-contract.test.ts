import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (file: string) =>
    readFileSync(resolve(__dirname, '../../../src/components/billing', file), 'utf8');

describe('pricing interval presentation', () => {
    it('mirrors initialization and subsequent selections to the document', () => {
        const grid = source('PricingCardsGrid.astro');
        expect(grid).toContain('document.documentElement.dataset.pricingBilling = interval');
        expect(grid).toContain("setActive(queryInterval ?? 'monthly')");
    });

    it('filters dual-cycle actions through the grid ancestor without hiding single options', () => {
        const css = source('PlanCardCta.module.css');
        expect(source('PlanCardCta.client.tsx')).toContain('data-cycle={cycle}');
        expect(source('PlanCardCta.client.tsx')).toContain(
            'data-cycle={id === billingOptions.monthly'
        );
        expect(css).toContain(':global([data-billing="annual"])');
        expect(css).toContain('[data-has-both-cycles="true"]');
        expect(css).toContain('[data-cycle="monthly"]');
        expect(css).toContain('[data-cycle="annual"]');
    });

    it('renders both catalog prices and defaults to monthly without JavaScript', () => {
        const price = source('PlanComparisonPrice.astro');
        expect(price).toContain('formatPriceArs');
        expect(price).toContain('getComparisonAnnualPrice({ plan })');
        expect(price).toContain('plan.monthlyPriceArs');
        expect(price).toContain(":global(html[data-pricing-billing='annual'])");
        expect(price).toContain("'pricing.period.year'");
    });
});
