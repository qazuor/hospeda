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
 * "One trial per customer, for life": any prior subscription that consumed a
 * trial-equivalent benefit — one authorized by the provider at least once
 * (active, trialing, past_due, paused, expired), or an explicit `comp` grant —
 * disqualifies, in any product domain (accommodation or commerce). A user who
 * has never checked out at all (e.g. every user on the implicit `tourist-free`
 * default, which never creates a `billing_subscriptions` row) is eligible — and
 * so is one whose only rows are checkouts they backed out of before
 * authorization: `abandoned` / never-authorized `pending_provider`, and
 * `cancelled` rows that were reached directly from `pending_provider` (HOS-230),
 * since those never granted a trial. A `cancelled` row is ambiguous and is
 * disambiguated via the subscription's `billing_subscription_events` history.
 *
 * @module services/billing/trial-eligibility
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { billingSubscriptionEvents, getDb } from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { normalizeStoredSubscriptionStatus } from '@repo/service-core';
import { inArray } from 'drizzle-orm';

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
 *   authorized the preapproval. The share-link flow creates it with no provider
 *   id (see `createPendingProviderSubscription`); the qzpay `mode:'paid'` inline
 *   flow writes the equivalent raw value `incomplete` and DOES persist a provider
 *   id at creation, before authorization (HOS-151 Bug C).
 * - `abandoned` — a `pending_provider` row whose checkout TTL elapsed with no
 *   provider authorization. Terminal; only ever reached FROM `pending_provider`.
 *   May still CARRY a provider id: the `abandoned-pending-subs` cron cancels and
 *   verifies the preapproval but does not clear the id column. The qzpay raw
 *   equivalent is `incomplete_expired`.
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
 * Statuses only ever reachable AFTER the provider authorized the subscription.
 * Presence of any of these — as a subscription's current status, or ANYWHERE in
 * its `billing_subscription_events` history (as a `previousStatus` or
 * `newStatus`) — proves the subscription was authorized at least once, and so
 * consumed the trial.
 *
 * `cancelled` is deliberately NOT here: it is ambiguous. It is reachable both
 * from an authorized state (`active`/`trialing` → `cancelled`, a real
 * cancellation that DID consume the trial) AND directly from `pending_provider`
 * (`pending_provider` → `cancelled`, when MercadoPago reports the pending
 * preapproval rejected/cancelled before it ever activated — the user backed out
 * of / rejected the card on MP's hosted checkout; a routine HOS-191 transition
 * that never consumed a trial). `comp` is also excluded here — it is a direct DB
 * insert with no provider authorization — but it is handled as consumed by
 * {@link classifyPriorSubscription} because it is an explicit permanent grant.
 */
const AUTHORIZED_STATUSES: ReadonlySet<SubscriptionStatusEnum> = new Set([
    SubscriptionStatusEnum.ACTIVE,
    SubscriptionStatusEnum.TRIALING,
    SubscriptionStatusEnum.PAST_DUE,
    SubscriptionStatusEnum.PAUSED,
    SubscriptionStatusEnum.EXPIRED
]);

/**
 * Whether a raw stored status value normalizes to one whose presence in a
 * subscription's event history PROVES it consumed the trial: any authorized
 * status, PLUS `comp`.
 *
 * `comp` is included even though it is never provider-authorized — it is an
 * explicit permanent (free-forever) grant that is trial-consuming. A comp
 * subscription later revoked (`comp` → `cancelled`, the SPEC-262 admin-revoke
 * transition) leaves `previousStatus: 'comp'` as its only history; without this
 * it would be misclassified as never-authorized and wrongly re-grant a trial.
 */
function isTrialConsumingStatus(rawStatus: unknown): boolean {
    const status = normalizeStoredSubscriptionStatus(rawStatus);
    return (
        status !== null &&
        (AUTHORIZED_STATUSES.has(status) || status === SubscriptionStatusEnum.COMP)
    );
}

/** Classification of a prior subscription against the trial-eligibility rule. */
type PriorSubscriptionClass =
    /** Definitely consumed the trial (authorized status, or an explicit `comp` grant). */
    | 'consumed'
    /** Definitely did not (never-authorized `pending_provider`/`abandoned`). */
    | 'not-consumed'
    /** `cancelled` — needs the event history to tell whether it was ever authorized. */
    | 'ambiguous-cancelled';

/**
 * Classify a single prior subscription by its NORMALIZED current status.
 *
 * Normalization is required because `getByCustomerId` returns the raw stored
 * string and `billing_subscriptions.status` holds two vocabularies (qzpay
 * `incomplete`/`incomplete_expired`/`canceled` from the `mode:'paid'` flow,
 * Hospeda `pending_provider`/`abandoned`/`cancelled` from the
 * share-link/webhook/cron paths). An unknown/unmappable status
 * (`normalizeStoredSubscriptionStatus` → `null`) is treated as `consumed` — the
 * fail-closed default for the single trial gate, which must never accidentally
 * hand out a second trial.
 *
 * NOTE: status alone is deliberately the classifier, NOT the provider id —
 * presence of a `providerSubscriptionIds.mercadopago` does NOT imply
 * authorization: the `mode:'paid'` inline flow persists the id at creation
 * (HOS-151 Bug C) and the `abandoned-pending-subs` cron reaps a row to
 * `abandoned` WITHOUT clearing the id, so trusting id-presence would re-open the
 * exact HOS-230 false-disqualification bug.
 */
function classifyPriorSubscription(sub: PriorSubscription): PriorSubscriptionClass {
    const status = normalizeStoredSubscriptionStatus(sub.status);
    if (status === null) {
        return 'consumed';
    }
    if (status === SubscriptionStatusEnum.CANCELLED) {
        return 'ambiguous-cancelled';
    }
    return NEVER_AUTHORIZED_STATUSES.has(status) ? 'not-consumed' : 'consumed';
}

/**
 * Whether any of the given (cancelled) subscriptions was authorized by the
 * provider at least once, resolved from the `billing_subscription_events` audit
 * trail — the single ground-truth signal that disambiguates a real cancellation
 * (`active`/`trialing` → `cancelled`, consumed the trial) from a never-activated
 * backout (`pending_provider` → `cancelled`, did NOT, the HOS-230 case).
 *
 * A subscription consumed the trial iff any of its events carries a
 * trial-consuming status (authorized, or `comp`) in `previousStatus` OR
 * `newStatus` — checking both catches the authorization transition itself and
 * the later cancel-from-authorized (or comp-revoke) event. A
 * `pending_provider` → `cancelled` row has neither, so it reads as
 * never-authorized and does NOT consume the trial. A cancelled row with NO
 * events (a data-integrity oddity — a real cancel always writes an event) reads
 * as never-authorized, the direction that fixes the bug.
 *
 * @param subscriptionIds - The ids of the customer's `cancelled` subscriptions.
 * @returns `true` if at least one was ever authorized.
 */
async function anyCancelledSubscriptionWasAuthorized(
    subscriptionIds: readonly string[]
): Promise<boolean> {
    const db = getDb();
    const events = await db
        .select({
            previousStatus: billingSubscriptionEvents.previousStatus,
            newStatus: billingSubscriptionEvents.newStatus
        })
        .from(billingSubscriptionEvents)
        .where(inArray(billingSubscriptionEvents.subscriptionId, [...subscriptionIds]));

    return events.some(
        (event) =>
            isTrialConsumingStatus(event.previousStatus) || isTrialConsumingStatus(event.newStatus)
    );
}

/**
 * Whether a billing customer has ANY prior subscription that actually consumed
 * their one-per-lifetime free trial — i.e. one whose preapproval was authorized
 * by the provider at least once (any authorized status, any product domain,
 * including a subsequently-cancelled one). Checkouts the user backed out of
 * before authorization are explicitly EXCLUDED: `abandoned` /
 * never-authorized `pending_provider` rows (HOS-230), AND `cancelled` rows that
 * were reached directly from `pending_provider` (MP reported the preapproval
 * rejected before it ever activated) — the latter disambiguated via the
 * subscription's event history.
 *
 * This is the exact query `subscription-checkout.service.ts` runs (behind
 * its `planHasTrial && planTrialDays > 0` short-circuit) to decide
 * `hasPriorSubscription` before calling
 * {@link resolveCheckoutFreeTrialDays | resolveCheckoutFreeTrialDays} —
 * extracted here so both call sites, plus this module's own
 * {@link resolveTrialEligibility}, share ONE implementation.
 *
 * The event-history query runs ONLY when the customer's sole prior rows are
 * `cancelled` (no unambiguously-authorized subscription short-circuits it away
 * first), so the common paths stay a single `getByCustomerId` call.
 *
 * @param input - Billing instance and customer id.
 * @returns `true` when the customer has at least one authorized prior
 *   subscription; `false` when they have never had one (or only ever
 *   abandoned/pending/never-activated-cancelled checkouts).
 */
export async function hasAnyPriorSubscription(input: TrialEligibilityInput): Promise<boolean> {
    const { billing, customerId } = input;
    const subscriptions = await billing.subscriptions.getByCustomerId(customerId);

    const cancelledSubscriptionIds: string[] = [];
    for (const sub of subscriptions) {
        const classification = classifyPriorSubscription(sub);
        if (classification === 'consumed') {
            // An unambiguously-authorized subscription settles it — no need to
            // inspect event history.
            return true;
        }
        if (classification === 'ambiguous-cancelled') {
            cancelledSubscriptionIds.push(sub.id);
        }
    }

    if (cancelledSubscriptionIds.length === 0) {
        return false;
    }

    return anyCancelledSubscriptionWasAuthorized(cancelledSubscriptionIds);
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
