/**
 * @file suscriptores-pricing-empty-state.test.ts
 * @description Source-based tests verifying that the tourist and owner pricing
 * pages render an EmptyState fallback when the corresponding plan list is
 * empty, and otherwise render the plan grid.
 *
 * SPEC-096 / REQ-096-43 (T-054).
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

describe('Tourist pricing page (turistas/index.astro)', () => {
    it('imports the EmptyState component', () => {
        expect(touristSrc).toContain(
            "import EmptyState from '@/components/shared/feedback/EmptyState.astro'"
        );
    });

    it('imports buildUrl helper for the contact CTA', () => {
        expect(touristSrc).toContain("import { buildUrl } from '@/lib/urls'");
    });

    it('computes a hasPlans flag from touristPlans length', () => {
        expect(touristSrc).toContain('const hasPlans = touristPlans.length > 0');
    });

    it('renders EmptyState in the no-plans branch', () => {
        expect(touristSrc).toContain('<EmptyState');
        expect(touristSrc).toContain('variant="empty"');
    });

    it('points the EmptyState CTA at /contacto/', () => {
        expect(touristSrc).toMatch(/buildUrl\(\{\s*locale,\s*path:\s*'contacto'\s*\}\)/);
    });

    it('uses an i18n key for the empty-state message', () => {
        expect(touristSrc).toContain("t('pricing.tourist.empty'");
    });

    it('still renders the pricing grid when plans exist', () => {
        expect(touristSrc).toContain('class="pricing-cards__grid"');
        // The fallback is in the !hasPlans branch.
        expect(touristSrc).toMatch(/!hasPlans\s*\?/);
    });
});

describe('Owner pricing page (planes/index.astro)', () => {
    it('imports the EmptyState component', () => {
        expect(ownerSrc).toContain(
            "import EmptyState from '@/components/shared/feedback/EmptyState.astro'"
        );
    });

    it('imports buildUrl helper for the contact CTA', () => {
        expect(ownerSrc).toContain("import { buildUrl } from '@/lib/urls'");
    });

    it('computes a hasPlans flag from ownerPlans length', () => {
        expect(ownerSrc).toContain('const hasPlans = ownerPlans.length > 0');
    });

    it('renders EmptyState in the no-plans branch', () => {
        expect(ownerSrc).toContain('<EmptyState');
        expect(ownerSrc).toContain('variant="empty"');
    });

    it('points the EmptyState CTA at /contacto/', () => {
        expect(ownerSrc).toMatch(/buildUrl\(\{\s*locale,\s*path:\s*'contacto'\s*\}\)/);
    });

    it('uses an i18n key for the empty-state message', () => {
        expect(ownerSrc).toContain("t('pricing.owner.empty'");
    });

    it('still renders the pricing grid when plans exist', () => {
        expect(ownerSrc).toContain('class="pricing-cards__grid"');
        expect(ownerSrc).toMatch(/!hasPlans\s*\?/);
    });
});
