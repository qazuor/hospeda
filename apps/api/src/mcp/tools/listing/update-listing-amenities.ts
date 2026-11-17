/**
 * @file update-listing-amenities.ts
 * @description Tool `update_listing_amenities` (HOS-2327, spec HOS-2335 §6.2,
 * AC-C8 to AC-C11): the owner adds or removes the amenities or features of ONE
 * category of one of their listings, leaving every other category untouched. It
 * is the write half of the amenities wizard (`get_listing_amenities` is the read).
 *
 * It is a thin adapter over the owner PATCH route of each vertical, and shares
 * the steps `update_listing_basic` runs (`listing-owner-write.ts`, spec C-1/C-6):
 * 1. **Ownership.** `readOwnListingDetail` (the get-own gate): a foreign or
 *    missing listing is the uniform not-found, before anything else is read.
 * 2. **The set.** The route replaces the whole set, so the tool reads the
 *    current one and sends `next = (current ∖ remove) ∪ add` for the one kind
 *    named; the other kind is not in the patch and the ids of other categories
 *    are carried over unchanged (AC-C8).
 * 3. **Listing access.** `authorizeOwnerEdit` with that patch: operation `EDIT`,
 *    owner-only, the sections a venue/experience patch writes.
 * 4. **Catalog check.** Every id in `add`/`remove` must exist, apply to the
 *    listing's vertical (`applicable_verticals`) and belong to the given kind and
 *    category; the first that does not is a `VALIDATION_ERROR` naming it, and
 *    nothing is written (AC-C9).
 * 5. **The write**: `writeAccommodationPatch` / `writeScheduledPatch`, i.e. the
 *    service call the route makes, plus for accommodations the public cache
 *    eviction the route gets from its HTTP middleware (HOS-2323, AC-C10).
 *
 * There is no confirmation token: the edit is idempotent and low risk, and MCP
 * clients already ask before running a write tool (spec §5.2).
 *
 * ## Published input schema
 * ONE flat object (MCP clients reject `oneOf`); the rules that tie fields
 * together live in a `superRefine`.
 */

import {
    type AccommodationUpdateHttp,
    type ExperienceOwnerUpdateInput,
    ServiceErrorCode,
    type VenueOwnerUpdateInput,
    VerticalEnum
} from '@repo/schemas';
import { z } from 'zod';
import {
    defineTool,
    type ToolErrorPayload,
    type ToolHandlerResult,
    type ToolRefusalLink
} from '../tool-definition';
import {
    ALL_CATALOG_CATEGORIES,
    type CatalogKind,
    CatalogKindSchema,
    categoryLabel,
    kindCategoryIssue
} from './catalog-categories';
import { type AmenityGroup, buildCatalogGroups } from './catalog-groups';
import { type CatalogRow, readVerticalCatalog } from './catalog-reader';
import { readOwnListingDetail } from './get-listing';
import {
    authorizeOwnerEdit,
    writeAccommodationPatch,
    writeScheduledPatch
} from './listing-owner-write';
import {
    editorLink,
    listingRefusalLink,
    readListingRef,
    sectionForField
} from './listing-refusal-actions';
import { type ListingToolVertical, ListingToolVerticalSchema } from './listing-services';

/** Most ids one call may add or remove (the largest category holds about twenty). */
export const MAX_IDS_PER_CALL = 50;

/** Per vertical, how its listings are named in a message. */
const VERTICAL_LABEL: Readonly<Record<ListingToolVertical, string>> = {
    [VerticalEnum.ACCOMMODATION]: 'alojamientos',
    [VerticalEnum.VENUE]: 'locales',
    [VerticalEnum.EXPERIENCE]: 'experiencias'
};

/** Input schema of `update_listing_amenities`. One flat object (see file header). */
export const UpdateListingAmenitiesInputSchema = z
    .object({
        vertical: ListingToolVerticalSchema.describe(
            'The vertical returned by list_my_listings for this listing.'
        ),
        id: z.uuid().describe('The listing id returned by list_my_listings.'),
        kind: CatalogKindSchema.describe('amenity or feature: which catalog the category is of.'),
        category: z
            .enum(ALL_CATALOG_CATEGORIES)
            .describe(
                'The category being edited, as get_listing_amenities returns it: an amenity type (KITCHEN, PARKING, …) when kind is amenity, a feature category (VIEW, STYLE, …) when kind is feature.'
            ),
        add: z
            .array(z.uuid())
            .max(MAX_IDS_PER_CALL)
            .optional()
            .describe('Item ids of that category to add to the listing.'),
        remove: z
            .array(z.uuid())
            .max(MAX_IDS_PER_CALL)
            .optional()
            .describe('Item ids of that category to remove from the listing.')
    })
    .strict()
    .superRefine((input, ctx) => {
        const mismatch = kindCategoryIssue({ kind: input.kind, category: input.category });
        if (mismatch !== undefined) {
            ctx.addIssue({ code: 'custom', path: ['category'], message: mismatch });
        }
        const add = input.add ?? [];
        const remove = input.remove ?? [];
        if (add.length === 0 && remove.length === 0) {
            ctx.addIssue({
                code: 'custom',
                path: [],
                message: 'indicá al menos un id en add o en remove'
            });
        }
        const removing = new Set(remove);
        const both = add.find((id) => removing.has(id));
        if (both !== undefined) {
            ctx.addIssue({
                code: 'custom',
                path: ['add'],
                message: `el id ${both} está en add y en remove`
            });
        }
    });

/** Validated input of `update_listing_amenities`. */
export type UpdateListingAmenitiesInput = z.output<typeof UpdateListingAmenitiesInputSchema>;

/** Result of `update_listing_amenities`. */
export interface UpdateListingAmenitiesResult {
    /** The listing that was edited. */
    readonly listing: {
        readonly vertical: ListingToolVertical;
        readonly id: string;
        readonly name: string;
    };
    /** Items newly linked by this call. */
    readonly added: number;
    /** Items unlinked by this call. */
    readonly removed: number;
    /** The edited category as stored after the change. */
    readonly group: AmenityGroup;
}

/**
 * The set a listing must end up with: the current one without `remove`, plus
 * `add`. Ids of every other category are in `current` and stay as they are; the
 * existing order is kept and new ids go last.
 *
 * @param args - The ids the listing has, and the ids to add and remove
 * @returns The full id set to send
 */
export function computeNextIds(args: {
    readonly current: readonly string[];
    readonly add: readonly string[];
    readonly remove: readonly string[];
}): string[] {
    const removing = new Set(args.remove);
    const kept = args.current.filter((id) => !removing.has(id));
    const present = new Set(kept);
    const fresh = [...new Set(args.add)].filter((id) => !present.has(id));
    return [...kept, ...fresh];
}

/** A catalog id a call named that it may not touch, with the field it came in. */
export interface InvalidCatalogId {
    /** `add` or `remove`. */
    readonly field: 'add' | 'remove';
    /** Spanish explanation, naming the id. */
    readonly message: string;
}

/**
 * The first id of the call that is not a catalog row of that kind and category
 * for the vertical. `rows` is the catalog already scoped to the vertical, so an
 * id missing from it either does not exist or does not apply to the vertical.
 *
 * @param args - The ids by field, the vertical's catalog rows, the kind and category
 * @returns The problem, or `undefined` when every id is acceptable
 */
export function findInvalidCatalogId(args: {
    readonly add: readonly string[];
    readonly remove: readonly string[];
    readonly rows: readonly CatalogRow[];
    readonly kind: CatalogKind;
    readonly category: string;
    readonly vertical: ListingToolVertical;
}): InvalidCatalogId | undefined {
    const { rows, kind, category, vertical } = args;
    const byId = new Map(rows.map((row) => [row.id, row]));
    const fields = [
        ['add', args.add],
        ['remove', args.remove]
    ] as const;
    for (const [field, ids] of fields) {
        for (const id of ids) {
            const row = byId.get(id);
            if (row === undefined) {
                return {
                    field,
                    message: `el id ${id} no existe o no aplica a ${VERTICAL_LABEL[vertical]}`
                };
            }
            if (row.category !== category) {
                return {
                    field,
                    message: `el id ${id} es de la categoría «${categoryLabel({ kind, category: row.category })}», no de «${categoryLabel({ kind, category })}»`
                };
            }
        }
    }
    return undefined;
}

/** Where a refusal points: a missing capability or a bad id to the services section. */
const refusalActionFor = ({
    error,
    input
}: {
    readonly error: ToolErrorPayload;
    readonly input: unknown;
}): ToolRefusalLink | undefined => {
    const ref = readListingRef({ input });
    if (ref === undefined) {
        return undefined;
    }
    if (error.code === ServiceErrorCode.VALIDATION_ERROR) {
        return {
            destination: editorLink({
                ref,
                section: sectionForField({ vertical: ref.vertical, field: 'amenityIds' })
            })
        };
    }
    return listingRefusalLink({ error, ref });
};

/** The patch for one kind: only that kind's key, so the other catalog is untouched. */
function patchFor(args: { readonly kind: CatalogKind; readonly ids: string[] }) {
    return args.kind === 'amenity' ? { amenityIds: args.ids } : { featureIds: args.ids };
}

/**
 * `update_listing_amenities`: a write that changes one category of the owner's
 * amenities or features; repeating it with the same input changes nothing more.
 */
export const updateListingAmenitiesTool = defineTool({
    name: 'update_listing_amenities',
    title: 'Editar comodidades o características por categoría',
    description:
        'Adds or removes the amenities or features of ONE category on a listing the connected Hospeda user owns, leaving every other category as it is (unlike update_listing_basic, which replaces the whole set). Take vertical and id from list_my_listings and call get_listing_amenities first: it lists each category with its items and which ones the listing already has. Send kind (amenity or feature), the category value as get_listing_amenities returns it, and add and/or remove with item ids of that category. An id from another category, or one that does not apply to the listing vertical, is rejected naming it and nothing is saved. To guide the user: go through the categories one at a time, show the items with the selected ones marked, ask what to add or remove, and call this tool once per category the user confirms. Repeating a call changes nothing more. A listing that does not exist or belongs to someone else is reported as not found. Answers with the category as stored after the change.',
    inputSchema: UpdateListingAmenitiesInputSchema,
    isWrite: true,
    hints: { destructiveHint: false, idempotentHint: true },
    refusalAction: refusalActionFor,
    auditTarget: ({ input }) => ({ type: input.vertical, id: input.id }),
    auditDetails: ({ input }) => ({
        kind: input.kind,
        category: input.category,
        added: input.add?.length ?? 0,
        removed: input.remove?.length ?? 0
    }),
    handler: async ({ actor, input }): Promise<ToolHandlerResult<UpdateListingAmenitiesResult>> => {
        const { vertical, id, kind, category } = input;
        const add = [...new Set(input.add ?? [])];
        const remove = [...new Set(input.remove ?? [])];

        // 1. Ownership: a foreign or missing listing is not found, before any other read.
        const owned = await readOwnListingDetail({ actor, vertical, id });
        if (owned.error) {
            return { error: owned.error };
        }
        const linked = kind === 'amenity' ? owned.data.amenities : owned.data.features;
        const current = linked.map((entry) => entry.id);

        // 2-3. The full set the route expects, and the route's listing access for it.
        const next = computeNextIds({ current, add, remove });
        const patch = patchFor({ kind, ids: next });
        const refused = await authorizeOwnerEdit({ actor, vertical, id, patch });
        if (refused) {
            return refused;
        }

        // 4. Every named id is a row of this kind and category that applies to the vertical.
        const catalog = await readVerticalCatalog({ actor, vertical, kind });
        if (catalog.error) {
            return { error: catalog.error };
        }
        const invalid = findInvalidCatalogId({
            add,
            remove,
            rows: catalog.rows,
            kind,
            category,
            vertical
        });
        if (invalid) {
            return {
                error: {
                    code: ServiceErrorCode.VALIDATION_ERROR,
                    message: invalid.message,
                    details: { field: invalid.field, message: invalid.message }
                }
            };
        }

        // 5. The write: the service call of the route, plus its cache eviction.
        const failed =
            vertical === VerticalEnum.ACCOMMODATION
                ? await writeAccommodationPatch({
                      actor,
                      id,
                      patch: patch as AccommodationUpdateHttp
                  })
                : await writeScheduledPatch({
                      actor,
                      vertical,
                      id,
                      patch: patch as VenueOwnerUpdateInput & ExperienceOwnerUpdateInput
                  });
        if (failed) {
            return failed;
        }

        // The answer is what was stored, so the model can confirm it.
        const stored = await readOwnListingDetail({ actor, vertical, id });
        if (stored.error) {
            return { error: stored.error };
        }
        const storedIds = new Set(
            (kind === 'amenity' ? stored.data.amenities : stored.data.features).map((e) => e.id)
        );
        const group = buildCatalogGroups({
            kind,
            rows: catalog.rows,
            selectedIds: storedIds,
            onlyCategory: category
        })[0] ?? { kind, category, label: categoryLabel({ kind, category }), items: [] };
        const currentSet = new Set(current);
        return {
            data: {
                listing: { vertical, id: stored.data.id, name: stored.data.name },
                added: add.filter((x) => !currentSet.has(x)).length,
                removed: remove.filter((x) => currentSet.has(x)).length,
                group
            }
        };
    }
});
