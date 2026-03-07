/**
 * @file trailing-slash.test.ts
 * @description Validates trailing-slash consistency across the web application.
 * Checks that:
 * - astro.config.mjs does NOT set trailingSlash to 'never' (config defers to
 *   the Vercel adapter which defaults to 'always' for SSR)
 * - The middleware enforces a trailing-slash redirect for paths without one
 * - buildUrl always produces URLs ending with /
 * - buildUrlWithParams always produces URLs where the path segment ends with /
 * - Internal links in key components end with /
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = resolve(__dirname, '../..');
const srcDir = resolve(rootDir, 'src');
const sharedDir = resolve(srcDir, 'components/shared');

const astroConfigContent = readFileSync(resolve(rootDir, 'astro.config.mjs'), 'utf8');
const urlsContent = readFileSync(resolve(srcDir, 'lib/urls.ts'), 'utf8');
const middlewareContent = readFileSync(resolve(srcDir, 'middleware.ts'), 'utf8');
const accommodationCard = readFileSync(resolve(sharedDir, 'AccommodationCard.astro'), 'utf8');
const destinationCard = readFileSync(resolve(sharedDir, 'DestinationCard.astro'), 'utf8');

// ---------------------------------------------------------------------------
// Import buildUrl so we can exercise it directly (pure function - no Astro runtime)
// ---------------------------------------------------------------------------
import { buildUrl, buildUrlWithParams } from '../../src/lib/urls';

// ---------------------------------------------------------------------------
// astro.config.mjs
// ---------------------------------------------------------------------------
describe('astro.config.mjs - trailing slash config', () => {
    it('should not set trailingSlash to "never"', () => {
        // The Vercel SSR adapter defaults to always appending trailing slashes.
        // Setting trailingSlash: 'never' would break locale routing.
        expect(astroConfigContent).not.toContain("trailingSlash: 'never'");
        expect(astroConfigContent).not.toContain('trailingSlash: "never"');
    });

    it('should not set trailingSlash to "ignore"', () => {
        // Ignoring trailing slashes would allow inconsistent URLs
        expect(astroConfigContent).not.toContain("trailingSlash: 'ignore'");
        expect(astroConfigContent).not.toContain('trailingSlash: "ignore"');
    });
});

// ---------------------------------------------------------------------------
// middleware.ts - trailing slash enforcement
// ---------------------------------------------------------------------------
describe('middleware.ts - trailing slash enforcement', () => {
    it('should contain logic to enforce trailing slashes on incoming paths', () => {
        // The middleware redirects paths without trailing slashes to avoid
        // Astro throwing errors with trailingSlash: 'always'
        expect(middlewareContent).toContain("!path.endsWith('/')");
    });

    it('should issue a 301 redirect for paths missing a trailing slash', () => {
        expect(middlewareContent).toContain('301');
        expect(middlewareContent).toContain('redirect');
    });

    it('should append / to the path in the redirect URL', () => {
        // The redirect target must include the trailing slash
        expect(middlewareContent).toContain('`${path}/');
    });

    it('should preserve query parameters when redirecting', () => {
        // Search params must not be lost during the trailing-slash redirect
        expect(middlewareContent).toContain('context.url.search');
    });

    it('should skip the redirect for the root path /', () => {
        // The root / already ends with /, so the check must exclude it
        expect(middlewareContent).toContain("path !== '/'");
    });
});

// ---------------------------------------------------------------------------
// src/lib/urls.ts - buildUrl implementation
// ---------------------------------------------------------------------------
describe('urls.ts - buildUrl implementation', () => {
    it('should export buildUrl as a named export', () => {
        expect(urlsContent).toContain('export function buildUrl');
    });

    it('should export buildUrlWithParams as a named export', () => {
        expect(urlsContent).toContain('export function buildUrlWithParams');
    });

    it('should document the trailing slash guarantee in JSDoc', () => {
        expect(urlsContent).toContain('trailing slash');
    });

    it('should normalise paths that do not start with /', () => {
        // The implementation prepends / when the path does not already start with one
        expect(urlsContent).toContain("path.startsWith('/')");
    });

    it('should normalise paths that do not end with /', () => {
        expect(urlsContent).toContain("normalized.endsWith('/')");
    });
});

// ---------------------------------------------------------------------------
// buildUrl - runtime behaviour
// ---------------------------------------------------------------------------
describe('buildUrl - runtime output', () => {
    it('should return / terminated URL for a simple path', () => {
        // Arrange
        const locale = 'es' as const;
        const path = 'alojamientos';

        // Act
        const result = buildUrl({ locale, path });

        // Assert
        expect(result).toBe('/es/alojamientos/');
        expect(result.endsWith('/')).toBe(true);
    });

    it('should return / terminated URL for nested path', () => {
        const result = buildUrl({ locale: 'es', path: 'mi-cuenta/editar' });
        expect(result).toBe('/es/mi-cuenta/editar/');
        expect(result.endsWith('/')).toBe(true);
    });

    it('should return locale root URL when path is empty', () => {
        const result = buildUrl({ locale: 'en' });
        expect(result).toBe('/en/');
        expect(result.endsWith('/')).toBe(true);
    });

    it('should not double-add a trailing slash when path already ends with /', () => {
        const result = buildUrl({ locale: 'pt', path: 'destinos/' });
        expect(result).toBe('/pt/destinos/');
        expect(result.endsWith('/')).toBe(true);
    });

    it('should not add a leading double slash when path starts with /', () => {
        const result = buildUrl({ locale: 'es', path: '/eventos' });
        expect(result).toBe('/es/eventos/');
        expect(result.endsWith('/')).toBe(true);
    });

    it('should work for all supported locales', () => {
        for (const locale of ['es', 'en', 'pt'] as const) {
            const result = buildUrl({ locale, path: 'contacto' });
            expect(result).toBe(`/${locale}/contacto/`);
        }
    });
});

// ---------------------------------------------------------------------------
// buildUrlWithParams - runtime behaviour
// ---------------------------------------------------------------------------
describe('buildUrlWithParams - runtime output', () => {
    it('should append query params after the trailing slash', () => {
        // Arrange
        const result = buildUrlWithParams({
            locale: 'es',
            path: 'busqueda',
            params: { q: 'hotel' }
        });

        // Act + Assert: path segment must end with / before ?
        expect(result).toMatch(/\/es\/busqueda\/\?q=hotel/);
    });

    it('should return a plain trailing-slash URL when params is empty', () => {
        const result = buildUrlWithParams({
            locale: 'es',
            path: 'destinos',
            params: {}
        });
        expect(result).toBe('/es/destinos/');
        expect(result.endsWith('/')).toBe(true);
    });

    it('should encode multiple params in the query string', () => {
        const result = buildUrlWithParams({
            locale: 'en',
            path: 'busqueda',
            params: { q: 'playa', page: '2' }
        });
        expect(result).toContain('/en/busqueda/?');
        expect(result).toContain('q=playa');
        expect(result).toContain('page=2');
    });
});

// ---------------------------------------------------------------------------
// Internal links in card components end with /
// ---------------------------------------------------------------------------
describe('AccommodationCard.astro - internal links', () => {
    it('should build accommodation detail link with trailing slash', () => {
        // The href template literal must end with /
        expect(accommodationCard).toContain('/${locale}/alojamientos/${card.slug}/');
    });
});

describe('DestinationCard.astro - internal links', () => {
    it('should build destination detail link with trailing slash', () => {
        expect(destinationCard).toContain('/${locale}/destinos/${card.slug}/');
    });
});
