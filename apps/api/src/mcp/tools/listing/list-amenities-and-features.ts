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
import { defineTool, type ToolHandlerResult } from '../tool-definition';
import { type CatalogRow, readVerticalCatalog } from './catalog-reader';
import { ListingToolVerticalSchema } from './listing-services';

/** Locale of the names: the assistant answers owners in Spanish. */
const NAME_LOCALE: Locale = 'es';

export { CATALOG_PAGE_SIZE } from './catalog-reader';

/** One catalog entry in the result. */
export interface CatalogEntry {
    /** Catalog id (UUID); the value `update_listing_basic` takes in `amenityIds` / `featureIds`. */
    readonly id: string;
    /** Stable slug. */
    readonly slug: string;
    /** Spanish display name. */
    readonly name: string;
    /** Category value (`type` of an amenity, `category` of a feature); see get_listing_amenities. */
    readonly category: string;
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

/** Projects rows to named entries, sorted by Spanish name. */
function toEntries(input: {
    readonly rows: readonly CatalogRow[];
    readonly label: (slug: string) => string;
}): CatalogEntry[] {
    return input.rows
        .map((row) => ({
            id: row.id,
            slug: row.slug,
            name: input.label(row.slug),
            category: row.category
        }))
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
        'Lists the amenities and features a listing of one vertical (accommodation, venue or experience) can have, each with its id, slug and Spanish name, sorted by name. Use these ids in the amenityIds and featureIds of update_listing_basic. That tool REPLACES the whole set, so to add one, read the listing current ids with get_listing, merge the new id into them and send the complete list; sending only the new id removes all the others. To work category by category, or to add and remove items without replacing the set, use get_listing_amenities and update_listing_amenities instead.',
    inputSchema: ListAmenitiesAndFeaturesInputSchema,
    isWrite: false,
    emailUnverifiedOperation: 'READ_OWN',
    handler: async ({
        actor,
        input
    }): Promise<ToolHandlerResult<ListAmenitiesAndFeaturesResult>> => {
        const [amenities, features] = await Promise.all([
            readVerticalCatalog({ actor, vertical: input.vertical, kind: 'amenity' }),
            readVerticalCatalog({ actor, vertical: input.vertical, kind: 'feature' })
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
