import { z } from 'zod';
import { ListingPoliciesBaseSchema } from '../../../common/listing-policies.schema.js';
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
 * The accommodation `policies` JSONB (HOS-2060): the shared base plus check-in,
 * check-out and the stay length.
 *
 * `minNights` and `maxNights` moved here from `extra_info` (HOS-2060);
 * `minNights` is still a publish requirement. When both are present,
 * `maxNights` cannot be below `minNights`.
 */
export const AccommodationPoliciesSchema = ListingPoliciesBaseSchema.extend({
    /** Check-in window. */
    checkIn: AccommodationPolicyTimeWindowSchema.nullish(),
    /** Check-out window. */
    checkOut: AccommodationPolicyTimeWindowSchema.nullish(),
    /** Minimum nights per stay. */
    minNights: NightsSchema.nullish(),
    /** Maximum nights per stay. */
    maxNights: NightsSchema.nullish()
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
