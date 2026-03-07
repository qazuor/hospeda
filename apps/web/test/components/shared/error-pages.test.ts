/**
 * @file error-pages.test.ts
 * @description Source-level tests for 404.astro and 500.astro.
 *
 * Astro components cannot be rendered in jsdom (no Astro runtime in Vitest).
 * Following the established pattern in this codebase, tests assert on the
 * source file contents to verify structure, translations, accessibility
 * attributes, icons, and i18n logic.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page404Src = readFileSync(resolve(__dirname, '../../../src/pages/404.astro'), 'utf8');

const page500Src = readFileSync(resolve(__dirname, '../../../src/pages/500.astro'), 'utf8');

// ────────────────────────────────────────────────────────────
// 404 page
// ────────────────────────────────────────────────────────────

describe('404.astro', () => {
    describe('Exports and directives', () => {
        it('should export prerender = false for SSR locale detection', () => {
            expect(page404Src).toContain('export const prerender = false');
        });
    });

    describe('i18n / locale detection', () => {
        it('should import isValidLocale and parseAcceptLanguage from lib/i18n', () => {
            expect(page404Src).toContain('isValidLocale');
            expect(page404Src).toContain('parseAcceptLanguage');
        });

        it('should detect locale from URL path first segment', () => {
            expect(page404Src).toContain('pathSegments[0]');
            expect(page404Src).toContain('isValidLocale');
        });

        it('should fall back to Accept-Language header', () => {
            expect(page404Src).toContain("Astro.request.headers.get('accept-language')");
        });

        it('should use createT to create the translation function', () => {
            expect(page404Src).toContain('createT(locale)');
        });
    });

    describe('Translation keys', () => {
        it('should translate the page title', () => {
            expect(page404Src).toContain("t('error.404.title'");
        });

        it('should translate the heading', () => {
            expect(page404Src).toContain("t('error.404.heading'");
        });

        it('should translate the body message', () => {
            expect(page404Src).toContain("t('error.404.message'");
        });

        it('should translate the go-home link label', () => {
            expect(page404Src).toContain("t('error.404.goHome'");
        });
    });

    describe('Layout and SEO', () => {
        it('should use BaseLayout', () => {
            expect(page404Src).toContain('BaseLayout');
        });

        it('should include SEOHead with noindex=true', () => {
            expect(page404Src).toContain('SEOHead');
            expect(page404Src).toContain('noindex={true}');
        });

        it('should pass the locale to SEOHead', () => {
            expect(page404Src).toContain('locale={locale}');
        });
    });

    describe('Markup and icons', () => {
        it('should render a decorative "404" text', () => {
            expect(page404Src).toContain('404');
        });

        it('should use AlertTriangleIcon for the error icon', () => {
            expect(page404Src).toContain('AlertTriangleIcon');
        });

        it('should use HomeIcon for the home link', () => {
            expect(page404Src).toContain('HomeIcon');
        });

        it('should render an h1 heading element', () => {
            expect(page404Src).toMatch(/<h1[^>]*>/);
        });

        it('should render a home link using buildUrl', () => {
            expect(page404Src).toContain('buildUrl');
            expect(page404Src).toContain('href={homeUrl}');
        });

        it('should mark the decorative elements with aria-hidden', () => {
            expect(page404Src).toContain('aria-hidden="true"');
        });
    });

    describe('Canonical URL', () => {
        it('should compute canonical URL from Astro.site', () => {
            expect(page404Src).toContain('Astro.site');
            expect(page404Src).toContain('canonicalUrl');
        });
    });
});

// ────────────────────────────────────────────────────────────
// 500 page
// ────────────────────────────────────────────────────────────

describe('500.astro', () => {
    describe('Exports and directives', () => {
        it('should export prerender = false for SSR locale detection', () => {
            expect(page500Src).toContain('export const prerender = false');
        });
    });

    describe('i18n / locale detection', () => {
        it('should use isValidLocale for URL-based locale detection', () => {
            expect(page500Src).toContain('isValidLocale');
        });

        it('should fall back to Accept-Language header', () => {
            expect(page500Src).toContain("Astro.request.headers.get('accept-language')");
        });

        it('should use createT to create the translation function', () => {
            expect(page500Src).toContain('createT(locale)');
        });
    });

    describe('Translation keys', () => {
        it('should translate the page title', () => {
            expect(page500Src).toContain("t('error.500.title'");
        });

        it('should translate the heading', () => {
            expect(page500Src).toContain("t('error.500.heading'");
        });

        it('should translate the body message', () => {
            expect(page500Src).toContain("t('error.500.message'");
        });

        it('should translate the retry label', () => {
            expect(page500Src).toContain("t('error.500.retry'");
        });

        it('should translate the go-home label', () => {
            expect(page500Src).toContain("t('error.500.goHome'");
        });
    });

    describe('Layout and SEO', () => {
        it('should use BaseLayout', () => {
            expect(page500Src).toContain('BaseLayout');
        });

        it('should include SEOHead with noindex=true', () => {
            expect(page500Src).toContain('SEOHead');
            expect(page500Src).toContain('noindex={true}');
        });
    });

    describe('Markup and icons', () => {
        it('should render a decorative "500" text', () => {
            expect(page500Src).toContain('500');
        });

        it('should use AlertTriangleIcon for the error icon', () => {
            expect(page500Src).toContain('AlertTriangleIcon');
        });

        it('should use RefreshIcon for the retry button', () => {
            expect(page500Src).toContain('RefreshIcon');
        });

        it('should use HomeIcon for the home link', () => {
            expect(page500Src).toContain('HomeIcon');
        });

        it('should render an h1 heading element', () => {
            expect(page500Src).toMatch(/<h1[^>]*>/);
        });

        it('should have a retry button that calls window.location.reload()', () => {
            expect(page500Src).toContain('window.location.reload()');
        });

        it('should render a home link using buildUrl', () => {
            expect(page500Src).toContain('buildUrl');
            expect(page500Src).toContain('href={homeUrl}');
        });

        it('should mark decorative elements with aria-hidden', () => {
            expect(page500Src).toContain('aria-hidden="true"');
        });
    });

    describe('Distinct from 404', () => {
        it('should use destructive color token (not accent) for the error icon', () => {
            // 404 uses text-accent, 500 uses text-destructive
            expect(page500Src).toContain('text-destructive');
        });

        it('should NOT use text-accent for the primary icon (404 pattern)', () => {
            // The 500 page should NOT be using the same accent styling as 404
            // The icon class should be text-destructive, not text-accent
            const iconLine = page500Src
                .split('\n')
                .find((line) => line.includes('AlertTriangleIcon') && line.includes('className'));
            if (iconLine) {
                expect(iconLine).toContain('text-destructive');
            }
        });
    });
});
