/**
 * @file pricing-catalogue-nav.test.ts
 * @description Both vertical pricing pages must offer a way BACK to the
 * audience index and a way ACROSS to the comparison table, above the cards.
 *
 * Owner review of the live pages: `/planes/anfitriones/` and
 * `/planes/turistas/` are reachable straight from search and from the index,
 * and neither had an exit other than the browser button. The comparison table
 * had the mirror problem — its only link sat after every card, so a reader
 * still choosing between tiers had to scroll past all of them to reach the
 * surface that actually compares them.
 *
 * Astro pages cannot be rendered under Vitest, so these read the source. What
 * they pin is placement and wiring: that the nav is ABOVE the cards section,
 * that the comparison link exists in BOTH places rather than having moved, and
 * that each page points at ITS OWN comparison table (owner and tourist tables
 * live at different paths — a copy-paste between the two pages is the obvious
 * way to get this wrong, and it would still render perfectly).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGES = {
    owner: {
        path: '../../../src/pages/[lang]/suscriptores/planes/anfitriones/index.astro',
        comparisonPath: 'suscriptores/planes/comparar'
    },
    tourist: {
        path: '../../../src/pages/[lang]/suscriptores/planes/turistas/index.astro',
        comparisonPath: 'suscriptores/turistas/comparar'
    }
} as const;

const NAV_SRC = readFileSync(
    resolve(__dirname, '../../../src/components/billing/PlanCatalogueNav.astro'),
    'utf8'
);

function read(page: keyof typeof PAGES): string {
    return readFileSync(resolve(__dirname, PAGES[page].path), 'utf8');
}

/**
 * The markup only, with the frontmatter cut off.
 *
 * Ordering assertions have to run on this, not on the whole file: the import
 * block lists the components in alphabetical-ish order, so `indexOf` over the
 * full source compares import positions and answers a question nobody asked.
 */
function template(src: string): string {
    return src.slice(src.indexOf('\n---\n', 3) + 5);
}

describe.each(
    Object.keys(PAGES) as Array<keyof typeof PAGES>
)('%s pricing page — catalogue nav', (page) => {
    const src = read(page);

    it('renders the shared nav', () => {
        expect(src).toContain(
            "import PlanCatalogueNav from '@/components/billing/PlanCatalogueNav.astro'"
        );
        expect(src).toContain('<PlanCatalogueNav');
    });

    it('places it ABOVE the cards, not after them', () => {
        const markup = template(src);
        const navAt = markup.indexOf('<PlanCatalogueNav');
        const cardsAt = markup.indexOf('<PricingCardsGrid');
        expect(navAt).toBeGreaterThan(-1);
        expect(cardsAt).toBeGreaterThan(-1);
        expect(navAt).toBeLessThan(cardsAt);
    });

    it('keeps the comparison link at the BOTTOM as well — it was added, not moved', () => {
        // The owner asked for it "en ambos lados". Losing the closing teaser
        // would satisfy every other assertion here.
        const markup = template(src);
        expect(markup).toContain('<ComparisonLinkTeaser');
        expect(markup.indexOf('<ComparisonLinkTeaser')).toBeGreaterThan(
            markup.indexOf('<PricingCardsGrid')
        );
    });

    it('points BOTH links at this audience’s own comparison table', () => {
        // Resolved once and passed to both, so the two can never disagree.
        expect(src).toContain(
            `const comparisonHref = buildUrl({ locale, path: '${PAGES[page].comparisonPath}' });`
        );
        expect(src).toContain('comparisonHref={comparisonHref}');
        expect(src).toContain('href={comparisonHref}');
    });
});

describe('PlanCatalogueNav.astro', () => {
    it('reuses the shared back control instead of inventing one', () => {
        // `HeaderBackButton` is history-aware: it returns the visitor to wherever
        // they came from when there is in-app history, and falls back to its
        // href otherwise.
        expect(NAV_SRC).toContain(
            "import HeaderBackButton from '@/components/shared/ui/HeaderBackButton.astro'"
        );
        expect(NAV_SRC).toContain('<HeaderBackButton');
    });

    it('reuses the shared button for the forward link', () => {
        expect(NAV_SRC).toContain(
            "import GradientButton from '@/components/shared/ui/GradientButton.astro'"
        );
    });

    it('sends "back" to the one plan index, never to a caller-supplied path', () => {
        // There is exactly one audience index; a caller that could point "back
        // to all plans" somewhere else is a bug, not a feature.
        expect(NAV_SRC).toContain(
            "const indexHref = buildUrl({ locale, path: 'suscriptores/planes' });"
        );
        expect(NAV_SRC).not.toMatch(/readonly indexHref/);
    });

    it('resolves every string through i18n', () => {
        expect(NAV_SRC).toContain("t('pricing.nav.backToIndex'");
        expect(NAV_SRC).toContain("t('pricing.comparison.link'");
        expect(NAV_SRC).toContain("t('pricing.nav.ariaLabel'");
    });

    it('is a landmark with a name, so the two nav regions are distinguishable', () => {
        expect(NAV_SRC).toMatch(/<nav[\s\S]*?aria-label=\{t\('pricing\.nav\.ariaLabel'/);
    });
});
