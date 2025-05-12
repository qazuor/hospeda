import type {
    AdditionalFeesInfoType,
    AdditionalFeesType,
    OtherAdditionalFeesType
} from '@repo/types';
import { z } from 'zod';

import { BasePriceSchema } from '../common.schema';

/**
 * Zod schema for generic additional fee info.
 */
export const AdditionalFeesInfoSchema: z.ZodType<AdditionalFeesInfoType> = z.object({
    price: BasePriceSchema.optional(),
    percent: z.number().min(0).max(100).optional(),
    isIncluded: z.boolean().optional(),
    isOptional: z.boolean().optional(),
    isPercent: z.boolean().optional(),
    isPerStay: z.boolean().optional(),
    isPerNight: z.boolean().optional(),
    isPerGuest: z.boolean().optional()
});

/**
 * Zod schema for other custom additional fees.
 */
export const OtherAdditionalFeesSchema: z.ZodType<OtherAdditionalFeesType> =
    AdditionalFeesInfoSchema.extend({
        name: z.string({ required_error: 'error:accommodation.otherFee.nameRequired' }),
        displayName: z.string({
            required_error: 'error:accommodation.otherFee.displayNameRequired'
        })
    });

/**
 * Zod schema for full additional fees breakdown.
 */
export const AdditionalFeesSchema: z.ZodType<AdditionalFeesType> = z.object({
    cleaning: AdditionalFeesInfoSchema.optional(),
    tax: AdditionalFeesInfoSchema.optional(),
    lateCheckout: AdditionalFeesInfoSchema.optional(),
    pets: AdditionalFeesInfoSchema.optional(),
    bedlinen: AdditionalFeesInfoSchema.optional(),
    towels: AdditionalFeesInfoSchema.optional(),
    babyCrib: AdditionalFeesInfoSchema.optional(),
    babyHighChair: AdditionalFeesInfoSchema.optional(),
    extraBed: AdditionalFeesInfoSchema.optional(),
    securityDeposit: AdditionalFeesInfoSchema.optional(),
    extraGuest: AdditionalFeesInfoSchema.optional(),
    parking: AdditionalFeesInfoSchema.optional(),
    earlyCheckin: AdditionalFeesInfoSchema.optional(),
    lateCheckin: AdditionalFeesInfoSchema.optional(),
    luggageStorage: AdditionalFeesInfoSchema.optional(),
    others: z.array(OtherAdditionalFeesSchema).optional()
});
