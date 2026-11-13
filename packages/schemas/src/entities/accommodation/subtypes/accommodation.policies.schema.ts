import { z } from 'zod';
import {
    ListingPoliciesBaseSchema,
    ListingPolicyNoteSchema
} from '../../../common/listing-policies.schema.js';
import { HHmmSchema } from '../../../common/opening-hours.schema.js';

/**
 * A check-in or check-out window, each bound an `HH:mm` string. Either bound
 * may be absent ("from 14:00", "until 10:00").
 */
export const AccommodationPolicyTimeWindowSchema = z.object({
    from: HHmmSchema.optional(),
    to: HHmmSchema.optional()
});

/** TypeScript type for {@link AccommodationPolicyTimeWindowSchema}. */
export type AccommodationPolicyTimeWindow = z.infer<typeof AccommodationPolicyTimeWindowSchema>;

/**
 * Nights per stay, 1 to 365. Same bounds as the host editor's `minNights`
 * field (`AccommodationUpdateHttpSchema`).
 */
const NightsSchema = z
    .number()
    .int({ message: 'zodError.accommodation.extraInfo.minNights.required' })
    .min(1, { message: 'zodError.accommodation.extraInfo.minNights.min' })
    .max(365, { message: 'zodError.accommodation.extraInfo.minNights.max' });

/**
 * Booking deposit ("seña para reservar", HOS-2120). `required` says whether
 * the host asks for one; `percentage` (1–100, of the stay total) and `notes`
 * are optional details that only mean something when it is required, so the
 * schema rejects a percentage on a "no". Money amounts are not modelled — an
 * owner who wants to state one writes it in `notes`.
 *
 * Accommodation-only: a venue or an experience does not take a deposit to hold
 * a stay, and keeping it out of `ListingPoliciesBaseSchema` keeps their editors
 * and public pages untouched.
 */
export const AccommodationDepositPolicySchema = z
    .object({
        required: z.boolean({ error: 'zodError.listingPolicies.deposit.required.invalid' }),
        percentage: z
            .number()
            .int({ message: 'zodError.listingPolicies.deposit.percentage.integer' })
            .min(1, { message: 'zodError.listingPolicies.deposit.percentage.min' })
            .max(100, { message: 'zodError.listingPolicies.deposit.percentage.max' })
            .optional(),
        notes: ListingPolicyNoteSchema.optional()
    })
    .refine((deposit) => deposit.required || deposit.percentage === undefined, {
        message: 'zodError.listingPolicies.deposit.percentage.requiresDeposit',
        path: ['percentage']
    });

/** TypeScript type for {@link AccommodationDepositPolicySchema}. */
export type AccommodationDepositPolicy = z.infer<typeof AccommodationDepositPolicySchema>;

/**
 * The closed list of languages a host can declare they attend guests in
 * (HOS-2120 owner decision): seven values, `other` included. Widening it is an
 * additive schema change.
 */
export const ACCOMMODATION_SPOKEN_LANGUAGES = [
    'es',
    'en',
    'pt',
    'it',
    'fr',
    'de',
    'other'
] as const;

/** One {@link ACCOMMODATION_SPOKEN_LANGUAGES} value. */
export type AccommodationSpokenLanguage = (typeof ACCOMMODATION_SPOKEN_LANGUAGES)[number];

/** Zod schema for one {@link AccommodationSpokenLanguage}. */
export const AccommodationSpokenLanguageSchema = z.enum(ACCOMMODATION_SPOKEN_LANGUAGES, {
    error: 'zodError.listingPolicies.spokenLanguages.invalid'
});

/**
 * Languages the host attends guests in: each value at most once, order not
 * meaningful. An empty array reads the same as an absent key.
 */
export const AccommodationSpokenLanguagesSchema = z
    .array(AccommodationSpokenLanguageSchema, {
        error: 'zodError.listingPolicies.spokenLanguages.invalidType'
    })
    .max(ACCOMMODATION_SPOKEN_LANGUAGES.length, {
        message: 'zodError.listingPolicies.spokenLanguages.duplicate'
    })
    .refine((languages) => new Set(languages).size === languages.length, {
        message: 'zodError.listingPolicies.spokenLanguages.duplicate'
    });

/**
 * Details of the private-events policy (HOS-2122), meaningful only when the
 * base `eventsAllowed` is `true`. Every field is optional: an absent one is
 * "not informed". `endTime` is the latest hour an event may run (`HH:mm`),
 * stored as a time rather than free text so it reads in every locale.
 *
 * A sibling of `eventsAllowed` rather than a replacement, so existing rows keep
 * parsing. Accommodation-only, for the same reason as the deposit. The service
 * drops a stored `eventsDetails` whenever the merged `eventsAllowed` is not
 * `true` (`listing-policies-write.ts`).
 */
export const AccommodationEventsDetailsSchema = z.object({
    /** Maximum number of guests at an event. */
    maxGuests: z
        .number()
        .int({ message: 'zodError.listingPolicies.eventsDetails.maxGuests.integer' })
        .min(1, { message: 'zodError.listingPolicies.eventsDetails.maxGuests.min' })
        .max(1000, { message: 'zodError.listingPolicies.eventsDetails.maxGuests.max' })
        .optional(),
    /** Whether amplified music/sound is allowed. */
    amplifiedSound: z.boolean().optional(),
    /** Latest hour an event may run, `HH:mm`. */
    endTime: HHmmSchema.optional(),
    /** Whether events carry an extra charge (the amount, if any, goes in `notes`). */
    extraCost: z.boolean().optional(),
    /** Owner note. */
    notes: ListingPolicyNoteSchema.optional()
});

/** TypeScript type for {@link AccommodationEventsDetailsSchema}. */
export type AccommodationEventsDetails = z.infer<typeof AccommodationEventsDetailsSchema>;

/**
 * The accommodation `policies` JSONB (HOS-2060): the shared base plus check-in,
 * check-out and the stay length.
 *
 * `minNights` and `maxNights` moved here from `extra_info` (HOS-2060);
 * `minNights` is still a publish requirement. When both are present,
 * `maxNights` cannot be below `minNights`.
 *
 * HOS-2120/HOS-2122 add `deposit`, `spokenLanguages` and `eventsDetails`, all
 * nullish like the rest, so every row stored before them still parses.
 */
export const AccommodationPoliciesSchema = ListingPoliciesBaseSchema.extend({
    /** Check-in window. */
    checkIn: AccommodationPolicyTimeWindowSchema.nullish(),
    /** Check-out window. */
    checkOut: AccommodationPolicyTimeWindowSchema.nullish(),
    /** Minimum nights per stay. */
    minNights: NightsSchema.nullish(),
    /** Maximum nights per stay. */
    maxNights: NightsSchema.nullish(),
    /** Booking deposit (HOS-2120). */
    deposit: AccommodationDepositPolicySchema.nullish(),
    /** Languages the host attends guests in (HOS-2120). */
    spokenLanguages: AccommodationSpokenLanguagesSchema.nullish(),
    /** Private-events details, meaningful only when `eventsAllowed` is true (HOS-2122). */
    eventsDetails: AccommodationEventsDetailsSchema.nullish()
}).refine(
    (policies) =>
        policies.minNights == null ||
        policies.maxNights == null ||
        policies.maxNights >= policies.minNights,
    {
        message: 'zodError.listingPolicies.maxNights.belowMinNights',
        path: ['maxNights']
    }
);

/** TypeScript type for {@link AccommodationPoliciesSchema}. */
export type AccommodationPolicies = z.infer<typeof AccommodationPoliciesSchema>;
