/**
 * @file accommodation-edit-form.schema.ts
 * @description Validation schema for the accommodation editor, sliced per
 * section page (HOS-318 T-004).
 *
 * Extracted from `AccommodationEditor.client.tsx`, where it lived while the
 * editor was one page. Now that each section is its own page with its own
 * partial PATCH, each page validates only the fields it owns.
 *
 * ## Why composition and not `.pick()`
 *
 * The slices are assembled from individual field schemas via `z.object({...})`,
 * never by slicing the full schema with `.pick()`/`.omit()`/`.partial()`. Zod 4
 * rejects those on a schema carrying `.refine()` (HOS-425), and the base HTTP
 * schema is free to grow one at any time. Reading fields off `.shape` and
 * composing them is immune to that.
 */

import {
    AccommodationUpdateHttpSchema,
    InternationalPhoneRegex,
    PriceCurrencyEnumSchema
} from '@repo/schemas';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Field overrides
// ---------------------------------------------------------------------------

/*
 * These five groups override the HTTP schema deliberately. The HTTP schema is
 * looser than `AccommodationSchema` (the domain source of truth), and the editor
 * used to validate against the loose bounds only:
 *
 *  - `name`: HTTP allows 200 chars; the domain caps it at 100.
 *  - `description`: HTTP allows up to 5000 with no minimum; the domain requires
 *    30–2000.
 *  - `basePrice`: HTTP accepts `0`; the domain requires a strictly positive value.
 *  - `phone`/`whatsapp`: HTTP types these as a bare `z.string().optional()` with
 *    NO format check (unlike `email`/`website`/every social URL in the same
 *    schema), so `"asdasd"` passed both the client gate and the server. They are
 *    re-tightened to the shared `InternationalPhoneRegex` — the same E.164
 *    pattern `ProfileEditSchema.phone` enforces. `''` stays valid so a host can
 *    clear the field (HOS-190).
 *
 * The numeric fields are widened with `.nullable()`: the inherited
 * `z.coerce.number()` would otherwise silently coerce an explicit `null` (host
 * clearing the field) to `0`, which then passes bounds checks it should not.
 */

const nameField = z
    .string()
    .min(3, { message: 'zodError.accommodation.name.min' })
    .max(100, { message: 'zodError.accommodation.name.max' })
    .optional();

const descriptionField = z
    .string()
    .min(30, { message: 'zodError.accommodation.description.min' })
    .max(2000, { message: 'zodError.accommodation.description.max' })
    .optional();

const latitudeField = z
    .number()
    .min(-90, { message: 'zodError.accommodation.location.coordinates.lat.min' })
    .max(90, { message: 'zodError.accommodation.location.coordinates.lat.max' })
    .nullable()
    .optional();

const longitudeField = z
    .number()
    .min(-180, { message: 'zodError.accommodation.location.coordinates.long.min' })
    .max(180, { message: 'zodError.accommodation.location.coordinates.long.max' })
    .nullable()
    .optional();

const maxGuestsField = z
    .number()
    .int()
    .min(1, { message: 'zodError.accommodation.extraInfo.capacity.min' })
    .max(200, { message: 'zodError.accommodation.extraInfo.capacity.max' })
    .nullable()
    .optional();

const bedroomsField = z
    .number()
    .int()
    .min(0, { message: 'zodError.accommodation.extraInfo.bedrooms.min' })
    .max(100, { message: 'zodError.accommodation.extraInfo.bedrooms.max' })
    .nullable()
    .optional();

const bathroomsField = z
    .number()
    .int()
    .min(1, { message: 'zodError.accommodation.extraInfo.bathrooms.min' })
    .max(100, { message: 'zodError.accommodation.extraInfo.bathrooms.max' })
    .nullable()
    .optional();

const basePriceField = z
    .number()
    .positive({ message: 'zodError.common.price.price.positive' })
    .nullable()
    .optional();

const currencyField = PriceCurrencyEnumSchema.nullable().optional();

const phoneField = z
    .union([
        z.literal(''),
        z.string().regex(InternationalPhoneRegex, {
            message: 'zodError.common.contact.mobilePhone.international'
        })
    ])
    .optional();

const whatsappField = z
    .union([
        z.literal(''),
        z.string().regex(InternationalPhoneRegex, {
            message: 'zodError.common.contact.whatsapp.international'
        })
    ])
    .optional();

/**
 * Fields taken verbatim from the real HTTP schema — the exact one
 * `PATCH /api/v1/protected/accommodations/:id` validates against — so
 * email/URL/social validation matches the server 1:1.
 *
 * Read off `.shape` rather than sliced with `.pick()`; see the file header.
 */
const inherited = AccommodationUpdateHttpSchema.shape;

// ---------------------------------------------------------------------------
// Per-section slices
// ---------------------------------------------------------------------------

/** `…/editar/datos/` — name, summary, description, type, destination. */
export const AccommodationBasicsSchema = z.object({
    name: nameField,
    summary: inherited.summary,
    description: descriptionField,
    type: inherited.type,
    destinationId: inherited.destinationId
});

/** `…/editar/capacidad-precio/` — guests, bedrooms, bathrooms, price, currency. */
export const AccommodationCapacityPricingSchema = z.object({
    maxGuests: maxGuestsField,
    bedrooms: bedroomsField,
    bathrooms: bathroomsField,
    basePrice: basePriceField,
    currency: currencyField
});

/**
 * `…/editar/ubicacion/` — coordinates.
 *
 * Latitude and longitude must always be sent together:
 * `httpToDomainAccommodationUpdate` only emits `location.coordinates` when BOTH
 * are present in the body, so a payload carrying one silently drops the
 * coordinate update with no error anywhere (HOS-190). The pairing is enforced by
 * the shared section-form hook, not here — this schema only bounds the values.
 */
export const AccommodationLocationSchema = z.object({
    latitude: latitudeField,
    longitude: longitudeField
});

/** `…/editar/servicios/` — amenity and feature selections. */
export const AccommodationServicesSchema = z.object({
    amenityIds: inherited.amenityIds,
    featureIds: inherited.featureIds
});

/** `…/editar/contacto/` — contact channels plus the six social URLs. */
export const AccommodationContactSchema = z.object({
    phone: phoneField,
    whatsapp: whatsappField,
    email: inherited.email,
    website: inherited.website,
    facebook: inherited.facebook,
    instagram: inherited.instagram,
    twitter: inherited.twitter,
    linkedin: inherited.linkedin,
    tiktok: inherited.tiktok,
    youtube: inherited.youtube
});

/**
 * Every slice merged — the exact field set the pre-split editor validated.
 *
 * Kept so the parity test can assert the split lost no field, and as the schema
 * for any caller that still submits a cross-section diff.
 */
export const AccommodationEditFormSchema = AccommodationBasicsSchema.extend(
    AccommodationCapacityPricingSchema.shape
)
    .extend(AccommodationLocationSchema.shape)
    .extend(AccommodationServicesSchema.shape)
    .extend(AccommodationContactSchema.shape);

/**
 * The slices keyed by section id, so a page can look up its own validator from
 * the section registry instead of importing one by hand.
 */
export const ACCOMMODATION_SECTION_SCHEMAS = {
    basicInfo: AccommodationBasicsSchema,
    capacityPricing: AccommodationCapacityPricingSchema,
    location: AccommodationLocationSchema,
    amenities: AccommodationServicesSchema,
    contact: AccommodationContactSchema
} as const;

/** Section ids that own a form. The other five sections save on their own. */
export type AccommodationFormSectionId = keyof typeof ACCOMMODATION_SECTION_SCHEMAS;
