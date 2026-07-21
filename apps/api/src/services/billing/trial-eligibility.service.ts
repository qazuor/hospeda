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
 * "One trial per customer, for life": any prior subscription that was
 * authorized by the provider at least once — any authorized status (active,
 * trialing, cancelled, comp, past_due, ...), any product domain (accommodation
 * or commerce) — disqualifies. A user who has never checked out at all (e.g.
 * every user on the implicit `tourist-free` default, which never creates a
 * `billing_subscriptions` row) is eligible — and so is one whose only rows are
 * `abandoned` / never-authorized `pending_provider` checkouts they backed out
 * of (HOS-230), since those never granted a trial.
 *
 * @module services/billing/trial-eligibility
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { normalizeStoredSubscriptionStatus } from '@repo/service-core';

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
 * One element of `billing.subscriptions.getByCustomerId`'s result, narrowed to
 * the two fields the eligibility rule reads. Derived from the method's own
 * return type so it stays in sync with qzpay-core without importing a named
 * subscription type.
 */
type PriorSubscription = Awaited<
    ReturnType<QZPayBilling['subscriptions']['getByCustomerId']>
>[number];

/**
 * The two canonical lifecycle states a subscription can be in WITHOUT ever
 * having been authorized by the payment provider (HOS-230), expressed in
 * Hospeda's {@link SubscriptionStatusEnum} vocabulary:
 *
 * - `pending_provider` — a checkout was started but MercadoPago has not yet
 *   collected the card / authorized the preapproval. Created with NO provider
 *   subscription id (see `createPendingProviderSubscription`). The qzpay
 *   `mode:'paid'` inline flow writes the equivalent raw value `incomplete`.
 * - `abandoned` — a `pending_provider` row whose checkout TTL elapsed with no
 *   provider authorization. Terminal; only ever reached FROM `pending_provider`,
 *   so it too never carried a real preapproval. The qzpay raw equivalent is
 *   `incomplete_expired`.
 *
 * A row in either state means the customer merely opened (and backed out of)
 * the MercadoPago screen — they never actually had a trial, so it must NOT
 * consume their one-per-lifetime trial eligibility.
 *
 * Membership is checked against the NORMALIZED status (see
 * {@link normalizeStoredSubscriptionStatus}), because `getByCustomerId` returns
 * the raw stored string and `billing_subscriptions.status` holds two
 * vocabularies (qzpay `incomplete`/`incomplete_expired` from the `mode:'paid'`
 * flow, Hospeda `pending_provider`/`abandoned` from the share-link/webhook/cron
 * paths). Checking raw values would miss the qzpay half and re-open this bug for
 * the inline-preapproval checkout.
 */
const NEVER_AUTHORIZED_STATUSES: ReadonlySet<SubscriptionStatusEnum> = new Set([
    SubscriptionStatusEnum.PENDING_PROVIDER,
    SubscriptionStatusEnum.ABANDONED
]);

/**
 * Whether a single prior subscription actually consumed the customer's trial —
 * i.e. its preapproval was authorized by the provider at least once.
 *
 * True for any status outside {@link NEVER_AUTHORIZED_STATUSES}
 * (`active`/`trialing`/`past_due`/`paused`/`cancelled`/`expired`/`comp` — all
 * only reachable after authorization) and for an unknown/unmappable status
 * (`normalizeStoredSubscriptionStatus` → `null`), the safe fail-closed default
 * for the single trial gate. For the two never-authorized statuses it falls back
 * to the provider id: a present `providerSubscriptionIds.mercadopago` means MP
 * created and authorized a real preapproval, which counts even if the webhook
 * has not yet flipped the local status away from `pending_provider` (a narrow
 * race). An `abandoned` row never carries one, so it correctly stays uncounted.
 */
function consumedTrialEligibility(sub: PriorSubscription): boolean {
    const status = normalizeStoredSubscriptionStatus(sub.status);
    if (status === null || !NEVER_AUTHORIZED_STATUSES.has(status)) {
        return true;
    }
    return Boolean(sub.providerSubscriptionIds?.mercadopago);
}

/**
 * Whether a billing customer has ANY prior subscription that actually consumed
 * their one-per-lifetime free trial — i.e. one whose preapproval was authorized
 * by the provider at least once (any status, any product domain, including
 * cancelled). Checkouts that ended in `abandoned` (or `pending_provider` rows
 * that never authorized) are explicitly EXCLUDED: merely opening the
 * MercadoPago screen and backing out must not strip the trial (HOS-230).
 *
 * This is the exact query `subscription-checkout.service.ts` runs (behind
 * its `planHasTrial && planTrialDays > 0` short-circuit) to decide
 * `hasPriorSubscription` before calling
 * {@link resolveCheckoutFreeTrialDays | resolveCheckoutFreeTrialDays} —
 * extracted here so both call sites, plus this module's own
 * {@link resolveTrialEligibility}, share ONE implementation.
 *
 * @param input - Billing instance and customer id.
 * @returns `true` when the customer has at least one authorized prior
 *   subscription; `false` when they have never had one (or only ever
 *   abandoned/pending checkouts).
 */
export async function hasAnyPriorSubscription(input: TrialEligibilityInput): Promise<boolean> {
    const { billing, customerId } = input;
    const subscriptions = await billing.subscriptions.getByCustomerId(customerId);
    return subscriptions.some(consumedTrialEligibility);
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
 * @returns `{ eligible: true }` when the customer has no prior authorized
 *   subscription (never checked out, or only ever abandoned/pending checkouts);
 *   `{ eligible: false }` otherwise.
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
