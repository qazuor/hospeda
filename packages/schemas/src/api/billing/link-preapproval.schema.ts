/**
 * Link-Preapproval Schemas (HOS-191 Path C, F2)
 *
 * Schemas for the `back_url` return-trip endpoint that links a MercadoPago
 * share-link checkout's real preapproval id back to the local `pending_provider`
 * subscription created at checkout time:
 *
 *   `POST /api/v1/protected/billing/subscriptions/link-preapproval`
 *
 * Flow:
 * 1. Path C's `/start-paid` redirects the browser straight to MercadoPago's
 *    hosted `preapproval_plan` share link — no preapproval exists locally yet.
 * 2. MercadoPago creates the real preapproval once the customer authorizes,
 *    then redirects back to the `paymentMethodReturnUrl` with `?preapproval_id=`
 *    in the query string.
 * 3. The front reads `preapproval_id` from that redirect plus the
 *    `localSubscriptionId` it stashed in sessionStorage at checkout time, and
 *    calls this endpoint to link them.
 * 4. If the customer never returns (closes the tab, network drop), the
 *    `subscription_preapproval` webhook fallback (F3) performs the same link
 *    server-side — this endpoint is a best-effort fast path, not the only path.
 *
 * @module api/billing/link-preapproval
 */

import { z } from 'zod';

/**
 * Request body for `POST /api/v1/protected/billing/subscriptions/link-preapproval`.
 */
export const LinkPreapprovalRequestSchema = z.object({
    /** The real MercadoPago preapproval id, read from the `back_url` redirect's `?preapproval_id=` query param. */
    preapprovalId: z
        .string({ message: 'zodError.billing.linkPreapproval.preapprovalId.invalidType' })
        .min(1, { message: 'zodError.billing.linkPreapproval.preapprovalId.min' })
        .max(255, { message: 'zodError.billing.linkPreapproval.preapprovalId.max' }),
    /** The local `pending_provider` subscription id the front stashed at checkout time. */
    localSubscriptionId: z
        .string({ message: 'zodError.billing.linkPreapproval.localSubscriptionId.invalidType' })
        .uuid({ message: 'zodError.billing.linkPreapproval.localSubscriptionId.invalid' })
});
export type LinkPreapprovalRequest = z.infer<typeof LinkPreapprovalRequestSchema>;

/**
 * Response body for `POST /api/v1/protected/billing/subscriptions/link-preapproval`.
 *
 * `outcome` mirrors {@link LinkPreapprovalOutcome} from the underlying service:
 * - `'linked'` — the preapproval was just linked to the local subscription.
 * - `'already'` — the preapproval was already linked (idempotent replay, e.g. the
 *   webhook fallback beat the front-end back to it).
 *
 * Non-2xx outcomes (`idor`, `reconcile_assisted`, `not_found`) are surfaced as
 * HTTP errors, not as a 200 response — see the route handler's status mapping.
 */
export const LinkPreapprovalResponseSchema = z.object({
    outcome: z.enum(['linked', 'already'], {
        message: 'zodError.billing.linkPreapproval.outcome.invalid'
    }),
    localSubscriptionId: z
        .string({ message: 'zodError.billing.linkPreapproval.localSubscriptionId.invalidType' })
        .uuid({ message: 'zodError.billing.linkPreapproval.localSubscriptionId.invalid' })
});
export type LinkPreapprovalResponse = z.infer<typeof LinkPreapprovalResponseSchema>;
