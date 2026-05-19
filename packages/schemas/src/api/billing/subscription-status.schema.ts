/**
 * Subscription Status Polling Schemas
 *
 * Schemas for the polling endpoint used by the front-end after redirecting
 * the user to the payment provider (MercadoPago) to start a paid subscription.
 *
 * Flow:
 * 1. Front calls `POST /billing/subscriptions/start-paid` and gets back a
 *    `localSubscriptionId` and a `checkoutUrl`.
 * 2. User is redirected to MercadoPago, then back to `/billing/return`.
 * 3. The return page polls this endpoint every 2 seconds until the local
 *    subscription transitions from `pending_provider` to `active` (or to a
 *    terminal state).
 *
 * @module api/billing/subscription-status
 */

import { z } from 'zod';
import { SubscriptionStatusEnumSchema } from '../../enums/subscription-status.schema.js';

/**
 * Path params for `GET /api/v1/protected/billing/subscriptions/:localId/status`.
 *
 * `localId` is the UUID of the locally-created subscription row, returned by
 * the `start-paid` endpoint as `localSubscriptionId`.
 */
export const SubscriptionStatusParamsSchema = z.object({
    localId: z
        .string()
        .uuid('localId must be a valid UUID')
        .describe('Local subscription UUID (returned by /start-paid)')
});
export type SubscriptionStatusParams = z.infer<typeof SubscriptionStatusParamsSchema>;

/**
 * Response body for the status polling endpoint.
 *
 * `mpSubscriptionId` is the MercadoPago `preapproval_id` that the webhook
 * handler writes back via `billing.subscriptions.linkProviderId()` once the
 * provider confirms the subscription. It remains `null` while the local sub
 * is still `pending_provider`.
 *
 * `activatedAt` is the ISO timestamp of the transition into `active`. It is
 * `null` for any non-active state.
 */
export const SubscriptionStatusResponseSchema = z.object({
    status: SubscriptionStatusEnumSchema,
    mpSubscriptionId: z
        .string()
        .nullable()
        .describe('MercadoPago preapproval_id, null until the webhook arrives'),
    activatedAt: z
        .string()
        .datetime()
        .nullable()
        .describe('ISO timestamp of activation, null if not yet active')
});
export type SubscriptionStatusResponse = z.infer<typeof SubscriptionStatusResponseSchema>;
