/**
 * @file planes-precios-trial-surface.test.ts
 * @description HOS-1233 T-026 — what the four `/planes/…/precios/` pages must
 * and must not carry.
 *
 * Turning a `ctaMode="link"` page into a checkout page would undo HOS-1156's
 * funnel (R-4), and nothing else in the suite would notice. The remaining-days
 * banner this file also used to pin was removed with the old billing, and the
 * aliados pricing page with it (HOS-1637, AC:B13a:21).
 *
 * Every "X is absent" assertion here has a sibling asserting the same literal
 * IS present on the two pages that legitimately carry it, so a typo in the
 * literal fails loudly instead of passing quietly.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { buildListingStartUrl } from '../../src/lib/listing/start-url';

const SRC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');

/** The four pricing pages, by audience. */
const PRICING_PAGES = {
    owner: 'pages/[lang]/planes/anfitriones/precios/index.astro',
    tourist: 'pages/[lang]/planes/turistas/precios/index.astro',
    gastronomy: 'pages/[lang]/planes/gastronomia/precios/index.astro',
    experience: 'pages/[lang]/planes/experiencias/precios/index.astro'
} as const;

/** The two whose CTA links out instead of charging (F-1 / D-1). */
const LINK_AUDIENCES = ['gastronomy', 'experience'] as const;

/** The two whose card CTA is the (future) in-page checkout (F-1). */
const CHECKOUT_AUDIENCES = ['owner', 'tourist'] as const;

function readSrc(relativePath: string): string {
    return readFileSync(resolve(SRC_ROOT, relativePath), 'utf-8');
}

describe('HOS-1233 — the four pricing pages are all reachable by this test', () => {
    it('reads a non-empty source for each of the four', () => {
        // Non-vacuity. Every assertion below is a substring check, and a file
        // read as an empty string satisfies the negative half of all of them.
        for (const path of Object.values(PRICING_PAGES)) {
            expect(readSrc(path).length, path).toBeGreaterThan(500);
        }
    });
});

describe('HOS-1233 — every pricing page renders the shared sections', () => {
    it('all four render the shared sections component, naming their audience', () => {
        for (const [audience, path] of Object.entries(PRICING_PAGES)) {
            const source = readSrc(path);
            expect(source, path).toContain('<AudiencePricingSections');
            expect(source, path).toContain(`audience="${audience}"`);
        }
    });
});

describe('HOS-1233 T-026 / AC-12 — the two link pages still link to signup → create form', () => {
    it('gastronomia and experiencias point at their own vertical create form', () => {
        // The real builder, not a copy of its output: this asserts the href a
        // visitor actually gets, through the function the page calls.
        expect(buildListingStartUrl({ locale: 'es', vertical: 'gastronomy' })).toBe(
            '/es/auth/signup/?returnUrl=%2Fes%2Fpublicar%2Fgastronomia%2F'
        );
        expect(buildListingStartUrl({ locale: 'es', vertical: 'experience' })).toBe(
            '/es/auth/signup/?returnUrl=%2Fes%2Fpublicar%2Fexperiencias%2F'
        );

        for (const [audience, vertical] of [
            ['gastronomy', 'gastronomy'],
            ['experience', 'experience']
        ] as const) {
            const source = readSrc(PRICING_PAGES[audience]);
            expect(source, audience).toContain(
                `buildListingStartUrl({ locale, vertical: '${vertical}' })`
            );
            expect(source, audience).toContain('ctaHref={ctaHref}');
        }
    });

    it('both declare ctaMode="link"', () => {
        for (const audience of LINK_AUDIENCES) {
            expect(readSrc(PRICING_PAGES[audience]), audience).toContain('ctaMode="link"');
        }
    });

    it('no checkout path was added to any of them', () => {
        // The positive sibling of this negative is the test above: the same
        // literal is asserted PRESENT on both, so a typo here cannot pass.
        for (const audience of LINK_AUDIENCES) {
            const source = readSrc(PRICING_PAGES[audience]);
            expect(source, audience).not.toContain('ctaMode="checkout"');
        }
    });

    it('the two checkout pages declare no link mode — the sibling of the above', () => {
        for (const audience of CHECKOUT_AUDIENCES) {
            const source = readSrc(PRICING_PAGES[audience]);
            expect(source, audience).not.toContain('ctaMode="link"');
            expect(source, audience).not.toContain('ctaHref=');
        }
    });
});
