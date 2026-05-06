/**
 * @file suscriptores-pricing-empty-state.test.ts
 * @description Source-based tests verifying that the tourist and owner pricing
 * pages render an EmptyState fallback when the corresponding plan list is
 * empty, and otherwise render the plan grid.
 *
 * SPEC-096 / REQ-096-43 (T-054).
 *
 * The pricing card UI was extracted into <PricingCardsGrid>, so the page-
 * level assertions check that the wrapper passes the right empty-state and
 * label props to the grid component, and the component-level assertions
 * confirm the fallback behavior actually lives in PricingCardsGrid.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const touristSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/suscriptores/turistas/index.astro'),
    'utf8'
);

const ownerSrc = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/suscriptores/planes/index.astro'),
    'utf8'
);

const gridSrc = readFileSync(
    resolve(__dirname, '../../src/components/billing/PricingCardsGrid.astro'),
    'utf8'
);

describe('Tourist pricing page (turistas/index.astro)', () => {
    it('imports the shared PricingCardsGrid component', () => {
        expect(touristSrc).toContain(
            "import PricingCardsGrid from '@/components/billing/PricingCardsGrid.astro'"
        );
    });

    it('imports buildUrl helper for the contact CTA', () => {
        expect(touristSrc).toContain("import { buildUrl } from '@/lib/urls'");
    });

    it('passes an empty-state message and contact action to the grid', () => {
        expect(touristSrc).toContain('emptyMessage=');
        expect(touristSrc).toContain("t('pricing.tourist.empty'");
        expect(touristSrc).toMatch(/buildUrl\(\{\s*locale,\s*path:\s*'contacto'\s*\}\)/);
    });

    it('passes the tourist plan list to the grid', () => {
        expect(touristSrc).toContain('plans={touristPlans}');
    });
});

describe('Owner pricing page (planes/index.astro)', () => {
    it('imports the shared PricingCardsGrid component', () => {
        expect(ownerSrc).toContain(
            "import PricingCardsGrid from '@/components/billing/PricingCardsGrid.astro'"
        );
    });

    it('imports buildUrl helper for the contact CTA', () => {
        expect(ownerSrc).toContain("import { buildUrl } from '@/lib/urls'");
    });

    it('passes an empty-state message and contact action to the grid', () => {
        expect(ownerSrc).toContain('emptyMessage=');
        expect(ownerSrc).toContain("t('pricing.owner.empty'");
        expect(ownerSrc).toMatch(/buildUrl\(\{\s*locale,\s*path:\s*'contacto'\s*\}\)/);
    });

    it('passes the owner plan list to the grid', () => {
        expect(ownerSrc).toContain('plans={ownerPlans}');
    });
});

describe('PricingCardsGrid (shared component)', () => {
    it('imports the EmptyState component', () => {
        expect(gridSrc).toContain(
            "import EmptyState from '@/components/shared/feedback/EmptyState.astro'"
        );
    });

    it('renders EmptyState in the no-plans branch', () => {
        expect(gridSrc).toContain('<EmptyState');
        expect(gridSrc).toContain('variant="empty"');
    });

    it('still renders the pricing grid when plans exist', () => {
        expect(gridSrc).toContain('class="pricing-cards__grid"');
        expect(gridSrc).toMatch(/!hasPlans\s*\?/);
    });
});
