import { z } from 'zod';
import { SubscriptionPlanChangeResponseSchema } from './subscription-plan-change.schema.js';

/** Parameters for administrative plan changes. */
export const AdminSubscriptionPlanChangeParamsSchema = z.strictObject({
    subscriptionId: z.uuid()
});

/** A confirmed plan choice against the status observed by the administrator. */
export const AdminSubscriptionPlanChangeRequestSchema = z.strictObject({
    billingOptionId: z.uuid(),
    expectedStatus: z.literal('ACTIVE'),
    confirmed: z.literal(true),
    note: z.string().trim().min(1).max(2000).optional()
});

/** Administrative outcomes expose a checkout link for the customer to authorize. */
export const AdminSubscriptionPlanChangeResponseSchema = z.discriminatedUnion('outcome', [
    z.strictObject({
        outcome: z.literal('SUCCESSION'),
        checkoutUrl: z.url(),
        firstChargeAt: z.iso.datetime(),
        creditDays: z.number().int().nonnegative()
    }),
    SubscriptionPlanChangeResponseSchema.options[1],
    SubscriptionPlanChangeResponseSchema.options[2]
]);
