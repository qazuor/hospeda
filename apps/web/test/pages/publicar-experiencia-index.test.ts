/**
 * @file publicar-experiencia-index.test.ts
 * @description Source-read tests for `/publicar-experiencia/`, which HOS-1032
 * turned from the experience vertical's full marketing page (hero, benefits,
 * how-it-works, price, FAQ — see the previous revision of this file) into a
 * permanent redirect to `/planes/experiencias/`, the new level-2 sales page.
 * Mirrors `publicar-restaurante-index.test.ts`.
 *
 * ## Where the retired content coverage lives now
 *
 * See that file's docblock: `test/pages/sales-pages-family.guard.test.ts`
 * covers `/planes/experiencias/index.astro`'s content, and
 * `test/pages/commerce-landing-cta.guard.test.ts` /
 * `test/pages/pricing-ssr-runtime.test.ts` cover its CTA and pricing pages.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/publicar-experiencia/index.astro'),
    'utf8'
);

describe('publicar-experiencia/index.astro', () => {
    it('renders on demand, so the redirect is actually executed', () => {
        expect(src).toContain('export const prerender = false;');
    });

    it('redirects rather than serving a 200 body', () => {
        expect(src).toContain('return Astro.redirect(');
        expect(src).not.toContain('<MarketingLayout');
        expect(src).not.toContain('<BaseLayout');
        expect(src).not.toContain('fetchPublicPlans');
    });

    it('answers 301, the status that transfers ranking signal for a moved page', () => {
        expect(src).toMatch(/Astro\.redirect\([\s\S]*?,\s*301\s*\)/);
    });

    it('targets the experience PUBLISH page, overriding HOS-941 D-8', () => {
        // This redirect pointed at `/planes/experiencias/` — a SALES page — and the
        // reasoning was correct while no publish page existed for this vertical.
        // One does now, and it carries the argument AND the form, so it is a
        // superset of what the sales page offers an arriving visitor. The URL's
        // own name said *publicar*; it finally leads there (HOS-1156 D-6).
        expect(src).toContain('PUBLISH_PAGE_PATH_BY_VERTICAL.experience');
        expect(src).not.toContain("path: 'planes/experiencias'");
    });
});
