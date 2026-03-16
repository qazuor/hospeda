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
    getAffectedPaths,
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
            paths.some((p) => /^(\/[a-z]{2})?\/alojamientos\/[^/]+\/$/.test(p) && !p.includes('/tipo/'))
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
            accommodationType: 'cabin',
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
            destinationSlug: 'concordia',
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
            destinationSlug: 'gualeguaychu',
        });
        expect(paths).toContain('/alojamientos/');
        expect(paths).toContain('/alojamientos/posada-sol/');
        expect(paths).toContain('/alojamientos/tipo/posada/');
        expect(paths).toContain('/destinos/gualeguaychu/');
        // Must not include other type pages
        expect(paths.some((p) => p.includes('/alojamientos/tipo/hotel/'))).toBe(false);
    });

    it('URL slugs use correct English/API slugs (hotel, hostel, cabin, apartment, camping, estancia, posada)', () => {
        const paths = getAffectedPaths({ entityType: 'accommodation' });
        expect(paths).toContain('/alojamientos/tipo/hotel/');
        expect(paths).toContain('/alojamientos/tipo/hostel/');
        expect(paths).toContain('/alojamientos/tipo/cabin/');
        expect(paths).toContain('/alojamientos/tipo/apartment/');
        expect(paths).toContain('/alojamientos/tipo/camping/');
        expect(paths).toContain('/alojamientos/tipo/estancia/');
        expect(paths).toContain('/alojamientos/tipo/posada/');
        // Must NOT contain old incorrect slugs
        expect(paths.some((p) => p.includes('/tipo/departamento/'))).toBe(false);
        expect(paths.some((p) => p.includes('/tipo/cabana/'))).toBe(false);
        expect(paths.some((p) => p.includes('/tipo/resort/'))).toBe(false);
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
        expect(paths.some((p) => /\/eventos\/[a-z]/.test(p) && !p.includes('/categoria/'))).toBe(false);
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
        expect(paths.some((p) => p.includes('/categoria/fair/'))).toBe(false);
        expect(paths.some((p) => p.includes('/categoria/sport/'))).toBe(false);
    });

    it('category pages use correct URL slugs (festival, fair, sport, cultural, gastronomy)', () => {
        const paths = getAffectedPaths({ entityType: 'event' });
        expect(paths).toContain('/eventos/categoria/festival/');
        expect(paths).toContain('/eventos/categoria/fair/');
        expect(paths).toContain('/eventos/categoria/sport/');
        expect(paths).toContain('/eventos/categoria/cultural/');
        expect(paths).toContain('/eventos/categoria/gastronomy/');
        // Must NOT contain old incorrect slugs
        expect(paths.some((p) => p.includes('/categoria/musica/'))).toBe(false);
        expect(paths.some((p) => p.includes('/categoria/cultura/'))).toBe(false);
        expect(paths.some((p) => p.includes('/categoria/deportes/'))).toBe(false);
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
            tagSlugs: ['turismo', 'gastronomia'],
        });
        expect(paths).toContain('/publicaciones/etiqueta/turismo/');
        expect(paths).toContain('/publicaciones/etiqueta/gastronomia/');
        expect(paths).toContain('/en/publicaciones/etiqueta/turismo/');
        expect(paths).toContain('/pt/publicaciones/etiqueta/gastronomia/');
    });

    it('includes one tag filter page per tagSlug provided', () => {
        const paths = getAffectedPaths({
            entityType: 'post',
            tagSlugs: ['alpha', 'beta', 'gamma'],
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
            accommodationSlug: 'hotel-bar',
        });
        expect(paths).toContain('/alojamientos/hotel-bar/');
        expect(paths).toContain('/en/alojamientos/hotel-bar/');
        expect(paths).toContain('/pt/alojamientos/hotel-bar/');
    });

    it('always includes /alojamientos/ listing (aggregate ratings affect listing)', () => {
        const paths = getAffectedPaths({
            entityType: 'accommodation_review',
            accommodationSlug: 'hotel-bar',
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
            destinationSlug: 'concepcion',
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
// deduplication
// ---------------------------------------------------------------------------

describe('getAffectedPaths — deduplication', () => {
    it('returns no duplicate paths for accommodation with full context', () => {
        const paths = getAffectedPaths({
            entityType: 'accommodation',
            slug: 'hotel-test',
            accommodationType: 'hotel',
            destinationSlug: 'gualeguaychu',
        });
        const unique = new Set(paths);
        expect(unique.size).toBe(paths.length);
    });

    it('returns no duplicate paths for post with multiple tagSlugs', () => {
        const paths = getAffectedPaths({
            entityType: 'post',
            slug: 'mi-post',
            tagSlugs: ['tag-a', 'tag-b'],
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
