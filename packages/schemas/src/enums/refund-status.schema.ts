import { z } from 'zod';
import { RefundStatusEnum } from './refund-status.enum.js';

/**
 * Refund status enum schema for validation
 */
export const RefundStatusEnumSchema = z.nativeEnum(RefundStatusEnum, {
    error: () => ({ message: 'zodError.enums.refundStatus.invalid' })
});
export type RefundStatusSchema = z.infer<typeof RefundStatusEnumSchema>;
