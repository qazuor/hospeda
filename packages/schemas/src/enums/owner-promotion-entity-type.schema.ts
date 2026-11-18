import { z } from 'zod';
import { OwnerPromotionEntityTypeEnum } from './owner-promotion-entity-type.enum.js';

/**
 * Owner promotion entity type enum schema for validation
 */
export const OwnerPromotionEntityTypeEnumSchema = z.nativeEnum(OwnerPromotionEntityTypeEnum, {
    error: () => ({ message: 'zodError.enums.ownerPromotionEntityType.invalid' })
});
export type OwnerPromotionEntityTypeSchema = z.infer<typeof OwnerPromotionEntityTypeEnumSchema>;
