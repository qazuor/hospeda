/**
 * Trial eligibility resolver (HOS-226).
 *
 * Single source of truth for the "does this customer have ANY prior
 * subscription" query, extracted from `subscription-checkout.service.ts`
 * (which previously inlined the same
 * `(await billing.subscriptions.getByCustomerId(customerId)).length > 0`
 * expression at both its monthly and annual entry points). Both the paid
 * checkout flow (which uses the result to decide `hasPriorSubscription` for
 * {@link resolveCheckoutFreeTrialDays}) and the read-only
 * `GET /trial-eligibility` route now call through this one function, so the
 * two can never drift on how they answer the same question.
 *
 * "One trial per customer, for life": any prior subscription — any status
 * (active, cancelled, comp, past_due, ...), any product domain (accommodation
 * or commerce) — disqualifies. A user who has never checked out at all (e.g.
 * every user on the implicit `tourist-free` default, which never creates a
 * `billing_subscriptions` row) is eligible.
 *
 * @module services/billing/trial-eligibility
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';

/**
 * Input shared by {@link hasAnyPriorSubscription} and
 * {@link resolveTrialEligibility}.
 */
export interface TrialEligibilityInput {
    /** Resolved qzpay billing instance. */
    readonly billing: QZPayBilling;
    /** Local billing customer id (the qzpay customer id). */
    readonly customerId: string;
}

/**
 * Whether a billing customer has ANY prior subscription — any status, any
 * product domain, including cancelled.
 *
 * This is the exact query `subscription-checkout.service.ts` runs (behind
 * its `planHasTrial && planTrialDays > 0` short-circuit) to decide
 * `hasPriorSubscription` before calling
 * {@link resolveCheckoutFreeTrialDays | resolveCheckoutFreeTrialDays} —
 * extracted here so both call sites, plus this module's own
 * {@link resolveTrialEligibility}, share ONE implementation.
 *
 * @param input - Billing instance and customer id.
 * @returns `true` when the customer has at least one subscription row of
 *   any kind; `false` when they have never had one.
 */
export async function hasAnyPriorSubscription(input: TrialEligibilityInput): Promise<boolean> {
    const { billing, customerId } = input;
    const subscriptions = await billing.subscriptions.getByCustomerId(customerId);
    return subscriptions.length > 0;
}

/**
 * Result of {@link resolveTrialEligibility}.
 */
export interface TrialEligibilityResult {
    /** `true` when the customer would still receive a free trial at checkout. */
    readonly eligible: boolean;
}

/**
 * Determines whether a billing customer is still eligible for a free trial,
 * reusing the exact "one trial per customer, for life" rule the checkout
 * flow enforces (see {@link hasAnyPriorSubscription}).
 *
 * Read-only: never reserves, consumes, or otherwise mutates anything. Safe
 * to call as often as needed (e.g. once per pricing-page hydration).
 *
 * @param input - Billing instance and customer id.
 * @returns `{ eligible: true }` when the customer has no prior subscription
 *   of any kind; `{ eligible: false }` otherwise.
 *
 * @example
 * ```ts
 * const { eligible } = await resolveTrialEligibility({ billing, customerId });
 * if (!eligible) {
 *   // suppress the "N days free" badge for this customer
 * }
 * ```
 */
export async function resolveTrialEligibility(
    input: TrialEligibilityInput
): Promise<TrialEligibilityResult> {
    const hasPrior = await hasAnyPriorSubscription(input);
    return { eligible: !hasPrior };
}
