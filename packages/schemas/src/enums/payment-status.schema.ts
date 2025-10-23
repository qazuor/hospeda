import { z } from 'zod';
import { PaymentStatusEnum } from './payment-status.enum.js';

/**
 * Payment status enum schema for validation
 */
export const PaymentStatusEnumSchema = z.nativeEnum(PaymentStatusEnum, {
    message: 'zodError.enums.paymentStatus.invalid'
});
export type PaymentStatusSchema = z.infer<typeof PaymentStatusEnumSchema>;
