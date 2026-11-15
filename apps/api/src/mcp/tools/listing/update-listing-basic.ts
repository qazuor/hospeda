/**
 * @file update-listing-basic.ts
 * @description Tool `update_listing_basic` (HOS-2184 T-016, spec §6.5, AC-5,
 * AC-6, AC-12): the owner changes the basic data of one of their listings —
 * description, opening hours, contact data, amenities and features.
 *
 * It is a thin adapter over the owner PATCH route of each vertical
 * (`routes/{venue,experience}/protected/patch.ts`) and runs the same steps:
 * 1. **Allowlist.** Per vertical, a `.pick()` of the route's own body schema
 *    (`VenueOwnerUpdateInputSchema` / `ExperienceOwnerUpdateInputSchema`),
 *    `.strict()`: any other field is a `VALIDATION_ERROR` (AC-5).
 * 2. **Listing access.** `decideListingAccess` with the route's declaration
 *    (operation `EDIT`, the sections the patch writes — shared through
 *    `utils/listing-access/owner-edit-listing-access.ts`), owner-only: a
 *    foreign or missing listing is not found (AC-6), never a staff edit.
 * 3. **The service call** the route makes: `updateOwn`. Cache revalidation,
 *    junction sync of amenities/features and auto-translation live in the
 *    service's update hooks, so they run exactly as for the route.
 *
 * The answer is the listing as `get_listing` returns it, re-read after the
 * write, so the model can confirm what was stored.
 *
 * ## Published input schema
 * MCP clients (Claude, ChatGPT) require a top-level `type: "object"` input
 * schema with no `oneOf`, so the input is ONE flat object: `vertical`, `id`
 * and every editable field, all optional. A refinement applies the
 * per-vertical allowlist and its validation, and requires at least one field.
 */

import {
    type ExperienceOwnerUpdateInput,
    ExperienceOwnerUpdateInputSchema,
    type VenueOwnerUpdateInput,
    VenueOwnerUpdateInputSchema,
    VerticalEnum
} from '@repo/schemas';
import { type Actor, entityNotFoundError } from '@repo/service-core';
import { z } from 'zod';
import {
    decideListingAccess,
    type ListingAccessWithSections,
    throwListingAccessRefusal
} from '../../../middlewares/listing-access';
import {
    experienceOwnerEditSections,
    experienceOwnerEditSectionTraits,
    venueOwnerEditSections
} from '../../../utils/listing-access/owner-edit-listing-access';
import { SPANISH_PARSE_PARAMS } from '../run-tool';
import { defineTool, type ToolHandlerResult } from '../tool-definition';
import { type ListingDetail, readOwnListingDetail } from './get-listing';
import { listingToolExperienceService, listingToolVenueService } from './listing-services';

/** The fields venues and experiences accept, in the order they are documented. */
const SCHEDULED_BASIC_FIELDS = {
    description: true,
    openingHours: true,
    contactInfo: true,
    amenityIds: true,
    featureIds: true
} as const;

/** Venue allowlist: a `.pick()` of the venue owner PATCH body, strict. */
export const VenueBasicPatchSchema =
    VenueOwnerUpdateInputSchema.pick(SCHEDULED_BASIC_FIELDS).strict();

/** Experience allowlist: a `.pick()` of the experience owner PATCH body, strict. */
export const ExperienceBasicPatchSchema =
    ExperienceOwnerUpdateInputSchema.pick(SCHEDULED_BASIC_FIELDS).strict();

/** The verticals this tool edits. */
const UPDATE_LISTING_BASIC_VERTICALS = [VerticalEnum.VENUE, VerticalEnum.EXPERIENCE] as const;

/** One of {@link UPDATE_LISTING_BASIC_VERTICALS}. */
type UpdateListingBasicVertical = (typeof UPDATE_LISTING_BASIC_VERTICALS)[number];

/** Per vertical: its allowlist schema and the Spanish name used in messages. */
const VERTICAL_PATCH: Readonly<
    Record<UpdateListingBasicVertical, { readonly schema: z.ZodObject; readonly label: string }>
> = {
    [VerticalEnum.VENUE]: { schema: VenueBasicPatchSchema, label: 'locales' },
    [VerticalEnum.EXPERIENCE]: { schema: ExperienceBasicPatchSchema, label: 'experiencias' }
};

/**
 * The editable fields as published. Each comes from an allowlist schema;
 * `description` is a plain string here because its length limits differ per
 * vertical — the refinement checks them with the vertical's own schema.
 */
const EDITABLE_FIELDS_SHAPE = {
    description: z
        .string()
        .optional()
        .describe(
            'New long description, written by the user. Venues and experiences: 20 to 2000 characters.'
        ),
    openingHours: VenueBasicPatchSchema.shape.openingHours.describe(
        'Venues and experiences only. Weekly schedule; replaces the stored one.'
    ),
    contactInfo: VenueBasicPatchSchema.shape.contactInfo.describe(
        'Venues and experiences only. Contact details (phones, email, website).'
    ),
    amenityIds: VenueBasicPatchSchema.shape.amenityIds.describe(
        'Amenity ids the listing must end up with: the full set, not a delta ([] clears all). Current ids come from get_listing.'
    ),
    featureIds: VenueBasicPatchSchema.shape.featureIds.describe(
        'Feature ids the listing must end up with: the full set, not a delta ([] clears all). Current ids come from get_listing.'
    )
} as const;

/** Names of the editable fields. */
type EditableField = keyof typeof EDITABLE_FIELDS_SHAPE;

/** Every editable field name. */
const EDITABLE_FIELDS: readonly EditableField[] = [
    'description',
    'openingHours',
    'contactInfo',
    'amenityIds',
    'featureIds'
];

/** Narrows an issue path segment to an editable field name. */
function isEditableField(value: unknown): value is EditableField {
    return EDITABLE_FIELDS.some((field) => field === value);
}

/** The editable fields present (not `undefined`) in an input. */
function presentFields(input: Readonly<Record<string, unknown>>): EditableField[] {
    return EDITABLE_FIELDS.filter((field) => input[field] !== undefined);
}

/** Copies the present fields of an input into a patch object. */
function pickPresent(
    input: Readonly<Record<string, unknown>>,
    fields: readonly string[]
): Record<string, unknown> {
    return Object.fromEntries(fields.map((field) => [field, input[field]]));
}

/**
 * Applies the vertical's allowlist to a parsed input: fields that vertical
 * does not edit, an empty patch, and the vertical's own validation of each
 * value. An issue on a value the published field already refused is not
 * repeated.
 */
function refineForVertical(
    input: Readonly<Record<string, unknown>> & { readonly vertical?: unknown },
    ctx: z.RefinementCtx
): void {
    const vertical = UPDATE_LISTING_BASIC_VERTICALS.find((v) => v === input.vertical);
    if (vertical === undefined) {
        return; // the `vertical` field reports its own issue
    }
    const { schema, label } = VERTICAL_PATCH[vertical];
    const allowed = Object.keys(schema.shape);
    const present = presentFields(input);
    const foreign = present.filter((field) => !allowed.includes(field));
    for (const field of foreign) {
        ctx.addIssue({
            code: 'custom',
            path: [field],
            message: `no se puede modificar en ${label}`
        });
    }
    const editable = present.filter((field) => allowed.includes(field));
    if (editable.length === 0) {
        ctx.addIssue({
            code: 'custom',
            path: [],
            message: `indicá al menos un campo a modificar (${allowed.join(', ')})`
        });
        return;
    }
    const patch = pickPresent(input, editable);
    const parsed = schema.safeParse(patch, SPANISH_PARSE_PARAMS);
    if (parsed.success) {
        return;
    }
    for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (
            isEditableField(field) &&
            !EDITABLE_FIELDS_SHAPE[field].safeParse(patch[field]).success
        ) {
            continue; // already reported by the published field
        }
        ctx.addIssue({ code: 'custom', path: [...issue.path], message: issue.message });
    }
}

/** Input schema of `update_listing_basic`. One flat object (see file header). */
export const UpdateListingBasicInputSchema = z
    .object({
        vertical: z
            .enum(UPDATE_LISTING_BASIC_VERTICALS)
            .describe('The vertical returned by list_my_listings for this listing.'),
        id: z.uuid().describe('The listing id returned by list_my_listings.'),
        ...EDITABLE_FIELDS_SHAPE
    })
    .strict()
    .superRefine(refineForVertical);

/** Validated input of `update_listing_basic`. */
export type UpdateListingBasicInput = z.output<typeof UpdateListingBasicInputSchema>;

/** The uniform not-found error, whatever the vertical. */
function notFound(): ToolHandlerResult<never> {
    const error = entityNotFoundError({ entityName: 'listing' });
    return { error: { code: error.code, message: error.message } };
}

/** The owner PATCH route's listing-access declaration for a vertical. */
function ownerEditDeclaration(vertical: UpdateListingBasicVertical): ListingAccessWithSections {
    if (vertical === VerticalEnum.VENUE) {
        return {
            vertical: VerticalEnum.VENUE,
            operation: 'EDIT',
            idParam: 'id',
            listingSection: venueOwnerEditSections
        };
    }
    return {
        vertical: VerticalEnum.EXPERIENCE,
        operation: 'EDIT',
        idParam: 'id',
        listingSection: experienceOwnerEditSections,
        sectionTraits: experienceOwnerEditSectionTraits
    };
}

/**
 * Runs the route's listing-access step, owner-only. Resolves to `undefined`
 * when allowed, to the not-found error for a foreign or missing listing;
 * every other refusal is thrown as the route throws it (a `ServiceError`,
 * mapped by the tool executor).
 */
async function authorizeOwnerEdit(input: {
    readonly actor: Actor;
    readonly vertical: UpdateListingBasicVertical;
    readonly id: string;
    readonly patch: Record<string, unknown>;
}): Promise<ToolHandlerResult<never> | undefined> {
    const config = ownerEditDeclaration(input.vertical);
    const decision = await decideListingAccess({
        actor: input.actor,
        listingId: input.id,
        config,
        tier: 'protected',
        body: input.patch,
        ownerOnly: true
    });
    if (decision === null) {
        return notFound(); // never for EDIT; fail closed
    }
    const { result, subjectId, ports } = decision;
    if (result.allowed) {
        return undefined;
    }
    if (result.reason === 'NOT_FOUND') {
        return notFound();
    }
    return throwListingAccessRefusal({ config, result, subjectId, ports });
}

/** Calls the vertical's `updateOwn`, as the owner PATCH route does. */
async function updateScheduled(input: {
    readonly actor: Actor;
    readonly vertical: UpdateListingBasicVertical;
    readonly id: string;
    readonly patch: VenueOwnerUpdateInput & ExperienceOwnerUpdateInput;
}): Promise<ToolHandlerResult<never> | undefined> {
    const { actor, vertical, id, patch } = input;
    const result =
        vertical === VerticalEnum.VENUE
            ? await listingToolVenueService.updateOwn(id, patch, actor)
            : await listingToolExperienceService.updateOwn(id, patch, actor);
    if (result.error) {
        return { error: result.error };
    }
    return undefined;
}

/** Spanish messages for refusal reasons the route can return. */
const UPDATE_LISTING_BASIC_REASON_MESSAGES: Readonly<Record<string, string>> = {
    SECTION_ABSENT:
        'Esa sección no existe para el tipo de publicación. Revisá los campos que querés cambiar.'
};

/**
 * `update_listing_basic`: a write that changes only what the owner PATCH
 * changes; repeating it with the same input changes nothing more.
 */
export const updateListingBasicTool = defineTool({
    name: 'update_listing_basic',
    title: 'Editar datos básicos de una publicación',
    description:
        'Changes the basic data of one listing the connected Hospeda user owns. Venues and experiences accept description, openingHours, contactInfo, amenityIds and featureIds. Send only the fields to change, with at least one; any other field is rejected. amenityIds and featureIds replace the whole set. A listing that does not exist or belongs to someone else is reported as not found. Take vertical and id from list_my_listings, and read the current values with get_listing first. Answers with the listing as stored after the change.',
    inputSchema: UpdateListingBasicInputSchema,
    isWrite: true,
    hints: { destructiveHint: false, idempotentHint: true },
    reasonMessages: UPDATE_LISTING_BASIC_REASON_MESSAGES,
    auditTarget: ({ input }) => ({ type: input.vertical, id: input.id }),
    auditContentLength: ({ input }) => input.description?.length,
    handler: async ({ actor, input }): Promise<ToolHandlerResult<ListingDetail>> => {
        const { vertical, id } = input;
        const patch: VenueOwnerUpdateInput & ExperienceOwnerUpdateInput = {
            ...(input.description === undefined ? {} : { description: input.description }),
            ...(input.openingHours === undefined ? {} : { openingHours: input.openingHours }),
            ...(input.contactInfo === undefined ? {} : { contactInfo: input.contactInfo }),
            ...(input.amenityIds === undefined ? {} : { amenityIds: input.amenityIds }),
            ...(input.featureIds === undefined ? {} : { featureIds: input.featureIds })
        };

        const refused = await authorizeOwnerEdit({ actor, vertical, id, patch });
        if (refused) {
            return refused;
        }
        const failed = await updateScheduled({ actor, vertical, id, patch });
        if (failed) {
            return failed;
        }
        return readOwnListingDetail({ actor, vertical, id });
    }
});
