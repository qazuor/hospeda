/**
 * @fileoverview
 * Unit tests for getAffectedPaths — the pure function that maps entity change events
 * to the set of URL paths that need ISR revalidation.
 *
 * Covers all EntityChangeData variants with the new discriminated-union API:
 *  - accommodation (with/without slug, accommodationType, destinationSlug)
 *  - destination (with/without slug)
 *  - event (with/without slug, category)
 *  - post (with/without slug, tagSlugs)
 *  - accommodation_review (with/without accommodationSlug)
 *  - destination_review (with/without destinationSlug)
 *  - tag
 *  - amenity
 *
 * Also covers locale handling and deduplication.
 */

import { describe, expect, it } from 'vitest';
import {
    ACCOMMODATION_TYPE_SLUGS,
    EVENT_CATEGORY_SLUGS,
    getAffectedPaths
} from '../../src/revalidation/entity-path-mapper.js';

// ---------------------------------------------------------------------------
// accommodation
// ---------------------------------------------------------------------------

describe('getAffectedPaths — accommodation', () => {
    it('always includes /alojamientos/ listing for all locales', () => {
        const paths = getAffectedPaths({ entityType: 'accommodation', slug: 'hotel-test' });
        expect(paths).toContain('/alojamientos/');
        expect(paths).toContain('/en/alojamientos/');
        expect(paths).toContain('/pt/alojamientos/');
    });

    // SPEC-092 T-019: home page revalidation gap fix
    it('always includes home / for all locales (SPEC-092 T-018)', () => {
        const paths = getAffectedPaths({ entityType: 'accommodation', slug: 'hotel-test' });
        expect(paths).toContain('/');
        expect(paths).toContain('/en/');
        expect(paths).toContain('/pt/');
    });

    it('includes detail page for all locales when slug provided', () => {
        const paths = getAffectedPaths({ entityType: 'accommodation', slug: 'hotel-solanas' });
        expect(paths).toContain('/alojamientos/hotel-solanas/');
        expect(paths).toContain('/en/alojamientos/hotel-solanas/');
        expect(paths).toContain('/pt/alojamientos/hotel-solanas/');
    });

    it('includes listing but no detail page when slug is undefined', () => {
        const paths = getAffectedPaths({ entityType: 'accommodation' });
        expect(paths).toContain('/alojamientos/');
        // Detail page would be /alojamientos/<slug>/ (NOT under /tipo/)
        expect(
            paths.some(
                (p) => /^(\/[a-z]{2})?\/alojamientos\/[^/]+\/$/.test(p) && !p.includes('/tipo/')
            )
        ).toBe(false);
    });

    it('includes ALL type pages when no accommodationType provided', () => {
        const paths = getAffectedPaths({ entityType: 'accommodation', slug: 'hotel-test' });
        for (const slug of ACCOMMODATION_TYPE_SLUGS) {
            expect(paths).toContain(`/alojamientos/tipo/${slug}/`);
        }
    });

    it('includes ONLY the specific type page when accommodationType provided', () => {
        const paths = getAffectedPaths({
            entityType: 'accommodation',
            slug: 'cabana-del-rio',
            accommodationType: 'cabin'
        });
        expect(paths).toContain('/alojamientos/tipo/cabin/');
        // Should NOT include other type pages
        expect(paths.some((p) => p.includes('/alojamientos/tipo/hotel/'))).toBe(false);
        expect(paths.some((p) => p.includes('/alojamientos/tipo/hostel/'))).toBe(false);
    });

    it('includes type pages for all locales', () => {
        const paths = getAffectedPaths({ entityType: 'accommodation', slug: 'test' });
        expect(paths).toContain('/alojamientos/tipo/hotel/');
        expect(paths).toContain('/en/alojamientos/tipo/hotel/');
        expect(paths).toContain('/pt/alojamientos/tipo/hotel/');
    });

    it('includes parent destination page when destinationSlug provided', () => {
        const paths = getAffectedPaths({
            entityType: 'accommodation',
            slug: 'cabana-del-rio',
            destinationSlug: 'concordia'
        });
        expect(paths).toContain('/destinos/concordia/');
        expect(paths).toContain('/en/destinos/concordia/');
        expect(paths).toContain('/pt/destinos/concordia/');
    });

    it('does not include destination page when destinationSlug not provided', () => {
        const paths = getAffectedPaths({ entityType: 'accommodation', slug: 'hotel-test' });
        expect(paths.some((p) => p.includes('/destinos/'))).toBe(false);
    });

    it('combines slug + accommodationType + destinationSlug correctly', () => {
        const paths = getAffectedPaths({
            entityType: 'accommodation',
            slug: 'posada-sol',
            accommodationType: 'posada',
            destinationSlug: 'gualeguaychu'
        });
        expect(paths).toContain('/alojamientos/');
        expect(paths).toContain('/alojamientos/posada-sol/');
        expect(paths).toContain('/alojamientos/tipo/posada/');
        expect(paths).toContain('/destinos/gualeguaychu/');
        // Must not include other type pages
        expect(paths.some((p) => p.includes('/alojamientos/tipo/hotel/'))).toBe(false);
    });

    it('URL slugs match AccommodationTypeEnum (all 13: apartment, house, country-house, cabin, hotel, hostel, camping, room, motel, resort, apart-hotel, estancia, bed-and-breakfast)', () => {
        const paths = getAffectedPaths({ entityType: 'accommodation' });
        // Original 10 types
        expect(paths).toContain('/alojamientos/tipo/apartment/');
        expect(paths).toContain('/alojamientos/tipo/house/');
        expect(paths).toContain('/alojamientos/tipo/country-house/');
        expect(paths).toContain('/alojamientos/tipo/cabin/');
        expect(paths).toContain('/alojamientos/tipo/hotel/');
        expect(paths).toContain('/alojamientos/tipo/hostel/');
        expect(paths).toContain('/alojamientos/tipo/camping/');
        expect(paths).toContain('/alojamientos/tipo/room/');
        expect(paths).toContain('/alojamientos/tipo/motel/');
        expect(paths).toContain('/alojamientos/tipo/resort/');
        // SPEC-213 additions (Bug B10 fix)
        expect(paths).toContain('/alojamientos/tipo/apart-hotel/');
        expect(paths).toContain('/alojamientos/tipo/estancia/');
        expect(paths).toContain('/alojamientos/tipo/bed-and-breakfast/');
        // Must NOT contain slugs not in the enum
        expect(paths.some((p) => p.includes('/tipo/posada/'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// destination
// ---------------------------------------------------------------------------

describe('getAffectedPaths — destination', () => {
    it('includes destination detail page when slug provided', () => {
        const paths = getAffectedPaths({ entityType: 'destination', slug: 'gualeguaychu' });
        expect(paths).toContain('/destinos/gualeguaychu/');
        expect(paths).toContain('/en/destinos/gualeguaychu/');
        expect(paths).toContain('/pt/destinos/gualeguaychu/');
    });

    // SPEC-092 T-019: home page revalidation gap fix
    it('always includes home / for all locales (SPEC-092 T-018)', () => {
        const paths = getAffectedPaths({ entityType: 'destination', slug: 'gualeguaychu' });
        expect(paths).toContain('/');
        expect(paths).toContain('/en/');
        expect(paths).toContain('/pt/');
    });

    it('always includes /destinos/ listing for all locales (SPEC-092 T-018)', () => {
        const paths = getAffectedPaths({ entityType: 'destination', slug: 'gualeguaychu' });
        expect(paths).toContain('/destinos/');
        expect(paths).toContain('/en/destinos/');
        expect(paths).toContain('/pt/destinos/');
    });

    it('always includes /alojamientos/ listing (destination info shown in accommodation cards)', () => {
        const paths = getAffectedPaths({ entityType: 'destination', slug: 'gualeguaychu' });
        expect(paths).toContain('/alojamientos/');
    });

    it('includes /alojamientos/ even without slug', () => {
        const paths = getAffectedPaths({ entityType: 'destination' });
        expect(paths).toContain('/alojamientos/');
    });

    it('does not include destination page when slug not provided', () => {
        const paths = getAffectedPaths({ entityType: 'destination' });
        expect(paths.some((p) => /\/destinos\/[a-z]/.test(p))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// event
// ---------------------------------------------------------------------------

describe('getAffectedPaths — event', () => {
    // SPEC-092 T-019: home page revalidation gap fix
    it('always includes home / for all locales (SPEC-092 T-018)', () => {
        const paths = getAffectedPaths({ entityType: 'event', slug: 'festival-2026' });
        expect(paths).toContain('/');
        expect(paths).toContain('/en/');
        expect(paths).toContain('/pt/');
    });

    it('always includes /eventos/ listing for all locales', () => {
        const paths = getAffectedPaths({ entityType: 'event', slug: 'festival-2026' });
        expect(paths).toContain('/eventos/');
        expect(paths).toContain('/en/eventos/');
        expect(paths).toContain('/pt/eventos/');
    });

    it('includes detail page when slug provided', () => {
        const paths = getAffectedPaths({ entityType: 'event', slug: 'festival-2026' });
        expect(paths).toContain('/eventos/festival-2026/');
        expect(paths).toContain('/en/eventos/festival-2026/');
        expect(paths).toContain('/pt/eventos/festival-2026/');
    });

    it('does not include detail page when slug not provided', () => {
        const paths = getAffectedPaths({ entityType: 'event' });
        expect(paths.some((p) => /\/eventos\/[a-z]/.test(p) && !p.includes('/categoria/'))).toBe(
            false
        );
    });

    it('includes ALL category pages when no category provided', () => {
        const paths = getAffectedPaths({ entityType: 'event' });
        for (const slug of EVENT_CATEGORY_SLUGS) {
            expect(paths).toContain(`/eventos/categoria/${slug}/`);
        }
    });

    it('includes ONLY the specific category page when category provided', () => {
        const paths = getAffectedPaths({ entityType: 'event', slug: 'fest', category: 'festival' });
        expect(paths).toContain('/eventos/categoria/festival/');
        expect(paths.some((p) => p.includes('/categoria/music/'))).toBe(false);
        expect(paths.some((p) => p.includes('/categoria/sports/'))).toBe(false);
    });

    it('category pages use correct EventCategoryEnum slugs (music, culture, sports, gastronomy, festival, nature, theater, workshop, other)', () => {
        const paths = getAffectedPaths({ entityType: 'event' });
        expect(paths).toContain('/eventos/categoria/music/');
        expect(paths).toContain('/eventos/categoria/culture/');
        expect(paths).toContain('/eventos/categoria/sports/');
        expect(paths).toContain('/eventos/categoria/gastronomy/');
        expect(paths).toContain('/eventos/categoria/festival/');
        expect(paths).toContain('/eventos/categoria/nature/');
        expect(paths).toContain('/eventos/categoria/theater/');
        expect(paths).toContain('/eventos/categoria/workshop/');
        expect(paths).toContain('/eventos/categoria/other/');
        // Must NOT contain removed stale slugs
        expect(paths.some((p) => p.includes('/categoria/fair/'))).toBe(false);
        expect(paths.some((p) => p.includes('/categoria/sport/'))).toBe(false);
        expect(paths.some((p) => p.includes('/categoria/cultural/'))).toBe(false);
    });

    it('category pages appear for all locales', () => {
        const paths = getAffectedPaths({ entityType: 'event' });
        expect(paths).toContain('/eventos/categoria/festival/');
        expect(paths).toContain('/en/eventos/categoria/festival/');
        expect(paths).toContain('/pt/eventos/categoria/festival/');
    });
});

// ---------------------------------------------------------------------------
// post
// ---------------------------------------------------------------------------

describe('getAffectedPaths — post', () => {
    // SPEC-092 T-019: home page revalidation gap fix
    it('always includes home / for all locales (SPEC-092 T-018)', () => {
        const paths = getAffectedPaths({ entityType: 'post', slug: 'mi-articulo' });
        expect(paths).toContain('/');
        expect(paths).toContain('/en/');
        expect(paths).toContain('/pt/');
    });

    it('always includes /publicaciones/ listing for all locales', () => {
        const paths = getAffectedPaths({ entityType: 'post', slug: 'mi-articulo' });
        expect(paths).toContain('/publicaciones/');
        expect(paths).toContain('/en/publicaciones/');
        expect(paths).toContain('/pt/publicaciones/');
    });

    it('includes listing even without slug', () => {
        const paths = getAffectedPaths({ entityType: 'post' });
        expect(paths).toContain('/publicaciones/');
    });

    it('includes detail page under /publicaciones/ (NOT /posts/) when slug provided', () => {
        const paths = getAffectedPaths({ entityType: 'post', slug: 'mi-articulo' });
        expect(paths).toContain('/publicaciones/mi-articulo/');
        expect(paths).toContain('/en/publicaciones/mi-articulo/');
        expect(paths).toContain('/pt/publicaciones/mi-articulo/');
        // Must NOT use /posts/
        expect(paths.some((p) => p.includes('/posts/'))).toBe(false);
    });

    it('does not include detail page when slug not provided', () => {
        const paths = getAffectedPaths({ entityType: 'post' });
        expect(paths.some((p) => /\/publicaciones\/[a-z]/.test(p))).toBe(false);
    });

    it('includes tag filter pages when tagSlugs provided', () => {
        const paths = getAffectedPaths({
            entityType: 'post',
            slug: 'mi-articulo',
            tagSlugs: ['turismo', 'gastronomia']
        });
        expect(paths).toContain('/publicaciones/etiqueta/turismo/');
        expect(paths).toContain('/publicaciones/etiqueta/gastronomia/');
        expect(paths).toContain('/en/publicaciones/etiqueta/turismo/');
        expect(paths).toContain('/pt/publicaciones/etiqueta/gastronomia/');
    });

    it('includes one tag filter page per tagSlug provided', () => {
        const paths = getAffectedPaths({
            entityType: 'post',
            tagSlugs: ['alpha', 'beta', 'gamma']
        });
        expect(paths).toContain('/publicaciones/etiqueta/alpha/');
        expect(paths).toContain('/publicaciones/etiqueta/beta/');
        expect(paths).toContain('/publicaciones/etiqueta/gamma/');
    });

    it('does not include tag pages when tagSlugs not provided', () => {
        const paths = getAffectedPaths({ entityType: 'post', slug: 'mi-articulo' });
        expect(paths.some((p) => p.includes('/etiqueta/'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// accommodation_review
// ---------------------------------------------------------------------------

describe('getAffectedPaths — accommodation_review', () => {
    it('includes parent accommodation detail page when accommodationSlug provided', () => {
        const paths = getAffectedPaths({
            entityType: 'accommodation_review',
            accommodationSlug: 'hotel-bar'
        });
        expect(paths).toContain('/alojamientos/hotel-bar/');
        expect(paths).toContain('/en/alojamientos/hotel-bar/');
        expect(paths).toContain('/pt/alojamientos/hotel-bar/');
    });

    it('always includes /alojamientos/ listing (aggregate ratings affect listing)', () => {
        const paths = getAffectedPaths({
            entityType: 'accommodation_review',
            accommodationSlug: 'hotel-bar'
        });
        expect(paths).toContain('/alojamientos/');
    });

    it('includes /alojamientos/ listing even without accommodationSlug', () => {
        const paths = getAffectedPaths({ entityType: 'accommodation_review' });
        expect(paths).toContain('/alojamientos/');
    });

    it('does not include detail page when accommodationSlug not provided', () => {
        const paths = getAffectedPaths({ entityType: 'accommodation_review' });
        expect(paths.some((p) => /\/alojamientos\/[a-z]/.test(p))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// destination_review
// ---------------------------------------------------------------------------

describe('getAffectedPaths — destination_review', () => {
    it('includes parent destination detail page when destinationSlug provided', () => {
        const paths = getAffectedPaths({
            entityType: 'destination_review',
            destinationSlug: 'concepcion'
        });
        expect(paths).toContain('/destinos/concepcion/');
        expect(paths).toContain('/en/destinos/concepcion/');
        expect(paths).toContain('/pt/destinos/concepcion/');
    });

    it('returns empty when destinationSlug not provided', () => {
        const paths = getAffectedPaths({ entityType: 'destination_review' });
        expect(paths).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// tag / amenity
// ---------------------------------------------------------------------------

describe('getAffectedPaths — tag and amenity', () => {
    it('tag includes /alojamientos/ listing for all locales', () => {
        const paths = getAffectedPaths({ entityType: 'tag' });
        expect(paths).toContain('/alojamientos/');
        expect(paths).toContain('/en/alojamientos/');
        expect(paths).toContain('/pt/alojamientos/');
    });

    it('amenity includes /alojamientos/ listing for all locales', () => {
        const paths = getAffectedPaths({ entityType: 'amenity' });
        expect(paths).toContain('/alojamientos/');
        expect(paths).toContain('/en/alojamientos/');
        expect(paths).toContain('/pt/alojamientos/');
    });

    it('tag does not include destination or event pages', () => {
        const paths = getAffectedPaths({ entityType: 'tag' });
        expect(paths.some((p) => p.includes('/destinos/'))).toBe(false);
        expect(paths.some((p) => p.includes('/eventos/'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// locale handling
// ---------------------------------------------------------------------------

describe('getAffectedPaths — locale handling', () => {
    it('respects single es locale — no locale prefix', () => {
        const paths = getAffectedPaths({ entityType: 'accommodation', slug: 'test' }, ['es']);
        expect(paths).toContain('/alojamientos/');
        expect(paths.some((p) => p.startsWith('/en/'))).toBe(false);
        expect(paths.some((p) => p.startsWith('/pt/'))).toBe(false);
    });

    it('prepends /en/ for en locale only', () => {
        const paths = getAffectedPaths({ entityType: 'accommodation', slug: 'test' }, ['en']);
        expect(paths).toContain('/en/alojamientos/');
        expect(paths.some((p) => p === '/alojamientos/')).toBe(false);
    });

    it('prepends /pt/ for pt locale only', () => {
        const paths = getAffectedPaths({ entityType: 'accommodation', slug: 'test' }, ['pt']);
        expect(paths).toContain('/pt/alojamientos/');
        expect(paths.some((p) => p === '/alojamientos/')).toBe(false);
    });

    it('handles multiple custom locales', () => {
        const paths = getAffectedPaths({ entityType: 'event' }, ['es', 'en']);
        expect(paths).toContain('/eventos/');
        expect(paths).toContain('/en/eventos/');
        expect(paths.some((p) => p.startsWith('/pt/'))).toBe(false);
    });

    it('handles all 3 default locales', () => {
        const paths = getAffectedPaths({ entityType: 'tag' });
        expect(paths).toContain('/alojamientos/');
        expect(paths).toContain('/en/alojamientos/');
        expect(paths).toContain('/pt/alojamientos/');
    });
});

// ---------------------------------------------------------------------------
// T-061: accommodation amenity + feature sub-routes
// ---------------------------------------------------------------------------

describe('getAffectedPaths — accommodation amenity and feature sub-routes (T-061)', () => {
    it('includes amenity filter pages for all provided amenitySlugs across all locales', () => {
        const paths = getAffectedPaths({
            entityType: 'accommodation',
            slug: 'hotel-test',
            amenitySlugs: ['wifi', 'piscina']
        });
        expect(paths).toContain('/alojamientos/comodidades/wifi/');
        expect(paths).toContain('/alojamientos/comodidades/piscina/');
        expect(paths).toContain('/en/alojamientos/comodidades/wifi/');
        expect(paths).toContain('/pt/alojamientos/comodidades/piscina/');
    });

    it('includes feature filter pages for all provided featureSlugs across all locales', () => {
        const paths = getAffectedPaths({
            entityType: 'accommodation',
            slug: 'hotel-test',
            featureSlugs: ['vista-al-mar', 'jardín-privado']
        });
        expect(paths).toContain('/alojamientos/caracteristicas/vista-al-mar/');
        expect(paths).toContain('/alojamientos/caracteristicas/jardín-privado/');
        expect(paths).toContain('/en/alojamientos/caracteristicas/vista-al-mar/');
        expect(paths).toContain('/pt/alojamientos/caracteristicas/jardín-privado/');
    });

    it('does not include amenity or feature pages when those arrays are absent', () => {
        const paths = getAffectedPaths({ entityType: 'accommodation', slug: 'hotel-test' });
        expect(paths.some((p) => p.includes('/comodidades/'))).toBe(false);
        expect(paths.some((p) => p.includes('/caracteristicas/'))).toBe(false);
    });

    it('handles a single amenitySlug correctly', () => {
        const paths = getAffectedPaths({
            entityType: 'accommodation',
            amenitySlugs: ['estacionamiento']
        });
        expect(paths).toContain('/alojamientos/comodidades/estacionamiento/');
        expect(paths).toContain('/en/alojamientos/comodidades/estacionamiento/');
    });

    it('combines amenitySlugs + featureSlugs + accommodationType + destinationSlug', () => {
        const paths = getAffectedPaths({
            entityType: 'accommodation',
            slug: 'complejo-norte',
            accommodationType: 'resort',
            destinationSlug: 'concordia',
            amenitySlugs: ['spa'],
            featureSlugs: ['pileta-climatizada']
        });
        expect(paths).toContain('/alojamientos/complejo-norte/');
        expect(paths).toContain('/alojamientos/tipo/resort/');
        expect(paths).toContain('/destinos/concordia/');
        expect(paths).toContain('/alojamientos/comodidades/spa/');
        expect(paths).toContain('/alojamientos/caracteristicas/pileta-climatizada/');
    });
});

// ---------------------------------------------------------------------------
// T-061: destination sub-routes (accommodations, events, attractions)
// ---------------------------------------------------------------------------

describe('getAffectedPaths — destination sub-routes (T-061)', () => {
    it('includes /destinos/{slug}/alojamientos/ sub-route when slug provided', () => {
        const paths = getAffectedPaths({ entityType: 'destination', slug: 'concordia' });
        expect(paths).toContain('/destinos/concordia/alojamientos/');
        expect(paths).toContain('/en/destinos/concordia/alojamientos/');
        expect(paths).toContain('/pt/destinos/concordia/alojamientos/');
    });

    it('includes /destinos/{slug}/eventos/ sub-route when slug provided', () => {
        const paths = getAffectedPaths({ entityType: 'destination', slug: 'gualeguaychu' });
        expect(paths).toContain('/destinos/gualeguaychu/eventos/');
        expect(paths).toContain('/en/destinos/gualeguaychu/eventos/');
        expect(paths).toContain('/pt/destinos/gualeguaychu/eventos/');
    });

    it('includes attraction pages for all provided attractionSlugs across all locales', () => {
        const paths = getAffectedPaths({
            entityType: 'destination',
            slug: 'concordia',
            attractionSlugs: ['termas-federacion', 'costanera-concepcion']
        });
        expect(paths).toContain('/destinos/atraccion/termas-federacion/');
        expect(paths).toContain('/destinos/atraccion/costanera-concepcion/');
        expect(paths).toContain('/en/destinos/atraccion/termas-federacion/');
        expect(paths).toContain('/pt/destinos/atraccion/costanera-concepcion/');
    });

    it('does not include attraction pages when attractionSlugs is absent', () => {
        const paths = getAffectedPaths({ entityType: 'destination', slug: 'concordia' });
        expect(paths.some((p) => p.includes('/atraccion/'))).toBe(false);
    });

    it('handles attractionSlugs without a destination slug', () => {
        const paths = getAffectedPaths({
            entityType: 'destination',
            attractionSlugs: ['plaza-san-martin']
        });
        expect(paths).toContain('/destinos/atraccion/plaza-san-martin/');
        expect(paths).toContain('/en/destinos/atraccion/plaza-san-martin/');
    });
});

// ---------------------------------------------------------------------------
// T-061: event location + destination events sub-route
// ---------------------------------------------------------------------------

describe('getAffectedPaths — event location and destination events sub-route (T-061)', () => {
    it('includes location sub-route when locationSlug provided', () => {
        const paths = getAffectedPaths({
            entityType: 'event',
            slug: 'festival-verano',
            locationSlug: 'anfiteatro-municipal'
        });
        expect(paths).toContain('/eventos/en/anfiteatro-municipal/');
        expect(paths).toContain('/en/eventos/en/anfiteatro-municipal/');
        expect(paths).toContain('/pt/eventos/en/anfiteatro-municipal/');
    });

    it("includes destination's events sub-route when destinationSlug provided", () => {
        const paths = getAffectedPaths({
            entityType: 'event',
            slug: 'carnaval-2026',
            destinationSlug: 'gualeguaychu'
        });
        expect(paths).toContain('/destinos/gualeguaychu/eventos/');
        expect(paths).toContain('/en/destinos/gualeguaychu/eventos/');
        expect(paths).toContain('/pt/destinos/gualeguaychu/eventos/');
    });

    it('does not include location or destination sub-routes when absent', () => {
        const paths = getAffectedPaths({ entityType: 'event', slug: 'simple-event' });
        expect(paths.some((p) => p.includes('/eventos/en/'))).toBe(false);
        expect(paths.some((p) => p.includes('/destinos/') && p.includes('/eventos/'))).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// T-061: post author sub-route
// ---------------------------------------------------------------------------

describe('getAffectedPaths — post author sub-route (T-061)', () => {
    it('includes author sub-route when authorSlug provided', () => {
        const paths = getAffectedPaths({
            entityType: 'post',
            slug: 'guia-litoral',
            authorSlug: 'maria-gonzalez'
        });
        expect(paths).toContain('/publicaciones/autor/maria-gonzalez/');
        expect(paths).toContain('/en/publicaciones/autor/maria-gonzalez/');
        expect(paths).toContain('/pt/publicaciones/autor/maria-gonzalez/');
    });

    it('does not include author sub-route when authorSlug is absent', () => {
        const paths = getAffectedPaths({ entityType: 'post', slug: 'guia-litoral' });
        expect(paths.some((p) => p.includes('/autor/'))).toBe(false);
    });

    it('includes category sub-route when category provided', () => {
        const paths = getAffectedPaths({
            entityType: 'post',
            slug: 'guia-litoral',
            category: 'turismo'
        });
        expect(paths).toContain('/publicaciones/categoria/turismo/');
        expect(paths).toContain('/en/publicaciones/categoria/turismo/');
        expect(paths).toContain('/pt/publicaciones/categoria/turismo/');
    });

    it('combines authorSlug + category + tagSlugs correctly', () => {
        const paths = getAffectedPaths({
            entityType: 'post',
            slug: 'articulo-completo',
            authorSlug: 'juan-perez',
            category: 'gastronomia',
            tagSlugs: ['parrilla', 'viajes']
        });
        expect(paths).toContain('/publicaciones/autor/juan-perez/');
        expect(paths).toContain('/publicaciones/categoria/gastronomia/');
        expect(paths).toContain('/publicaciones/etiqueta/parrilla/');
        expect(paths).toContain('/publicaciones/etiqueta/viajes/');
        expect(paths).toContain('/publicaciones/articulo-completo/');
    });
});

// ---------------------------------------------------------------------------
// T-060: exact slug list validation
// ---------------------------------------------------------------------------

describe('ACCOMMODATION_TYPE_SLUGS — exact enum match (T-060)', () => {
    it('contains exactly the 13 valid AccommodationTypeEnum slugs (SPEC-213 adds apart-hotel, estancia, bed-and-breakfast)', () => {
        // Hardcoded on purpose: deriving `expected` with the same transformation
        // as the implementation would be tautological. This list fails if a type
        // is added without updating it, or if the slug transformation regresses.
        const expected = [
            'apartment',
            'house',
            'country-house',
            'cabin',
            'hotel',
            'hostel',
            'camping',
            'room',
            'motel',
            'resort',
            'apart-hotel',
            'estancia',
            'bed-and-breakfast'
        ];
        expect([...ACCOMMODATION_TYPE_SLUGS].sort()).toEqual([...expected].sort());
    });

    it('does not contain posada (never added to AccommodationTypeEnum)', () => {
        expect(ACCOMMODATION_TYPE_SLUGS).not.toContain('posada');
    });
});

describe('EVENT_CATEGORY_SLUGS — exact enum match (T-060)', () => {
    it('contains exactly the 9 valid EventCategoryEnum slugs', () => {
        const expected = [
            'music',
            'culture',
            'sports',
            'gastronomy',
            'festival',
            'nature',
            'theater',
            'workshop',
            'other'
        ] as const;
        expect([...EVENT_CATEGORY_SLUGS].sort()).toEqual([...expected].sort());
    });

    it('does not contain stale slugs fair, sport, or cultural', () => {
        expect(EVENT_CATEGORY_SLUGS).not.toContain('fair');
        expect(EVENT_CATEGORY_SLUGS).not.toContain('sport');
        expect(EVENT_CATEGORY_SLUGS).not.toContain('cultural');
    });
});

// ---------------------------------------------------------------------------
// deduplication
// ---------------------------------------------------------------------------

describe('getAffectedPaths — deduplication', () => {
    it('returns no duplicate paths for accommodation with full context', () => {
        const paths = getAffectedPaths({
            entityType: 'accommodation',
            slug: 'hotel-test',
            accommodationType: 'hotel',
            destinationSlug: 'gualeguaychu'
        });
        const unique = new Set(paths);
        expect(unique.size).toBe(paths.length);
    });

    it('returns no duplicate paths for post with multiple tagSlugs', () => {
        const paths = getAffectedPaths({
            entityType: 'post',
            slug: 'mi-post',
            tagSlugs: ['tag-a', 'tag-b']
        });
        const unique = new Set(paths);
        expect(unique.size).toBe(paths.length);
    });
});

// ---------------------------------------------------------------------------
// unknown entity type
// ---------------------------------------------------------------------------

describe('getAffectedPaths — unknown entity type', () => {
    it('returns empty array for unknown type', () => {
        // @ts-expect-error testing invalid input
        const paths = getAffectedPaths({ entityType: 'unknown_entity_type' });
        expect(paths).toHaveLength(0);
    });
});
