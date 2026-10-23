import { z } from 'zod';
import { VerticalEnumSchema } from '../../enums/vertical.schema.js';

/**
 * The payer declares the provider account email that will authorize this attempt.
 * It is not a confirmed email and is never stored as one.
 */
export const StartSubscriptionRequestSchema = z.strictObject({
    billingOptionId: z.uuid(),
    payerEmail: z.string().trim().email().max(255)
});

export type StartSubscriptionRequest = z.infer<typeof StartSubscriptionRequestSchema>;

/** Stable, closed reasons for the S1 rejection contract. */
export const StartSubscriptionRejectionReasonSchema = z.enum([
    'PLAN_NOT_FOR_SALE',
    'PREVIOUS_ATTEMPT_CLOSING',
    'COMMITMENT_TAKEN',
    'TOURIST_VIP_INHERITED',
    'CREATION_NOT_APPLIED',
    'PREVIOUS_ATTEMPT_IN_PROGRESS',
    'PROVIDER_REJECTED'
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

/** Path parameters for cancelling the authenticated user's pending signup attempt. */
export const PendingAttemptCancellationParamsSchema = z.strictObject({
    subscriptionId: z.uuid()
});

/** Successful result of cancelling a pending signup attempt. */
export const PendingAttemptCancellationResponseSchema = z.strictObject({
    subscriptionId: z.uuid(),
    outcome: z.enum(['ABANDONED', 'ALREADY_ABANDONED'])
});
