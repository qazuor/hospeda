import { z } from 'zod';
import { OwnerPromotionDiscountTypeEnum } from './owner-promotion-discount-type.enum.js';

/**
 * Owner promotion discount type enum schema for validation
 */
export const OwnerPromotionDiscountTypeEnumSchema = z.nativeEnum(OwnerPromotionDiscountTypeEnum, {
    error: () => ({ message: 'zodError.enums.ownerPromotionDiscountType.invalid' })
});
export type OwnerPromotionDiscountTypeSchema = z.infer<typeof OwnerPromotionDiscountTypeEnumSchema>;
