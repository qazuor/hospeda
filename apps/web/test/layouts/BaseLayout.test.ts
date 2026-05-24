/**
 * @file BaseLayout.test.ts
 * @description Source-level tests for BaseLayout.astro (Astro components cannot
 * be rendered in Vitest; assert on the component source — the project's
 * documented approach for .astro coverage).
 *
 * SPEC-157:
 * - REQ-11: BaseLayout must NOT emit its own <meta name="description"> — SEOHead
 *   is the single source, otherwise every page ships two description tags.
 * - REQ-4: BaseLayout must preconnect to the Cloudinary CDN and the API origin.
 * - REQ-10: the full-page opacity:0 font gate must be gone (font-display: swap
 *   is the correct, non-blocking strategy; the gate penalised FCP).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/layouts/BaseLayout.astro'), 'utf8');

describe('BaseLayout.astro', () => {
    describe('REQ-11 — no duplicate meta description', () => {
        it('does not emit its own <meta name="description"> (SEOHead owns it)', () => {
            expect(src).not.toMatch(/<meta\s+name=["']description["']/);
        });
    });

    describe('REQ-4 — resource hints', () => {
        it('preconnects to the Cloudinary image CDN', () => {
            expect(src).toMatch(/rel=["']preconnect["'][^>]*res\.cloudinary\.com/);
        });

        it('preconnects to the API origin (env-derived, not hardcoded)', () => {
            // The API origin is derived from getApiUrl() into an `apiOrigin` const.
            expect(src).toContain('apiOrigin');
            expect(src).toMatch(/rel=["']preconnect["'][^>]*\{apiOrigin\}/);
        });
    });

    describe('REQ-10 — no full-page font opacity gate', () => {
        it('removed the fonts-loading class/script that gated body opacity', () => {
            // The gate worked by toggling a `fonts-loading` class that set
            // `body { opacity: 0 }`. Asserting the class/script is gone is the
            // precise check — a blanket /opacity: 0/ match would also flag
            // legitimate opacity rules elsewhere in the layout.
            expect(src).not.toContain('fonts-loading');
        });

        it('has no inline script awaiting document.fonts to reveal the body', () => {
            expect(src).not.toContain('document.fonts.ready');
        });
    });
});
