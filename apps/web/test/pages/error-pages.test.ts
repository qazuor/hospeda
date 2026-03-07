/**
 * @file error-pages.test.ts
 * @description Source-content tests for 404 and 500 error pages.
 *
 * Both pages are SSR-only (prerender = false) so Astro can read request
 * headers at runtime to detect the visitor's locale.  These tests validate
 * the page source for correct structure, i18n usage, accessible markup,
 * navigation links, and semantic HTML patterns.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Source files under test
// ---------------------------------------------------------------------------

const page404Src = readFileSync(resolve(__dirname, '../../src/pages/404.astro'), 'utf8');

const page500Src = readFileSync(resolve(__dirname, '../../src/pages/500.astro'), 'utf8');

// ---------------------------------------------------------------------------
// Shared assertions — applied to both error pages
// ---------------------------------------------------------------------------

function describeErrorPage(label: string, src: string): void {
    describe(`${label} — shared structure`, () => {
        it('is SSR-only (prerender = false)', () => {
            // Error pages must be server-rendered so they can read Accept-Language
            expect(src).toContain('export const prerender = false');
        });

        it('imports BaseLayout', () => {
            expect(src).toContain('import BaseLayout from');
        });

        it('imports SEOHead', () => {
            expect(src).toContain('import SEOHead from');
        });

        it('uses SEOHead with noindex to prevent indexing', () => {
            expect(src).toContain('noindex={true}');
        });

        it('passes canonical URL to SEOHead', () => {
            expect(src).toContain('canonical={canonicalUrl}');
        });

        it('passes locale to SEOHead', () => {
            expect(src).toContain('locale={locale}');
        });

        it('uses DEFAULT_LOCALE as fallback locale', () => {
            expect(src).toContain('DEFAULT_LOCALE');
        });

        it('detects locale from URL path segments', () => {
            expect(src).toContain('pathSegments');
            expect(src).toContain('firstSegment');
            expect(src).toContain('isValidLocale');
        });

        it('falls back to Accept-Language header when URL has no locale', () => {
            expect(src).toContain('parseAcceptLanguage');
            expect(src).toContain('accept-language');
        });

        it('uses createT for i18n translations', () => {
            expect(src).toContain('createT(locale)');
        });

        it('builds canonical URL from Astro.site', () => {
            expect(src).toContain('new URL(Astro.url.pathname, Astro.site)');
        });

        it('uses buildUrl for the home link href', () => {
            expect(src).toContain('buildUrl({ locale })');
        });

        it('renders an h1 heading', () => {
            expect(src).toContain('<h1');
        });

        it('renders a descriptive paragraph message', () => {
            expect(src).toContain('<p');
            expect(src).toContain('{message}');
        });

        it('has a link back to the homepage', () => {
            expect(src).toContain('href={homeUrl}');
        });

        it('marks decorative SVG illustration as aria-hidden', () => {
            // Decorative elements must be hidden from screen readers
            expect(src).toContain('aria-hidden="true"');
        });

        it('hides the decorative error code from screen readers', () => {
            // The large "404" or "500" display text is purely decorative
            const ariaHiddenCount = (src.match(/aria-hidden="true"/g) ?? []).length;
            expect(ariaHiddenCount).toBeGreaterThanOrEqual(2);
        });

        it('icons used inside interactive elements have aria-hidden', () => {
            // Icons next to button/link labels must be hidden to avoid duplication
            expect(src).toContain('aria-hidden="true"');
        });

        it('uses focus-visible styles on interactive links', () => {
            expect(src).toContain('focus-visible:outline');
        });

        it('uses semantic color tokens (no hardcoded colors)', () => {
            expect(src).not.toContain('bg-white');
            expect(src).not.toContain('text-gray-');
            expect(src).not.toContain('bg-blue-');
        });

        it('wraps content inside BaseLayout', () => {
            expect(src).toContain('<BaseLayout');
            expect(src).toContain('</BaseLayout>');
        });
    });
}

// Run shared assertions for both error pages
describeErrorPage('404.astro', page404Src);
describeErrorPage('500.astro', page500Src);

// ---------------------------------------------------------------------------
// 404 page — specific assertions
// ---------------------------------------------------------------------------

describe('404.astro — not found page', () => {
    it('uses the error.404 i18n namespace for all strings', () => {
        expect(page404Src).toContain("'error.404.title'");
        expect(page404Src).toContain("'error.404.heading'");
        expect(page404Src).toContain("'error.404.message'");
        expect(page404Src).toContain("'error.404.goHome'");
    });

    it('provides a Spanish fallback for the page title', () => {
        expect(page404Src).toContain("'Pagina no encontrada'");
    });

    it('provides a Spanish fallback for the description', () => {
        expect(page404Src).toContain("'La pagina que buscas no existe o fue movida.'");
    });

    it('provides a Spanish fallback for the heading', () => {
        expect(page404Src).toContain("'Pagina no encontrada'");
    });

    it('provides a Spanish fallback for the error message', () => {
        expect(page404Src).toContain("'Lo sentimos, no pudimos encontrar la pagina que buscas.");
    });

    it('provides a Spanish fallback for the home button label', () => {
        expect(page404Src).toContain("'Volver al inicio'");
    });

    it('imports AlertTriangleIcon and HomeIcon from @repo/icons', () => {
        expect(page404Src).toContain('AlertTriangleIcon');
        expect(page404Src).toContain('HomeIcon');
        expect(page404Src).toContain("from '@repo/icons'");
    });

    it('renders only one navigation link (home)', () => {
        // 404 has a single CTA: go home
        const hrefCount = (page404Src.match(/href=\{homeUrl\}/g) ?? []).length;
        expect(hrefCount).toBe(1);
    });

    it('uses heading level h1 for the error heading', () => {
        expect(page404Src).toContain('<h1 ');
        expect(page404Src).toContain('{heading}');
    });

    it('renders an inline SVG illustration (river / map-pin theme)', () => {
        expect(page404Src).toContain('<svg');
        expect(page404Src).toContain('viewBox');
    });

    it('sets the open graph type to website', () => {
        expect(page404Src).toContain('type="website"');
    });
});

// ---------------------------------------------------------------------------
// 500 page — specific assertions
// ---------------------------------------------------------------------------

describe('500.astro — internal server error page', () => {
    it('uses the error.500 i18n namespace for all strings', () => {
        expect(page500Src).toContain("'error.500.title'");
        expect(page500Src).toContain("'error.500.heading'");
        expect(page500Src).toContain("'error.500.message'");
        expect(page500Src).toContain("'error.500.retry'");
        expect(page500Src).toContain("'error.500.goHome'");
        expect(page500Src).toContain("'error.500.report'");
    });

    it('provides a Spanish fallback for the page title', () => {
        expect(page500Src).toContain("'Error del servidor'");
    });

    it('provides a Spanish fallback for the heading', () => {
        expect(page500Src).toContain("'Algo salio mal'");
    });

    it('provides a Spanish fallback for the error message', () => {
        expect(page500Src).toContain("'Ocurrio un error inesperado en el servidor.");
    });

    it('provides a Spanish fallback for the retry label', () => {
        expect(page500Src).toContain("'Intentar de nuevo'");
    });

    it('provides a Spanish fallback for the report label', () => {
        expect(page500Src).toContain("'Reportar este error'");
    });

    it('imports AlertTriangleIcon, HomeIcon, RefreshIcon, DebugIcon from @repo/icons', () => {
        expect(page500Src).toContain('AlertTriangleIcon');
        expect(page500Src).toContain('HomeIcon');
        expect(page500Src).toContain('RefreshIcon');
        expect(page500Src).toContain('DebugIcon');
        expect(page500Src).toContain("from '@repo/icons'");
    });

    it('has a retry button that reloads the page', () => {
        expect(page500Src).toContain('window.location.reload()');
        expect(page500Src).toContain('type="button"');
    });

    it('has a home link CTA', () => {
        expect(page500Src).toContain('href={homeUrl}');
    });

    it('builds a feedback URL with bug type and source params', () => {
        expect(page500Src).toContain('feedbackUrl');
        expect(page500Src).toContain('type=bug-js');
        expect(page500Src).toContain('source=web');
    });

    it('has a report error link pointing to feedbackUrl', () => {
        expect(page500Src).toContain('href={feedbackUrl}');
    });

    it('renders three action items (retry button, report link, home link)', () => {
        // Arrange: count anchor/button interactive elements in action area
        const buttonCount = (page500Src.match(/<button/g) ?? []).length;
        const anchorCount = (page500Src.match(/href=\{/g) ?? []).length;
        // At minimum 1 button (retry) and 2 links (report + home)
        expect(buttonCount).toBeGreaterThanOrEqual(1);
        expect(anchorCount).toBeGreaterThanOrEqual(2);
    });

    it('renders an inline SVG illustration (storm / broken bridge theme)', () => {
        expect(page500Src).toContain('<svg');
        expect(page500Src).toContain('viewBox');
    });

    it('uses destructive color token for the error code display', () => {
        expect(page500Src).toContain('text-destructive');
    });

    it('sets the open graph type to website', () => {
        expect(page500Src).toContain('type="website"');
    });
});
