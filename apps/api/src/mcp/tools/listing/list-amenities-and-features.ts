/**
 * @file list-amenities-and-features.ts
 * @description Tool `list_amenities_and_features` (HOS-2184 T-038, spec §6.5,
 * AC-5): the amenity and feature catalog of one vertical, so the model can
 * pick ids for `update_listing_basic`.
 *
 * A thin adapter over the services behind the public catalog endpoints
 * (`GET /api/v1/public/amenities|features?applicableVertical=`): the same
 * `search` call, scoped by `applicable_verticals`, retired rows excluded by
 * the service. The catalog is public data; reading it needs no ownership.
 *
 * Catalog rows have no `name` column (SPEC-266): the Spanish display name is
 * the `@repo/i18n` label of the slug (`accommodations.amenityNames.<slug>` /
 * `accommodations.featureNames.<slug>`), degrading to a humanized slug when
 * the key is missing, the same resolution the AI context blocks use.
 */

import type { Locale } from '@repo/i18n';
import { z } from 'zod';
import { amenityLabel, featureLabel } from '../../../services/ai-context/listing-labels';
import { defineTool, type ToolErrorPayload, type ToolHandlerResult } from '../tool-definition';
import {
    ListingToolVerticalSchema,
    listingToolAmenityService,
    listingToolFeatureService
} from './listing-services';

/** Locale of the names: the assistant answers owners in Spanish. */
const NAME_LOCALE: Locale = 'es';

/** Largest page the catalog `search` accepts. */
export const CATALOG_PAGE_SIZE = 100;

/** Safety bound on pages read per catalog (the catalogs hold well under 1000 rows). */
const MAX_CATALOG_PAGES = 20;

/** One catalog entry in the result. */
export interface CatalogEntry {
    /** Catalog id (UUID); the value `update_listing_basic` takes in `amenityIds` / `featureIds`. */
    readonly id: string;
    /** Stable slug. */
    readonly slug: string;
    /** Spanish display name. */
    readonly name: string;
}

/** Result of `list_amenities_and_features`. */
export interface ListAmenitiesAndFeaturesResult {
    /** Amenities available to the vertical, sorted by name. */
    readonly amenities: readonly CatalogEntry[];
    /** Features available to the vertical, sorted by name. */
    readonly features: readonly CatalogEntry[];
}

/** Input schema of `list_amenities_and_features`. */
export const ListAmenitiesAndFeaturesInputSchema = z
    .object({
        vertical: ListingToolVerticalSchema.describe(
            'The vertical whose catalog to list: accommodation, venue or experience.'
        )
    })
    .strict();

/** A catalog row as the services return it. */
interface CatalogRow {
    readonly id: string;
    readonly slug: string;
}

/** One page of a catalog search, or its error. */
type CatalogPage =
    | { readonly data?: { readonly items: readonly CatalogRow[]; readonly total: number } }
    | { readonly error: ToolErrorPayload };

/** Reads every page of a catalog search, stopping on the first error. */
async function readCatalog(input: {
    readonly fetchPage: (page: number) => Promise<CatalogPage>;
}): Promise<
    | { readonly rows: readonly CatalogRow[]; readonly error?: never }
    | { readonly rows?: never; readonly error: ToolErrorPayload }
> {
    const rows: CatalogRow[] = [];
    for (let page = 1; page <= MAX_CATALOG_PAGES; page++) {
        const result = await input.fetchPage(page);
        if ('error' in result && result.error) {
            return { error: result.error };
        }
        const data = 'data' in result ? result.data : undefined;
        const items = data?.items ?? [];
        rows.push(...items);
        if (items.length === 0 || rows.length >= (data?.total ?? 0)) {
            break;
        }
    }
    return { rows };
}

/** Projects rows to named entries, sorted by Spanish name. */
function toEntries(input: {
    readonly rows: readonly CatalogRow[];
    readonly label: (slug: string) => string;
}): CatalogEntry[] {
    return input.rows
        .map((row) => ({ id: row.id, slug: row.slug, name: input.label(row.slug) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/**
 * `list_amenities_and_features`: read-only, available to an unverified email
 * (`READ_OWN`, like the other read tools).
 */
export const listAmenitiesAndFeaturesTool = defineTool({
    name: 'list_amenities_and_features',
    title: 'Comodidades y características disponibles',
    description:
        'Lists the amenities and features a listing of one vertical (accommodation, venue or experience) can have, each with its id, slug and Spanish name, sorted by name. Use these ids in the amenityIds and featureIds of update_listing_basic. That tool REPLACES the whole set, so to add one, read the listing current ids with get_listing, merge the new id into them and send the complete list; sending only the new id removes all the others.',
    inputSchema: ListAmenitiesAndFeaturesInputSchema,
    isWrite: false,
    emailUnverifiedOperation: 'READ_OWN',
    handler: async ({
        actor,
        input
    }): Promise<ToolHandlerResult<ListAmenitiesAndFeaturesResult>> => {
        const applicableVertical = input.vertical;
        const [amenities, features] = await Promise.all([
            readCatalog({
                fetchPage: (page) =>
                    listingToolAmenityService.search(actor, {
                        applicableVertical,
                        page,
                        pageSize: CATALOG_PAGE_SIZE,
                        sortBy: 'slug'
                    }) as Promise<CatalogPage>
            }),
            readCatalog({
                fetchPage: (page) =>
                    listingToolFeatureService.search(actor, {
                        applicableVertical,
                        page,
                        pageSize: CATALOG_PAGE_SIZE,
                        sortBy: 'slug'
                    }) as Promise<CatalogPage>
            })
        ]);
        // A partial catalog would read as "that amenity does not exist": fail the call.
        if (amenities.error) {
            return { error: amenities.error };
        }
        if (features.error) {
            return { error: features.error };
        }
        return {
            data: {
                amenities: toEntries({
                    rows: amenities.rows,
                    label: (slug) => amenityLabel({ slug, locale: NAME_LOCALE }).label
                }),
                features: toEntries({
                    rows: features.rows,
                    label: (slug) => featureLabel({ slug, locale: NAME_LOCALE }).label
                })
            }
        };
    }
});
