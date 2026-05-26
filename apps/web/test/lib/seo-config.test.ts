/**
 * @fileoverview
 * Unit tests for the static-sitemap SEO helpers in src/lib/seo-config.ts.
 *
 * These helpers back the `@astrojs/sitemap` `serialize()` and `filter()` hooks
 * in astro.config.mjs (which is not itself testable under Vitest). They are
 * pure functions, so we test their behavior directly.
 *
 * SPEC-157 follow-up (sitemap es-prefix): the static sitemap must match the
 * dynamic sitemap strategy (REQ-2/REQ-12):
 *  - the `es` locale carries the `/es` prefix (never unprefixed),
 *  - `x-default` points at the Spanish (`/es`) URL,
 *  - no locale prefix is ever doubled (e.g. `/en/es/...`),
 *  - the root `/` (which 301-redirects to `/es/`) is excluded from the sitemap.
 */

import { describe, expect, it } from 'vitest';
import { buildSitemapAlternateLinks, isExcludedSitemapPage } from '../../src/lib/seo-config.js';

const SITE = 'https://hospeda.test';

describe('buildSitemapAlternateLinks', () => {
    it('builds es/en/pt/x-default alternates for an es-prefixed path', () => {
        const links = buildSitemapAlternateLinks({ pathname: '/es/nosotros/', siteUrl: SITE });

        expect(links).toEqual([
            { lang: 'es', url: 'https://hospeda.test/es/nosotros/' },
            { lang: 'en', url: 'https://hospeda.test/en/nosotros/' },
            { lang: 'pt', url: 'https://hospeda.test/pt/nosotros/' },
            { lang: 'x-default', url: 'https://hospeda.test/es/nosotros/' }
        ]);
    });

    it('produces the identical alternate set regardless of the source locale prefix', () => {
        const fromEs = buildSitemapAlternateLinks({ pathname: '/es/nosotros/', siteUrl: SITE });
        const fromEn = buildSitemapAlternateLinks({ pathname: '/en/nosotros/', siteUrl: SITE });
        const fromPt = buildSitemapAlternateLinks({ pathname: '/pt/nosotros/', siteUrl: SITE });

        expect(fromEn).toEqual(fromEs);
        expect(fromPt).toEqual(fromEs);
    });

    it('always prefixes the es alternate with /es (never unprefixed)', () => {
        // Regression for P1: /en/ and /pt/ pages used to emit es="/nosotros/".
        const links = buildSitemapAlternateLinks({ pathname: '/en/nosotros/', siteUrl: SITE });
        const es = links.find((l) => l.lang === 'es');
        const xDefault = links.find((l) => l.lang === 'x-default');

        expect(es?.url).toBe('https://hospeda.test/es/nosotros/');
        expect(xDefault?.url).toBe('https://hospeda.test/es/nosotros/');
    });

    it('never doubles a locale prefix', () => {
        // Regression for P2: /es/ pages used to emit en="/en/es/nosotros/".
        const links = buildSitemapAlternateLinks({ pathname: '/es/nosotros/', siteUrl: SITE });

        for (const { url } of links) {
            expect(url).not.toContain('/en/es/');
            expect(url).not.toContain('/pt/es/');
            expect(url).not.toContain('/es/es/');
        }
    });

    it('handles the locale home root (e.g. /es/) without a trailing path', () => {
        expect(buildSitemapAlternateLinks({ pathname: '/es/', siteUrl: SITE })).toEqual([
            { lang: 'es', url: 'https://hospeda.test/es/' },
            { lang: 'en', url: 'https://hospeda.test/en/' },
            { lang: 'pt', url: 'https://hospeda.test/pt/' },
            { lang: 'x-default', url: 'https://hospeda.test/es/' }
        ]);
    });

    it('does not strip a prefix from paths that merely start with locale letters', () => {
        // The /es|en|pt match must be a full segment, not a substring.
        const links = buildSitemapAlternateLinks({ pathname: '/entradas/', siteUrl: SITE });
        const es = links.find((l) => l.lang === 'es');

        expect(es?.url).toBe('https://hospeda.test/es/entradas/');
    });

    it('normalizes a site URL that carries a trailing slash', () => {
        const links = buildSitemapAlternateLinks({
            pathname: '/en/contacto/',
            siteUrl: 'https://hospeda.test/'
        });
        const es = links.find((l) => l.lang === 'es');

        expect(es?.url).toBe('https://hospeda.test/es/contacto/');
    });
});

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
        expect(isExcludedSitemapPage('/en/busqueda/')).toBe(true);
    });
});
