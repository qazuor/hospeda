/**
 * @fileoverview
 * Unit tests for the ISR exclude regex in astro.config.mjs.
 *
 * The regex is: /^(\/(?:en|pt))?\/(auth|mi-cuenta|busqueda|feedback)(\/.*)?$/
 *
 * SSR-only routes (must match — excluded from ISR):
 *   /auth/*, /mi-cuenta/*, /busqueda/*, /feedback/*
 *   and their locale-prefixed variants /en/* and /pt/*
 *
 * ISR-cached routes (must NOT match):
 *   /alojamientos/, /alojamientos/tipo/cabin/, /destinos/, /eventos/, /publicaciones/
 *   and their locale-prefixed variants
 */

import { describe, expect, it } from 'vitest';

/**
 * The consolidated ISR exclude regex — kept in sync with astro.config.mjs.
 * We test the regex directly here so tests remain fast and dependency-free.
 */
const ISR_EXCLUDE_REGEX = /^(\/(?:en|pt))?\/(auth|mi-cuenta|busqueda|feedback)(\/.*)?$/;

// ---------------------------------------------------------------------------
// Paths that MUST be excluded from ISR (SSR-only routes)
// ---------------------------------------------------------------------------

describe('ISR exclude regex — paths that must be excluded (SSR-only)', () => {
    const ssrPaths = [
        // auth — no locale prefix (es)
        '/auth/',
        '/auth/signin/',
        '/auth/signup/',
        '/auth/signout/',
        // auth — en
        '/en/auth/',
        '/en/auth/signin/',
        // auth — pt
        '/pt/auth/',
        '/pt/auth/signup/',
        // mi-cuenta — es
        '/mi-cuenta/',
        '/mi-cuenta/perfil/',
        '/mi-cuenta/favoritos/',
        '/mi-cuenta/reservas/',
        // mi-cuenta — en
        '/en/mi-cuenta/',
        '/en/mi-cuenta/perfil/',
        // mi-cuenta — pt
        '/pt/mi-cuenta/',
        // busqueda — es
        '/busqueda/',
        '/busqueda/resultados/',
        // busqueda — en/pt
        '/en/busqueda/',
        '/pt/busqueda/',
        // feedback — es
        '/feedback/',
        '/feedback/gracias/',
        // feedback — en/pt
        '/en/feedback/',
        '/pt/feedback/',
        '/pt/feedback/gracias/'
    ];

    for (const path of ssrPaths) {
        it(`matches SSR path: ${path}`, () => {
            expect(ISR_EXCLUDE_REGEX.test(path)).toBe(true);
        });
    }
});

// ---------------------------------------------------------------------------
// Paths that must NOT be excluded (ISR-cached)
// ---------------------------------------------------------------------------

describe('ISR exclude regex — paths that must remain ISR-cached', () => {
    const isrPaths = [
        // Accommodation listing and sub-routes
        '/alojamientos/',
        '/alojamientos/tipo/cabin/',
        '/alojamientos/tipo/hotel/',
        '/alojamientos/tipo/apartment/',
        '/alojamientos/tipo/hostel/',
        '/alojamientos/tipo/camping/',
        '/alojamientos/tipo/room/',
        '/alojamientos/tipo/motel/',
        '/alojamientos/tipo/resort/',
        '/alojamientos/tipo/house/',
        '/alojamientos/tipo/country-house/',
        '/alojamientos/comodidades/wifi/',
        '/alojamientos/caracteristicas/vista-al-mar/',
        '/alojamientos/hotel-las-palmeras/',
        // Locale-prefixed ISR paths
        '/en/alojamientos/',
        '/en/alojamientos/tipo/cabin/',
        '/pt/alojamientos/tipo/resort/',
        // Destinations
        '/destinos/',
        '/destinos/concordia/',
        '/en/destinos/',
        '/pt/destinos/gualeguaychu/',
        // Events
        '/eventos/',
        '/eventos/categoria/festival/',
        '/en/eventos/categoria/music/',
        // Posts
        '/publicaciones/',
        '/publicaciones/mi-articulo/',
        '/en/publicaciones/',
        // Other public routes
        '/nosotros/',
        '/contacto/',
        '/suscriptores/',
        '/suscriptores/precios/',
        '/',
        '/es/',
        '/en/',
        '/pt/'
    ];

    for (const path of isrPaths) {
        it(`does NOT match ISR path: ${path}`, () => {
            expect(ISR_EXCLUDE_REGEX.test(path)).toBe(false);
        });
    }
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('ISR exclude regex — edge cases', () => {
    it('does not match paths that merely contain an excluded segment word mid-path', () => {
        // e.g. a hypothetical /mi-cuenta-publica/ should NOT match
        expect(ISR_EXCLUDE_REGEX.test('/mi-cuenta-publica/')).toBe(false);
    });

    it('does not match /es/ prefixed paths (es has no prefix in URL)', () => {
        // Spanish locale has no prefix in the URL scheme
        expect(ISR_EXCLUDE_REGEX.test('/es/auth/')).toBe(false);
        expect(ISR_EXCLUDE_REGEX.test('/es/mi-cuenta/')).toBe(false);
    });

    it('matches /auth with no trailing slash (trailing group is optional in the regex)', () => {
        // The web app enforces trailing slashes in practice, but the regex
        // also covers the bare segment (no trailing slash) since (\/.*)?$ is optional.
        expect(ISR_EXCLUDE_REGEX.test('/auth')).toBe(true);
    });

    it('matches /busqueda with no trailing content', () => {
        // Route without trailing slash — regex still matches since trailing group is optional
        expect(ISR_EXCLUDE_REGEX.test('/busqueda')).toBe(true);
    });

    it('matches /feedback with sub-path', () => {
        expect(ISR_EXCLUDE_REGEX.test('/feedback/enviado/')).toBe(true);
    });
});
