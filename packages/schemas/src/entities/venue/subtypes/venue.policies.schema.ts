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

/** Longest a localized minimum-age scope area may be, per locale (HOS-2098). */
export const VENUE_MIN_AGE_SCOPE_AREA_MAX = 60;

/** The three ways a minimum age can apply (HOS-2098). */
export const VENUE_MIN_AGE_SCOPE_KINDS = ['all_day', 'from_time', 'area'] as const;

/** One {@link VENUE_MIN_AGE_SCOPE_KINDS} value. */
export type VenueMinAgeScopeKind = (typeof VENUE_MIN_AGE_SCOPE_KINDS)[number];

/**
 * Short localized name of the sector or activity the minimum age applies to
 * ("pista", "show"), at most {@link VENUE_MIN_AGE_SCOPE_AREA_MAX} characters
 * per locale and never blank in every locale.
 */
export const VenueMinAgeScopeAreaSchema = I18nTextSchema.extend({
    es: z.string().max(VENUE_MIN_AGE_SCOPE_AREA_MAX, {
        message: 'zodError.venue.minAgeScope.area.tooLong'
    }),
    en: z.string().max(VENUE_MIN_AGE_SCOPE_AREA_MAX, {
        message: 'zodError.venue.minAgeScope.area.tooLong'
    }),
    pt: z.string().max(VENUE_MIN_AGE_SCOPE_AREA_MAX, {
        message: 'zodError.venue.minAgeScope.area.tooLong'
    })
}).refine((area) => [area.es, area.en, area.pt].some((text) => text.trim() !== ''), {
    message: 'zodError.venue.minAgeScope.area.required'
});

/**
 * Where or when the venue's minimum age applies (HOS-2098), stored as
 * `policies.minAgeScope`:
 *
 * - `all_day` — the whole venue at every hour;
 * - `from_time` — from `from` (24 h `HH:MM`) until the venue closes that night;
 * - `area` — only in one sector or activity (`area`, localized).
 *
 * An ABSENT key means `all_day`: venues saved before HOS-2098 get that default
 * by reading, never by a backfill. The scope means nothing without `minAge`;
 * readers ignore it when no age is set. The chat may say a minor can go only
 * for a question outside a `from_time` or `area` scope.
 */
export const VenueMinAgeScopeSchema = z.discriminatedUnion(
    'kind',
    [
        z.object({ kind: z.literal('all_day') }),
        z.object({
            kind: z.literal('from_time'),
            from: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
                message: 'zodError.venue.minAgeScope.from.invalid'
            })
        }),
        z.object({ kind: z.literal('area'), area: VenueMinAgeScopeAreaSchema })
    ],
    { error: 'zodError.venue.minAgeScope.kind.invalid' }
);

/** TypeScript type for {@link VenueMinAgeScopeSchema}. */
export type VenueMinAgeScope = z.infer<typeof VenueMinAgeScopeSchema>;

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
    /** Where or when the minimum age applies; absent means all day (HOS-2098). */
    minAgeScope: VenueMinAgeScopeSchema.nullish(),
    /** Closed dress-code list. */
    dressCode: VenueDressCodeEnumSchema.nullish(),
    /** Localized dress-code note. */
    dressCodeNote: VenueDressCodeNoteSchema.nullish()
});

/** TypeScript type for {@link VenuePoliciesSchema}. */
export type VenuePolicies = z.infer<typeof VenuePoliciesSchema>;
