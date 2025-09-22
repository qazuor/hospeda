import { z } from 'zod';
import { PaymentTypeEnum } from './payment-type.enum.js';

/**
 * Payment type enum schema for validation
 */
export const PaymentTypeEnumSchema = z.nativeEnum(PaymentTypeEnum, {
    message: 'zodError.payment.type.invalid'
});
