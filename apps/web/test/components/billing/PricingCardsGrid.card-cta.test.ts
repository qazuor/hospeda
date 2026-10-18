import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
    resolve(__dirname, '../../../src/components/billing/PricingCardsGrid.astro'),
    'utf8'
);
const island = readFileSync(
    resolve(__dirname, '../../../src/components/billing/PlanCardCta.client.tsx'),
    'utf8'
);

describe('PricingCardsGrid per-card CTA wiring', () => {
    it('mounts the situation-aware CTA only for checkout cards with vertical and purchase identifiers', () => {
        expect(source).toContain(
            "ctaMode === 'checkout' && pricingVertical !== null && card.plan.planVersionId && card.plan.billingOptions"
        );
        expect(source).toContain(
            '<PlanCardCta client:idle locale={locale} vertical={pricingVertical} planVersionId={card.plan.planVersionId} billingOptions={card.plan.billingOptions} />'
        );
        expect(source).toContain("ctaMode === 'link'");
        expect(island).toContain('data-kind={view.kind}');
        expect(island).toContain('data-plan-version-id={planVersionId}');
        expect(island).toContain('data-loaded={result !== null}');
    });
});
