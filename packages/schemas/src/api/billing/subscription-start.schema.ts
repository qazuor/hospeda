import { z } from 'zod';
import { VerticalEnum } from '../../enums/vertical.enum.js';
import { VerticalEnumSchema } from '../../enums/vertical.schema.js';

/**
 * Partner plans are paid manually by the team under US:B3:2 and DEC-SUB-016.
 * The team payment link does not exist yet (HOS-1739); when it does, this is
 * the point where an invited checkout can be accepted.
 */
export const MANUAL_PAYMENT_ONLY_VERTICALS = [VerticalEnum.PARTNER] as const;

export type ManualPaymentOnlyVertical = (typeof MANUAL_PAYMENT_ONLY_VERTICALS)[number];

/** Whether the vertical requires manual payment instead of card checkout. */
export function isManualPaymentOnlyVertical({ vertical }: { readonly vertical: string }): boolean {
    return (MANUAL_PAYMENT_ONLY_VERTICALS as readonly string[]).includes(vertical);
}

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
    'PROVIDER_REJECTED',
    'PARTNER_MANUAL_ONLY',
    'PROVIDER_BUSY',
    'PROVIDER_UNAVAILABLE'
]);

/**
 * The rejection reasons answered with 503 when the payment provider is transiently
 * failing (HOS-1968): `PROVIDER_BUSY` after a throttle (429), `PROVIDER_UNAVAILABLE`
 * after a 5xx or transport failure. Single source for the API route and the web.
 */
export const PROVIDER_TRANSIENT_REJECTION_REASONS = [
    'PROVIDER_BUSY',
    'PROVIDER_UNAVAILABLE'
] as const;

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
