import { z } from 'zod';
import { RefundReasonEnum } from './refund-reason.enum.js';

/**
 * Refund reason enum schema for validation
 */
export const RefundReasonEnumSchema = z.nativeEnum(RefundReasonEnum, {
    message: 'zodError.enums.refundReason.invalid'
});
export type RefundReasonSchema = z.infer<typeof RefundReasonEnumSchema>;
