import { z } from 'zod';
import { I18nTextSchema } from '../../../common/i18n.schema.js';
import { ListingPoliciesBaseSchema } from '../../../common/listing-policies.schema.js';
import { VenueDressCodeEnumSchema } from '../../../enums/index.js';

/**
 * Lowest age that applies to entry (DEC-FAC-058): integral, 13 to 30. Empty
 * means "not informed", never `0`. There is intentionally no database CHECK for
 * this range.
 *
 * Stored as `policies.minAge` since HOS-2060.
 */
export const VenueMinAgeSchema = z
    .number()
    .int({ message: 'zodError.venue.minAge.int' })
    .min(13, { message: 'zodError.venue.minAge.min' })
    .max(30, { message: 'zodError.venue.minAge.max' });

/**
 * Short localized note about the dress code, capped at 200 characters per
 * locale. Stored as `policies.dressCodeNote` since HOS-2060.
 */
export const VenueDressCodeNoteSchema = I18nTextSchema.extend({
    es: z.string().max(200, { message: 'zodError.venue.dressCodeNote.tooLong' }),
    en: z.string().max(200, { message: 'zodError.venue.dressCodeNote.tooLong' }),
    pt: z.string().max(200, { message: 'zodError.venue.dressCodeNote.tooLong' })
});

/** Whether the venue takes reservations, and how strongly it asks for one. */
export const VENUE_RESERVATION_POLICY_VALUES = ['required', 'recommended', 'not_accepted'] as const;

/** One {@link VENUE_RESERVATION_POLICY_VALUES} value. */
export type VenueReservationPolicy = (typeof VENUE_RESERVATION_POLICY_VALUES)[number];

/** Zod schema for one {@link VenueReservationPolicy}. */
export const VenueReservationPolicySchema = z.enum(VENUE_RESERVATION_POLICY_VALUES, {
    error: 'zodError.listingPolicies.reservations.invalid'
});

/**
 * The venue `policies` JSONB (HOS-2060): the shared base plus the venue's own
 * rules.
 *
 * `minAge`, `dressCode` and `dressCodeNote` replaced the `min_age`,
 * `dress_code` and `dress_code_note_i18n` columns and belong to the nightInfo
 * section (DEC-FAC-040), which gates them on read and write. The entry columns (`entry_kind`, `entry_price_from`, ...) are NOT policies and
 * stay columns.
 */
export const VenuePoliciesSchema = ListingPoliciesBaseSchema.extend({
    /** Reservation policy. */
    reservations: VenueReservationPolicySchema.nullish(),
    /** Lowest entry age. */
    minAge: VenueMinAgeSchema.nullish(),
    /** Closed dress-code list. */
    dressCode: VenueDressCodeEnumSchema.nullish(),
    /** Localized dress-code note. */
    dressCodeNote: VenueDressCodeNoteSchema.nullish()
});

/** TypeScript type for {@link VenuePoliciesSchema}. */
export type VenuePolicies = z.infer<typeof VenuePoliciesSchema>;
