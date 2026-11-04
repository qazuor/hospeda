import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildAccommodationListingSummary } from '../../accommodation-listing-summary';
import { SUMMARY_FILTER_DESCRIPTOR_KEYS } from '../../accommodation-listing-summary/summary.descriptors';
import {
    ACCOMMODATION_LISTING_FILTER_PARAMS,
    LISTING_NON_FILTER_PARAMS
} from '../listing-filter-params';
import {
    parseAccommodationListingFilters,
    resolveSummarySubjectTotal
} from '../parse-listing-filters';

const parse = (query: string, ignoreTypeFacet?: boolean) =>
    parseAccommodationListingFilters({ searchParams: new URLSearchParams(query), ignoreTypeFacet });

/** Mirrors what `alojamientos/index.astro` does with the parser output. */
const summarize = (query: string, locale: 'es' | 'en' | 'pt' = 'es') => {
    const { summaryFilters } = parse(query);
    return buildAccommodationListingSummary({
        locale,
        filters: summaryFilters,
        counts: {
            shown: 1,
            globalTotal: 5,
            subjectTotal: resolveSummarySubjectTotal({ summaryFilters, total: 5 })
        }
    });
};

describe('parseAccommodationListingFilters allowlist', () => {
    it('never forwards, summarises or paginates a param outside the allowlist (?categories=)', () => {
        const withUnknown = parse('categories=x&foo=bar&page=2&sortBy=nameAsc');
        const withoutUnknown = parse('page=2&sortBy=nameAsc');

        expect(withUnknown.apiQuery).toEqual(withoutUnknown.apiQuery);
        expect(withUnknown.summaryFilters).toEqual(withoutUnknown.summaryFilters);
        expect(JSON.stringify(withUnknown.apiQuery)).not.toMatch(/categories|foo/);
        expect(withUnknown.paginationParams.toString()).toBe('sortBy=nameAsc');
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

    it('keeps the legacy coercion and defaults of every old param', () => {
        const parsed = parse(
            'hasWifi=false&hasPool=yes&isFeatured=true&includeNoPrice=true&includeNoReviews=false&minBedrooms=2&minBathrooms=&type=HOTEL&destinationIds=a,b'
        );
        expect(parsed.apiQuery).toMatchObject({
            hasWifi: undefined,
            hasPool: undefined,
            isFeatured: true,
            includeNoPrice: undefined,
            includeNoReviews: false,
            minBedrooms: 2,
            minBathrooms: undefined,
            type: 'HOTEL',
            destinationIds: 'a,b'
        });
        // Radius without a coordinate pair or POI sends no geo filter at all.
        expect(parse('radius=5').apiQuery.radius).toBeUndefined();
    });

    it('forwards the legacy singular ?type= to the API query', () => {
        expect(parse('type=HOTEL').apiQuery.type).toBe('HOTEL');
        expect(parse('types=HOTEL').apiQuery.types).toBe('HOTEL');
    });

    it('ignores the type facet when the URL fixes it', () => {
        const parsed = parse('types=HOTEL&type=CABIN&q=x', true);
        expect(parsed.apiQuery.types).toBeUndefined();
        expect(parsed.apiQuery.type).toBeUndefined();
        expect(parsed.apiQuery.q).toBe('x');
        expect(parsed.paginationParams.toString()).toBe('q=x');
    });

    it('sends the availability pair only when it is valid, and describes only that pair', () => {
        const valid = parse('checkIn=2026-12-01&checkOut=2026-12-05');
        expect(valid.apiQuery).toMatchObject({ checkIn: '2026-12-01', checkOut: '2026-12-05' });
        expect(valid.summaryFilters.availability).toEqual({
            checkIn: '2026-12-01',
            checkOut: '2026-12-05'
        });

        for (const bad of [
            'checkIn=2026-12-05&checkOut=2026-12-01',
            'checkIn=2026-12-01',
            'checkIn=nope&checkOut=2026-12-05'
        ]) {
            const parsed = parse(bad);
            expect(parsed.apiQuery.checkIn, bad).toBeUndefined();
            expect(parsed.summaryFilters.availability, bad).toBeUndefined();
            expect(summarize(bad), bad).toContain('sin filtros activos');
        }
    });

    it('keeps allowlisted filters and sort in the pagination params, never page', () => {
        const parsed = parse('page=2&q=x&hasWifi=true&sortBy=nameAsc&utm_source=z');
        expect(parsed.paginationParams.get('q')).toBe('x');
        expect(parsed.paginationParams.get('hasWifi')).toBe('true');
        expect(parsed.paginationParams.get('sortBy')).toBe('nameAsc');
        expect(parsed.paginationParams.has('page')).toBe(false);
        expect(parsed.paginationParams.has('utm_source')).toBe(false);
    });
});

describe('summary subject for the legacy ?type=', () => {
    it('names the type for ?type=HOTEL exactly like ?types=HOTEL', () => {
        expect(summarize('type=HOTEL')).toBe(summarize('types=HOTEL'));
        expect(summarize('type=HOTEL')).toContain('hotel');
        expect(summarize('type=HOTEL')).not.toContain('hospedaje');
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

    /**
     * One param per scenario and the exact phrase it must produce. Params that
     * only mean something together (a coordinate pair plus radius, a POI plus
     * radius, a date pair) form one scenario per group; the group is listed in
     * `params` so coverage is still checked per param.
     */
    const scenarios: readonly {
        readonly params: readonly string[];
        readonly query: string;
        readonly phrase: RegExp;
        readonly feeds: (filters: ReturnType<typeof parse>['summaryFilters']) => unknown;
    }[] = [
        { params: ['q'], query: 'q=hotel', phrase: /contiene "hotel"/, feeds: (f) => f.text },
        { params: ['types'], query: 'types=HOTEL', phrase: /hotel/, feeds: (f) => f.types },
        { params: ['type'], query: 'type=HOTEL', phrase: /hotel/, feeds: (f) => f.types },
        {
            params: ['destinationIds'],
            query: 'destinationIds=a',
            phrase: /en a\./,
            feeds: (f) => f.destinations
        },
        {
            params: ['minPrice'],
            query: 'minPrice=10',
            phrase: /precio desde \$10/,
            feeds: (f) => f.price
        },
        {
            params: ['maxPrice'],
            query: 'maxPrice=20',
            phrase: /precio de hasta \$20/,
            feeds: (f) => f.price
        },
        {
            params: ['includeNoPrice'],
            query: 'includeNoPrice=false',
            phrase: /solo con precio definido/,
            feeds: (f) => f.price
        },
        {
            params: ['adults'],
            query: 'adults=2',
            phrase: /para al menos 2 huéspedes/,
            feeds: (f) => f.guests
        },
        {
            params: ['children'],
            query: 'children=1',
            phrase: /para al menos 1 huésped/,
            feeds: (f) => f.guests
        },
        {
            params: ['minBedrooms'],
            query: 'minBedrooms=1',
            phrase: /1 dormitorio/,
            feeds: (f) => f.bedrooms
        },
        {
            params: ['minBathrooms'],
            query: 'minBathrooms=1',
            phrase: /1 baño/,
            feeds: (f) => f.bathrooms
        },
        {
            params: ['features'],
            query: 'features=a',
            phrase: /servicios como a/,
            feeds: (f) => f.services
        },
        {
            params: ['amenities'],
            query: 'amenities=a',
            phrase: /amenities como a/,
            feeds: (f) => f.amenities
        },
        {
            params: ['hasWifi'],
            query: 'hasWifi=true',
            phrase: /con wifi\./,
            feeds: (f) => f.quickAmenities?.wifi
        },
        {
            params: ['hasPool'],
            query: 'hasPool=true',
            phrase: /con pileta\./,
            feeds: (f) => f.quickAmenities?.pool
        },
        {
            params: ['hasParking'],
            query: 'hasParking=true',
            phrase: /con cochera\./,
            feeds: (f) => f.quickAmenities?.parking
        },
        {
            params: ['allowsPets'],
            query: 'allowsPets=true',
            phrase: /admisión de mascotas/,
            feeds: (f) => f.quickAmenities?.pets
        },
        {
            params: ['minRating'],
            query: 'minRating=4',
            phrase: /calificación mínima de 4/,
            feeds: (f) => f.minRating
        },
        {
            params: ['includeNoReviews'],
            query: 'includeNoReviews=false',
            phrase: /solo con reseñas/,
            feeds: (f) => f.includeWithoutRating
        },
        {
            params: ['isFeatured'],
            query: 'isFeatured=true',
            phrase: /solo destacado/,
            feeds: (f) => f.featured
        },
        {
            params: ['latitude', 'longitude', 'radius'],
            query: 'latitude=-32.4&longitude=-58.2&radius=5',
            phrase: /a menos de 5 km/,
            feeds: (f) => f.location
        },
        {
            params: ['poiId', 'radius'],
            query: 'poiId=x&radius=5',
            phrase: /a menos de 5 km/,
            feeds: (f) => f.location
        },
        {
            params: ['poiSlug', 'radius'],
            query: 'poiSlug=x&radius=5',
            phrase: /a menos de 5 km/,
            feeds: (f) => f.location
        },
        {
            params: ['checkIn', 'checkOut'],
            query: 'checkIn=2026-12-01&checkOut=2026-12-05',
            phrase: /disponibles del 1 de dic de 2026 al 5 de dic de 2026/,
            feeds: (f) => f.availability
        }
    ];

    it('has a scenario for every allowlisted param (adding one without a case fails)', () => {
        const covered = new Set(scenarios.flatMap((s) => s.params));
        expect([...covered].sort()).toEqual(
            ACCOMMODATION_LISTING_FILTER_PARAMS.map((p) => p.param).sort()
        );
    });

    it('each scenario URL carries exactly its declared params', () => {
        for (const s of scenarios) {
            const keys = [...new URLSearchParams(s.query).keys()].sort();
            expect(keys, s.query).toEqual([...s.params].sort());
        }
    });

    const baseline = summarize('');
    for (const s of scenarios) {
        it(`${s.query}: feeds its descriptor and shows its phrase`, () => {
            const { summaryFilters } = parse(s.query);
            const fed = s.feeds(summaryFilters);
            expect(fed, 'parser produced nothing for this facet').not.toBeUndefined();
            expect(fed).not.toBeNull();
            const sentence = summarize(s.query);
            expect(sentence).not.toBe(baseline);
            expect(sentence).toMatch(s.phrase);
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
            expect(source).toContain('searchParams={paginationParams}');
            expect(source).not.toMatch(
                /searchParams\.get\('(hasWifi|minPrice|amenities|categories|types|type|checkIn)'\)/
            );
        });
    }
});
