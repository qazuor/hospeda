/**
 * @fileoverview
 * Tests for the regional locale signals (HOS-585 G-5 / AC-10).
 *
 * The failure this suite exists to prevent is not "the regional tags are
 * missing" — it is "the regional tags REPLACED the generic ones". Swapping
 * `hreflang="es"` for `es-AR` looks like an upgrade in a diff and quietly drops
 * the site out of the generic Spanish bucket, losing es-ES / es-MX coverage
 * (spec R-3). So every assertion below checks for BOTH, never for one.
 *
 * The map itself is unit-tested for real; the emission is source-asserted,
 * which is the project's documented approach for `.astro` (see
 * apps/web/CLAUDE.md). A source assertion proves the tag is DECLARED, not that
 * a response carries it — stated here so nobody reads this file as end-to-end
 * proof.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REGIONAL_LOCALE_TAGS, SUPPORTED_LOCALES, toRegionalLocaleTag } from '@/lib/i18n';

const WEB_SRC = resolve(__dirname, '../../src');
const seoHeadSrc = readFileSync(resolve(WEB_SRC, 'components/seo/SEOHead.astro'), 'utf8');

const LAYOUTS = [
    'layouts/BaseLayout.astro',
    'layouts/AuthLayout.astro',
    'layouts/ErrorLayout.astro',
    'layouts/StandaloneLayout.astro'
] as const;

describe('REGIONAL_LOCALE_TAGS', () => {
    it('covers every supported locale', () => {
        for (const locale of SUPPORTED_LOCALES) {
            expect(REGIONAL_LOCALE_TAGS[locale]).toBeDefined();
        }
    });

    it('maps each locale to its target market', () => {
        expect(toRegionalLocaleTag({ locale: 'es' })).toBe('es-AR');
        expect(toRegionalLocaleTag({ locale: 'en' })).toBe('en-US');
        expect(toRegionalLocaleTag({ locale: 'pt' })).toBe('pt-BR');
    });

    it('produces hyphenated BCP-47 tags whose base is the locale itself', () => {
        for (const locale of SUPPORTED_LOCALES) {
            const tag = toRegionalLocaleTag({ locale });
            // `es_AR` is the og:locale form and is NOT valid in hreflang or
            // `<html lang>`; the base must still be the locale so the regional
            // tag and the generic one describe the same language.
            expect(tag).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
            expect(tag.split('-')[0]).toBe(locale);
        }
    });
});

describe('SEOHead emits regional hreflang ALONGSIDE the generic tags', () => {
    it('still emits the three generic tags and x-default', () => {
        expect(seoHeadSrc).toMatch(/hreflang="es"\s+href=\{esUrl\}/);
        expect(seoHeadSrc).toMatch(/hreflang="en"\s+href=\{enUrl\}/);
        expect(seoHeadSrc).toMatch(/hreflang="pt"\s+href=\{ptUrl\}/);
        expect(seoHeadSrc).toMatch(/hreflang="x-default"\s+href=\{esUrl\}/);
    });

    it('adds one regional alternate per locale, pointing at the same URL', () => {
        expect(seoHeadSrc).toMatch(/hreflang=\{REGIONAL_LOCALE_TAGS\.es\}\s+href=\{esUrl\}/);
        expect(seoHeadSrc).toMatch(/hreflang=\{REGIONAL_LOCALE_TAGS\.en\}\s+href=\{enUrl\}/);
        expect(seoHeadSrc).toMatch(/hreflang=\{REGIONAL_LOCALE_TAGS\.pt\}\s+href=\{ptUrl\}/);
    });

    it('never hard-codes a regional tag as an hreflang literal', () => {
        // A literal would be a second copy of the map, free to drift from the
        // one `<html lang>` and og:locale are built from.
        for (const locale of SUPPORTED_LOCALES) {
            const tag = toRegionalLocaleTag({ locale });
            expect(seoHeadSrc).not.toContain(`hreflang="${tag}"`);
        }
    });

    it('derives og:locale from the same map instead of restating it', () => {
        expect(seoHeadSrc).toMatch(/REGIONAL_LOCALE_TAGS\.es\.replace\('-', '_'\)/);
        expect(seoHeadSrc).not.toContain("'es_AR'");
    });
});

describe('layouts declare the region on <html lang> without losing the locale', () => {
    it.each(LAYOUTS)('%s emits a regional lang and a bare data-locale', (layout) => {
        const src = readFileSync(resolve(WEB_SRC, layout), 'utf8');

        expect(src).toMatch(/<html lang=\{toRegionalLocaleTag\(\{ locale \}\)\}/);
        // The bare locale must survive as its own attribute: it is the route
        // segment, and `/es-AR/...` is not a route (see the
        // locale-segment-not-from-lang guard).
        expect(src).toMatch(/data-locale=\{locale\}/);
    });
});
