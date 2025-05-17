import { z } from 'zod';
import { AccommodationAdditionalFeesInfoSchema } from './additionalFeesInfo.schema.js';
import { AccommodationOtherAdditionalFeesSchema } from './otherAdditionalFees.schema.js';

/**
 * Zod schema for a accommodation adittional fees.
 */
export const AccommodationAdditionalFeesSchema = z.object({
    cleaning: AccommodationAdditionalFeesInfoSchema.optional(),
    tax: AccommodationAdditionalFeesInfoSchema.optional(),
    lateCheckout: AccommodationAdditionalFeesInfoSchema.optional(),
    pets: AccommodationAdditionalFeesInfoSchema.optional(),
    bedlinen: AccommodationAdditionalFeesInfoSchema.optional(),
    towels: AccommodationAdditionalFeesInfoSchema.optional(),
    babyCrib: AccommodationAdditionalFeesInfoSchema.optional(),
    babyHighChair: AccommodationAdditionalFeesInfoSchema.optional(),
    extraBed: AccommodationAdditionalFeesInfoSchema.optional(),
    securityDeposit: AccommodationAdditionalFeesInfoSchema.optional(),
    extraGuest: AccommodationAdditionalFeesInfoSchema.optional(),
    parking: AccommodationAdditionalFeesInfoSchema.optional(),
    earlyCheckin: AccommodationAdditionalFeesInfoSchema.optional(),
    lateCheckin: AccommodationAdditionalFeesInfoSchema.optional(),
    luggageStorage: AccommodationAdditionalFeesInfoSchema.optional(),
    others: z.array(AccommodationOtherAdditionalFeesSchema)
});

export type AccommodationAdditionalFeesInput = z.infer<typeof AccommodationAdditionalFeesSchema>;
