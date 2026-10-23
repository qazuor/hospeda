/**
 * Source check for the withdrawal CTA's contrast pair (HOS-1752).
 *
 * Astro pages do not render in Vitest, so this reads the page source, the same
 * way `legal-arrepentimiento.test.ts` and `PricingCardsGrid.test.ts` do. The
 * ratios themselves are measured from the real token values in
 * `packages/design-tokens/src/tokens/withdrawal-cta-contrast.test.ts`; this
 * block only pins the CONSUMER, so the page and the guard cannot drift apart.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGE_PATH = resolve(__dirname, '../../src/pages/[lang]/legal/arrepentimiento/index.astro');
const PAGE_SOURCE = readFileSync(PAGE_PATH, 'utf8');

/** The FIRST match is the base rule; `:hover` and `:focus-visible` differ. */
const CTA_RULE = PAGE_SOURCE.match(/\.withdrawal-cta \{([^}]*)\}/)?.[1] ?? '';
const HOVER_RULE = PAGE_SOURCE.match(/\.withdrawal-cta:hover \{([^}]*)\}/)?.[1] ?? '';

describe('TEST:1752:3 AC:1752:3 the withdrawal CTA uses the AA-safe ink pair', () => {
    it('TEST:1752:3 paints surface-dark text on the brand-accent fill', () => {
        expect(CTA_RULE).toContain('background: var(--brand-accent);');
        expect(CTA_RULE).toContain('color: var(--surface-dark);');
    });

    it('TEST:1752:3 no longer uses the orange or white inks that fail AA', () => {
        expect(CTA_RULE).not.toContain('--brand-accent-text');
        expect(CTA_RULE).not.toContain('--accent-foreground');
    });

    it('TEST:1752:3 references --brand-accent-text nowhere in the page', () => {
        // The retired ink is not merely removed from this rule: it must not
        // come back anywhere in the page as a CSS custom property reference.
        expect(PAGE_SOURCE).not.toContain('--brand-accent-text');
    });

    it('TEST:1752:3 keeps the hover state the contrast guard models', () => {
        // `withdrawal-cta-contrast.test.ts` models the hover fill as
        // brightness(0.94). If this filter changes, that model stops describing
        // the page: reread the guard instead of widening this assertion.
        expect(HOVER_RULE).toContain('filter: brightness(0.94);');
    });
});
