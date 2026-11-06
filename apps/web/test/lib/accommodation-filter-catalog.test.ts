/**
 * @file accommodation-filter-catalog.test.ts
 * @description Regression tests for HOS-2057: the accommodation listing's
 * amenity/feature catalog fetch must be scoped to the accommodation vertical,
 * page through the whole catalog (server clamps pageSize to 100) and never sort
 * amenities by the dropped `name` column.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { amenitiesList, featuresList, warn } = vi.hoisted(() => ({
    amenitiesList: vi.fn(),
    featuresList: vi.fn(),
    warn: vi.fn()
}));

vi.mock('../../src/lib/logger', () => ({ webLogger: { warn } }));

vi.mock('../../src/lib/api/endpoints', () => ({
    amenitiesApi: { list: amenitiesList },
    featuresApi: { list: featuresList },
    SSR_PUBLIC_CACHE_TTL_MS: 1000
}));

import {
    fetchAccommodationFilterAmenities,
    fetchAccommodationFilterCatalog,
    fetchAccommodationFilterFeatures
} from '../../src/lib/filters/accommodation-filter-catalog';

const PAGE_SIZE = 100;

/** Builds a fake paginated endpoint over `total` rows, honoring page/pageSize. */
const paged = ({ total }: { readonly total: number }) =>
    vi.fn(async (params?: { page?: number; pageSize?: number }) => {
        const page = params?.page ?? 1;
        const size = Math.min(params?.pageSize ?? 20, PAGE_SIZE);
        const start = (page - 1) * size;
        const items = Array.from(
            { length: Math.max(0, Math.min(size, total - start)) },
            (_, i) => ({ id: `id-${start + i}`, slug: `slug-${start + i}` })
        );
        return {
            ok: true as const,
            data: {
                items,
                pagination: {
                    page,
                    pageSize: size,
                    total,
                    totalPages: Math.ceil(total / size),
                    hasNextPage: start + size < total,
                    hasPreviousPage: page > 1
                }
            }
        };
    });

describe('fetchAccommodationFilterCatalog', () => {
    beforeEach(() => {
        amenitiesList.mockReset();
        featuresList.mockReset();
        warn.mockReset();
    });

    it('scopes both calls to the accommodation vertical', async () => {
        amenitiesList.mockImplementation(paged({ total: 3 }));
        featuresList.mockImplementation(paged({ total: 2 }));

        await fetchAccommodationFilterCatalog();

        for (const call of amenitiesList.mock.calls) {
            expect(call[0]).toMatchObject({ applicableVertical: 'accommodation' });
        }
        for (const call of featuresList.mock.calls) {
            expect(call[0]).toMatchObject({ applicableVertical: 'accommodation' });
        }
        expect(amenitiesList).toHaveBeenCalled();
        expect(featuresList).toHaveBeenCalled();
    });

    /**
     * HOS-299 pinned the SSR cache opt-in on the pages' own catalog calls. Since
     * HOS-2057 those calls live here, so the opt-in is asserted on EVERY page
     * request (a cached page 1 with an uncached page 2 would still hit the API).
     */
    it('opts every catalog page request into the SSR cache', async () => {
        amenitiesList.mockImplementation(paged({ total: 250 }));
        featuresList.mockImplementation(paged({ total: 101 }));

        await fetchAccommodationFilterCatalog();

        const calls = [...amenitiesList.mock.calls, ...featuresList.mock.calls];
        expect(calls).toHaveLength(5);
        for (const call of calls) {
            expect(call[0]).toMatchObject({ cacheTtlMs: 1000 });
        }
    });

    it('retrieves every row when the catalog exceeds the 100 page cap', async () => {
        amenitiesList.mockImplementation(paged({ total: 250 }));
        featuresList.mockImplementation(paged({ total: 101 }));

        const { amenities, features } = await fetchAccommodationFilterCatalog();

        expect(amenities).toHaveLength(250);
        expect(features).toHaveLength(101);
        expect(new Set(amenities.map((a) => a.id)).size).toBe(250);
    });

    it('never sorts by the dropped name column and sorts amenities by displayWeight desc', async () => {
        amenitiesList.mockImplementation(paged({ total: 150 }));
        featuresList.mockImplementation(paged({ total: 5 }));

        await fetchAccommodationFilterCatalog();

        for (const call of [...amenitiesList.mock.calls, ...featuresList.mock.calls]) {
            expect(call[0].sortBy).not.toBe('name');
        }
        expect(amenitiesList.mock.calls[0]?.[0]).toMatchObject({
            sortBy: 'displayWeight',
            sortOrder: 'desc'
        });
    });

    it('degrades to an empty list when a catalog read fails', async () => {
        amenitiesList.mockResolvedValue({ ok: false, error: { status: 500 } });
        featuresList.mockImplementation(paged({ total: 2 }));

        const { amenities, features } = await fetchAccommodationFilterCatalog();

        expect(amenities).toEqual([]);
        expect(features).toHaveLength(2);
    });

    it('keeps the partial list and logs when a later page fails', async () => {
        amenitiesList.mockImplementation(async (params?: { page?: number }) => {
            if (params?.page === 2) return { ok: false, error: { status: 502 } };
            return paged({ total: 250 })(params);
        });
        featuresList.mockImplementation(paged({ total: 1 }));

        const { amenities } = await fetchAccommodationFilterCatalog();

        expect(amenities).toHaveLength(100);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[1]).toMatchObject({ endpoint: 'amenities', page: 2 });
    });

    it('logs a first-page failure with endpoint and page', async () => {
        amenitiesList.mockResolvedValue({ ok: false, error: { status: 500 } });
        featuresList.mockImplementation(paged({ total: 1 }));

        await fetchAccommodationFilterCatalog();

        expect(warn.mock.calls[0]?.[1]).toMatchObject({ endpoint: 'amenities', page: 1 });
    });

    it('stops after page one when totalPages is 0 or missing', async () => {
        const one = (totalPages: number | undefined) =>
            vi.fn(async () => ({
                ok: true as const,
                data: {
                    items: [{ id: 'a', slug: 'a' }],
                    pagination: { totalPages }
                }
            }));
        amenitiesList.mockImplementation(one(0));
        featuresList.mockImplementation(one(undefined));

        const { amenities, features } = await fetchAccommodationFilterCatalog();

        expect(amenities).toHaveLength(1);
        expect(features).toHaveLength(1);
        expect(amenitiesList).toHaveBeenCalledTimes(1);
        expect(featuresList).toHaveBeenCalledTimes(1);
    });

    it('caps paging at 20 pages', async () => {
        amenitiesList.mockImplementation(paged({ total: 100 * 50 }));

        const amenities = await fetchAccommodationFilterAmenities();

        expect(amenitiesList).toHaveBeenCalledTimes(20);
        expect(amenities).toHaveLength(2000);
    });

    it('asks only for active amenities and sorts both lists by displayWeight desc', async () => {
        amenitiesList.mockImplementation(paged({ total: 1 }));
        featuresList.mockImplementation(paged({ total: 1 }));

        await fetchAccommodationFilterCatalog();

        expect(amenitiesList.mock.calls[0]?.[0]).toMatchObject({ isActive: true });
        expect(featuresList.mock.calls[0]?.[0]).toMatchObject({
            sortBy: 'displayWeight',
            sortOrder: 'desc'
        });
    });

    it('exposes single-catalog loaders that call only their own endpoint', async () => {
        amenitiesList.mockImplementation(paged({ total: 1 }));
        featuresList.mockImplementation(paged({ total: 1 }));

        await fetchAccommodationFilterAmenities();
        expect(featuresList).not.toHaveBeenCalled();
        await fetchAccommodationFilterFeatures();
        expect(featuresList).toHaveBeenCalledTimes(1);
    });
});
