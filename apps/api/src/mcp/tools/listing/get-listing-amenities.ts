/**
 * @file get-listing-amenities.ts
 * @description Tool `get_listing_amenities` (HOS-2327, spec HOS-2335 §6.2,
 * AC-C7, AC-C11): the amenity and feature catalog of one of the caller's
 * listings grouped by category, each item marked `selected` when the listing
 * already has it. It is the read half of the amenities wizard: the model walks
 * the groups and then calls `update_listing_amenities` once per confirmed
 * category.
 *
 * - **Ownership** is `get_listing`'s (`readOwnListingDetail`): the vertical
 *   service's `getById` plus the `READ_OWN` resource step. A missing, foreign or
 *   refused listing is the uniform not-found error, answered before the catalog
 *   is read.
 * - **Vertical scope.** The catalog is read through the same
 *   `applicable_verticals` filter the public endpoints use, so a venue never
 *   sees accommodation-only rows (AC-C7).
 * - **Labels** are the `@repo/i18n` Spanish labels (SPEC-266: no `name` column).
 * - **Budget (spec §5.3).** An accommodation has about 210 applicable rows, which
 *   does not fit one result. Groups are returned in wizard order while they fit
 *   `MCP_RESULT_MAX_CHARS`; the rest are listed in `omittedGroups` (counts only)
 *   with `truncated: true`, and the model asks for them with `category`.
 */

import { z } from 'zod';
import { MCP_RESULT_MAX_CHARS, measureResultChars } from '../response-budget';
import { defineTool, type ToolHandlerResult } from '../tool-definition';
import {
    ALL_CATALOG_CATEGORIES,
    type CatalogKind,
    CatalogKindSchema,
    categoriesOf
} from './catalog-categories';
import { type AmenityGroup, buildCatalogGroups } from './catalog-groups';
import { readVerticalCatalog } from './catalog-reader';
import { type ListingDetail, readOwnListingDetail } from './get-listing';
import { listingRefusalLink, readListingRef } from './listing-refusal-actions';
import { type ListingToolVertical, ListingToolVerticalSchema } from './listing-services';

/** A group left out of the result by the size budget. */
export interface OmittedAmenityGroup {
    /** `amenity` or `feature`. */
    readonly kind: CatalogKind;
    /** Category value to pass as `category` to read it. */
    readonly category: string;
    /** Spanish category label. */
    readonly label: string;
    /** How many items it has. */
    readonly itemCount: number;
}

/** Result of `get_listing_amenities`. */
export interface GetListingAmenitiesResult {
    /** The listing the groups are about. */
    readonly listing: {
        readonly vertical: ListingToolVertical;
        readonly id: string;
        readonly name: string;
    };
    /** Groups in wizard order (amenities first); empty groups are omitted. */
    readonly groups: readonly AmenityGroup[];
    /** `true` when some groups did not fit and are listed in `omittedGroups`. */
    readonly truncated?: true;
    /** The groups that did not fit; ask for each with `category`. */
    readonly omittedGroups?: readonly OmittedAmenityGroup[];
}

/** Input schema of `get_listing_amenities`. */
export const GetListingAmenitiesInputSchema = z
    .object({
        vertical: ListingToolVerticalSchema.describe(
            'The vertical returned by list_my_listings for this listing.'
        ),
        id: z.uuid().describe('The listing id returned by list_my_listings.'),
        kind: CatalogKindSchema.optional().describe(
            'Only amenities or only features. Omit for both.'
        ),
        category: z
            .enum(ALL_CATALOG_CATEGORIES)
            .optional()
            .describe(
                'Only this category: an amenity type (KITCHEN, PARKING, …) or a feature category (VIEW, STYLE, …). Omit to walk every category.'
            )
    })
    .strict()
    .superRefine((input, ctx) => {
        if (
            input.kind !== undefined &&
            input.category !== undefined &&
            !categoriesOf({ kind: input.kind }).includes(input.category)
        ) {
            ctx.addIssue({
                code: 'custom',
                path: ['category'],
                message: `la categoría «${input.category}» no es de ${
                    input.kind === 'amenity' ? 'comodidades' : 'características'
                }`
            });
        }
    });

/** Validated input of `get_listing_amenities`. */
export type GetListingAmenitiesInput = z.output<typeof GetListingAmenitiesInputSchema>;

/**
 * Keeps the leading groups that fit the size budget and lists the rest as
 * omitted. A first group that alone exceeds the budget is still returned (a
 * category never holds more than a few dozen items), so a result is never empty.
 *
 * @param args - The listing, the groups in order and the budget
 * @returns The result within the budget
 */
export function fitGroupsToBudget(args: {
    readonly listing: GetListingAmenitiesResult['listing'];
    readonly groups: readonly AmenityGroup[];
    readonly maxChars?: number;
}): GetListingAmenitiesResult {
    const { listing, groups, maxChars = MCP_RESULT_MAX_CHARS } = args;
    const omittedOf = (from: number): OmittedAmenityGroup[] =>
        groups.slice(from).map((g) => ({
            kind: g.kind,
            category: g.category,
            label: g.label,
            itemCount: g.items.length
        }));
    const withOmitted = (kept: readonly AmenityGroup[]): GetListingAmenitiesResult => {
        const omitted = omittedOf(kept.length);
        return omitted.length === 0
            ? { listing, groups: kept }
            : { listing, groups: kept, truncated: true, omittedGroups: omitted };
    };
    let kept: AmenityGroup[] = [];
    for (const group of groups) {
        const candidate = [...kept, group];
        if (kept.length > 0 && measureResultChars({ value: withOmitted(candidate) }) > maxChars) {
            break;
        }
        kept = candidate;
    }
    return withOmitted(kept);
}

/** The ids a listing currently has, of the kinds read. */
function selectedIdsOf(listing: ListingDetail, kind: CatalogKind): ReadonlySet<string> {
    return new Set((kind === 'amenity' ? listing.amenities : listing.features).map((x) => x.id));
}

/**
 * `get_listing_amenities`: read-only, available to an unverified email exactly
 * as `get_listing` is (`READ_OWN`).
 */
export const getListingAmenitiesTool = defineTool({
    name: 'get_listing_amenities',
    title: 'Comodidades y características de una publicación',
    description:
        'Shows the amenities and features a listing of the connected Hospeda user can have, grouped by category (kitchen, parking, views, …), each item marked selected when the listing already has it. Only items that apply to the listing vertical appear. Use it to guide the user category by category: show the items of a category with the selected ones marked, ask what to add or remove, then call update_listing_amenities for that category with the item ids. When the result is truncated, the omitted categories are listed: ask for each with category. A listing that does not exist or belongs to someone else is reported as not found. Take vertical and id from list_my_listings.',
    inputSchema: GetListingAmenitiesInputSchema,
    isWrite: false,
    emailUnverifiedOperation: 'READ_OWN',
    refusalAction: ({ error, input }) => {
        const ref = readListingRef({ input });
        return ref === undefined ? undefined : listingRefusalLink({ error, ref });
    },
    auditTarget: ({ input }) => ({ type: input.vertical, id: input.id }),
    handler: async ({ actor, input }): Promise<ToolHandlerResult<GetListingAmenitiesResult>> => {
        const { vertical, id, category } = input;
        // The ownership gate comes first: a foreign id never reaches the catalog.
        const owned = await readOwnListingDetail({ actor, vertical, id });
        if (owned.error) {
            return { error: owned.error };
        }
        const listing = owned.data;
        const kinds: readonly CatalogKind[] =
            input.kind === undefined
                ? category === undefined
                    ? ['amenity', 'feature']
                    : categoriesOf({ kind: 'amenity' }).includes(category)
                      ? ['amenity']
                      : ['feature']
                : [input.kind];
        const groups: AmenityGroup[] = [];
        for (const kind of kinds) {
            const catalog = await readVerticalCatalog({ actor, vertical, kind });
            // A partial catalog would read as "that item does not exist": fail the call.
            if (catalog.error) {
                return { error: catalog.error };
            }
            groups.push(
                ...buildCatalogGroups({
                    kind,
                    rows: catalog.rows,
                    selectedIds: selectedIdsOf(listing, kind),
                    onlyCategory: category
                })
            );
        }
        return {
            data: fitGroupsToBudget({
                listing: { vertical, id: listing.id, name: listing.name },
                groups
            })
        };
    }
});
