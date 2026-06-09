/**
 * User Self-Service Subscription Cancellation Schemas (SPEC-147 T-006)
 *
 * Schemas for the user-facing soft-cancel endpoint:
 * - `POST /api/v1/protected/billing/subscriptions/:id/cancel`
 *
 * A soft-cancel sets `cancelAtPeriodEnd=true` on the subscription so the
 * user keeps access until `current_period_end`. The MercadoPago preapproval
 * is paused automatically by qzpay-core@1.12.0 (PR #42). Status remains
 * `active` until the finalization cron runs after `current_period_end`.
 *
 * @module api/billing/subscription-cancel
 */

import { z } from 'zod';

/**
 * Request body for the user self-service subscription cancel endpoint.
 *
 * The `reason` field is optional and free-text (SPEC-147 Q6 resolution).
 * Canned reasons for the UI (SPEC-203) are a front-end concern — the API
 * stores whatever string the caller provides in the audit event metadata.
 * An empty body is valid (cancellation without a reason).
 */
export const UserCancelSubscriptionRequestSchema = z.object({
    /** Optional free-text reason for cancellation, stored in the audit event. */
    reason: z
        .string()
        .max(500, 'Cancellation reason must be 500 characters or fewer')
        .optional()
        .describe('Optional reason for cancellation (stored in the audit event metadata)')
});

export type UserCancelSubscriptionRequest = z.infer<typeof UserCancelSubscriptionRequestSchema>;

/**
 * Response body returned by the user self-service subscription cancel endpoint.
 *
 * The subscription status remains `active` after a soft-cancel — it is
 * flipped to `cancelled` by the finalization cron once `accessUntil` passes.
 * `cancelAtPeriodEnd` is always `true` on a 200 response.
 */
export const UserCancelSubscriptionResponseSchema = z.object({
    /** The subscription that was soft-cancelled. */
    subscriptionId: z.string().describe('The soft-cancelled subscription ID'),
    /**
     * Always `true` on a successful soft-cancel response.
     * The finalization cron will flip this to `false` when it sets status to
     * `cancelled` after `accessUntil`.
     */
    cancelAtPeriodEnd: z
        .literal(true)
        .describe('Soft-cancel flag — access continues until accessUntil'),
    /** Timestamp when the cancel was recorded. Set by qzpay-core. */
    canceledAt: z.coerce.date().describe('When the cancellation was recorded'),
    /**
     * The `current_period_end` of the subscription. The user retains full
     * access to plan entitlements until this date.
     */
    accessUntil: z.coerce.date().describe('Last day the user retains access (current_period_end)')
});

export type UserCancelSubscriptionResponse = z.infer<typeof UserCancelSubscriptionResponseSchema>;
