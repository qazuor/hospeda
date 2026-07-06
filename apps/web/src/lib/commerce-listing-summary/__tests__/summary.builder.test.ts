/**
 * Tests for the commerce listing summary builder (gastronomy + experience,
 * BETA-119).
 */

import { describe, expect, it } from 'vitest';
import { buildExperienceListingSummary, buildGastronomyListingSummary } from '../index';
import {
    DEFAULT_EXPERIENCE_TYPES,
    DEFAULT_GASTRONOMY_TYPES,
    DEFAULT_PRICE_RANGES
} from '../summary.catalogs';
import type { SummaryCatalogs } from '../summary.types';

const DESTINATIONS: SummaryCatalogs['destinations'] = [
    { key: 'colon-id', label: { es: 'Colón', en: 'Colón' } },
    { key: 'concordia-id', label: { es: 'Concordia', en: 'Concordia' } }
];

describe('buildGastronomyListingSummary', () => {
    describe('no filters', () => {
        it('should render the generic subject with no-filters phrase', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 9, total: 18 }
            });
            expect(result).toBe(
                'Mostrando 9 de 18 establecimientos gastronómicos, sin filtros activos.'
            );
        });

        it('should append the gendered sort phrase after the no-filters phrase', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 9, total: 18 },
                sort: { sortKey: 'featured' }
            });
            expect(result).toBe(
                'Mostrando 9 de 18 establecimientos gastronómicos, sin filtros activos, ordenados con los destacados primero.'
            );
        });

        it('should use the singular subject when total is 1', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 1, total: 1 }
            });
            expect(result).toBe(
                'Mostrando 1 de 1 establecimiento gastronómico, sin filtros activos.'
            );
        });

        it('should render in English', () => {
            const result = buildGastronomyListingSummary({
                locale: 'en',
                filters: {},
                counts: { shown: 9, total: 18 }
            });
            expect(result).toBe('Showing 9 of 18 gastronomic establishments, no active filters.');
        });
    });

    describe('type filter', () => {
        it('should flow the type into the subject', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: { type: 'RESTAURANT' },
                counts: { shown: 5, total: 12 },
                catalogs: { types: DEFAULT_GASTRONOMY_TYPES }
            });
            expect(result).toBe('Mostrando 5 de 12 establecimientos gastronómicos de restaurante.');
        });

        it('should not show "sin filtros activos" once destination is also active', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: { type: 'BAR', destinationId: 'colon-id' },
                counts: { shown: 3, total: 3 },
                catalogs: { types: DEFAULT_GASTRONOMY_TYPES, destinations: DESTINATIONS }
            });
            expect(result).toBe('Mostrando 3 de 3 establecimientos gastronómicos de bar en Colón.');
        });

        it('should fall back to the raw key when type is not in the catalog', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: { type: 'UNKNOWN' },
                counts: { shown: 1, total: 1 }
            });
            expect(result).toContain('de UNKNOWN');
        });
    });

    describe('destination filter', () => {
        it('should render a single destination', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: { destinationId: 'concordia-id' },
                counts: { shown: 4, total: 10 },
                catalogs: { destinations: DESTINATIONS }
            });
            expect(result).toBe('Mostrando 4 de 10 establecimientos gastronómicos en Concordia.');
        });
    });

    describe('text filter', () => {
        it('should join with a space when destination is NOT active', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: { text: 'pizza' },
                counts: { shown: 2, total: 20 }
            });
            expect(result).toBe(
                'Mostrando 2 de 20 establecimientos gastronómicos que contienen "pizza" en el nombre o la descripción.'
            );
        });

        it('should join with a comma when destination IS active', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: { destinationId: 'colon-id', text: 'pizza' },
                counts: { shown: 2, total: 10 },
                catalogs: { destinations: DESTINATIONS }
            });
            expect(result).toBe(
                'Mostrando 2 de 10 establecimientos gastronómicos en Colón, que contienen "pizza" en el nombre o la descripción.'
            );
        });

        it('should strip surrounding % wildcards', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: { text: '%pizza%' },
                counts: { shown: 2, total: 20 }
            });
            expect(result).toContain('"pizza"');
            expect(result).not.toContain('%');
        });
    });

    describe('price range filter (gastronomy only)', () => {
        it('should render the price-range label', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: { priceRange: 'BUDGET' },
                counts: { shown: 6, total: 30 },
                catalogs: { priceRanges: DEFAULT_PRICE_RANGES }
            });
            expect(result).toBe(
                'Mostrando 6 de 30 establecimientos gastronómicos, con precios económicos.'
            );
        });

        it('should render in English', () => {
            const result = buildGastronomyListingSummary({
                locale: 'en',
                filters: { priceRange: 'PREMIUM' },
                counts: { shown: 6, total: 30 },
                catalogs: { priceRanges: DEFAULT_PRICE_RANGES }
            });
            expect(result).toContain('with premium');
        });
    });

    describe('minRating filter', () => {
        it('should render an integer rating without decimals', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: { minRating: 4 },
                counts: { shown: 8, total: 30 }
            });
            expect(result).toContain('con calificación mínima de 4');
        });

        it('should render a decimal rating with a comma in es', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: { minRating: 4.5 },
                counts: { shown: 8, total: 30 }
            });
            expect(result).toContain('con calificación mínima de 4,5');
        });

        it('should render a decimal rating with a dot in en', () => {
            const result = buildGastronomyListingSummary({
                locale: 'en',
                filters: { minRating: 4.5 },
                counts: { shown: 8, total: 30 }
            });
            expect(result).toContain('with minimum rating of 4.5');
        });
    });

    describe('featured filter', () => {
        it('should render the masculine "solo destacados" phrase', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: { isFeatured: true },
                counts: { shown: 7, total: 18 }
            });
            expect(result).toBe(
                'Mostrando 7 de 18 establecimientos gastronómicos, solo destacados.'
            );
        });

        it('should not be active when isFeatured is falsy', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: { isFeatured: undefined },
                counts: { shown: 18, total: 18 }
            });
            expect(result).toContain('sin filtros activos');
        });
    });

    describe('sort', () => {
        it('should render the ratingDesc phrase (gender-invariant fragment)', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 10, total: 10 },
                sort: { sortKey: 'ratingDesc' }
            });
            expect(result).toContain('ordenados por mejor calificación');
        });

        it('should render the newest phrase', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 10, total: 10 },
                sort: { sortKey: 'newest' }
            });
            expect(result).toContain('ordenados por más recientes');
        });

        it('should render the nameAsc phrase', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 10, total: 10 },
                sort: { sortKey: 'nameAsc' }
            });
            expect(result).toContain('ordenados por nombre, A a Z');
        });

        it('should not render a sort phrase for an unknown key', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 10, total: 10 },
                sort: { sortKey: 'bogus' }
            });
            expect(result).not.toContain('ordenados');
        });

        it('should not render a sort phrase when sort is omitted', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 10, total: 10 }
            });
            expect(result).not.toContain('ordenados');
        });
    });

    describe('zero results', () => {
        it('should render the "no results found" sentence', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: { type: 'BAR' },
                counts: { shown: 0, total: 0 },
                catalogs: { types: DEFAULT_GASTRONOMY_TYPES }
            });
            expect(result).toBe('No se encontraron establecimientos gastronómicos de bar.');
        });
    });

    describe('full integration example', () => {
        it('should combine type + destination + text + priceRange + minRating + featured + sort', () => {
            const result = buildGastronomyListingSummary({
                locale: 'es',
                filters: {
                    type: 'RESTAURANT',
                    destinationId: 'colon-id',
                    text: 'centro',
                    priceRange: 'MID',
                    minRating: 4,
                    isFeatured: true
                },
                counts: { shown: 2, total: 5 },
                sort: { sortKey: 'ratingDesc' },
                catalogs: {
                    types: DEFAULT_GASTRONOMY_TYPES,
                    destinations: DESTINATIONS,
                    priceRanges: DEFAULT_PRICE_RANGES
                }
            });
            expect(result).toBe(
                'Mostrando 2 de 5 establecimientos gastronómicos de restaurante en Colón, que contienen "centro" en el nombre o la descripción, con precios moderados, con calificación mínima de 4, solo destacados, ordenados por mejor calificación.'
            );
        });
    });
});

describe('buildExperienceListingSummary', () => {
    describe('no filters', () => {
        it('should render the generic feminine subject with no-filters phrase', () => {
            const result = buildExperienceListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 3, total: 4 }
            });
            expect(result).toBe('Mostrando 3 de 4 experiencias, sin filtros activos.');
        });

        it('should append the feminine gendered sort phrase', () => {
            const result = buildExperienceListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 3, total: 4 },
                sort: { sortKey: 'featured' }
            });
            expect(result).toBe(
                'Mostrando 3 de 4 experiencias, sin filtros activos, ordenadas con las destacadas primero.'
            );
        });

        it('should use the singular subject when total is 1', () => {
            const result = buildExperienceListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 1, total: 1 }
            });
            expect(result).toBe('Mostrando 1 de 1 experiencia, sin filtros activos.');
        });

        it('should render in English', () => {
            const result = buildExperienceListingSummary({
                locale: 'en',
                filters: {},
                counts: { shown: 3, total: 4 }
            });
            expect(result).toBe('Showing 3 of 4 experiences, no active filters.');
        });
    });

    describe('type filter', () => {
        it('should flow the type into the subject', () => {
            const result = buildExperienceListingSummary({
                locale: 'es',
                filters: { type: 'KAYAK_RENTAL' },
                counts: { shown: 2, total: 6 },
                catalogs: { types: DEFAULT_EXPERIENCE_TYPES }
            });
            expect(result).toBe('Mostrando 2 de 6 experiencias de alquiler de kayak.');
        });
    });

    describe('price range filter should never apply to experiences', () => {
        it('should ignore a stray priceRange value (hasPriceRange=false)', () => {
            // `priceRange` is a shared field on `CommerceSummaryFilters` (used by
            // gastronomy) but must be defensively ignored by the experience
            // entity config, which sets `hasPriceRange: false` — the
            // experiences page itself never reads/sends this filter.
            const result = buildExperienceListingSummary({
                locale: 'es',
                filters: { priceRange: 'BUDGET' },
                counts: { shown: 6, total: 6 }
            });
            expect(result).not.toContain('precios');
            expect(result).toContain('sin filtros activos');
        });
    });

    describe('featured filter', () => {
        it('should render the feminine "solo destacadas" phrase', () => {
            const result = buildExperienceListingSummary({
                locale: 'es',
                filters: { isFeatured: true },
                counts: { shown: 5, total: 6 }
            });
            expect(result).toBe('Mostrando 5 de 6 experiencias, solo destacadas.');
        });
    });

    describe('minRating filter', () => {
        it('should render the rating phrase', () => {
            const result = buildExperienceListingSummary({
                locale: 'es',
                filters: { minRating: 3.5 },
                counts: { shown: 4, total: 6 }
            });
            expect(result).toContain('con calificación mínima de 3,5');
        });
    });

    describe('destination + text joining', () => {
        it('should join text with a comma once destination is active', () => {
            const result = buildExperienceListingSummary({
                locale: 'es',
                filters: { destinationId: 'colon-id', text: 'kayak' },
                counts: { shown: 1, total: 1 },
                catalogs: { destinations: DESTINATIONS }
            });
            expect(result).toBe(
                'Mostrando 1 de 1 experiencia en Colón, que contienen "kayak" en el nombre o la descripción.'
            );
        });
    });

    describe('zero results', () => {
        it('should render the "no results found" sentence', () => {
            const result = buildExperienceListingSummary({
                locale: 'es',
                filters: {},
                counts: { shown: 0, total: 0 }
            });
            expect(result).toBe('No se encontraron experiencias.');
        });
    });

    describe('full integration example', () => {
        it('should combine type + destination + text + minRating + featured + sort', () => {
            const result = buildExperienceListingSummary({
                locale: 'es',
                filters: {
                    type: 'BOAT_TRIP',
                    destinationId: 'concordia-id',
                    text: 'atardecer',
                    minRating: 4.5,
                    isFeatured: true
                },
                counts: { shown: 2, total: 3 },
                sort: { sortKey: 'newest' },
                catalogs: { types: DEFAULT_EXPERIENCE_TYPES, destinations: DESTINATIONS }
            });
            expect(result).toBe(
                'Mostrando 2 de 3 experiencias de paseo en lancha en Concordia, que contienen "atardecer" en el nombre o la descripción, con calificación mínima de 4,5, solo destacadas, ordenadas por más recientes.'
            );
        });
    });
});
