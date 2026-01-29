import { z } from 'zod';
import { BillingIntervalEnum } from './billing-interval.enum.js';

/**
 * Billing interval enum schema for validation
 */
export const BillingIntervalEnumSchema = z.nativeEnum(BillingIntervalEnum, {
    error: () => ({ message: 'zodError.enums.billingInterval.invalid' })
});
export type BillingIntervalSchema = z.infer<typeof BillingIntervalEnumSchema>;
