import { PaymentStatusEnum } from '@repo/types';
import { z } from 'zod';

/**
 * Payment status enum schema for validation
 */
export const PaymentStatusEnumSchema = z.nativeEnum(PaymentStatusEnum, {
    message: 'zodError.payment.status.invalid'
});
