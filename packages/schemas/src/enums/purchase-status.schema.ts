import { z } from 'zod';
import { PurchaseStatusEnum } from './purchase-status.enum.js';

/**
 * Zod schema for PurchaseStatus enum validation
 * Used for runtime validation of purchase status values
 */
export const PurchaseStatusEnumSchema = z.nativeEnum(PurchaseStatusEnum, {
    message: 'zodError.purchaseStatus.invalid'
});

export type PurchaseStatusType = z.infer<typeof PurchaseStatusEnumSchema>;
