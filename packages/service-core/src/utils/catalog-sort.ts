import type { ServiceContext } from '../types';

/**
 * Columns a public catalog (features, amenities) may be sorted by.
 * Anything else is ignored: `buildOrderByClause` accepts every own table key,
 * hidden ones included (`createdById`, `adminInfo`), which would let an anonymous
 * caller probe values by ordering on them (HOS-2068).
 */
export const PUBLIC_CATALOG_SORT_COLUMNS = ['displayWeight', 'slug'] as const;

/** A column from {@link PUBLIC_CATALOG_SORT_COLUMNS}. */
export type PublicCatalogSortColumn = (typeof PUBLIC_CATALOG_SORT_COLUMNS)[number];

/** Sort options ready to be spread into `model.findAll` options. */
export interface CatalogSortOptions {
    readonly sortBy?: PublicCatalogSortColumn;
    readonly sortOrder?: 'asc' | 'desc';
    readonly thenSortBy?: 'slug';
}

/**
 * Resolves the sort a catalog search may apply from `ctx.pagination`.
 *
 * - A `sortBy` outside the allow-list yields no sort at all.
 * - Sorting by `displayWeight` adds `slug` as an ascending tie-break so equal
 *   weights keep a stable order across pages.
 *
 * @param input - `{ pagination }` from the service context
 * @returns Sort options, empty when nothing valid was requested
 */
export const resolveCatalogSort = ({
    pagination
}: {
    readonly pagination?: ServiceContext['pagination'];
}): CatalogSortOptions => {
    const sortBy = pagination?.sortBy;
    if (!sortBy || !(PUBLIC_CATALOG_SORT_COLUMNS as readonly string[]).includes(sortBy)) {
        return {};
    }
    return {
        sortBy: sortBy as PublicCatalogSortColumn,
        sortOrder: pagination?.sortOrder,
        ...(sortBy === 'displayWeight' ? { thenSortBy: 'slug' as const } : {})
    };
};
