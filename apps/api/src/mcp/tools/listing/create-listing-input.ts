/**
 * @file create-listing-input.ts
 * @description The input of `create_listing` (HOS-2329, spec HOS-2335 §6.4):
 * one flat published object (C-2) and a refinement that applies, per vertical,
 * a `.pick().strict()` of that vertical's portal create schema (C-6):
 *
 * - accommodation: `AccommodationCreateDraftHttpSchema` (the host-onboarding
 *   body, owner decision D-6) → name, summary, type, destinationId, description,
 *   maxGuests, bedrooms, bathrooms, beds, street, number;
 * - venue: `VenueOwnerCreateInputSchema` → name, summary, description, type,
 *   destinationId, businessLines; street and number go to `location`;
 * - experience: `ExperienceOwnerCreateInputSchema` plus its pricing rule →
 *   name, summary, description, type, destinationId, priceFrom, priceUnit,
 *   isPriceOnRequest, businessLines; street and number go to `meetingPoint`.
 *
 * A field another vertical owns is refused by name, so the model re-asks only
 * that step (AC-C21). Coordinates are never an input: they come only from
 * `mapsUrl`, resolved by the preview (owner decision D-4).
 */

import {
    AccommodationCreateDraftHttpSchema,
    ExperienceOwnerCreateInputSchema,
    PostalAddressSchema,
    requirePricingUnlessOnRequest,
    VenueOwnerCreateInputSchema,
    VerticalEnum
} from '@repo/schemas';
import { z } from 'zod';
import type { CanonicalJsonValue } from '../canonical-json';
import { SPANISH_PARSE_PARAMS } from '../run-tool';
import { MAPS_LINK_MAX_URL_LENGTH } from './google-maps-link-guard';
import { LISTING_TOOL_VERTICALS, type ListingToolVertical } from './listing-services';

/** Accommodation: the host-onboarding draft body, strict. */
export const AccommodationCreateFieldsSchema = AccommodationCreateDraftHttpSchema.pick({
    name: true,
    summary: true,
    type: true,
    destinationId: true,
    description: true,
    maxGuests: true,
    bedrooms: true,
    bathrooms: true,
    beds: true,
    street: true,
    number: true
}).strict();

/** Venue: the owner create body, strict (location is built from street and number). */
export const VenueCreateFieldsSchema = VenueOwnerCreateInputSchema.pick({
    name: true,
    summary: true,
    description: true,
    type: true,
    destinationId: true,
    businessLines: true
}).strict();

/** Experience: the owner create body, strict, plus the route's pricing rule. */
export const ExperienceCreateFieldsSchema = ExperienceOwnerCreateInputSchema.pick({
    name: true,
    summary: true,
    description: true,
    type: true,
    destinationId: true,
    priceFrom: true,
    priceUnit: true,
    isPriceOnRequest: true,
    businessLines: true
}).strict();

/** Street and number, as the shared postal address bounds them (venue, experience). */
const PostalStreetNumberSchema = z
    .object({ street: PostalAddressSchema.shape.street, number: PostalAddressSchema.shape.number })
    .strict();

/** Per vertical: its fields schema, the Spanish name, and whether street/number live in it. */
const VERTICAL_FIELDS: Readonly<
    Record<
        ListingToolVertical,
        { readonly schema: z.ZodObject; readonly label: string; readonly ownStreet: boolean }
    >
> = {
    [VerticalEnum.ACCOMMODATION]: {
        schema: AccommodationCreateFieldsSchema,
        label: 'alojamientos',
        ownStreet: true
    },
    [VerticalEnum.VENUE]: { schema: VenueCreateFieldsSchema, label: 'locales', ownStreet: false },
    [VerticalEnum.EXPERIENCE]: {
        schema: ExperienceCreateFieldsSchema,
        label: 'experiencias',
        ownStreet: false
    }
};

/** Keys every call may carry that are not a field of the listing. */
const CONTROL_KEYS: ReadonlySet<string> = new Set(['vertical', 'mapsUrl', 'confirmationToken']);

/** Keys handled outside the vertical's schema for venue and experience. */
const STREET_KEYS: ReadonlySet<string> = new Set(['street', 'number']);

/**
 * The fields as published: types only, every limit checked by the refinement
 * with the vertical's own schema (limits differ per vertical).
 */
const PUBLISHED_FIELDS = {
    name: z.string().describe('Listing name, as the user wants it shown.'),
    type: z
        .string()
        .describe('Type value from get_listing_creation_guide for this vertical (e.g. CABIN).'),
    summary: z.string().describe('Short summary written by the user.'),
    description: z
        .string()
        .optional()
        .describe(
            'Long description written by the user. Required for venues and experiences, optional for accommodations.'
        ),
    destinationId: z.uuid().describe('Destination id from get_listing_creation_guide.'),
    priceFrom: z
        .number()
        .optional()
        .describe(
            'Experiences only. Starting price in whole centavos (pesos x 100). Omit when isPriceOnRequest is true.'
        ),
    priceUnit: z
        .string()
        .optional()
        .describe('Experiences only. Price unit value from get_listing_creation_guide.'),
    isPriceOnRequest: z
        .boolean()
        .optional()
        .describe('Experiences only. true when the price is given on request.'),
    businessLines: z
        .array(z.string())
        .optional()
        .describe(
            'Venues and experiences only. Business lines from get_listing_creation_guide; omit to use the type default.'
        ),
    maxGuests: z.number().optional().describe('Accommodations only. Maximum guests.'),
    bedrooms: z.number().optional().describe('Accommodations only. Bedrooms.'),
    bathrooms: z.number().optional().describe('Accommodations only. Bathrooms.'),
    beds: z.number().optional().describe('Accommodations only. Beds.'),
    mapsUrl: z
        .string()
        .max(MAPS_LINK_MAX_URL_LENGTH)
        .optional()
        .describe(
            'Google Maps link to the place, pasted by the user (maps.app.goo.gl, goo.gl/maps or google.com/maps). Never build one yourself.'
        ),
    street: z
        .string()
        .optional()
        .describe('Street name the user confirmed. Never taken from the map link by itself.'),
    number: z.string().optional().describe('Street number the user confirmed.'),
    confirmationToken: z
        .string()
        .min(1)
        .optional()
        .describe(
            'Omit on the first call. Pass the token of the preview ONLY after the user approved it, repeating every other field unchanged.'
        )
} as const;

/** The published listing-field names (not the control keys). */
type PublishedKey = keyof typeof PUBLISHED_FIELDS;

const PUBLISHED_KEYS: readonly PublishedKey[] = [
    'name',
    'type',
    'summary',
    'description',
    'destinationId',
    'priceFrom',
    'priceUnit',
    'isPriceOnRequest',
    'businessLines',
    'maxGuests',
    'bedrooms',
    'bathrooms',
    'beds',
    'mapsUrl',
    'street',
    'number',
    'confirmationToken'
];

/** The listing fields present (not `undefined`) in a parsed input. */
function presentFields(input: Readonly<Record<string, unknown>>): string[] {
    return PUBLISHED_KEYS.filter((key) => !CONTROL_KEYS.has(key) && input[key] !== undefined);
}

/** Copies the given keys of an input. */
function pick(
    input: Readonly<Record<string, unknown>>,
    keys: readonly string[]
): Record<string, unknown> {
    return Object.fromEntries(keys.map((key) => [key, input[key]]));
}

/** Adds the issues of a failed parse, keeping their paths. */
function addIssues(
    ctx: z.RefinementCtx,
    result: { readonly success: boolean; readonly error?: z.ZodError }
): void {
    for (const issue of result.error?.issues ?? []) {
        ctx.addIssue({ code: 'custom', path: [...issue.path], message: issue.message });
    }
}

/**
 * Experience pricing on request: the portal schema requires `priceFrom` and
 * accepts `null` for it, which a published optional number cannot carry. When
 * the user said "price on request" and gave no price, the body gets
 * `priceFrom: null`, as the web form sends.
 *
 * @param args - The input
 * @returns `{ priceFrom: null }` when it applies, `{}` otherwise
 */
export function priceOnRequestDefaults({
    input
}: {
    readonly input: Readonly<Record<string, unknown>>;
}): { readonly priceFrom?: null } {
    return input.vertical === VerticalEnum.EXPERIENCE &&
        input.isPriceOnRequest === true &&
        input.priceFrom === undefined
        ? { priceFrom: null }
        : {};
}

/**
 * Applies the vertical's create schema to a parsed input: foreign fields, the
 * vertical's own validation, and (venue, experience) the postal bounds of
 * street and number.
 */
function refineForVertical(
    input: Readonly<Record<string, unknown>> & { readonly vertical?: unknown },
    ctx: z.RefinementCtx
): void {
    const vertical = LISTING_TOOL_VERTICALS.find((v) => v === input.vertical);
    if (vertical === undefined) {
        return; // the `vertical` field reports its own issue
    }
    const { schema, label, ownStreet } = VERTICAL_FIELDS[vertical];
    const accepted = new Set([...Object.keys(schema.shape), ...STREET_KEYS]);
    const present = presentFields(input);
    for (const field of present.filter((key) => !accepted.has(key))) {
        ctx.addIssue({ code: 'custom', path: [field], message: `no se usa en ${label}` });
    }
    const own = present.filter(
        (key) => Object.hasOwn(schema.shape, key) && (ownStreet || !STREET_KEYS.has(key))
    );
    const base = { ...pick(input, own), ...priceOnRequestDefaults({ input }) };
    addIssues(ctx, schema.safeParse(base, SPANISH_PARSE_PARAMS));
    if (vertical === VerticalEnum.EXPERIENCE) {
        // The route's CHECKED schema: a price needs a unit, unless it is on request.
        const pricing = z
            .looseObject({})
            .superRefine((value, refineCtx) => requirePricingUnlessOnRequest(value, refineCtx));
        addIssues(ctx, pricing.safeParse(base, SPANISH_PARSE_PARAMS));
    }
    if (!ownStreet) {
        const streetPart = pick(
            input,
            present.filter((key) => STREET_KEYS.has(key))
        );
        addIssues(ctx, PostalStreetNumberSchema.safeParse(streetPart, SPANISH_PARSE_PARAMS));
    }
}

/** Input schema of `create_listing`. One flat object (see file header). */
export const CreateListingInputSchema = z
    .object({
        vertical: z
            .enum(LISTING_TOOL_VERTICALS)
            .describe('accommodation, venue or experience: what the user wants to publish.'),
        ...PUBLISHED_FIELDS
    })
    .strict()
    .superRefine(refineForVertical);

/** Validated input of `create_listing`. */
export type CreateListingInput = z.output<typeof CreateListingInputSchema>;

/**
 * The payload a confirmation token binds: every field of the call except the
 * token itself, absent fields dropped. Key order is irrelevant (canonical JSON).
 *
 * @param args - The validated input
 * @returns The canonical-JSON-ready payload
 */
export function bindingPayloadOf({
    input
}: {
    readonly input: CreateListingInput;
}): CanonicalJsonValue {
    const { confirmationToken: _token, ...rest } = input;
    const payload: Record<string, CanonicalJsonValue> = {};
    for (const [key, value] of Object.entries(rest)) {
        if (value !== undefined) {
            payload[key] = value;
        }
    }
    return payload;
}
