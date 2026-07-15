/**
 * Start-Paid Subscription Schemas
 *
 * Schemas for the entry-point route that begins a paid subscription flow:
 *
 *   `POST /api/v1/protected/billing/subscriptions/start-paid`
 *
 * Flow:
 * 1. Front sends `{ planSlug, billingInterval, promoCode? }`.
 * 2. API creates a local subscription in a pending state and provisions a
 *    provider-hosted checkout (MercadoPago preapproval for monthly, MP
 *    Checkout Pro for annual).
 * 3. API returns the checkout URL plus the local subscription UUID and a
 *    TTL after which the abandoned-pending cron flips the row to `abandoned`.
 * 4. Front redirects the user to the checkout URL, then to a return page
 *    that polls `GET /subscriptions/:localId/status` (see
 *    `subscription-status.schema.ts`) until activation.
 *
 * @module api/billing/start-paid
 */

import { z } from 'zod';

/**
 * Subset of {@link BillingIntervalEnum} accepted by `/start-paid`.
 *
 * Trial subs are handled by a separate route. Plan-change flows are the
 * only place where the multi-month variants (`quarterly`, `semi_annual`)
 * are exposed today, so they are excluded here to keep the public surface
 * focused on the two cadences described in the SPEC-122 master plan.
 */
export const StartPaidBillingIntervalSchema = z.enum(['monthly', 'annual'], {
    error: () => ({ message: 'zodError.billing.startPaid.billingInterval.invalid' })
});
export type StartPaidBillingInterval = z.infer<typeof StartPaidBillingIntervalSchema>;

/**
 * Request body for `POST /api/v1/protected/billing/subscriptions/start-paid`.
 *
 * `planSlug` is matched against `QZPayPlan.name` (Hospeda treats the qzpay
 * plan name as the slug). The promo code is optional and only the
 * `free_trial_days_extension` type is meaningful for monthly recurring
 * subs (SPEC-126 D9); other promo types apply to addons or annual upfront.
 */
export const StartPaidSubscriptionRequestSchema = z.object({
    planSlug: z
        .string({ message: 'zodError.billing.startPaid.planSlug.invalidType' })
        .min(1, { message: 'zodError.billing.startPaid.planSlug.min' })
        .max(100, { message: 'zodError.billing.startPaid.planSlug.max' }),
    billingInterval: StartPaidBillingIntervalSchema,
    promoCode: z
        .string({ message: 'zodError.billing.startPaid.promoCode.invalidType' })
        .min(1, { message: 'zodError.billing.startPaid.promoCode.min' })
        .max(64, { message: 'zodError.billing.startPaid.promoCode.max' })
        .optional()
});
export type StartPaidSubscriptionRequest = z.infer<typeof StartPaidSubscriptionRequestSchema>;

/**
 * Response body for `POST /api/v1/protected/billing/subscriptions/start-paid`.
 *
 * `checkoutUrl` is the provider-hosted page (MP `init_point` for monthly
 * preapprovals, MP Checkout Pro `init_point` for annual one-time). The
 * front MUST redirect the user there to authorize the charge.
 *
 * `localSubscriptionId` is the UUID the front passes back to the polling
 * endpoint after the user returns. `expiresAt` is the wall-clock time at
 * which the abandoned-pending cron will flip the row to `abandoned` if
 * the provider webhook never arrives.
 */
export const StartPaidSubscriptionResponseSchema = z.object({
    checkoutUrl: z
        .string({ message: 'zodError.billing.startPaid.checkoutUrl.invalidType' })
        .url({ message: 'zodError.billing.startPaid.checkoutUrl.invalid' }),
    localSubscriptionId: z
        .string({ message: 'zodError.billing.startPaid.localSubscriptionId.invalidType' })
        .uuid({ message: 'zodError.billing.startPaid.localSubscriptionId.invalid' }),
    expiresAt: z
        .string({ message: 'zodError.billing.startPaid.expiresAt.invalidType' })
        .datetime({ message: 'zodError.billing.startPaid.expiresAt.invalid' }),
    /**
     * SPEC-262 T-012 P2: marker for a promo effect that changes the redirect
     * semantics. Additive + optional so existing monthly/annual consumers (no
     * promo, or a trial extension) are unaffected.
     *
     * - `'comp'` — a complimentary (free-forever) code was applied. There is NO
     *   MercadoPago checkout: `checkoutUrl` is an in-app success sentinel URL the
     *   front-end should treat as "already subscribed, go straight to success"
     *   rather than redirecting to a payment provider.
     * - `'discount'` — a discount was applied (the monthly preapproval amount was
     *   lowered, or the annual line-item was reduced). A normal MP redirect to
     *   `checkoutUrl` still follows; the marker is informational.
     * There is no `'trial'` variant. Card-first (HOS-171) deleted the no-card
     * trial that used to be granted INSTEAD of a paid checkout: a trial is now
     * `free_trial` on the very preapproval a paid checkout creates, so it is a
     * normal MP redirect and carries no marker of its own.
     *
     * Narrowing this enum is a deliberate exception to the additive-only
     * schema-compat policy, taken while the platform has no real customers and the
     * API and web release together. The policy guards stored JSONB, cached
     * responses and queued messages; `appliedEffect` is a transient response field
     * that nothing persists, so no old value can be in flight to fail parsing.
     */
    appliedEffect: z
        .enum(['comp', 'discount'], {
            message: 'zodError.billing.startPaid.appliedEffect.invalid'
        })
        .optional(),
    /**
     * `true` when a promo code was supplied but had no effect, so the customer is
     * told rather than silently losing it. Absent (not `false`) otherwise — the
     * front-end should treat "absent" and "false" identically.
     *
     * Since HOS-171 this means exactly ONE thing: a `trial_extension` code was
     * applied to a checkout that grants no trial to lengthen (the plan declares
     * none, or the customer already had a subscription — one trial per customer,
     * for life).
     *
     * It no longer means "a discount was discarded in favour of a trial". That
     * precedence is gone: a discount now COEXISTS with a trial, because the trial
     * defers the first charge while the discount lowers what that charge will be.
     * The old rule left a first-time owner — the only customer who gets a trial —
     * unable to use a discount code at all.
     */
    promoCodeIgnored: z
        .literal(true, {
            message: 'zodError.billing.startPaid.promoCodeIgnored.invalid'
        })
        .optional()
});
export type StartPaidSubscriptionResponse = z.infer<typeof StartPaidSubscriptionResponseSchema>;
