import { z } from 'zod';
import { PriceSchema } from '../../common/index.js';

const AdditionalFeesInfoSchema = PriceSchema.extend({
    isIncluded: z.boolean().optional(),
    isOptional: z.boolean().optional(),
    isPercent: z.boolean().optional(),
    isPerStay: z.boolean().optional(),
    isPerNight: z.boolean().optional(),
    isPerGuest: z.boolean().optional()
});

const OtherAdditionalFeesSchema = AdditionalFeesInfoSchema.extend({
    name: z
        .string({
            message: 'zodError.accommodation.price.otherAdditionalFees.name.required'
        })
        .min(2, { message: 'zodError.accommodation.price.otherAdditionalFees.name.min' })
        .max(50, { message: 'zodError.accommodation.price.otherAdditionalFees.name.max' })
});

const AdditionalFeesSchema = z.object({
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

const DiscountInfoSchema = PriceSchema.extend({
    isIncluded: z.boolean().optional(),
    isOptional: z.boolean().optional(),
    isPercent: z.boolean().optional(),
    isPerStay: z.boolean().optional(),
    isPerNight: z.boolean().optional(),
    isPerGuest: z.boolean().optional()
});

const OtherDiscountSchema = DiscountInfoSchema.extend({
    name: z
        .string({
            message: 'zodError.accommodation.price.otherDiscount.name.required'
        })
        .min(2, { message: 'zodError.accommodation.price.otherDiscount.name.min' })
        .max(50, { message: 'zodError.accommodation.price.otherDiscount.name.max' })
});

const DiscountsSchema = z.object({
    weekly: DiscountInfoSchema.optional(),
    monthly: DiscountInfoSchema.optional(),
    lastMinute: DiscountInfoSchema.optional(),
    others: z.array(OtherDiscountSchema).optional()
});

export const AccommodationPriceSchema = PriceSchema.extend({
    additionalFees: AdditionalFeesSchema.optional(),
    discounts: DiscountsSchema.optional()
});
