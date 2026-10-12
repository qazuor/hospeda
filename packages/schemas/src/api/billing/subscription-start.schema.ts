import { z } from 'zod';
import { VerticalEnumSchema } from '../../enums/vertical.schema.js';

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
    'TOURIST_VIP_INHERITED',
    'CREATION_NOT_APPLIED'
]);

export type StartSubscriptionRejectionReason = z.infer<
    typeof StartSubscriptionRejectionReasonSchema
>;

export const StartSubscriptionResponseSchema = z.strictObject({
    subscriptionId: z.uuid(),
    authorizationId: z.string().min(1),
    checkoutUrl: z.url(),
    /** Vertical read from subscription.vertical on the persisted row. */
    vertical: VerticalEnumSchema,
    /** Expiration from subscription.authorization_window_ends_at. */
    authorizationWindowEndsAt: z.iso.datetime()
});
