import type { DiscountInfoType, DiscountsType, OtherDiscountType } from '@repo/types';
import { z } from 'zod';

import { BasePriceSchema } from '../common.schema';

/**
 * Zod schema for basic discount info.
 */
export const DiscountInfoSchema: z.ZodType<DiscountInfoType> = z.object({
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
 * Zod schema for a custom discount.
 */
export const OtherDiscountSchema: z.ZodType<OtherDiscountType> = DiscountInfoSchema.extend({
    name: z.string({ required_error: 'error:accommodation.discount.nameRequired' }),
    displayName: z.string({ required_error: 'error:accommodation.discount.displayNameRequired' })
});

/**
 * Zod schema for full discount configuration.
 */
export const DiscountsSchema: z.ZodType<DiscountsType> = z.object({
    weekly: z.number().min(0).max(100).optional(),
    monthly: z.number().min(0).max(100).optional(),
    lastMinute: z.number().min(0).max(100).optional(),
    others: z.array(OtherDiscountSchema).optional()
});
