/**
 * @file listing-catalogs.test.ts
 * @description The venue/experience editor reads its catalogs to the last page
 * (HOS-2061). A single `pageSize=100` read drops every row past the cap
 * without failing, so these cases drive a catalog that spans several pages.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const amenitiesList = vi.fn();
const featuresList = vi.fn();

vi.mock('@/lib/api/endpoints', () => ({
    amenitiesApi: { list: (params: unknown) => amenitiesList(params) },
    featuresApi: { list: (params: unknown) => featuresList(params) }
}));

const { LISTING_CATALOG_PAGE_SIZE, loadListingCatalogs, readAllCatalogPages } = await import(
    '@/lib/editor/listing-catalogs'
);

/** Builds `count` catalog rows whose slugs start at `offset`. */
function rows({ count, offset }: { readonly count: number; readonly offset: number }) {
    return Array.from({ length: count }, (_, index) => ({
        id: `id-${offset + index}`,
        slug: `slug_${offset + index}`,
        icon: null,
        category: 'GENERAL'
    }));
}

/** A paginated fetcher over `total` rows, 100 per page. */
function pagedCatalog({ total }: { readonly total: number }) {
    const totalPages = Math.max(1, Math.ceil(total / LISTING_CATALOG_PAGE_SIZE));
    return vi.fn(async ({ page }: { readonly page: number }) => {
        const offset = (page - 1) * LISTING_CATALOG_PAGE_SIZE;
        const count = Math.max(0, Math.min(LISTING_CATALOG_PAGE_SIZE, total - offset));
        return {
            ok: true as const,
            data: {
                items: rows({ count, offset }),
                pagination: {
                    page,
                    pageSize: LISTING_CATALOG_PAGE_SIZE,
                    total,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1
                }
            }
        };
    });
}

describe('readAllCatalogPages', () => {
    it('reads every page of a catalog larger than one page', async () => {
        // Arrange
        const fetchPage = pagedCatalog({ total: 243 });

        // Act
        const result = await readAllCatalogPages({ fetchPage, vertical: 'venue' });

        // Assert
        expect(fetchPage).toHaveBeenCalledTimes(3);
        expect(fetchPage.mock.calls.map(([params]) => params.page).sort()).toEqual([1, 2, 3]);
        for (const [params] of fetchPage.mock.calls) {
            expect(params).toMatchObject({ pageSize: 100, applicableVertical: 'venue' });
        }
        expect(result?.items).toHaveLength(243);
        expect(result?.items.at(-1)).toMatchObject({ slug: 'slug_242' });
    });

    it('reads a single page once', async () => {
        const fetchPage = pagedCatalog({ total: 19 });

        const result = await readAllCatalogPages({ fetchPage, vertical: 'experience' });

        expect(fetchPage).toHaveBeenCalledTimes(1);
        expect(result?.items).toHaveLength(19);
    });

    it('returns null when a later page fails, never a partial catalog', async () => {
        // Arrange
        const healthy = pagedCatalog({ total: 150 });
        const fetchPage = vi.fn(async (params: { readonly page: number }) =>
            params.page === 2
                ? { ok: false as const, error: { status: 500, message: 'boom' } }
                : healthy(params)
        );

        // Act
        const result = await readAllCatalogPages({
            fetchPage: fetchPage as never,
            vertical: 'venue'
        });

        // Assert
        expect(result).toBeNull();
    });
});

describe('loadListingCatalogs', () => {
    beforeEach(() => {
        amenitiesList.mockReset();
        featuresList.mockReset();
    });

    it('returns both catalogs in full across pages', async () => {
        // Arrange
        amenitiesList.mockImplementation(pagedCatalog({ total: 101 }));
        featuresList.mockImplementation(pagedCatalog({ total: 29 }));

        // Act
        const { amenities, features } = await loadListingCatalogs({ vertical: 'venue' });

        // Assert
        expect(amenitiesList).toHaveBeenCalledTimes(2);
        expect(amenities).toHaveLength(101);
        expect(features).toHaveLength(29);
    });

    it('degrades to empty lists when the catalog read throws', async () => {
        amenitiesList.mockRejectedValue(new Error('network'));
        featuresList.mockImplementation(pagedCatalog({ total: 3 }));

        const result = await loadListingCatalogs({ vertical: 'experience' });

        expect(result).toEqual({ amenities: [], features: [] });
    });
});
