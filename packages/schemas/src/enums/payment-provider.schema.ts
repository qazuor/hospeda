import { z } from 'zod';
import { PaymentProviderEnum } from './payment-provider.enum.js';

/**
 * Payment provider enum schema for validation
 */
export const PaymentProviderEnumSchema = z.nativeEnum(PaymentProviderEnum, {
    message: 'zodError.enums.paymentProvider.invalid'
});
export type PaymentProviderSchema = z.infer<typeof PaymentProviderEnumSchema>;
