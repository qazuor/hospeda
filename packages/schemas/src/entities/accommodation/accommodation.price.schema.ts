import { PriceSchema } from '@repo/schemas/common';
import { z } from 'zod';

/**
 * Additional Fees Info Schema
 * Extends base price with fee-specific flags
 */
export const AdditionalFeesInfoSchema = PriceSchema.extend({
    isIncluded: z
        .boolean({
            message: 'zodError.accommodation.price.additionalFees.isIncluded.required'
        })
        .optional(),
    isOptional: z
        .boolean({
            message: 'zodError.accommodation.price.additionalFees.isOptional.required'
        })
        .optional(),
    isPercent: z
        .boolean({
            message: 'zodError.accommodation.price.additionalFees.isPercent.required'
        })
        .optional(),
    isPerStay: z
        .boolean({
            message: 'zodError.accommodation.price.additionalFees.isPerStay.required'
        })
        .optional(),
    isPerNight: z
        .boolean({
            message: 'zodError.accommodation.price.additionalFees.isPerNight.required'
        })
        .optional(),
    isPerGuest: z
        .boolean({
            message: 'zodError.accommodation.price.additionalFees.isPerGuest.required'
        })
        .optional()
});

/**
 * Other Additional Fees Schema
 * For custom additional fees with a name
 */
export const OtherAdditionalFeesSchema = AdditionalFeesInfoSchema.extend({
    name: z
        .string({
            message: 'zodError.accommodation.price.additionalFees.others.name.required'
        })
        .min(2, {
            message: 'zodError.accommodation.price.additionalFees.others.name.min'
        })
        .max(100, {
            message: 'zodError.accommodation.price.additionalFees.others.name.max'
        })
});

/**
 * Additional Fees Schema
 * Complete structure for all possible additional fees
 */
export const AdditionalFeesSchema = z.object({
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

/**
 * Discount Info Schema
 * Extends base price with discount-specific flags
 */
export const DiscountInfoSchema = PriceSchema.extend({
    isIncluded: z
        .boolean({
            message: 'zodError.accommodation.price.discounts.isIncluded.required'
        })
        .optional(),
    isOptional: z
        .boolean({
            message: 'zodError.accommodation.price.discounts.isOptional.required'
        })
        .optional(),
    isPercent: z
        .boolean({
            message: 'zodError.accommodation.price.discounts.isPercent.required'
        })
        .optional(),
    isPerStay: z
        .boolean({
            message: 'zodError.accommodation.price.discounts.isPerStay.required'
        })
        .optional(),
    isPerNight: z
        .boolean({
            message: 'zodError.accommodation.price.discounts.isPerNight.required'
        })
        .optional(),
    isPerGuest: z
        .boolean({
            message: 'zodError.accommodation.price.discounts.isPerGuest.required'
        })
        .optional()
});

/**
 * Other Discount Schema
 * For custom discounts with a name
 */
export const OtherDiscountSchema = DiscountInfoSchema.extend({
    name: z
        .string({
            message: 'zodError.accommodation.price.discounts.others.name.required'
        })
        .min(2, {
            message: 'zodError.accommodation.price.discounts.others.name.min'
        })
        .max(100, {
            message: 'zodError.accommodation.price.discounts.others.name.max'
        })
});

/**
 * Discounts Schema
 * Complete structure for all possible discounts
 */
export const DiscountsSchema = z.object({
    weekly: DiscountInfoSchema.optional(),
    monthly: DiscountInfoSchema.optional(),
    lastMinute: DiscountInfoSchema.optional(),
    others: z.array(OtherDiscountSchema).optional()
});

/**
 * Accommodation Price Schema - Main Price Schema
 *
 * This schema defines the complete pricing structure for accommodations,
 * including base price, additional fees, and discounts.
 * Matches AccommodationPriceType from @repo/types
 */
export const AccommodationPriceSchema = PriceSchema.extend({
    additionalFees: AdditionalFeesSchema.optional(),
    discounts: DiscountsSchema.optional()
});

/**
 * Type exports for the accommodation price schemas
 */
export type BasePrice = z.infer<typeof PriceSchema>;
export type AdditionalFeesInfo = z.infer<typeof AdditionalFeesInfoSchema>;
export type OtherAdditionalFees = z.infer<typeof OtherAdditionalFeesSchema>;
export type AdditionalFees = z.infer<typeof AdditionalFeesSchema>;
export type DiscountInfo = z.infer<typeof DiscountInfoSchema>;
export type OtherDiscount = z.infer<typeof OtherDiscountSchema>;
export type Discounts = z.infer<typeof DiscountsSchema>;
export type AccommodationPrice = z.infer<typeof AccommodationPriceSchema>;
