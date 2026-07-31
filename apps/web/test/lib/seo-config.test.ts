/**
 * @fileoverview
 * Unit tests for the sitemap/robots path-exclusion helper in
 * src/lib/seo-config.ts.
 *
 * `SITEMAP_EXCLUDED_PATHS` is the single source of truth shared by
 * `src/pages/robots.txt.ts` (which emits it as `Disallow:` directives) and the
 * static-sitemap drift guard (which uses `isExcludedSitemapPage` to skip these
 * prefixes when checking that every page is classified).
 *
 * hreflang/alternate construction used to live here too, backing the
 * `@astrojs/sitemap` `serialize()` hook. That integration is gone (it emitted
 * an empty urlset on this fully-SSR app); the alternates logic now lives in
 * `src/lib/seo/sitemap-xml.ts` and is tested in `test/lib/seo/sitemap-xml.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { isExcludedSitemapPage, SITEMAP_EXCLUDED_PATHS } from '../../src/lib/seo-config.js';

describe('isExcludedSitemapPage', () => {
    it('excludes the bare root "/" (it 301-redirects to /es/)', () => {
        expect(isExcludedSitemapPage('/')).toBe(true);
    });

    it('keeps the localized home roots', () => {
        expect(isExcludedSitemapPage('/es/')).toBe(false);
        expect(isExcludedSitemapPage('/en/')).toBe(false);
        expect(isExcludedSitemapPage('/pt/')).toBe(false);
    });

    it('keeps regular content pages', () => {
        expect(isExcludedSitemapPage('/es/nosotros/')).toBe(false);
        expect(isExcludedSitemapPage('/en/suscriptores/planes/')).toBe(false);
    });

    it('excludes pages under a disallowed prefix', () => {
        expect(isExcludedSitemapPage('/es/auth/login/')).toBe(true);
        expect(isExcludedSitemapPage('/es/mi-cuenta/')).toBe(true);
        expect(isExcludedSitemapPage('/en/feedback/')).toBe(true);
    });

    // The global site-search feature was cut: the `/busqueda/` page and the
    // `GET /api/v1/public/search` endpoint behind it were deleted, so the path no
    // longer needs a sitemap exclusion or a robots.txt Disallow.
    it('no longer carries a /busqueda/ exclusion (global search removed)', () => {
        expect(SITEMAP_EXCLUDED_PATHS).not.toContain('/busqueda/');
    });
});
