import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAccommodationListingSummary } from '../../accommodation-listing-summary';
import { SUMMARY_FILTER_DESCRIPTOR_KEYS } from '../../accommodation-listing-summary/summary.descriptors';
import {
    ACCOMMODATION_LISTING_FILTER_PARAMS,
    LISTING_NON_FILTER_PARAMS
} from '../listing-filter-params';
import { parseAccommodationListingFilters } from '../parse-listing-filters';

const parse = (query: string, ignoreTypeFacet?: boolean) =>
    parseAccommodationListingFilters({ searchParams: new URLSearchParams(query), ignoreTypeFacet });

describe('parseAccommodationListingFilters allowlist', () => {
    it('never forwards or summarises a param outside the allowlist (?categories=)', () => {
        const withUnknown = parse('categories=x&foo=bar&page=2&sortBy=nameAsc');
        const withoutUnknown = parse('page=2&sortBy=nameAsc');

        expect(withUnknown.apiQuery).toEqual(withoutUnknown.apiQuery);
        expect(withUnknown.summaryFilters).toEqual(withoutUnknown.summaryFilters);
        expect(JSON.stringify(withUnknown.apiQuery)).not.toMatch(/categories|foo/);
        expect(JSON.stringify(withUnknown.values)).not.toMatch(/categories|foo/);
    });

    it('does not let a non-filter param leak into the API query', () => {
        const parsed = parse('page=3&sortBy=priceAsc&sortOrder=desc');
        expect(Object.values(parsed.apiQuery).every((v) => v === undefined)).toBe(true);
        expect(LISTING_NON_FILTER_PARAMS).toEqual(['page', 'sortBy', 'sortOrder']);
    });

    it('keeps legitimate filters working and prefers poiId over poiSlug', () => {
        const parsed = parse(
            'types=HOTEL,CABIN&q=centro&minPrice=100&adults=2&children=1&hasWifi=true&checkIn=2026-12-01&checkOut=2026-12-05&latitude=-32.4&longitude=-58.2&radius=5&poiId=abc&poiSlug=slug'
        );
        expect(parsed.apiQuery).toMatchObject({
            types: 'HOTEL,CABIN',
            q: 'centro',
            minPrice: 100,
            minGuests: 3,
            hasWifi: true,
            checkIn: '2026-12-01',
            checkOut: '2026-12-05',
            latitude: -32.4,
            longitude: -58.2,
            radius: 5,
            poiId: 'abc',
            poiSlug: undefined
        });
    });

    it('ignores the type facet when the URL fixes it', () => {
        const parsed = parse('types=HOTEL&type=CABIN&q=x', true);
        expect(parsed.apiQuery.types).toBeUndefined();
        expect(parsed.apiQuery.type).toBeUndefined();
        expect(parsed.apiQuery.q).toBe('x');
    });

    it('falls back to the legacy ?type= for the summary types', () => {
        expect(parse('type=HOTEL').summaryFilters.types).toEqual(['HOTEL']);
    });
});

describe('allowlist and summary share one source', () => {
    const registryKeys = new Set<string>(
        ACCOMMODATION_LISTING_FILTER_PARAMS.map((p) => p.summaryKey)
    );

    it('every allowlisted param maps to a summary descriptor (or the types subject)', () => {
        for (const key of registryKeys) {
            const known = key === 'types' || SUMMARY_FILTER_DESCRIPTOR_KEYS.includes(key);
            expect(known, `summary facet "${key}" has no descriptor`).toBe(true);
        }
    });

    it('every summary descriptor is fed by an allowlisted param', () => {
        for (const key of SUMMARY_FILTER_DESCRIPTOR_KEYS) {
            expect(registryKeys.has(key), `descriptor "${key}" has no allowlisted param`).toBe(
                true
            );
        }
    });

    const scenarios: Record<string, string> = {
        q: 'q=hotel',
        types: 'types=HOTEL&destinationIds=a',
        type: 'type=HOTEL&destinationIds=a',
        destinationIds: 'destinationIds=a',
        minPrice: 'minPrice=10',
        maxPrice: 'maxPrice=20',
        includeNoPrice: 'includeNoPrice=false&minPrice=10',
        adults: 'adults=2',
        children: 'children=1',
        minBedrooms: 'minBedrooms=1',
        minBathrooms: 'minBathrooms=1',
        features: 'features=a',
        amenities: 'amenities=a',
        hasWifi: 'hasWifi=true',
        hasPool: 'hasPool=true',
        hasParking: 'hasParking=true',
        allowsPets: 'allowsPets=true',
        minRating: 'minRating=4',
        includeNoReviews: 'includeNoReviews=false&minRating=4',
        isFeatured: 'isFeatured=true',
        latitude: 'latitude=-32.4&longitude=-58.2&radius=5',
        longitude: 'latitude=-32.4&longitude=-58.2&radius=5',
        radius: 'latitude=-32.4&longitude=-58.2&radius=5',
        poiId: 'poiId=x&radius=5',
        poiSlug: 'poiSlug=x&radius=5',
        checkIn: 'checkIn=2026-12-01&checkOut=2026-12-05',
        checkOut: 'checkIn=2026-12-01&checkOut=2026-12-05'
    };

    it('has a scenario for every allowlisted param (adding one without a case fails)', () => {
        expect(Object.keys(scenarios).sort()).toEqual(
            ACCOMMODATION_LISTING_FILTER_PARAMS.map((p) => p.param).sort()
        );
    });

    for (const [param, query] of Object.entries(scenarios)) {
        it(`the summary reflects ?${param}`, () => {
            const { summaryFilters } = parse(query);
            const sentence = buildAccommodationListingSummary({
                locale: 'es',
                filters: summaryFilters,
                counts: { shown: 1, globalTotal: 1 }
            });
            expect(sentence).not.toContain('sin filtros activos');
        });
    }
});

describe('listing pages use the shared parser', () => {
    const pages = [
        'src/pages/[lang]/alojamientos/index.astro',
        'src/pages/[lang]/alojamientos/tipo/[type]/index.astro'
    ];
    for (const page of pages) {
        it(`${page} reads filters only through the parser`, () => {
            const source = readFileSync(resolve(process.cwd(), page), 'utf8');
            expect(source).toContain('parseAccommodationListingFilters');
            expect(source).not.toMatch(
                /searchParams\.get\('(hasWifi|minPrice|amenities|categories)'\)/
            );
        });
    }
});
