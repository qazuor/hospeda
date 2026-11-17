/**
 * @file catalog-reader.ts
 * @description Reads the amenity or feature catalog of one vertical for the
 * assistant tools (`list_amenities_and_features`, `get_listing_amenities`,
 * `update_listing_amenities`).
 *
 * A thin adapter over the services behind the public catalog endpoints
 * (`GET /api/v1/public/amenities|features?applicableVertical=`): the same
 * `search` call, scoped by `applicable_verticals`, retired rows excluded by the
 * service. The catalog is public data; reading it needs no ownership. Every page
 * is read: a partial catalog would read as "that id does not exist".
 */

import type { Actor } from '@repo/service-core';
import type { ToolErrorPayload } from '../tool-definition';
import type { CatalogKind } from './catalog-categories';
import {
    type ListingToolVertical,
    listingToolAmenityService,
    listingToolFeatureService
} from './listing-services';

/** Largest page the catalog `search` accepts. */
export const CATALOG_PAGE_SIZE = 100;

/** Safety bound on pages read per catalog (the catalogs hold well under 1000 rows). */
const MAX_CATALOG_PAGES = 20;

/** One catalog row, reduced to what the tools use. */
export interface CatalogRow {
    /** Catalog id (UUID). */
    readonly id: string;
    /** Stable slug (also the i18n key of its name). */
    readonly slug: string;
    /** `type` for an amenity, `category` for a feature. */
    readonly category: string;
}

/** A catalog row as the services return it. */
interface RawCatalogRow {
    readonly id: string;
    readonly slug: string;
    readonly type?: string;
    readonly category?: string;
}

/** One page of a catalog search, or its error. */
type CatalogPage =
    | { readonly data?: { readonly items: readonly RawCatalogRow[]; readonly total: number } }
    | { readonly error: ToolErrorPayload };

/** The rows of a catalog read, or the error that stopped it. */
export type CatalogReadResult =
    | { readonly rows: readonly CatalogRow[]; readonly error?: never }
    | { readonly rows?: never; readonly error: ToolErrorPayload };

/** Reads every page of a catalog search, stopping on the first error. */
async function readAllPages(input: {
    readonly fetchPage: (page: number) => Promise<CatalogPage>;
    readonly categoryOf: (row: RawCatalogRow) => string | undefined;
}): Promise<CatalogReadResult> {
    const rows: CatalogRow[] = [];
    let total = 0;
    for (let page = 1; page <= MAX_CATALOG_PAGES; page++) {
        const result = await input.fetchPage(page);
        if ('error' in result && result.error) {
            return { error: result.error };
        }
        const data = 'data' in result ? result.data : undefined;
        const items = data?.items ?? [];
        total = data?.total ?? 0;
        rows.push(
            ...items.map((row) => ({
                id: row.id,
                slug: row.slug,
                category: input.categoryOf(row) ?? ''
            }))
        );
        if (items.length === 0 || rows.length >= total) {
            break;
        }
    }
    return { rows };
}

/**
 * Reads the whole catalog of one kind, scoped to one vertical.
 *
 * @param args - Actor, vertical and kind
 * @returns Every active row applicable to the vertical, or the error
 */
export async function readVerticalCatalog(args: {
    readonly actor: Actor;
    readonly vertical: ListingToolVertical;
    readonly kind: CatalogKind;
}): Promise<CatalogReadResult> {
    const { actor, vertical, kind } = args;
    const applicableVertical = vertical;
    if (kind === 'amenity') {
        return readAllPages({
            categoryOf: (row) => row.type,
            fetchPage: (page) =>
                listingToolAmenityService.search(actor, {
                    applicableVertical,
                    page,
                    pageSize: CATALOG_PAGE_SIZE,
                    sortBy: 'slug'
                }) as Promise<CatalogPage>
        });
    }
    return readAllPages({
        categoryOf: (row) => row.category,
        fetchPage: (page) =>
            listingToolFeatureService.search(actor, {
                applicableVertical,
                page,
                pageSize: CATALOG_PAGE_SIZE,
                sortBy: 'slug'
            }) as Promise<CatalogPage>
    });
}
