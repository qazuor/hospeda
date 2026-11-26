import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    ACCOMMODATION_LISTING_FILTER_PARAMS,
    LISTING_NON_FILTER_PARAMS
} from '../listing-filter-params';
import { parseAccommodationListingFilters } from '../parse-listing-filters';

const parse = (query: string, ignoreTypeFacet?: boolean) =>
    parseAccommodationListingFilters({ searchParams: new URLSearchParams(query), ignoreTypeFacet });

describe('accommodation listing URL allowlist', () => {
    it('keeps URL controls out of the API filter payload and unknown params out of pagination', () => {
        const query = 'categories=x&foo=bar&page=2&sortBy=nameAsc&sortOrder=desc';

        const result = parse(query);

        expect(Object.values(result.apiQuery).every((v) => v === undefined)).toBe(true);
        expect(result.paginationParams.toString()).toBe('sortBy=nameAsc&sortOrder=desc');
        expect(LISTING_NON_FILTER_PARAMS).toEqual(['page', 'sortBy', 'sortOrder']);
    });

    it('preserves every accepted filter in pagination and parses valid API filters', () => {
        const query = new URLSearchParams({
            q: 'centro',
            types: 'HOTEL,CABIN',
            type: 'HOTEL',
            destinationIds: 'a,b',
            minPrice: '100',
            maxPrice: '200',
            includeNoPrice: 'false',
            adults: '2',
            children: '1',
            minBedrooms: '2',
            minBathrooms: '1',
            features: 'feature',
            amenities: 'amenity',
            hasWifi: 'true',
            hasPool: 'true',
            hasParking: 'true',
            allowsPets: 'true',
            minRating: '3',
            includeNoReviews: 'false',
            isFeatured: 'true',
            latitude: '-32.4',
            longitude: '-58.2',
            radius: '5',
            poiId: 'abc',
            poiSlug: 'slug',
            checkIn: '2026-12-01',
            checkOut: '2026-12-05'
        });

        const result = parse(query.toString());

        expect([...query.keys()].sort()).toEqual([...ACCOMMODATION_LISTING_FILTER_PARAMS].sort());
        expect(Object.fromEntries(result.paginationParams)).toEqual(Object.fromEntries(query));
        expect(result.apiQuery).toMatchObject({
            q: 'centro',
            types: 'HOTEL,CABIN',
            destinationIds: 'a,b',
            minPrice: 100,
            maxPrice: 200,
            includeNoPrice: false,
            minGuests: 3,
            minBedrooms: 2,
            minBathrooms: 1,
            features: 'feature',
            amenities: 'amenity',
            hasWifi: true,
            hasPool: true,
            hasParking: true,
            allowsPets: true,
            minRating: 3,
            includeNoReviews: false,
            isFeatured: true,
            latitude: -32.4,
            longitude: -58.2,
            radius: 5,
            poiId: 'abc',
            poiSlug: undefined,
            checkIn: '2026-12-01',
            checkOut: '2026-12-05'
        });
    });

    it('accepts legacy singular types and ignores query types when fixed by the route', () => {
        expect(parse('type=HOTEL').apiQuery.type).toBe('HOTEL');
        const facet = parse('types=HOTEL&type=CABIN&q=x', true);
        expect(facet.apiQuery).toMatchObject({ type: undefined, types: undefined, q: 'x' });
        expect(facet.paginationParams.toString()).toBe('q=x');
    });

    it('does not forward malformed booleans, incomplete geography, or invalid date pairs', () => {
        const malformed = parse(
            'hasWifi=false&hasPool=yes&includeNoPrice=true&minBathrooms=&radius=5'
        );
        expect(malformed.apiQuery).toMatchObject({
            hasWifi: undefined,
            hasPool: undefined,
            includeNoPrice: undefined,
            minBathrooms: undefined,
            radius: undefined
        });
        for (const query of [
            'checkIn=2026-12-05&checkOut=2026-12-01',
            'checkIn=2026-12-01',
            'checkIn=nope&checkOut=2026-12-05'
        ]) {
            expect(parse(query).apiQuery.checkIn).toBeUndefined();
        }
    });

    it.each(['index.astro', 'tipo/[type]/index.astro'])('uses the shared parser in %s', (page) => {
        const source = readFileSync(
            resolve(__dirname, `../../../pages/[lang]/alojamientos/${page}`),
            'utf8'
        );

        expect(source).toContain('parseAccommodationListingFilters({');
        for (const key of ACCOMMODATION_LISTING_FILTER_PARAMS) {
            expect(source).not.toContain(`searchParams.get('${key}')`);
        }
    });
});
