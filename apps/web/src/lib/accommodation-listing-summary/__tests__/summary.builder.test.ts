/**
 * Comprehensive tests for the accommodation listing summary builder.
 */

import { describe, expect, it } from 'vitest';
import { buildAccommodationListingSummary } from '../summary.builder';
import { DEFAULT_SORT_KEYS, DEFAULT_TYPE_GRAMMAR } from '../summary.catalogs';
import { mapLegacyFiltersToSummaryFilters } from '../summary.legacy';
import type { SummaryCatalogs } from '../summary.types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_CATALOGS: SummaryCatalogs = {
    types: [
        ...DEFAULT_TYPE_GRAMMAR,
        {
            key: 'APART_HOTEL',
            singular: { es: 'apart hotel', en: 'apart hotel' },
            plural: { es: 'apart hoteles', en: 'apart hotels' }
        }
    ],
    destinations: [
        { key: 'colon', label: { es: 'Colón', en: 'Colón' } },
        { key: 'concordia', label: { es: 'Concordia', en: 'Concordia' } },
        { key: 'federacion', label: { es: 'Federación', en: 'Federación' } }
    ],
    services: [
        { key: 'desayuno', label: { es: 'desayuno', en: 'breakfast' } },
        { key: 'limpieza', label: { es: 'limpieza', en: 'cleaning' } }
    ],
    amenities: [
        { key: 'wifi', label: { es: 'wifi', en: 'wifi' } },
        { key: 'pileta', label: { es: 'pileta', en: 'pool' } },
        { key: 'aire-acondicionado', label: { es: 'aire acondicionado', en: 'air conditioning' } }
    ],
    sortKeys: DEFAULT_SORT_KEYS
};

// ---------------------------------------------------------------------------
// No filters
// ---------------------------------------------------------------------------

describe('buildAccommodationListingSummary', () => {
    describe('no filters', () => {
        it('should render generic subject with no-filters phrase when no filters active', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 124, globalTotal: 124 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe('Mostrando 124 de 124 hospedajes, sin filtros activos.');
        });

        it('should append sort phrase after no-filters phrase', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 124, globalTotal: 124 },
                sort: { key: 'name', direction: 'asc' },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe(
                'Mostrando 124 de 124 hospedajes, sin filtros activos, ordenados por nombre, A a Z.'
            );
        });

        it('should handle empty filters object with english locale', () => {
            const result = buildAccommodationListingSummary({
                locale: 'en',
                filters: {},
                counts: { shown: 50, globalTotal: 50 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe('Showing 50 of 50 accommodations, no active filters.');
        });
    });

    // -------------------------------------------------------------------------
    // Subject resolution
    // -------------------------------------------------------------------------

    describe('subject resolution', () => {
        it('should use singular generic subject when shown is 1 and no types', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 1, globalTotal: 50 }
            });
            expect(result).toBe('Mostrando 1 de 50 hospedaje, sin filtros activos.');
        });

        it('should use specific plural subject for single type with subjectTotal', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { types: ['HOTEL'], destinations: ['colon'] },
                counts: { shown: 18, globalTotal: 124, subjectTotal: 42 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe('Mostrando 18 de 42 hoteles en Colón.');
        });

        it('should use natural list subject for two types', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {
                    types: ['HOTEL', 'CABIN'],
                    destinations: ['colon', 'concordia'],
                    price: { max: 20000 }
                },
                counts: { shown: 31, globalTotal: 124, subjectTotal: 67 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe(
                'Mostrando 31 de 67 hoteles y cabañas en Colón o Concordia, con precio de hasta $20.000.'
            );
        });

        it('should use natural list subject for three types', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {
                    types: ['HOTEL', 'APART_HOTEL', 'CABIN'],
                    destinations: ['colon']
                },
                counts: { shown: 12, globalTotal: 124, subjectTotal: 61 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('hoteles, apart hoteles y cabañas');
        });

        it('should degrade to generic subject when too many types (> maxTypesInSubjectList)', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { types: ['HOTEL', 'CABIN', 'HOSTEL', 'RESORT'] },
                counts: { shown: 10, globalTotal: 124, subjectTotal: 50 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('hospedajes');
            // Should use globalTotal, not subjectTotal
            expect(result).toContain('de 124');
        });

        it('should degrade to generic subject when subjectTotal is null', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { types: ['HOTEL'] },
                counts: { shown: 18, globalTotal: 124, subjectTotal: null },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('hospedajes');
            expect(result).toContain('de 124');
        });

        it('should degrade to generic subject when subjectTotal is undefined', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { types: ['HOTEL'] },
                counts: { shown: 18, globalTotal: 124 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('hospedajes');
            expect(result).toContain('de 124');
        });

        it('should respect custom maxTypesInSubjectList option', () => {
            // With maxTypesInSubjectList=2, two types should still work
            const result2 = buildAccommodationListingSummary({
                locale: 'es',
                filters: { types: ['HOTEL', 'CABIN'] },
                counts: { shown: 10, globalTotal: 124, subjectTotal: 50 },
                catalogs: TEST_CATALOGS,
                options: { maxTypesInSubjectList: 2 }
            });
            expect(result2).toContain('hoteles y cabañas');

            // With maxTypesInSubjectList=2, three types should degrade
            const result3 = buildAccommodationListingSummary({
                locale: 'es',
                filters: { types: ['HOTEL', 'CABIN', 'HOSTEL'] },
                counts: { shown: 10, globalTotal: 124, subjectTotal: 50 },
                catalogs: TEST_CATALOGS,
                options: { maxTypesInSubjectList: 2 }
            });
            expect(result3).toContain('hospedajes');
        });

        it('should fall back to raw type key when not in catalog', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { types: ['UNKNOWN_TYPE'] },
                counts: { shown: 5, globalTotal: 50, subjectTotal: 5 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('UNKNOWN_TYPE');
        });

        it('should NOT show "sin filtros activos" when only types filter is active', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { types: ['HOTEL'] },
                counts: { shown: 18, globalTotal: 124, subjectTotal: 42 },
                catalogs: TEST_CATALOGS
            });
            expect(result).not.toContain('sin filtros activos');
            expect(result).toBe('Mostrando 18 de 42 hoteles.');
        });

        it('should NOT show "sin filtros activos" when multiple types selected with no other filters', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { types: ['HOTEL', 'CABIN'] },
                counts: { shown: 10, globalTotal: 124, subjectTotal: 50 },
                catalogs: TEST_CATALOGS
            });
            expect(result).not.toContain('sin filtros activos');
            expect(result).toBe('Mostrando 10 de 50 hoteles y cabañas.');
        });

        it('should NOT show "no active filters" when only types filter is active (en locale)', () => {
            const result = buildAccommodationListingSummary({
                locale: 'en',
                filters: { types: ['HOTEL'] },
                counts: { shown: 18, globalTotal: 124, subjectTotal: 42 },
                catalogs: TEST_CATALOGS
            });
            expect(result).not.toContain('no active filters');
            expect(result).toBe('Showing 18 of 42 hotels.');
        });

        it('should still show "sin filtros activos" when types is empty array', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { types: [] },
                counts: { shown: 10, globalTotal: 50 }
            });
            expect(result).toContain('sin filtros activos');
        });
    });

    // -------------------------------------------------------------------------
    // Destination filter
    // -------------------------------------------------------------------------

    describe('destination filter', () => {
        it('should render single destination without comma after subject', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { types: ['HOTEL'], destinations: ['colon'] },
                counts: { shown: 18, globalTotal: 124, subjectTotal: 42 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe('Mostrando 18 de 42 hoteles en Colón.');
        });

        it('should render multiple destinations joined with "o"', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { destinations: ['colon', 'concordia'] },
                counts: { shown: 30, globalTotal: 124 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('en Colón o Concordia');
        });

        it('should use raw key as fallback when destination not in catalog', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { destinations: ['unknown-dest'] },
                counts: { shown: 5, globalTotal: 100 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('en unknown-dest');
        });

        it('should render three destinations with "o" before last', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { destinations: ['colon', 'concordia', 'federacion'] },
                counts: { shown: 20, globalTotal: 124 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('en Colón, Concordia o Federación');
        });
    });

    // -------------------------------------------------------------------------
    // Text filter
    // -------------------------------------------------------------------------

    describe('text filter', () => {
        it('should render text filter with double quotes', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { text: 'centro' },
                counts: { shown: 10, globalTotal: 124 }
            });
            expect(result).toContain('que contienen "centro" en el nombre o la descripción');
        });

        it('should strip surrounding % from text', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { text: '%centro%' },
                counts: { shown: 10, globalTotal: 124 }
            });
            expect(result).toContain('"centro"');
            expect(result).not.toContain('%');
        });

        it('should collapse multiple spaces in text', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { text: 'hotel   norte' },
                counts: { shown: 5, globalTotal: 100 }
            });
            expect(result).toContain('"hotel norte"');
        });

        it('should not be active when text is empty string', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { text: '' },
                counts: { shown: 10, globalTotal: 50 }
            });
            expect(result).toContain('sin filtros activos');
        });

        it('should not be active when text is null', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { text: null },
                counts: { shown: 10, globalTotal: 50 }
            });
            expect(result).toContain('sin filtros activos');
        });

        it('should join text with comma when destination is also active', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { destinations: ['colon'], text: 'centro' },
                counts: { shown: 5, globalTotal: 100 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('en Colón, que contienen "centro"');
        });

        it('should join text with space (no comma) when destination is NOT active', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { text: 'centro' },
                counts: { shown: 5, globalTotal: 100 }
            });
            // "hospedajes que contienen" — no comma
            expect(result).toContain('hospedajes que contienen');
        });
    });

    // -------------------------------------------------------------------------
    // Price filter
    // -------------------------------------------------------------------------

    describe('price filter', () => {
        it('should render only min price', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { price: { min: 8000 } },
                counts: { shown: 20, globalTotal: 124 }
            });
            expect(result).toContain('con precio desde $8.000');
        });

        it('should render only max price', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { price: { max: 20000 } },
                counts: { shown: 25, globalTotal: 124 }
            });
            expect(result).toContain('con precio de hasta $20.000');
        });

        it('should render price range with both min and max', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { price: { min: 8000, max: 20000 } },
                counts: { shown: 15, globalTotal: 124 }
            });
            expect(result).toContain('con precio entre $8.000 y $20.000');
        });

        it('should render includeWithoutPrice alone', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { price: { includeWithoutPrice: true } },
                counts: { shown: 10, globalTotal: 50 }
            });
            expect(result).toContain('sin precio definido');
        });

        it('should append "o sin precio definido" when includeWithoutPrice with range', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { price: { min: 8000, max: 20000, includeWithoutPrice: true } },
                counts: { shown: 8, globalTotal: 124 }
            });
            expect(result).toContain('con precio entre $8.000 y $20.000 o sin precio definido');
        });

        it('should not be active when price is null', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { price: null },
                counts: { shown: 10, globalTotal: 50 }
            });
            expect(result).toContain('sin filtros activos');
        });

        it('should not be active when price fields are null', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { price: { min: null, max: null, includeWithoutPrice: false } },
                counts: { shown: 10, globalTotal: 50 }
            });
            expect(result).toContain('sin filtros activos');
        });

        it('should handle string price values', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { price: { max: '20000' } },
                counts: { shown: 25, globalTotal: 124 }
            });
            expect(result).toContain('con precio de hasta $20.000');
        });
    });

    // -------------------------------------------------------------------------
    // Guests filter
    // -------------------------------------------------------------------------

    describe('guests filter', () => {
        it('should render atLeast mode (default) with plural', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { guests: 3 },
                counts: { shown: 10, globalTotal: 50 }
            });
            expect(result).toContain('para al menos 3 huéspedes');
        });

        it('should render atLeast mode with singular when count is 1', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { guests: 1 },
                counts: { shown: 50, globalTotal: 50 }
            });
            expect(result).toContain('para al menos 1 huésped');
        });

        it('should render exact mode', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { guests: 2 },
                counts: { shown: 20, globalTotal: 50 },
                options: { quantityMode: { guests: 'exact' } }
            });
            expect(result).toContain('para exactamente 2 huéspedes');
        });

        it('should render exact mode singular', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { guests: 1 },
                counts: { shown: 50, globalTotal: 50 },
                options: { quantityMode: { guests: 'exact' } }
            });
            expect(result).toContain('para exactamente 1 huésped');
        });

        it('should not be active when guests is null', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { guests: null },
                counts: { shown: 10, globalTotal: 50 }
            });
            expect(result).toContain('sin filtros activos');
        });
    });

    // -------------------------------------------------------------------------
    // Bedrooms and bathrooms
    // -------------------------------------------------------------------------

    describe('bedrooms and bathrooms', () => {
        it('should render bedrooms atLeast (default)', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { bedrooms: 2 },
                counts: { shown: 10, globalTotal: 50 }
            });
            expect(result).toContain('con al menos 2 dormitorios');
        });

        it('should render bedrooms exact singular', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { bedrooms: 1 },
                counts: { shown: 20, globalTotal: 50 },
                options: { quantityMode: { bedrooms: 'exact' } }
            });
            expect(result).toContain('con exactamente 1 dormitorio');
        });

        it('should render bathrooms atLeast (default)', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { bathrooms: 1 },
                counts: { shown: 30, globalTotal: 50 }
            });
            expect(result).toContain('con al menos 1 baño');
        });

        it('should render bathrooms exact plural', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { bathrooms: 2 },
                counts: { shown: 15, globalTotal: 50 },
                options: { quantityMode: { bathrooms: 'exact' } }
            });
            expect(result).toContain('con exactamente 2 baños');
        });

        it('should render both bedrooms and bathrooms together', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { bedrooms: 2, bathrooms: 1 },
                counts: { shown: 10, globalTotal: 50 }
            });
            expect(result).toContain('con al menos 2 dormitorios');
            expect(result).toContain('con al menos 1 baño');
        });
    });

    // -------------------------------------------------------------------------
    // Services and amenities
    // -------------------------------------------------------------------------

    describe('services and amenities', () => {
        it('should render single service', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { services: ['desayuno'] },
                counts: { shown: 20, globalTotal: 50 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('con servicios como desayuno');
        });

        it('should render multiple services with natural list', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { services: ['desayuno', 'limpieza'] },
                counts: { shown: 15, globalTotal: 50 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('con servicios como desayuno y limpieza');
        });

        it('should render single amenity', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { amenities: ['wifi'] },
                counts: { shown: 30, globalTotal: 50 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('con amenities como wifi');
        });

        it('should render multiple amenities with natural list', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { amenities: ['wifi', 'pileta'] },
                counts: { shown: 20, globalTotal: 50 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('con amenities como wifi y pileta');
        });

        it('should fall back to raw key when amenity not in catalog', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { amenities: ['jacuzzi'] },
                counts: { shown: 5, globalTotal: 50 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('con amenities como jacuzzi');
        });

        it('should not be active when amenities array is empty', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { amenities: [] },
                counts: { shown: 50, globalTotal: 50 }
            });
            expect(result).toContain('sin filtros activos');
        });
    });

    // -------------------------------------------------------------------------
    // Rating filter
    // -------------------------------------------------------------------------

    describe('rating filter', () => {
        it('should render minimum rating only', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { minRating: 4 },
                counts: { shown: 20, globalTotal: 50 }
            });
            expect(result).toContain('con calificación mínima de 4');
        });

        it('should render minimum rating with decimal', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { minRating: 4.5 },
                counts: { shown: 10, globalTotal: 50 }
            });
            expect(result).toContain('con calificación mínima de 4,5');
        });

        it('should append "o sin calificación" when includeWithoutRating is true', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { minRating: 4, includeWithoutRating: true },
                counts: { shown: 25, globalTotal: 50 }
            });
            expect(result).toContain('con calificación mínima de 4 o sin calificación');
        });

        it('should render only "sin calificación" when minRating absent but includeWithoutRating true', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { includeWithoutRating: true },
                counts: { shown: 30, globalTotal: 50 }
            });
            expect(result).toContain('sin calificación');
            expect(result).not.toContain('con calificación mínima de');
        });

        it('should not be active when minRating is null and includeWithoutRating is false', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { minRating: null, includeWithoutRating: false },
                counts: { shown: 50, globalTotal: 50 }
            });
            expect(result).toContain('sin filtros activos');
        });
    });

    // -------------------------------------------------------------------------
    // Featured filter
    // -------------------------------------------------------------------------

    describe('featured filter', () => {
        it('should render "solo destacados" when featured is true', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { featured: true },
                counts: { shown: 10, globalTotal: 50 }
            });
            expect(result).toContain('solo destacados');
        });

        it('should render "solo no destacados" when featured is false', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { featured: false },
                counts: { shown: 40, globalTotal: 50 }
            });
            expect(result).toContain('solo no destacados');
        });

        it('should not be active when featured is null', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { featured: null },
                counts: { shown: 50, globalTotal: 50 }
            });
            expect(result).toContain('sin filtros activos');
        });

        it('should render featured as comma modifier (with comma)', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { featured: true },
                counts: { shown: 7, globalTotal: 124 }
            });
            expect(result).toBe('Mostrando 7 de 124 hospedajes, solo destacados.');
        });
    });

    // -------------------------------------------------------------------------
    // Sort
    // -------------------------------------------------------------------------

    describe('sort', () => {
        it('should render alpha asc sort phrase', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 10, globalTotal: 50 },
                sort: { key: 'name', direction: 'asc' },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('ordenados por nombre, A a Z');
        });

        it('should render alpha desc sort phrase', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 10, globalTotal: 50 },
                sort: { key: 'name', direction: 'desc' },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('ordenados por nombre, Z a A');
        });

        it('should render numeric asc sort phrase', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 10, globalTotal: 50 },
                sort: { key: 'price', direction: 'asc' },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('ordenados por precio, de menor a mayor');
        });

        it('should render numeric desc sort phrase', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 10, globalTotal: 50 },
                sort: { key: 'averageRating', direction: 'desc' },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('ordenados por calificación, de mayor a menor');
        });

        it('should render date desc sort phrase', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 10, globalTotal: 50 },
                sort: { key: 'createdAt', direction: 'desc' },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('ordenados por fecha de creación, más recientes primero');
        });

        it('should render date asc sort phrase', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 10, globalTotal: 50 },
                sort: { key: 'createdAt', direction: 'asc' },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('ordenados por fecha de creación, más antiguos primero');
        });

        it('should render boolean sort phrase', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 10, globalTotal: 50 },
                sort: { key: 'isFeatured', direction: 'desc' },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('ordenados por destacados, destacados primero');
        });

        it('should render generic fallback for unknown sort key', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 10, globalTotal: 50 },
                sort: { key: 'customField', direction: 'asc' },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('ordenados por customField, asc');
        });

        it('should not render sort phrase when sort is null', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 10, globalTotal: 50 },
                sort: null,
                catalogs: TEST_CATALOGS
            });
            expect(result).not.toContain('ordenados por');
        });

        it('should separate sort with comma when filters are active', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { featured: true },
                counts: { shown: 5, globalTotal: 50 },
                sort: { key: 'price', direction: 'asc' },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('solo destacados, ordenados por precio');
        });
    });

    // -------------------------------------------------------------------------
    // Full integration examples (exact match)
    // -------------------------------------------------------------------------

    describe('full integration examples', () => {
        it('example 1: no filters + sort name asc', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 124, globalTotal: 124 },
                sort: { key: 'name', direction: 'asc' },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe(
                'Mostrando 124 de 124 hospedajes, sin filtros activos, ordenados por nombre, A a Z.'
            );
        });

        it('example 2: single type + destination', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { types: ['HOTEL'], destinations: ['colon'] },
                counts: { shown: 18, globalTotal: 124, subjectTotal: 42 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe('Mostrando 18 de 42 hoteles en Colón.');
        });

        it('example 3: multiple types + destinations + price max', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {
                    types: ['HOTEL', 'CABIN'],
                    destinations: ['colon', 'concordia'],
                    price: { max: 20000 }
                },
                counts: { shown: 31, globalTotal: 124, subjectTotal: 67 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe(
                'Mostrando 31 de 67 hoteles y cabañas en Colón o Concordia, con precio de hasta $20.000.'
            );
        });

        it('example 4: full complex case', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {
                    types: ['HOTEL'],
                    text: 'centro',
                    price: { min: 8000, max: 20000, includeWithoutPrice: true },
                    guests: 3,
                    amenities: ['wifi', 'aire-acondicionado'],
                    minRating: 4,
                    includeWithoutRating: true,
                    featured: true
                },
                counts: { shown: 8, globalTotal: 124, subjectTotal: 42 },
                sort: { key: 'price', direction: 'asc' },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe(
                'Mostrando 8 de 42 hoteles que contienen "centro" en el nombre o la descripción, con precio entre $8.000 y $20.000 o sin precio definido, para al menos 3 huéspedes, con amenities como wifi y aire acondicionado, con calificación mínima de 4 o sin calificación, solo destacados, ordenados por precio, de menor a mayor.'
            );
        });

        it('example 5: zero results', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {
                    types: ['HOTEL'],
                    destinations: ['colon'],
                    guests: 10
                },
                counts: { shown: 0, globalTotal: 124, subjectTotal: 42 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe('Mostrando 0 de 42 hoteles en Colón, para al menos 10 huéspedes.');
        });

        it('example 6: no subjectTotal with featured only', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { featured: true },
                counts: { shown: 7, globalTotal: 124 }
            });
            expect(result).toBe('Mostrando 7 de 124 hospedajes, solo destacados.');
        });

        it('example 7: three types + destination + bedrooms + bathrooms + sort', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {
                    types: ['HOTEL', 'APART_HOTEL', 'CABIN'],
                    destinations: ['colon'],
                    bedrooms: 2,
                    bathrooms: 1
                },
                counts: { shown: 12, globalTotal: 124, subjectTotal: 61 },
                sort: { key: 'averageRating', direction: 'desc' },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe(
                'Mostrando 12 de 61 hoteles, apart hoteles y cabañas en Colón, con al menos 2 dormitorios, con al menos 1 baño, ordenados por calificación, de mayor a menor.'
            );
        });

        it('example 8: multiple types + destinations + services + amenities + rating', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {
                    types: ['HOTEL', 'APART_HOTEL'],
                    destinations: ['colon', 'concordia'],
                    services: ['desayuno'],
                    amenities: ['wifi', 'pileta'],
                    minRating: 4
                },
                counts: { shown: 25, globalTotal: 124, subjectTotal: 61 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe(
                'Mostrando 25 de 61 hoteles y apart hoteles en Colón o Concordia, con servicios como desayuno, con amenities como wifi y pileta, con calificación mínima de 4.'
            );
        });
    });

    // -------------------------------------------------------------------------
    // English locale
    // -------------------------------------------------------------------------

    describe('english locale', () => {
        it('should render no filters in English', () => {
            const result = buildAccommodationListingSummary({
                locale: 'en',
                filters: {},
                counts: { shown: 50, globalTotal: 50 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe('Showing 50 of 50 accommodations, no active filters.');
        });

        it('should render single type + destination in English', () => {
            const result = buildAccommodationListingSummary({
                locale: 'en',
                filters: { types: ['HOTEL'], destinations: ['colon'] },
                counts: { shown: 18, globalTotal: 124, subjectTotal: 42 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe('Showing 18 of 42 hotels in Colón.');
        });

        it('should render sort phrase in English', () => {
            const result = buildAccommodationListingSummary({
                locale: 'en',
                filters: {},
                counts: { shown: 10, globalTotal: 50 },
                sort: { key: 'name', direction: 'asc' },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('sorted by name, A to Z');
        });

        it('should render price in English locale', () => {
            const result = buildAccommodationListingSummary({
                locale: 'en',
                filters: { price: { max: 500 } },
                counts: { shown: 20, globalTotal: 100 }
            });
            expect(result).toContain('with price up to');
        });

        it('should render guests in English', () => {
            const result = buildAccommodationListingSummary({
                locale: 'en',
                filters: { guests: 3 },
                counts: { shown: 10, globalTotal: 50 }
            });
            expect(result).toContain('for at least 3 guests');
        });

        it('should render amenities in English using catalog labels', () => {
            const result = buildAccommodationListingSummary({
                locale: 'en',
                filters: { amenities: ['wifi', 'pileta'] },
                counts: { shown: 20, globalTotal: 50 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('with amenities like wifi and pool');
        });

        it('should render featured in English', () => {
            const result = buildAccommodationListingSummary({
                locale: 'en',
                filters: { featured: true },
                counts: { shown: 10, globalTotal: 50 }
            });
            expect(result).toContain('featured only');
        });

        it('should render multiple types joined with "and" in English', () => {
            const result = buildAccommodationListingSummary({
                locale: 'en',
                filters: { types: ['HOTEL', 'CABIN'] },
                counts: { shown: 20, globalTotal: 100, subjectTotal: 50 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toContain('hotels and cabins');
        });
    });

    // -------------------------------------------------------------------------
    // Edge cases
    // -------------------------------------------------------------------------

    describe('edge cases', () => {
        it('should handle 0 results', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 0, globalTotal: 0 }
            });
            expect(result).toBe('No se encontraron hospedajes.');
        });

        it('should handle completely empty filters object', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 10, globalTotal: 100 }
            });
            expect(result).toContain('sin filtros activos');
        });

        it('should end with a period', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { types: ['HOTEL'] },
                counts: { shown: 5, globalTotal: 100, subjectTotal: 10 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toMatch(/\.$/);
        });

        it('should not have double spaces', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {
                    types: ['HOTEL'],
                    text: 'centro',
                    price: { max: 20000 }
                },
                counts: { shown: 5, globalTotal: 100, subjectTotal: 20 },
                catalogs: TEST_CATALOGS
            });
            expect(result).not.toContain('  ');
        });

        it('should handle all filters active at once', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {
                    types: ['HOTEL'],
                    destinations: ['colon'],
                    text: 'centro',
                    price: { min: 5000, max: 30000, includeWithoutPrice: true },
                    guests: 4,
                    bedrooms: 2,
                    bathrooms: 1,
                    services: ['desayuno'],
                    amenities: ['wifi'],
                    minRating: 3,
                    includeWithoutRating: true,
                    featured: true
                },
                counts: { shown: 2, globalTotal: 124, subjectTotal: 42 },
                sort: { key: 'price', direction: 'asc' },
                catalogs: TEST_CATALOGS
            });
            // Should contain all parts
            expect(result).toContain('hoteles');
            expect(result).toContain('en Colón');
            expect(result).toContain('que contienen "centro"');
            expect(result).toContain('con precio entre');
            expect(result).toContain('para al menos 4 huéspedes');
            expect(result).toContain('con al menos 2 dormitorios');
            expect(result).toContain('con al menos 1 baño');
            expect(result).toContain('con servicios como desayuno');
            expect(result).toContain('con amenities como wifi');
            expect(result).toContain('con calificación mínima de 3');
            expect(result).toContain('solo destacados');
            expect(result).toContain('ordenados por precio');
            expect(result).toMatch(/\.$/);
        });

        it('should use default locale (es) when locale is not provided', () => {
            const result = buildAccommodationListingSummary({
                filters: {},
                counts: { shown: 10, globalTotal: 50 }
            });
            expect(result).toContain('Mostrando');
            expect(result).toContain('hospedajes');
        });
    });

    // -------------------------------------------------------------------------
    // Legacy mapper
    // -------------------------------------------------------------------------

    describe('legacy mapper', () => {
        it('should map types filter', () => {
            const result = mapLegacyFiltersToSummaryFilters({
                filters: [{ type: 'checkbox', key: 'types', values: ['HOTEL', 'CABIN'] }]
            });
            expect(result.types).toEqual(['HOTEL', 'CABIN']);
        });

        it('should map accommodationType alias', () => {
            const result = mapLegacyFiltersToSummaryFilters({
                filters: [{ type: 'checkbox', key: 'accommodationType', values: ['HOTEL'] }]
            });
            expect(result.types).toEqual(['HOTEL']);
        });

        it('should map destination filter', () => {
            const result = mapLegacyFiltersToSummaryFilters({
                filters: [{ type: 'checkbox', key: 'destination', values: ['colon', 'concordia'] }]
            });
            expect(result.destinations).toEqual(['colon', 'concordia']);
        });

        it('should map destinationIds alias', () => {
            const result = mapLegacyFiltersToSummaryFilters({
                filters: [{ type: 'select-search', key: 'destinationIds', values: ['colon'] }]
            });
            expect(result.destinations).toEqual(['colon']);
        });

        it('should map text filter (key=name)', () => {
            const result = mapLegacyFiltersToSummaryFilters({
                filters: [{ type: 'text', key: 'name', values: ['centro'] }]
            });
            expect(result.text).toBe('centro');
        });

        it('should map text filter (key=q)', () => {
            const result = mapLegacyFiltersToSummaryFilters({
                filters: [{ type: 'text', key: 'q', values: ['%hotel%'] }]
            });
            expect(result.text).toBe('hotel');
        });

        it('should not map text when type is not "text"', () => {
            const result = mapLegacyFiltersToSummaryFilters({
                filters: [{ type: 'checkbox', key: 'name', values: ['centro'] }]
            });
            expect(result.text).toBeUndefined();
        });

        it('should map price range filter', () => {
            const result = mapLegacyFiltersToSummaryFilters({
                filters: [{ type: 'range', key: 'price', values: [5000, 20000, true] }]
            });
            expect(result.price?.min).toBe(5000);
            expect(result.price?.max).toBe(20000);
            expect(result.price?.includeWithoutPrice).toBe(true);
        });

        it('should map dual-range price filter', () => {
            const result = mapLegacyFiltersToSummaryFilters({
                filters: [{ type: 'dual-range', key: 'price', values: [1000, 15000] }]
            });
            expect(result.price?.min).toBe(1000);
            expect(result.price?.max).toBe(15000);
        });

        it('should map minGuests stepper', () => {
            const result = mapLegacyFiltersToSummaryFilters({
                filters: [{ type: 'stepper', key: 'minGuests', values: [3] }]
            });
            expect(result.guests).toBe(3);
        });

        it('should map minBedrooms stepper', () => {
            const result = mapLegacyFiltersToSummaryFilters({
                filters: [{ type: 'stepper', key: 'minBedrooms', values: [2] }]
            });
            expect(result.bedrooms).toBe(2);
        });

        it('should map minBathrooms stepper', () => {
            const result = mapLegacyFiltersToSummaryFilters({
                filters: [{ type: 'stepper', key: 'minBathrooms', values: [1] }]
            });
            expect(result.bathrooms).toBe(1);
        });

        it('should map minRating stars filter', () => {
            const result = mapLegacyFiltersToSummaryFilters({
                filters: [{ type: 'stars', key: 'minRating', values: [4, true] }]
            });
            expect(result.minRating).toBe(4);
            expect(result.includeWithoutRating).toBe(true);
        });

        it('should map amenities icon-chips', () => {
            const result = mapLegacyFiltersToSummaryFilters({
                filters: [{ type: 'icon-chips', key: 'amenities', values: ['wifi', 'pileta'] }]
            });
            expect(result.amenities).toEqual(['wifi', 'pileta']);
        });

        it('should map features to services', () => {
            const result = mapLegacyFiltersToSummaryFilters({
                filters: [{ type: 'icon-chips', key: 'features', values: ['desayuno'] }]
            });
            expect(result.services).toEqual(['desayuno']);
        });

        it('should map isFeatured toggle', () => {
            const result = mapLegacyFiltersToSummaryFilters({
                filters: [{ type: 'toggle', key: 'isFeatured', values: [true] }]
            });
            expect(result.featured).toBe(true);
        });

        it('should silently skip unknown keys', () => {
            const result = mapLegacyFiltersToSummaryFilters({
                filters: [{ type: 'text', key: 'unknownField', values: ['value'] }]
            });
            expect(result).toEqual({});
        });

        it('should be tolerant of empty values arrays', () => {
            const result = mapLegacyFiltersToSummaryFilters({
                filters: [
                    { type: 'checkbox', key: 'types', values: [] },
                    { type: 'stepper', key: 'minGuests', values: [] }
                ]
            });
            expect(result.types).toBeUndefined();
            expect(result.guests).toBeUndefined();
        });

        it('should be tolerant of null/undefined values', () => {
            const result = mapLegacyFiltersToSummaryFilters({
                filters: [{ type: 'stepper', key: 'minGuests', values: [null, undefined] }]
            });
            expect(result.guests).toBeUndefined();
        });

        it('should be tolerant of empty filter array', () => {
            const result = mapLegacyFiltersToSummaryFilters({ filters: [] });
            expect(result).toEqual({});
        });

        it('should map multiple filter types at once', () => {
            const result = mapLegacyFiltersToSummaryFilters({
                filters: [
                    { type: 'checkbox', key: 'types', values: ['HOTEL', 'CABIN'] },
                    { type: 'checkbox', key: 'destination', values: ['colon'] },
                    { type: 'range', key: 'price', values: [5000, 20000, false] },
                    { type: 'stepper', key: 'minGuests', values: [4] },
                    { type: 'toggle', key: 'isFeatured', values: [true] }
                ]
            });
            expect(result.types).toEqual(['HOTEL', 'CABIN']);
            expect(result.destinations).toEqual(['colon']);
            expect(result.price?.min).toBe(5000);
            expect(result.price?.max).toBe(20000);
            expect(result.guests).toBe(4);
            expect(result.featured).toBe(true);
        });

        it('should integrate with buildAccommodationListingSummary after mapping', () => {
            const filters = mapLegacyFiltersToSummaryFilters({
                filters: [
                    { type: 'checkbox', key: 'types', values: ['HOTEL'] },
                    { type: 'checkbox', key: 'destination', values: ['colon'] }
                ]
            });
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters,
                counts: { shown: 18, globalTotal: 124, subjectTotal: 42 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe('Mostrando 18 de 42 hoteles en Colón.');
        });
    });

    // -------------------------------------------------------------------------
    // Spec examples — exact phrases from the functional specification
    //
    // These tests verify the EXACT output strings the product requires.
    // The `subjectTotal` field reflects how the page should call the builder:
    // when types are filtered, the API's `pagination.total` is already the
    // type-specific count, so the page passes it as `subjectTotal`.
    // -------------------------------------------------------------------------

    describe('spec examples — exact phrases', () => {
        // --- Spec example 1 ---------------------------------------------------
        it('single type + single destination → "hoteles en Colón"', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {
                    types: ['HOTEL'],
                    destinations: ['colon']
                },
                counts: { shown: 18, globalTotal: 42, subjectTotal: 42 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe('Mostrando 18 de 42 hoteles en Colón.');
        });

        // --- Spec example 2 ---------------------------------------------------
        it('two types + two destinations + price max → "hoteles y cabañas en Colón o Concordia, con precio de hasta $20.000"', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {
                    types: ['HOTEL', 'CABIN'],
                    destinations: ['colon', 'concordia'],
                    price: { max: 20000 }
                },
                counts: { shown: 31, globalTotal: 67, subjectTotal: 67 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe(
                'Mostrando 31 de 67 hoteles y cabañas en Colón o Concordia, con precio de hasta $20.000.'
            );
        });

        // --- Spec example 3 — full complex sentence ---------------------------
        it('type + text + price range + guests + amenities + rating + featured + sort → full sentence', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {
                    types: ['HOTEL'],
                    text: 'centro',
                    price: { min: 8000, max: 20000, includeWithoutPrice: true },
                    guests: 3,
                    amenities: ['wifi', 'aire-acondicionado'],
                    minRating: 4,
                    includeWithoutRating: true,
                    featured: true
                },
                counts: { shown: 8, globalTotal: 42, subjectTotal: 42 },
                sort: { key: 'price', direction: 'asc' },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe(
                'Mostrando 8 de 42 hoteles que contienen "centro" en el nombre o la descripción, con precio entre $8.000 y $20.000 o sin precio definido, para al menos 3 huéspedes, con amenities como wifi y aire acondicionado, con calificación mínima de 4 o sin calificación, solo destacados, ordenados por precio, de menor a mayor.'
            );
        });

        // --- Spec example 4 ---------------------------------------------------
        it('no filters + sort → "sin filtros activos, ordenados por nombre, A a Z"', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 124, globalTotal: 124 },
                sort: { key: 'name', direction: 'asc' },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe(
                'Mostrando 124 de 124 hospedajes, sin filtros activos, ordenados por nombre, A a Z.'
            );
        });

        // --- Additional combinations ------------------------------------------

        it('single type, no other filters, no sort → period only', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { types: ['CABIN'] },
                counts: { shown: 12, globalTotal: 12, subjectTotal: 12 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe('Mostrando 12 de 12 cabañas.');
        });

        it('single type + destination + bedrooms + bathrooms', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {
                    types: ['APARTMENT'],
                    destinations: ['federacion'],
                    bedrooms: 2,
                    bathrooms: 1
                },
                counts: { shown: 5, globalTotal: 20, subjectTotal: 20 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe(
                'Mostrando 5 de 20 departamentos en Federación, con al menos 2 dormitorios, con al menos 1 baño.'
            );
        });

        it('single type + text (no destination) → text joins without comma', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {
                    types: ['HOTEL'],
                    text: 'colonial'
                },
                counts: { shown: 3, globalTotal: 10, subjectTotal: 10 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe(
                'Mostrando 3 de 10 hoteles que contienen "colonial" en el nombre o la descripción.'
            );
        });

        it('single type + destination + text → text joins with comma', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {
                    types: ['HOTEL'],
                    destinations: ['colon'],
                    text: 'colonial'
                },
                counts: { shown: 3, globalTotal: 10, subjectTotal: 10 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe(
                'Mostrando 3 de 10 hoteles en Colón, que contienen "colonial" en el nombre o la descripción.'
            );
        });

        it('no types + price max + sort → hospedajes with modifier', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: { price: { max: 15000 } },
                counts: { shown: 30, globalTotal: 80 },
                sort: { key: 'price', direction: 'asc' },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe(
                'Mostrando 30 de 80 hospedajes, con precio de hasta $15.000, ordenados por precio, de menor a mayor.'
            );
        });

        it('two types + services + amenities + sort', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {
                    types: ['HOSTEL', 'HOTEL'],
                    services: ['desayuno', 'limpieza'],
                    amenities: ['wifi']
                },
                counts: { shown: 7, globalTotal: 25, subjectTotal: 25 },
                sort: { key: 'averageRating', direction: 'desc' },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe(
                'Mostrando 7 de 25 hostels y hoteles, con servicios como desayuno y limpieza, con amenities como wifi, ordenados por calificación, de mayor a menor.'
            );
        });

        it('single type + featured false (non-featured only)', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {
                    types: ['RESORT'],
                    featured: false
                },
                counts: { shown: 4, globalTotal: 8, subjectTotal: 8 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe('Mostrando 4 de 8 resorts, solo no destacados.');
        });

        it('no filters, no sort → sin filtros activos, no sort phrase', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 20, globalTotal: 124 },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe('Mostrando 20 de 124 hospedajes, sin filtros activos.');
        });

        it('three types + three destinations + price range + guests + sort', () => {
            const result = buildAccommodationListingSummary({
                locale: 'es',
                filters: {
                    types: ['HOTEL', 'CABIN', 'HOSTEL'],
                    destinations: ['colon', 'concordia', 'federacion'],
                    price: { min: 5000, max: 30000 },
                    guests: 2
                },
                counts: { shown: 15, globalTotal: 45, subjectTotal: 45 },
                sort: { key: 'isFeatured', direction: 'desc' },
                catalogs: TEST_CATALOGS
            });
            expect(result).toBe(
                'Mostrando 15 de 45 hoteles, cabañas y hostels en Colón, Concordia o Federación, con precio entre $5.000 y $30.000, para al menos 2 huéspedes, ordenados por destacados, destacados primero.'
            );
        });
    });
});
