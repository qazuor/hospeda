import { z } from 'zod';
import { BillingSchemeEnum } from './billing-scheme.enum.js';

/**
 * Billing scheme enum schema for validation
 */
export const BillingSchemeEnumSchema = z.nativeEnum(BillingSchemeEnum, {
    message: 'zodError.enums.billingScheme.invalid'
});
export type BillingSchemeSchema = z.infer<typeof BillingSchemeEnumSchema>;
