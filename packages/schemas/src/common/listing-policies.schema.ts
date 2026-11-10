import { z } from 'zod';
import { I18nTextSchema } from './i18n.schema.js';

/**
 * @file listing-policies.schema.ts
 * @description Shared base of the `policies` JSONB column carried by every
 * listing vertical (HOS-2060, stage 4 of HOS-1016).
 *
 * House rules used to live as amenity/feature catalog rows (`pet_friendly`,
 * `smoke_free`, `accepts_cards`, `private_events`, ...) or scattered columns.
 * A checkbox cannot say "on request" or "extra charge", so the rules move to a
 * structured, validated object. This file holds the fields every vertical
 * shares; each vertical extends it with its own (see
 * `AccommodationPoliciesSchema`, `VenuePoliciesSchema`,
 * `ExperiencePoliciesSchema`).
 *
 * ## Absent is not `false`
 *
 * Every field is OPTIONAL and none carries a default. A listing that never
 * declared a smoking policy has no `smokingAllowed` key; it does not "forbid
 * smoking". Readers, filters and structured data must treat a missing key as
 * "not informed". There is deliberately no `.default()` anywhere: Zod 4's
 * `.partial()` keeps defaults, and an injected default would be indistinguishable
 * from a declaration.
 */

/**
 * The closed list of payment methods a listing can declare (owner decision,
 * HOS-2060 OQ-2, 2026-11-07). Five values, no sixth: widening it is an
 * additive schema change and needs its own decision.
 */
export const LISTING_PAYMENT_METHODS = [
    'cash',
    'debit',
    'credit',
    'transfer',
    'mercadopago'
] as const;

/** One payment method a listing accepts. */
export type ListingPaymentMethod = (typeof LISTING_PAYMENT_METHODS)[number];

/** Zod schema for one {@link ListingPaymentMethod}. */
export const ListingPaymentMethodSchema = z.enum(LISTING_PAYMENT_METHODS, {
    error: 'zodError.listingPolicies.paymentMethods.invalid'
});

/**
 * Accepted payment methods: each value at most once. Order is not meaningful;
 * an empty array is accepted and means "declared, and the list is empty",
 * which a reader should treat the same as an absent key.
 */
export const ListingPaymentMethodsSchema = z
    .array(ListingPaymentMethodSchema, {
        error: 'zodError.listingPolicies.paymentMethods.invalidType'
    })
    .max(LISTING_PAYMENT_METHODS.length, {
        message: 'zodError.listingPolicies.paymentMethods.duplicate'
    })
    .refine((methods) => new Set(methods).size === methods.length, {
        message: 'zodError.listingPolicies.paymentMethods.duplicate'
    });

/** Whether pets are admitted: `on_request` means "ask first". */
export const LISTING_PET_ADMISSION_VALUES = ['no', 'yes', 'on_request'] as const;

/** One {@link LISTING_PET_ADMISSION_VALUES} value. */
export type ListingPetAdmission = (typeof LISTING_PET_ADMISSION_VALUES)[number];

/**
 * The admission values that count as "pets allowed" for the public
 * `allowsPets` filter. `on_request` counts: a visitor travelling with a pet
 * wants to see the listings where it is possible, even if they must ask.
 */
export const LISTING_PETS_ALLOWED_ADMISSIONS = [
    'yes',
    'on_request'
] as const satisfies readonly ListingPetAdmission[];

/** Zod schema for one {@link ListingPetAdmission}. */
export const ListingPetAdmissionSchema = z.enum(LISTING_PET_ADMISSION_VALUES, {
    error: 'zodError.listingPolicies.pets.admission.invalid'
});

/**
 * Short localized note for a policy (e.g. "only small dogs"). Capped per locale
 * because it renders next to a badge, not as body text.
 */
export const ListingPolicyNoteSchema = I18nTextSchema.extend({
    es: z.string().max(200, { message: 'zodError.listingPolicies.note.tooLong' }),
    en: z.string().max(200, { message: 'zodError.listingPolicies.note.tooLong' }),
    pt: z.string().max(200, { message: 'zodError.listingPolicies.note.tooLong' })
});

/**
 * Pets policy. `extraCost` says whether pets carry a surcharge; the amount, when
 * the owner wants to state it, belongs in `notes` (money is not modelled here).
 */
export const ListingPetsPolicySchema = z.object({
    admission: ListingPetAdmissionSchema,
    extraCost: z.boolean().optional(),
    notes: ListingPolicyNoteSchema.optional()
});

/** TypeScript type for {@link ListingPetsPolicySchema}. */
export type ListingPetsPolicy = z.infer<typeof ListingPetsPolicySchema>;

/** Smoking policy values. `outdoor_only` = allowed only in open-air areas. */
export const LISTING_SMOKING_VALUES = ['no', 'yes', 'outdoor_only'] as const;

/** One {@link LISTING_SMOKING_VALUES} value. */
export type ListingSmokingPolicy = (typeof LISTING_SMOKING_VALUES)[number];

/** Zod schema for one {@link ListingSmokingPolicy}. */
export const ListingSmokingPolicySchema = z.enum(LISTING_SMOKING_VALUES, {
    error: 'zodError.listingPolicies.smokingAllowed.invalid'
});

/**
 * The policy fields every listing vertical shares. Extend it per vertical with
 * `.extend({...})`; never copy its fields.
 */
export const ListingPoliciesBaseSchema = z.object({
    // Every key is nullish: on an update, `null` clears that one key (see
    // `mergeListingPolicies`); a stored object never holds a null.
    /** Payment methods the listing accepts. */
    paymentMethods: ListingPaymentMethodsSchema.nullish(),
    /** Pets policy. */
    pets: ListingPetsPolicySchema.nullish(),
    /** Smoking policy. */
    smokingAllowed: ListingSmokingPolicySchema.nullish(),
    /** Whether private events can be held at the listing. */
    eventsAllowed: z.boolean().nullish()
});

/** TypeScript type for {@link ListingPoliciesBaseSchema}. */
export type ListingPoliciesBase = z.infer<typeof ListingPoliciesBaseSchema>;

/**
 * The policies a listing is born with (HOS-2060): cash, the one payment
 * method every listing accepts. The migration that introduced `policies` gave
 * every existing listing the same value, so a new listing is never the only
 * one with nothing declared. Frozen: callers copy it.
 */
export const DEFAULT_LISTING_POLICIES = Object.freeze({
    paymentMethods: Object.freeze(['cash'] as const)
});

/**
 * Shallow-merges a policies patch into the stored object, per top-level key
 * (HOS-2060). A key the patch omits keeps its stored value; a key the patch
 * sets to `null` is removed; `patch === null` clears the whole object. This is
 * what lets an editor section send only the keys it owns without wiping the
 * rest.
 *
 * @param input.stored - The object currently stored (or null).
 * @param input.patch - The incoming value (undefined = untouched).
 * @returns The object to persist, or `undefined` when nothing changes.
 */
export function mergeListingPolicies<T extends Record<string, unknown>>({
    stored,
    patch
}: {
    readonly stored: T | null | undefined;
    readonly patch: Partial<Record<keyof T, unknown>> | null | undefined;
}): { readonly policies: T | null | undefined } {
    if (patch === undefined) return { policies: undefined };
    if (patch === null) return { policies: null };
    const merged: Record<string, unknown> = { ...(stored ?? {}) };
    for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue;
        if (value === null) delete merged[key];
        else merged[key] = value;
    }
    return { policies: merged as T };
}
