import { describe, expect, it } from 'vitest';
import type { PoiCategoryAssignment } from '../../scripts/poi-pipeline/categories.js';
import { AUTO_GEOCODE_MARKER, buildPoiFixture } from '../../scripts/poi-pipeline/emit.js';
import type { GeocodeResult, RawCsvRow } from '../../scripts/poi-pipeline/types.js';

function makeRow(overrides: Partial<RawCsvRow>): RawCsvRow {
    return {
        id: 'colon__x',
        destinationSlug: 'colon',
        destinationName: 'Colon',
        destinationTier: 'HIGH',
        relation: 'PRIMARY',
        name: 'Plaza X',
        description: 'Una plaza historica.',
        priority: 'HIGH',
        address: 'Calle 1, Colon',
        lat: '',
        lng: '',
        verified: 'False',
        source: 'https://x.tur.ar/',
        verifiedAt: '',
        notes: 'Carga inicial.',
        categorySlugs: 'SQUARE',
        categoryNames: 'Square',
        keywords: 'plaza; centro',
        nearbyDestinationSlugs: '',
        nearbyDestinationNames: '',
        ...overrides
    };
}

const CATS: PoiCategoryAssignment[] = [
    { slug: 'square', isPrimary: true },
    { slug: 'historic_site', isPrimary: false }
];

const GEO: GeocodeResult = { lat: -31.4, long: -58.02, confidence: 'high', provider: 'nominatim' };
const DATE = '2026-07-13';

describe('buildPoiFixture — provenance (G-5)', () => {
    it('passes CSV coordinates + verification through for an already-verified row', () => {
        // Arrange
        const row = makeRow({
            lat: '-32.48',
            lng: '-58.23',
            verified: 'True',
            verifiedAt: '2026-07-01T00:00:00.000Z',
            notes: 'Verificado en campo.'
        });

        // Act
        const fx = buildPoiFixture({
            row,
            slug: 'plaza_x',
            categories: CATS,
            geocoded: null,
            geocodeIsoDate: DATE
        });

        // Assert — byte-identical provenance, no marker (AC-6)
        expect(fx.lat).toBe(-32.48);
        expect(fx.long).toBe(-58.23);
        expect(fx.verified).toBe(true);
        expect(fx.verifiedAt).toBe('2026-07-01T00:00:00.000Z');
        expect(fx.notes).toBe('Verificado en campo.');
        expect(fx.notes).not.toContain(AUTO_GEOCODE_MARKER);
    });

    it('forces verified:false and appends the auto-geocode marker for a geocoded row (AC-5/AC-6)', () => {
        // Arrange — no CSV coords, geocoder resolved
        const row = makeRow({ verified: 'False', notes: 'Carga inicial.' });

        // Act
        const fx = buildPoiFixture({
            row,
            slug: 'plaza_x',
            categories: CATS,
            geocoded: GEO,
            geocodeIsoDate: DATE
        });

        // Assert
        expect(fx.lat).toBe(-31.4);
        expect(fx.long).toBe(-58.02);
        expect(fx.verified).toBe(false);
        expect(fx.verifiedAt).toBeNull();
        expect(fx.notes).toContain(AUTO_GEOCODE_MARKER);
        expect(fx.notes).toContain('nominatim');
        expect(fx.notes).toContain(DATE);
        expect(fx.notes).toContain('Carga inicial.');
    });

    it('leaves coordinates null for an unresolved row, carrying provenance unchanged', () => {
        // Arrange
        const row = makeRow({ verified: 'False', notes: 'Pendiente.' });

        // Act
        const fx = buildPoiFixture({
            row,
            slug: 'plaza_x',
            categories: CATS,
            geocoded: null,
            geocodeIsoDate: DATE
        });

        // Assert
        expect(fx.lat).toBeNull();
        expect(fx.long).toBeNull();
        expect(fx.verified).toBe(false);
        expect(fx.notes).toBe('Pendiente.');
        expect(fx.notes).not.toContain(AUTO_GEOCODE_MARKER);
    });

    it('never emits verified:true unless the CSV row was verified (AC-5)', () => {
        // A geocoded row whose CSV said verified True would be impossible in the
        // real data, but the emit must still never *upgrade* verification.
        const row = makeRow({ verified: 'False' });
        const fx = buildPoiFixture({
            row,
            slug: 's',
            categories: CATS,
            geocoded: GEO,
            geocodeIsoDate: DATE
        });
        expect(fx.verified).toBe(false);
    });
});

describe('buildPoiFixture — derivations (spec §7)', () => {
    it('derives displayWeight from priority (HIGH/MEDIUM/LOW -> 100/50/10)', () => {
        expect(
            buildPoiFixture({
                row: makeRow({ priority: 'HIGH' }),
                slug: 's',
                categories: CATS,
                geocoded: null,
                geocodeIsoDate: DATE
            }).displayWeight
        ).toBe(100);
        expect(
            buildPoiFixture({
                row: makeRow({ priority: 'MEDIUM' }),
                slug: 's',
                categories: CATS,
                geocoded: null,
                geocodeIsoDate: DATE
            }).displayWeight
        ).toBe(50);
        expect(
            buildPoiFixture({
                row: makeRow({ priority: 'LOW' }),
                slug: 's',
                categories: CATS,
                geocoded: null,
                geocodeIsoDate: DATE
            }).displayWeight
        ).toBe(10);
    });

    it('sets isFeatured only for HIGH priority', () => {
        expect(
            buildPoiFixture({
                row: makeRow({ priority: 'HIGH' }),
                slug: 's',
                categories: CATS,
                geocoded: null,
                geocodeIsoDate: DATE
            }).isFeatured
        ).toBe(true);
        expect(
            buildPoiFixture({
                row: makeRow({ priority: 'MEDIUM' }),
                slug: 's',
                categories: CATS,
                geocoded: null,
                geocodeIsoDate: DATE
            }).isFeatured
        ).toBe(false);
    });

    it('derives type from the primary category via deriveTypeFromCategorySlug', () => {
        // square -> PLAZA (direct enum mapping)
        expect(
            buildPoiFixture({
                row: makeRow({}),
                slug: 's',
                categories: CATS,
                geocoded: null,
                geocodeIsoDate: DATE
            }).type
        ).toBe('PLAZA');
        // a primary with no direct enum mapping -> OTHER
        const other = buildPoiFixture({
            row: makeRow({}),
            slug: 's',
            categories: [{ slug: 'gastronomy', isPrimary: true }],
            geocoded: null,
            geocodeIsoDate: DATE
        });
        expect(other.type).toBe('OTHER');
    });

    it('populates nameI18n.es from the CSV name and leaves en/pt null', () => {
        const fx = buildPoiFixture({
            row: makeRow({ name: 'Basílica' }),
            slug: 's',
            categories: CATS,
            geocoded: null,
            geocodeIsoDate: DATE
        });
        expect(fx.nameI18n).toEqual({ es: 'Basílica', en: null, pt: null });
    });

    it('carries keywords, categories, and seed defaults', () => {
        const fx = buildPoiFixture({
            row: makeRow({ keywords: 'a; b; c' }),
            slug: 'plaza_x',
            categories: CATS,
            geocoded: null,
            geocodeIsoDate: DATE
        });
        expect(fx.keywords).toEqual(['a', 'b', 'c']);
        expect(fx.categories).toEqual([
            { slug: 'square', isPrimary: true },
            { slug: 'historic_site', isPrimary: false }
        ]);
        expect(fx.isBuiltin).toBe(true);
        expect(fx.hasOwnPage).toBe(false);
        expect(fx.lifecycleState).toBe('ACTIVE');
        expect(fx.icon).toBeNull();
    });
});
