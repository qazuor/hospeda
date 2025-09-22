import { z } from 'zod';
import { PaymentMethodEnum } from './payment-method.enum.js';

/**
 * Payment method enum schema for validation
 */
export const PaymentMethodEnumSchema = z.nativeEnum(PaymentMethodEnum, {
    message: 'zodError.payment.method.invalid'
});
