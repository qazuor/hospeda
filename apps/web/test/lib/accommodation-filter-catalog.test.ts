/**
 * @file accommodation-filter-catalog.test.ts
 * @description Regression tests for HOS-2057: the accommodation listing's
 * amenity/feature catalog fetch must be scoped to the accommodation vertical,
 * page through the whole catalog (server clamps pageSize to 100) and never sort
 * amenities by the dropped `name` column.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { amenitiesList, featuresList } = vi.hoisted(() => ({
    amenitiesList: vi.fn(),
    featuresList: vi.fn()
}));

vi.mock('../../src/lib/api/endpoints', () => ({
    amenitiesApi: { list: amenitiesList },
    featuresApi: { list: featuresList },
    SSR_PUBLIC_CACHE_TTL_MS: 1000
}));

import { fetchAccommodationFilterCatalog } from '../../src/lib/filters/accommodation-filter-catalog';

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
});
