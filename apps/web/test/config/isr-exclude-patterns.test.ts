/**
 * @fileoverview
 * Tests the ISR exclude regex patterns from astro.config.mjs.
 *
 * These patterns determine which URL paths are excluded from Vercel ISR
 * caching (i.e., always SSR'd on every request). Getting these wrong means
 * either caching auth-dependent pages (security issue) or failing to cache
 * public content pages (performance issue).
 *
 * The patterns are duplicated here (not imported) because astro.config.mjs
 * is a plain .mjs file that cannot be imported in Vitest without the full
 * Astro config pipeline. If the patterns in astro.config.mjs change, these
 * tests MUST be updated to match.
 *
 * @module test/config/isr-exclude-patterns
 */

import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// ISR exclude patterns — duplicated from astro.config.mjs
// These must be kept in sync with the actual config.
// ---------------------------------------------------------------------------

const ISR_EXCLUDE_PATTERNS: readonly RegExp[] = [
    /^(\/(?:en|pt))?\/mi-cuenta(\/.*)?$/,
    /^(\/(?:en|pt))?\/auth(\/.*)?$/,
    /^(\/(?:en|pt))?\/busqueda(\/.*)?$/,
    /^(\/(?:en|pt))?\/feedback(\/.*)?$/,
    /^(\/(?:en|pt))?\/alojamientos\/(.*)\/?$/,
    /^(\/(?:en|pt))?\/eventos\/(.*)\/?$/,
    /^(\/(?:en|pt))?\/alojamientos\/tipo(\/.*)?$/,
    /^(\/(?:en|pt))?\/eventos\/categoria(\/.*)?$/
];

/**
 * Returns true if any ISR exclude pattern matches the given path.
 */
function isExcludedFromISR(path: string): boolean {
    return ISR_EXCLUDE_PATTERNS.some((pattern) => pattern.test(path));
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ISR exclude patterns', () => {
    // -----------------------------------------------------------------
    // Paths that SHOULD be excluded from ISR (always SSR)
    // -----------------------------------------------------------------

    describe('pages excluded from ISR cache (always SSR)', () => {
        const excludedPaths = [
            // mi-cuenta (account pages — auth-dependent)
            '/mi-cuenta/',
            '/mi-cuenta/settings/',
            '/en/mi-cuenta/',
            '/pt/mi-cuenta/',
            '/en/mi-cuenta/settings/',
            '/pt/mi-cuenta/reservas/',

            // auth pages
            '/auth/login',
            '/auth/signin',
            '/en/auth/forgot-password',
            '/pt/auth/signup',

            // search (dynamic, not cacheable)
            '/busqueda/',
            '/en/busqueda/',
            '/pt/busqueda/?q=hotel',

            // feedback (dynamic form)
            '/feedback/',
            '/en/feedback/',

            // accommodation pages (index + detail + type filter)
            // The regex /\/alojamientos\/(.*)\/?$/ matches any path with
            // /alojamientos/ followed by anything (including empty string)
            '/alojamientos/',
            '/en/alojamientos/',
            '/alojamientos/hotel-paradise/',
            '/en/alojamientos/hotel-paradise/',
            '/pt/alojamientos/cabana-rio/',

            // event pages (index + detail + category filter)
            '/eventos/',
            '/en/eventos/',
            '/eventos/fiesta-de-la-playa/',
            '/en/eventos/festival-litoral/',

            // accommodation type filter pages
            '/alojamientos/tipo/cabanas/',
            '/en/alojamientos/tipo/hoteles/',
            '/pt/alojamientos/tipo/departamentos/',

            // event category filter pages
            '/eventos/categoria/musica/',
            '/en/eventos/categoria/gastronomia/',
            '/pt/eventos/categoria/deportes/'
        ] as const;

        it.each(excludedPaths)('excludes %s from ISR cache', (path) => {
            expect(isExcludedFromISR(path)).toBe(true);
        });
    });

    // -----------------------------------------------------------------
    // Paths that should NOT be excluded (ISR cached)
    // -----------------------------------------------------------------

    describe('pages included in ISR cache (static + on-demand revalidation)', () => {
        const cachedPaths = [
            // homepage
            '/',
            '/en/',
            '/pt/',

            // destination pages
            '/destinos/',
            '/destinos/concepcion/',
            '/en/destinos/',
            '/en/destinos/litoral/',

            // publication/blog pages
            '/publicaciones/',
            '/publicaciones/mi-articulo/',
            '/en/publicaciones/my-article/',

            // static pages
            '/contacto/',
            '/quienes-somos/',
            '/privacidad/',
            '/terminos-condiciones/',
            '/mapa-del-sitio/',
            '/beneficios/',

            // pricing pages
            '/precios/turistas/',
            '/precios/propietarios/',
            '/en/precios/turistas/',

            // propietarios landing
            '/propietarios/',
            '/en/propietarios/'
        ] as const;

        it.each(cachedPaths)('does NOT exclude %s (ISR cached)', (path) => {
            expect(isExcludedFromISR(path)).toBe(false);
        });
    });

    // -----------------------------------------------------------------
    // Pattern correctness — locale prefix handling
    // -----------------------------------------------------------------

    describe('locale prefix handling', () => {
        it('matches paths without locale prefix (default es)', () => {
            expect(isExcludedFromISR('/mi-cuenta/')).toBe(true);
            expect(isExcludedFromISR('/auth/login')).toBe(true);
        });

        it('matches paths with /en/ prefix', () => {
            expect(isExcludedFromISR('/en/mi-cuenta/')).toBe(true);
            expect(isExcludedFromISR('/en/auth/signup')).toBe(true);
        });

        it('matches paths with /pt/ prefix', () => {
            expect(isExcludedFromISR('/pt/mi-cuenta/')).toBe(true);
            expect(isExcludedFromISR('/pt/auth/login')).toBe(true);
        });

        it('does NOT match paths with /es/ prefix (es is default, no prefix)', () => {
            // In Astro config, es is the default locale and has no URL prefix.
            // The patterns only handle /en/ and /pt/.
            expect(isExcludedFromISR('/es/mi-cuenta/')).toBe(false);
        });

        it('does NOT match paths with unsupported locale prefix', () => {
            expect(isExcludedFromISR('/fr/mi-cuenta/')).toBe(false);
            expect(isExcludedFromISR('/de/auth/login')).toBe(false);
        });
    });

    // -----------------------------------------------------------------
    // Edge cases
    // -----------------------------------------------------------------

    describe('edge cases', () => {
        it('total number of exclude patterns matches astro.config.mjs (8 patterns)', () => {
            expect(ISR_EXCLUDE_PATTERNS).toHaveLength(8);
        });

        it('all patterns are valid RegExp instances', () => {
            for (const pattern of ISR_EXCLUDE_PATTERNS) {
                expect(pattern).toBeInstanceOf(RegExp);
            }
        });
    });
});
