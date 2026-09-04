/**
 * @file suscriptores-pricing-empty-state.test.ts
 * @description Source-based tests verifying that the pricing pages render an
 * EmptyState fallback when a plan list is empty, and otherwise render the
 * plan grid.
 *
 * SPEC-096 / REQ-096-43 (T-054).
 *
 * ## HOS-1032 moved this wiring into the shared sections component
 *
 * The two page-level tests this file used to run against
 * `suscriptores/planes/anfitriones/index.astro` and `.../turistas/index.astro`
 * no longer apply: both files are now permanent redirects to
 * `/planes/anfitriones/precios/` and `/planes/turistas/precios/`
 * (`test/pages/suscriptores/planes-index.test.ts` covers the redirects). The
 * wiring itself — `emptyMessage`/`emptyActionUrl`/`emptyActionLabel` forwarded
 * from the page into `<PricingCardsGrid>` — moved into
 * `AudiencePricingSections.astro`, the ONE component all five `/planes/
 * <audiencia>/precios/` pages render through (HOS-1032 AC-44). Testing it
 * there, once, is more honest than five near-identical page-level copies: it
 * is what actually makes the fallback shared rather than five things that
 * happen to look alike today.
 *
 * The card UI itself lives in <PricingCardsGrid>, so the assertions below
 * check that the wrapper passes the right empty-state and label props to the
 * grid component, and the component-level assertions confirm the fallback
 * behavior actually lives in PricingCardsGrid.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sectionsSrc = readFileSync(
    resolve(__dirname, '../../src/components/billing/AudiencePricingSections.astro'),
    'utf8'
);

const pricingPageContentSrc = readFileSync(
    resolve(__dirname, '../../src/lib/billing/pricing-page-content.ts'),
    'utf8'
);

const gridSrc = readFileSync(
    resolve(__dirname, '../../src/components/billing/PricingCardsGrid.astro'),
    'utf8'
);

describe('AudiencePricingSections.astro (shared by all five /planes/<audiencia>/precios/ pages)', () => {
    it('imports the shared PricingCardsGrid component', () => {
        expect(sectionsSrc).toContain(
            "import PricingCardsGrid from '@/components/billing/PricingCardsGrid.astro'"
        );
    });

    it('imports buildUrl helper for the contact CTA', () => {
        expect(sectionsSrc).toContain("import { buildUrl } from '@/lib/urls'");
    });

    it('passes an empty-state message and contact action to the grid', () => {
        // `${copyRoot}.empty` rather than a hardcoded `pricing.owner.empty` /
        // `pricing.tourist.empty`: one call site now serves all five
        // audiences, and per-audience resolution is what the next test checks.
        expect(sectionsSrc).toContain('emptyMessage={t(`${copyRoot}.empty`)}');
        expect(sectionsSrc).toMatch(/buildUrl\(\{\s*locale,\s*path:\s*'contacto'\s*\}\)/);
    });

    it('passes the audience plan list straight through to the grid', () => {
        // `plans={plans}`, forwarded verbatim from the page's own
        // `fetchAudiencePlans` result — not a per-audience local name like the
        // old `plans={ownerPlans}` / `plans={touristPlans}`, since one
        // component now serves all five.
        expect(sectionsSrc).toContain('plans={plans}');
    });
});

describe('copyRoot resolves each audience to its own empty-state key', () => {
    // The two page-level tests this replaces hardcoded `pricing.owner.empty`
    // and `pricing.tourist.empty` — this is where that per-audience coverage
    // now lives, against the map `AudiencePricingSections`' `copyRoot` prop is
    // actually built from.
    it('maps owner and tourist to their historical i18n roots', () => {
        expect(pricingPageContentSrc).toContain("owner: 'pricing.owner'");
        expect(pricingPageContentSrc).toContain("tourist: 'pricing.tourist'");
    });

    it('gives all five audiences their own root, none of them shared', () => {
        const roots = ['owner', 'tourist', 'gastronomy', 'experience', 'partner'].map(
            (audience) => {
                const match = pricingPageContentSrc.match(
                    new RegExp(`${audience}: '(pricing\\.[a-z]+)'`)
                );
                expect(match, `no copyRoot mapping found for ${audience}`).not.toBeNull();
                return match?.[1];
            }
        );

        expect(new Set(roots).size).toBe(5);
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
