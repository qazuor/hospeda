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
        .optional(),
    /**
     * HOS-937 step 2: the email the user explicitly typed on the
     * pre-redirect screen (spec §8.1), overriding the default MercadoPago
     * will otherwise resolve (`billing_customers.mp_payer_email`, then
     * `.email` — spec §6.3). Optional: omitted when the user accepts the
     * pre-filled default.
     */
    payerEmail: z
        .string({ message: 'zodError.billing.startPaid.payerEmail.invalidType' })
        .email({ message: 'zodError.billing.startPaid.payerEmail.invalid' })
        .max(255, { message: 'zodError.billing.startPaid.payerEmail.max' })
        .optional()
});
export type StartPaidSubscriptionRequest = z.infer<typeof StartPaidSubscriptionRequestSchema>;

/**
 * Request body for the commerce owner self-checkout
 * (`POST /api/v1/protected/commerce/listings/{entityType}/{entityId}/start-subscription`).
 *
 * Carries `payerEmail` (HOS-1008) and `planSlug` (HOS-1119). The interval is
 * always monthly, so unlike {@link StartPaidSubscriptionRequestSchema} there is
 * still nothing else for the caller to choose. **Every field is optional and so
 * is the body itself** — omitting it entirely keeps the exact pre-HOS-1008
 * behavior, which is what the `ownPreapprovalEnabled` flag being off must
 * produce, and what a caller with no tier picker must keep producing.
 *
 * Deliberately NOT accepted on the ADMIN commerce start-subscription route:
 * that route provisions on the OWNER's behalf, and the admin has no way to
 * know which MercadoPago account the owner pays with — an editable field
 * there would let one person bind another person's payer email. Same
 * reasoning that keeps the partner flow on a synthetic address.
 *
 * The `payerEmail` field reuses the same validation and the same i18n error
 * keys as its accommodation sibling on purpose: it is the same value, bound
 * to the same MercadoPago field, and a second set of keys would drift.
 */
export const CommerceStartSubscriptionRequestSchema = z.object({
    payerEmail: z
        .string({ message: 'zodError.billing.startPaid.payerEmail.invalidType' })
        .email({ message: 'zodError.billing.startPaid.payerEmail.invalid' })
        .max(255, { message: 'zodError.billing.startPaid.payerEmail.max' })
        .optional(),
    /**
     * HOS-1119: the tier the owner picked, when the vertical offers more than
     * one. Omitted means "the vertical's default", i.e. the pre-HOS-1119
     * behaviour exactly.
     *
     * Validated here only for SHAPE — a lowercase kebab slug, same pattern
     * `parseCommercePlanSlugMap` accepts. **Whether the slug names a plan of
     * this listing's vertical is decided by `resolveCommercePlanSlug`, and
     * nowhere else** (HOS-688 AC-35): putting a per-vertical allowlist in this
     * schema would make it a second place that maps a vertical to a set of
     * plans, which is the thing the guard forbids. A well-formed slug that
     * belongs to the other vertical therefore passes here and is refused there,
     * with a 400 either way.
     */
    planSlug: z
        .string({ message: 'zodError.billing.startPaid.planSlug.invalidType' })
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
            message: 'zodError.billing.startPaid.planSlug.invalid'
        })
        .max(100, { message: 'zodError.billing.startPaid.planSlug.max' })
        .optional()
});
export type CommerceStartSubscriptionRequest = z.infer<
    typeof CommerceStartSubscriptionRequestSchema
>;

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
     * - `'attached'` — HOS-688 §6.8, commerce only. The owner ALREADY holds a
     *   live subscription for this vertical and is under its listing cap, so the
     *   listing was attached to that subscription and **no checkout was opened**.
     *   Like `'comp'`, `checkoutUrl` is an in-app sentinel rather than a payment
     *   page. This is the case that does not exist under per-listing billing, and
     *   the one where a rename would quietly survive: opening a checkout here
     *   creates a SECOND MercadoPago preapproval and charges the owner twice for
     *   a plan that already covers them.
     * - `'trial'` — HOS-1184, commerce only. The owner is eligible for their
     *   vertical's free trial, so a Hospeda-owned `trialing` subscription was
     *   created with NO MercadoPago preapproval and no card, and the listing was
     *   attached to it. Like `'comp'` and `'attached'`, `checkoutUrl` is an
     *   in-app sentinel rather than a payment page.
     *
     * This variant existed before HOS-171, was deleted by it, and is back for the
     * reason it was deleted — that reason stopped being true. Card-first removed
     * the no-card trial, making a trial `free_trial` on the very preapproval a
     * paid checkout creates: not an alternative to a checkout, so not an effect.
     * HOS-1012 then reversed card-first (MercadoPago reports a spent trial
     * identically to a live one, and charged ARS 18.000 in production 118 seconds
     * after promising 14 free days — HOS-522), and a trial is once again exactly
     * what this comment used to call "a separate no-card path" granted INSTEAD of
     * a paid checkout. Re-widening is additive and needs no migration; it is the
     * NARROWING that was the deliberate exception to the compat policy.
     *
     * The accommodation side never needed the marker back: its trial is granted
     * by the publish flow, which does not go through a checkout route at all.
     * Commerce grants it from `POST /commerce/listings/:id/start-subscription` —
     * the same route that otherwise opens a checkout — so the response has to be
     * able to say which of the two happened.
     */
    appliedEffect: z
        .enum(['comp', 'discount', 'attached', 'trial'], {
            message: 'zodError.billing.startPaid.appliedEffect.invalid'
        })
        .optional(),
    /**
     * `true` when the checkout granted free trial days — MercadoPago will defer
     * the first charge instead of taking it today.
     *
     * Deliberately NOT an `appliedEffect` variant. A card-first trial is not an
     * alternative to a paid checkout the way `comp` is: it IS the paid checkout,
     * on the same preapproval, with the first debit pushed out — so it returns a
     * normal MP redirect and no effect marker. Modelling it as an effect is what
     * the pre-HOS-171 `'trial'` variant did, back when a trial really was a
     * separate no-card path.
     *
     * Absent (not `false`) when no trial was granted.
     */
    trialGranted: z
        .literal(true, {
            message: 'zodError.billing.startPaid.trialGranted.invalid'
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
        .optional(),
    /**
     * HOS-937 step 2: the resolved MercadoPago payer email (spec §6.3) —
     * the email whoever authorizes this checkout at MercadoPago must use or
     * type. The front-end shows this on the pre-redirect screen (spec
     * §8.1), pre-filled and editable, before redirecting to `checkoutUrl`.
     *
     * Optional at the type level ONLY because this response schema is
     * reused verbatim by the commerce/partner start-subscription routes
     * (`apps/api/src/routes/commerce/.../start-subscription.ts`), which are
     * untouched by HOS-937 (accommodation monthly/annual only — see spec
     * §6.3) and do not resolve a payer email. Both accommodation branches
     * of `/billing/subscriptions/start-paid` (monthly and annual) always
     * populate it.
     */
    payerEmail: z
        .string({ message: 'zodError.billing.startPaid.payerEmail.invalidType' })
        .email({ message: 'zodError.billing.startPaid.payerEmail.invalid' })
        .optional()
});
export type StartPaidSubscriptionResponse = z.infer<typeof StartPaidSubscriptionResponseSchema>;
