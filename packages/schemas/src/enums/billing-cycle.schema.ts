import { z } from 'zod';
import { BillingCycleEnum } from './billing-cycle.enum.js';

/**
 * Billing cycle enum schema for validation
 */
export const BillingCycleEnumSchema = z.nativeEnum(BillingCycleEnum, {
    message: 'zodError.payment.billingCycle.invalid'
});
