import { z } from 'zod';

/** Public S1 body: version and vertical come only from the option's composite FK. */
export const StartSubscriptionRequestSchema = z.strictObject({
    billingOptionId: z.uuid()
});

export type StartSubscriptionRequest = z.infer<typeof StartSubscriptionRequestSchema>;

/** Stable, closed reasons for the S1 rejection contract. */
export const StartSubscriptionRejectionReasonSchema = z.enum([
    'PLAN_NOT_FOR_SALE',
    'PREVIOUS_ATTEMPT_CLOSING',
    'COMMITMENT_TAKEN',
    'CREATION_NOT_APPLIED'
]);

export type StartSubscriptionRejectionReason = z.infer<
    typeof StartSubscriptionRejectionReasonSchema
>;

export const StartSubscriptionResponseSchema = z.strictObject({
    subscriptionId: z.uuid(),
    authorizationId: z.string().min(1),
    checkoutUrl: z.url()
});
