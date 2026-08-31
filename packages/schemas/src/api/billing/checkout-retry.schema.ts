/**
 * Checkout-Retry Schemas (HOS-937 step 3)
 *
 * Schemas for the recovery endpoint used by the front-end when the user
 * returns from MercadoPago and the checkout did NOT come back `authorized`:
 *
 *   `POST /api/v1/protected/billing/subscriptions/:localId/checkout-retry`
 *
 * Reads the preapproval by id (spec §6.4) and answers with one of three
 * outcomes — the two failure ones are NOT interchangeable:
 * - `authorized` — happy path, nothing to do. `checkoutUrl` is `null`.
 * - `pending` — the SAME preapproval object; `checkoutUrl` is its own
 *   `init_point`, recovered from `metadata.checkoutUrl`.
 * - `cancelled` — MercadoPago cancelled the object (typically a card
 *   rejection). `checkoutUrl` is a FRESH preapproval's `init_point` —
 *   `payer_email` on the old one is not mutable, so there is no way to
 *   retry on the SAME object. Only present once the cancellation is
 *   CONFIRMED (spec §10 R-3); an unconfirmed read reports `confirming`
 *   instead, with `checkoutUrl: null`, so the client polls again shortly.
 *
 * @module api/billing/checkout-retry
 */

import { z } from 'zod';

/**
 * Path params for `POST /api/v1/protected/billing/subscriptions/:localId/checkout-retry`.
 */
export const CheckoutRetryParamsSchema = z.object({
    localId: z
        .string()
        .uuid('localId must be a valid UUID')
        .describe('Local subscription UUID (returned by /start-paid)')
});
export type CheckoutRetryParams = z.infer<typeof CheckoutRetryParamsSchema>;

/**
 * Response body for the checkout-retry recovery endpoint.
 *
 * `recovery` is the classification this call resolved to:
 * - `'authorized'` — the checkout already succeeded.
 * - `'pending'` — the SAME preapproval is still awaiting completion.
 * - `'cancelled'` — a FRESH preapproval was minted (or reused from an
 *   earlier call — this endpoint never mints twice for the same cancelled
 *   checkout).
 * - `'confirming'` — the read looked cancelled but has not yet been
 *   confirmed by the deferred re-read (spec §10 R-3); the client should
 *   poll again shortly rather than treat this as final.
 */
export const CheckoutRetryResponseSchema = z.object({
    recovery: z.enum(['authorized', 'pending', 'cancelled', 'confirming'], {
        message: 'zodError.billing.checkoutRetry.recovery.invalid'
    }),
    checkoutUrl: z
        .string()
        .nullable()
        .describe(
            'init_point to redirect the user to — the SAME object for pending, a FRESH one for cancelled, null for authorized/confirming'
        )
});
export type CheckoutRetryResponse = z.infer<typeof CheckoutRetryResponseSchema>;
