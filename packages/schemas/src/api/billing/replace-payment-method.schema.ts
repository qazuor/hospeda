/**
 * Past-Due Payment-Method Replacement Schemas (HOS-348 Part B)
 *
 * Schemas for the recovery endpoint a `past_due` customer uses to fix their
 * own billing status once the grace period has (or hasn't yet) expired:
 *
 *   `POST /api/v1/protected/billing/subscriptions/:localId/replace-payment-method`
 *
 * Mints a brand-new MercadoPago preapproval on the SAME plan and returns its
 * `checkoutUrl` for the caller to redirect the user to. The old (past-due)
 * preapproval is cancelled only once the new one is confirmed authorized —
 * see `apps/api/src/services/billing/past-due-payment-method-replacement.service.ts`.
 *
 * @module api/billing/replace-payment-method
 */

import { z } from 'zod';

/**
 * Path params for
 * `POST /api/v1/protected/billing/subscriptions/:localId/replace-payment-method`.
 */
export const ReplacePaymentMethodParamsSchema = z.object({
    localId: z
        .string()
        .uuid('localId must be a valid UUID')
        .describe('Local subscription UUID of the past-due subscription to replace')
});
export type ReplacePaymentMethodParams = z.infer<typeof ReplacePaymentMethodParamsSchema>;

/**
 * Response body for the payment-method replacement endpoint.
 *
 * `checkoutUrl` is always non-null on success — the caller MUST redirect the
 * user there to authorize the new preapproval. `reused` is `true` when an
 * already-in-flight attempt (from a previous, not-yet-confirmed call) was
 * returned instead of minting a second preapproval.
 */
export const ReplacePaymentMethodResponseSchema = z.object({
    checkoutUrl: z.string().describe('init_point to redirect the user to for the new preapproval'),
    reused: z
        .boolean()
        .describe(
            'true when an in-flight replacement attempt was reused instead of minting a new one'
        )
});
export type ReplacePaymentMethodResponse = z.infer<typeof ReplacePaymentMethodResponseSchema>;
