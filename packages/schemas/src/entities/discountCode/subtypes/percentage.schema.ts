import { z } from 'zod';
import { DiscountCodeSchema } from '../discountCode.schema.js';

/**
 * Percentage Discount Code Schema
 * Schema specifically for percentage-based discount codes
 */
export const PercentageDiscountCodeSchema = DiscountCodeSchema.extend({
    discountType: z.literal('percentage'),

    // Required for percentage type
    percentOff: z
        .number({
            message: 'zodError.discountCode.percentOff.required'
        })
        .min(0, { message: 'zodError.discountCode.percentOff.min' })
        .max(100, { message: 'zodError.discountCode.percentOff.max' }),

    // Must be undefined for percentage type
    amountOffMinor: z.undefined()
});

/**
 * Create Percentage Discount Code Schema
 * Schema for creating percentage-based discount codes
 */
export const CreatePercentageDiscountCodeSchema = z.object({
    discountType: z.literal('percentage'),
    percentOff: z
        .number({
            message: 'zodError.discountCode.percentOff.required'
        })
        .min(0, { message: 'zodError.discountCode.percentOff.min' })
        .max(100, { message: 'zodError.discountCode.percentOff.max' })
});

/**
 * Update Percentage Discount Code Schema
 * Schema for updating percentage-based discount codes
 */
export const UpdatePercentageDiscountCodeSchema = z.object({
    discountType: z.literal('percentage').optional(),
    percentOff: z
        .number()
        .min(0, { message: 'zodError.discountCode.percentOff.min' })
        .max(100, { message: 'zodError.discountCode.percentOff.max' })
        .optional()
});

export type PercentageDiscountCode = z.infer<typeof PercentageDiscountCodeSchema>;
export type CreatePercentageDiscountCode = z.infer<typeof CreatePercentageDiscountCodeSchema>;
export type UpdatePercentageDiscountCode = z.infer<typeof UpdatePercentageDiscountCodeSchema>;
