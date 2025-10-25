import { z } from 'zod';
import { DiscountCodeSchema } from '../discountCode.schema.js';

/**
 * Fixed Amount Discount Code Schema
 * Schema specifically for fixed amount discount codes
 */
export const FixedAmountDiscountCodeSchema = DiscountCodeSchema.extend({
    discountType: z.literal('fixed_amount'),

    // Required for fixed amount type
    amountOffMinor: z
        .number({
            message: 'zodError.discountCode.amountOffMinor.required'
        })
        .int({ message: 'zodError.discountCode.amountOffMinor.int' })
        .positive({ message: 'zodError.discountCode.amountOffMinor.positive' }),

    // Must be undefined for fixed amount type
    percentOff: z.undefined()
});

/**
 * Create Fixed Amount Discount Code Schema
 * Schema for creating fixed amount discount codes
 */
export const CreateFixedAmountDiscountCodeSchema = z.object({
    discountType: z.literal('fixed_amount'),
    amountOffMinor: z
        .number({
            message: 'zodError.discountCode.amountOffMinor.required'
        })
        .int({ message: 'zodError.discountCode.amountOffMinor.int' })
        .positive({ message: 'zodError.discountCode.amountOffMinor.positive' })
});

/**
 * Update Fixed Amount Discount Code Schema
 * Schema for updating fixed amount discount codes
 */
export const UpdateFixedAmountDiscountCodeSchema = z.object({
    discountType: z.literal('fixed_amount').optional(),
    amountOffMinor: z
        .number()
        .int({ message: 'zodError.discountCode.amountOffMinor.int' })
        .positive({ message: 'zodError.discountCode.amountOffMinor.positive' })
        .optional()
});

export type FixedAmountDiscountCode = z.infer<typeof FixedAmountDiscountCodeSchema>;
export type CreateFixedAmountDiscountCode = z.infer<typeof CreateFixedAmountDiscountCodeSchema>;
export type UpdateFixedAmountDiscountCode = z.infer<typeof UpdateFixedAmountDiscountCodeSchema>;
