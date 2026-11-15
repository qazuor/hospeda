import { z } from 'zod';
import { BillingCycleSchema } from '../../catalog/plan-publication.schema.js';
import { SubscriptionPlanChangeResponseSchema } from './subscription-plan-change.schema.js';

/** Parameters for administrative plan changes. */
export const AdminSubscriptionPlanChangeParamsSchema = z.strictObject({
    subscriptionId: z.uuid()
});

/** Sellable options of the subscription's vertical, including its current option. */
export const AdminSubscriptionPlanChangeOptionsResponseSchema = z.strictObject({
    subscriptionId: z.uuid(),
    vertical: z.string(),
    options: z.array(
        z.strictObject({
            billingOptionId: z.uuid(),
            planId: z.uuid(),
            planName: z.string(),
            planVersionId: z.uuid(),
            cycle: BillingCycleSchema,
            amountMinor: z.number().int().nonnegative(),
            currency: z.literal('ARS'),
            current: z.boolean()
        })
    )
});
export type AdminSubscriptionPlanChangeOptionsResponse = z.infer<
    typeof AdminSubscriptionPlanChangeOptionsResponseSchema
>;

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
export type AdminSubscriptionPlanChangeResponse = z.infer<
    typeof AdminSubscriptionPlanChangeResponseSchema
>;
