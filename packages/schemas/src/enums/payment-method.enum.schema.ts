import { PaymentMethodEnum } from '@repo/types';
import { z } from 'zod';

/**
 * Payment method enum schema for validation
 */
export const PaymentMethodEnumSchema = z.nativeEnum(PaymentMethodEnum, {
    message: 'zodError.payment.method.invalid'
});
