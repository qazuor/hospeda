/**
 * The partner payment-review window, and the one place it is decided (HOS-1299).
 *
 * Lives here rather than in the cron job because there are TWO readers and they
 * must agree: the job asks the model for partners past this window, and the
 * confirmation endpoint pushes `paymentConfirmedThrough` forward by the same
 * amount when the admin does not type a date. Two copies would let a partner be
 * confirmed for 30 days and re-asked about after 14, forever.
 *
 * @module services/partner/partner.payment-review
 */

/**
 * How long a partner may run before an admin is asked to confirm their payment.
 *
 * A constant, and NOT a value derived from the partner's plan. That was
 * measured first, and the period genuinely is not derivable today:
 *
 * - `partners` records `plan_id` but no cadence, so nothing on the row says
 *   which period was agreed;
 * - a partner plan carries BOTH prices — the seed writes a `month` row and a
 *   `year` row against the same plan — so `plan_id` maps to two cadences;
 * - `registerManualPayment` never reads `plan_id` at all, so a partner
 *   activated in cash may legitimately have none.
 *
 * 30 days is the shortest cadence the platform actually executes — the only
 * partner checkout there is creates a monthly preapproval — and erring short is
 * the cheap error under the asymmetry this whole feature exists for: asking too
 * often costs one alert an admin dismisses, asking too rarely gives away a
 * year of product. Changing it is one line, here.
 */
export const PARTNER_PAYMENT_REVIEW_AFTER_DAYS = 30;

/**
 * The date a confirmation covers when the admin does not type one.
 *
 * @param input - `{ from }` (RO-RO) — the moment of confirmation.
 * @returns One standard review window past `from`.
 */
export function defaultPaymentConfirmedThrough(input: { readonly from: Date }): Date {
    return new Date(input.from.getTime() + PARTNER_PAYMENT_REVIEW_AFTER_DAYS * 24 * 60 * 60 * 1000);
}
