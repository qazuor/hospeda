/**
 * @file publicar-restaurante-index.test.ts
 * @description Source-read tests for `/publicar-restaurante/`, which HOS-1032
 * turned from the gastronomy vertical's full marketing page (hero, benefits,
 * how-it-works, price, FAQ — see the previous revision of this file) into a
 * permanent redirect to `/planes/gastronomia/`, the new level-2 sales page.
 *
 * ## Where the retired content coverage lives now
 *
 * Every assertion this file used to make about the page's CONTENT (hero copy,
 * benefits/how-it-works/FAQ sections, the trial-aware price block, the
 * `applyCacheHeaders` pricing class) moved with the content itself: the
 * shared-section family guard in `test/pages/sales-pages-family.guard.test.ts`
 * covers `/planes/gastronomia/index.astro` alongside its four siblings, and
 * `test/pages/commerce-landing-cta.guard.test.ts` covers the vertical's
 * checkout CTA wiring on both the sales page and its own `/precios/` page
 * (`test/pages/pricing-ssr-runtime.test.ts`). Nothing here duplicates that
 * coverage — this file only asserts the one thing left that is genuinely a
 * property of THIS URL: that it forwards rather than serves.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicar-restaurante/index.astro'),
    'utf8'
);

describe('publicar-restaurante/index.astro', () => {
    it('renders on demand, so the redirect is actually executed', () => {
        // Without `prerender = false` this would be built once at compile
        // time and could not read the request-scoped locale.
        expect(src).toContain('export const prerender = false;');
    });

    it('redirects rather than serving a 200 body', () => {
        // Catches a regression back to a rendered landing page: no layout,
        // no plan fetch, no lead-form island — just the redirect statement.
        expect(src).toContain('return Astro.redirect(');
        expect(src).not.toContain('<MarketingLayout');
        expect(src).not.toContain('<BaseLayout');
        expect(src).not.toContain('fetchPublicPlans');
    });

    it('answers 301, the status that transfers ranking signal for a moved page', () => {
        // 302 or a bare 404 would both be wrong here: the content moved
        // location, it did not disappear or become temporary.
        expect(src).toMatch(/Astro\.redirect\([\s\S]*?,\s*301\s*\)/);
    });

    it('targets the gastronomy PUBLISH page, overriding HOS-941 D-8', () => {
        // This redirect pointed at `/planes/gastronomia/` — a SALES page — and the
        // reasoning was correct while no publish page existed for this vertical.
        // One does now, and it carries the argument AND the form, so it is a
        // superset of what the sales page offers an arriving visitor. The URL's
        // own name said *publicar*; it finally leads there (HOS-1156 D-6).
        expect(src).toContain('PUBLISH_PAGE_PATH_BY_VERTICAL.gastronomy');
        expect(src).not.toContain("path: 'planes/gastronomia'");
    });
});
