import { describe, expect, it, vi } from 'vitest';
import { createCachedGeocoder } from '../../scripts/poi-pipeline/cache.js';
import { AUTO_GEOCODE_MARKER } from '../../scripts/poi-pipeline/constants.js';
import type { Geocoder, RawGeocodeHit } from '../../scripts/poi-pipeline/geocoder.js';
import { runPipeline } from '../../scripts/poi-pipeline/pipeline.js';
import type { RealDestinationRecord } from '../../scripts/poi-pipeline/reconcile.js';
import { geocodeAttempts } from '../../scripts/poi-pipeline/report.js';
import type { RawCsvRow } from '../../scripts/poi-pipeline/types.js';

function makeRow(overrides: Partial<RawCsvRow>): RawCsvRow {
    return {
        id: 'colon__x',
        destinationSlug: 'colon',
        destinationName: 'Colon',
        destinationTier: 'HIGH',
        relation: 'PRIMARY',
        name: 'X',
        description: 'Desc.',
        priority: 'MEDIUM',
        address: 'Calle 1, Colon',
        lat: '',
        lng: '',
        verified: 'False',
        source: '',
        verifiedAt: '',
        notes: 'Carga inicial.',
        categorySlugs: 'SQUARE',
        categoryNames: 'Square',
        keywords: 'a; b',
        nearbyDestinationSlugs: '',
        nearbyDestinationNames: '',
        ...overrides
    };
}

const HIT: RawGeocodeHit = {
    lat: -32.2174,
    long: -58.1326,
    importance: 0.8,
    featureClass: 'place',
    featureType: 'town',
    displayName: 'X',
    provider: 'nominatim'
};

const realDestinationSlugs = new Set(['colon', 'concordia']);
const realDestinations = new Map<string, RealDestinationRecord>([
    [
        'colon',
        {
            slug: 'colon',
            name: 'Colón',
            center: { lat: -32.217, long: -58.133 }
        }
    ],
    [
        'concordia',
        {
            slug: 'concordia',
            name: 'Concordia',
            center: { lat: -31.39296, long: -58.02089 }
        }
    ]
]);
const realCategorySlugs = new Set(['square', 'historic_site', 'park']);

describe('runPipeline (e2e machinery)', () => {
    it('emits one fixture per row with zero duplicate slugs (AC-1/AC-2)', async () => {
        // Arrange — municipalidad collides across two destinations
        const rows = [
            makeRow({
                id: 'colon__municipalidad',
                destinationSlug: 'colon',
                lat: '-1',
                lng: '-2',
                verified: 'True'
            }),
            makeRow({
                id: 'concordia__municipalidad',
                destinationSlug: 'concordia',
                lat: '-3',
                lng: '-4',
                verified: 'True'
            })
        ];
        const geocoder: Geocoder = { resolve: vi.fn(async () => HIT) };

        // Act
        const { fixtures } = await runPipeline({
            rows,
            geocoder,
            realDestinationSlugs,
            realDestinations,
            realCategorySlugs
        });

        // Assert
        expect(fixtures).toHaveLength(2);
        const slugs = fixtures.map((f) => f.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
        expect(slugs).toEqual(['colon_municipalidad', 'concordia_municipalidad']);
    });

    it('geocodes coordinate-less rows and stamps the auto-geocode marker', async () => {
        // Arrange
        const rows = [makeRow({ id: 'colon__plaza', lat: '', lng: '' })];
        const geocoder: Geocoder = { resolve: vi.fn(async () => HIT) };

        // Act
        const { fixtures, stats } = await runPipeline({
            rows,
            geocoder,
            realDestinationSlugs,
            realDestinations,
            realCategorySlugs
        });

        // Assert
        expect(fixtures[0]?.lat).toBe(-32.2174);
        expect(fixtures[0]?.verified).toBe(false);
        expect(fixtures[0]?.notes).toContain(AUTO_GEOCODE_MARKER);
        expect(stats.geocode.resolvedHigh).toBe(1);
        expect(geocoder.resolve).toHaveBeenCalledTimes(1);
    });

    it('does not geocode rows that already have coordinates', async () => {
        // Arrange
        const rows = [
            makeRow({ id: 'colon__plaza', lat: '-32.4', lng: '-58.2', verified: 'True' })
        ];
        const geocoder: Geocoder = { resolve: vi.fn(async () => HIT) };

        // Act
        const { stats } = await runPipeline({
            rows,
            geocoder,
            realDestinationSlugs,
            realDestinations,
            realCategorySlugs
        });

        // Assert
        expect(geocoder.resolve).not.toHaveBeenCalled();
        expect(stats.geocode.alreadyHadCoords).toBe(1);
    });

    it('report totals are internally consistent (AC-8)', async () => {
        // Arrange
        const rows = [
            makeRow({ id: 'colon__a', lat: '-1', lng: '-2' }),
            makeRow({ id: 'colon__b', lat: '', lng: '' })
        ];
        const geocoder: Geocoder = { resolve: vi.fn(async () => HIT) };

        // Act
        const { stats } = await runPipeline({
            rows,
            geocoder,
            realDestinationSlugs,
            realDestinations,
            realCategorySlugs
        });

        // Assert — attempts === coordinate-less rows; alreadyHad + attempts === totalRows
        const coordinateless = rows.filter((r) => r.lat === '').length;
        expect(geocodeAttempts(stats.geocode)).toBe(coordinateless);
        expect(stats.geocode.alreadyHadCoords + geocodeAttempts(stats.geocode)).toBe(
            stats.totalRows
        );
    });

    it('falls back to the second-tier geocoder only when the primary is unresolved', async () => {
        // Arrange — primary always misses; fallback resolves
        const rows = [makeRow({ id: 'colon__plaza', lat: '', lng: '' })];
        const primary: Geocoder = { resolve: vi.fn(async () => null) };
        const fallback: Geocoder = { resolve: vi.fn(async () => HIT) };

        // Act
        const { fixtures, stats } = await runPipeline({
            rows,
            geocoder: primary,
            fallbackGeocoder: fallback,
            realDestinationSlugs,
            realDestinations,
            realCategorySlugs
        });

        // Assert
        expect(primary.resolve).toHaveBeenCalledTimes(1);
        expect(fallback.resolve).toHaveBeenCalledTimes(1);
        expect(fixtures[0]?.lat).toBe(-32.2174);
        expect(stats.geocode.resolvedHigh).toBe(1);
        expect(stats.geocode.resolvedByFallback).toBe(1);
        expect(fallback.resolve).toHaveBeenCalledWith('Calle 1, Colon, Entre Rios, Argentina');
    });

    it('does NOT call the fallback when the primary already resolves', async () => {
        // Arrange
        const rows = [makeRow({ id: 'colon__plaza', lat: '', lng: '' })];
        const primary: Geocoder = { resolve: vi.fn(async () => HIT) };
        const fallback: Geocoder = { resolve: vi.fn(async () => HIT) };

        // Act
        const { stats } = await runPipeline({
            rows,
            geocoder: primary,
            fallbackGeocoder: fallback,
            realDestinationSlugs,
            realDestinations,
            realCategorySlugs
        });

        // Assert
        expect(fallback.resolve).not.toHaveBeenCalled();
        expect(stats.geocode.resolvedByFallback).toBe(0);
    });

    it('is idempotent: a warm-cache re-run is byte-identical and makes zero network calls (AC-7)', async () => {
        // Arrange
        const rows = [makeRow({ id: 'colon__plaza', lat: '', lng: '' })];
        const inner: Geocoder = { resolve: vi.fn(async () => HIT) };
        const io = { contents: null as string | null };
        const cacheIO = {
            read: () => io.contents,
            write: (c: string) => {
                io.contents = c;
            }
        };

        // Act — first run warms the cache
        const cached1 = createCachedGeocoder({ geocoder: inner, io: cacheIO });
        const first = await runPipeline({
            rows,
            geocoder: cached1,
            realDestinationSlugs,
            realDestinations,
            realCategorySlugs
        });

        // Second run reads the warm cache
        const cached2 = createCachedGeocoder({ geocoder: inner, io: cacheIO });
        const second = await runPipeline({
            rows,
            geocoder: cached2,
            realDestinationSlugs,
            realDestinations,
            realCategorySlugs
        });

        // Assert
        expect(JSON.stringify(second.fixtures)).toBe(JSON.stringify(first.fixtures));
        expect(cached2.networkCalls).toBe(0);
        expect(inner.resolve).toHaveBeenCalledTimes(1); // only the first run hit the provider
    });

    it('rejects a far geocode hit and leaves coordinates null', async () => {
        const rows = [
            makeRow({ id: 'colon__monumento', address: 'Laprida 86, Colón, Entre Ríos' })
        ];
        const geocoder: Geocoder = {
            resolve: vi.fn(async () => ({
                ...HIT,
                lat: -31.7179736,
                long: -60.537909299999995,
                displayName: 'Monumento a Justo José de Urquiza'
            }))
        };

        const { fixtures, stats } = await runPipeline({
            rows,
            geocoder,
            realDestinationSlugs,
            realDestinations,
            realCategorySlugs
        });

        expect(fixtures[0]?.lat).toBeNull();
        expect(fixtures[0]?.long).toBeNull();
        expect(stats.geocode.unresolved).toBe(1);
    });

    it('rejects a town-centroid fallback hit for a destination-only address', async () => {
        const rows = [
            makeRow({
                id: 'concordia__centro',
                destinationSlug: 'concordia',
                destinationName: 'Concordia',
                address: 'Concordia, Entre Ríos'
            })
        ];
        const primary: Geocoder = { resolve: vi.fn(async () => null) };
        const fallback: Geocoder = {
            resolve: vi.fn(async () => ({
                ...HIT,
                lat: -31.39296,
                long: -58.02089,
                displayName: 'Concordia'
            }))
        };

        const { fixtures, stats } = await runPipeline({
            rows,
            geocoder: primary,
            fallbackGeocoder: fallback,
            realDestinationSlugs,
            realDestinations,
            realCategorySlugs
        });

        expect(fixtures[0]?.lat).toBeNull();
        expect(fixtures[0]?.long).toBeNull();
        expect(stats.geocode.unresolved).toBe(1);
        expect(fallback.resolve).toHaveBeenCalledWith('X, Concordia, Entre Ríos, Argentina');
    });

    it('does not overwrite a verified row that already has coordinates', async () => {
        const rows = [
            makeRow({
                id: 'colon__verified',
                lat: '-32.217',
                lng: '-58.133',
                verified: 'True',
                notes: 'Human-verified.'
            })
        ];
        const geocoder: Geocoder = { resolve: vi.fn(async () => HIT) };

        const { fixtures } = await runPipeline({
            rows,
            geocoder,
            realDestinationSlugs,
            realDestinations,
            realCategorySlugs
        });

        expect(geocoder.resolve).not.toHaveBeenCalled();
        expect(fixtures[0]).toMatchObject({
            lat: -32.217,
            long: -58.133,
            verified: true,
            notes: 'Human-verified.'
        });
    });

    it('nulls exact duplicate auto-geocoded coordinates instead of keeping stacked pins', async () => {
        const rows = [
            makeRow({ id: 'colon__a', name: 'A', address: 'Laprida 86, Colón, Entre Ríos' }),
            makeRow({ id: 'colon__b', name: 'B', address: '12 de Abril 100, Colón, Entre Ríos' })
        ];
        const geocoder: Geocoder = {
            resolve: vi.fn(async () => ({
                ...HIT,
                lat: -32.2174,
                long: -58.1326,
                displayName: 'Colón'
            }))
        };

        const { fixtures } = await runPipeline({
            rows,
            geocoder,
            realDestinationSlugs,
            realDestinations,
            realCategorySlugs
        });

        expect(fixtures).toHaveLength(2);
        expect(fixtures.every((fixture) => fixture.lat === null && fixture.long === null)).toBe(
            true
        );
        expect(
            fixtures.every((fixture) => fixture.notes?.includes(AUTO_GEOCODE_MARKER) === false)
        ).toBe(true);
    });
});
