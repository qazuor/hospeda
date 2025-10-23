import { z } from 'zod';
import { DiscountTypeEnum } from './discount-type.enum.js';

/**
 * Discount type enum schema for validation
 */
export const DiscountTypeEnumSchema = z.nativeEnum(DiscountTypeEnum, {
    message: 'zodError.enums.discountType.invalid'
});
export type DiscountTypeSchema = z.infer<typeof DiscountTypeEnumSchema>;
