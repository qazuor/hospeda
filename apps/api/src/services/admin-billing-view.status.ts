/**
 * Admin billing VIEW — status vocabulary
 *
 * The single place where the vocabulary physically stored in
 * `billing_subscriptions.status` / `billing_payments.status` is translated into
 * the normalised vocabulary the admin UI consumes
 * (`AdminSubscriptionViewStatus` / `AdminPaymentViewStatus`), and back again
 * when a filter has to be applied.
 *
 * ## Why a column holds two spellings of one state
 *
 * `billing_subscriptions.status` is written by two different layers:
 *
 * - The **webhook path** normalises through Hospeda's vocabulary, so it writes
 *   `cancelled` (British, two L's, {@link SubscriptionStatusEnum.CANCELLED}).
 * - The **admin cancel path** (`POST /subscriptions/:id/cancel`) goes straight
 *   through the `@qazuor/qzpay-hono` tier, which writes qzpay's own `canceled`
 *   (American, one L).
 *
 * Both are therefore present in live data — production held 6 `canceled` rows and
 * 2 `cancelled` rows when this module was written. Reading is handled by
 * {@link normalizeSubscriptionStatusForView}; FILTERING is handled by
 * {@link widenSubscriptionStatusFilter}, which turns one normalised value into
 * every spelling that can physically match it. Filtering with a single exact
 * match is the defect this module exists to prevent: the admin "Cancelada"
 * filter returned 2 of 8 rows.
 *
 * ## No second mapping table
 *
 * The stored→normalised direction deliberately delegates to
 * `normalizeStoredSubscriptionStatus` from `@repo/service-core`, which is
 * already the single source of truth for that map (it is what the webhook and
 * the crons use). Re-declaring the pairs here would create a second table that
 * drifts. What this module adds is the INVERSE, derived by running every
 * physically-possible spelling back through the canonical normaliser — so a
 * change to the canonical map automatically changes the widening.
 *
 * @module services/admin-billing-view.status
 */

import type { AdminPaymentViewStatus, AdminSubscriptionViewStatus } from '@repo/schemas';
import { AdminPaymentViewStatusSchema, AdminSubscriptionViewStatusSchema } from '@repo/schemas';
import { normalizeStoredSubscriptionStatus } from '@repo/service-core';

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/**
 * Every spelling `billing_subscriptions.status` can physically hold.
 *
 * The union of Hospeda's `SubscriptionStatusEnum` values and qzpay's own
 * creation-time vocabulary (`incomplete`, `incomplete_expired`, `unpaid`,
 * `canceled`). Used ONLY as the candidate set fed back through the canonical
 * normaliser to derive {@link widenSubscriptionStatusFilter} — it is not itself
 * a mapping, so it cannot drift into disagreeing with one.
 *
 * A spelling missing from this list is a row no filter can reach; the test suite
 * asserts every entry is reachable from some normalised filter value.
 */
export const STORED_SUBSCRIPTION_STATUS_SPELLINGS: readonly string[] = [
    // Hospeda vocabulary (webhook + crons + Hospeda inserts)
    'active',
    'trialing',
    'past_due',
    'paused',
    'cancelled',
    'expired',
    'pending_provider',
    'abandoned',
    'comp',
    // qzpay vocabulary (qzpay-core / qzpay-drizzle / the qzpay admin tier)
    'canceled',
    'incomplete',
    'incomplete_expired',
    'unpaid'
] as const;

/**
 * Translate a raw stored subscription status into the normalised vocabulary the
 * admin UI consumes.
 *
 * @param params.rawStatus - The value read straight from `billing_subscriptions.status`.
 * @returns The normalised status, or `null` when the stored value belongs to
 *   neither vocabulary — a data-integrity signal the caller should surface
 *   rather than silently coerce into a plausible-looking state.
 *
 * @example
 * ```ts
 * normalizeSubscriptionStatusForView({ rawStatus: 'canceled' }); // 'cancelled'
 * normalizeSubscriptionStatusForView({ rawStatus: 'bogus' });    // null
 * ```
 */
export function normalizeSubscriptionStatusForView(params: {
    readonly rawStatus: string;
}): AdminSubscriptionViewStatus | null {
    const normalised = normalizeStoredSubscriptionStatus(params.rawStatus);
    if (normalised === null) {
        return null;
    }

    const parsed = AdminSubscriptionViewStatusSchema.safeParse(normalised);
    return parsed.success ? parsed.data : null;
}

/**
 * Expand one normalised subscription status into every spelling that can match
 * it in the database.
 *
 * @param params.status - A normalised status as sent by the admin UI.
 * @returns Every physical spelling to include in the SQL `IN (...)` filter.
 *
 * @example
 * ```ts
 * widenSubscriptionStatusFilter({ status: 'cancelled' }); // ['cancelled', 'canceled']
 * ```
 */
export function widenSubscriptionStatusFilter(params: {
    readonly status: AdminSubscriptionViewStatus;
}): readonly string[] {
    return STORED_SUBSCRIPTION_STATUS_SPELLINGS.filter(
        (spelling) => normalizeSubscriptionStatusForView({ rawStatus: spelling }) === params.status
    );
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

/**
 * Maps the payment-status spellings that are NOT already contract values onto
 * the contract value they mean.
 *
 * Only one entry is needed today: the MercadoPago webhook maps both `cancelled`
 * and `canceled` onto qzpay's `canceled`, but a hand-written row or a future
 * adapter could persist the British spelling. Everything else the payment
 * pipeline produces (`succeeded`, `pending`, `processing`, `failed`, `refunded`,
 * `partially_refunded`) is already a contract value and passes through.
 *
 * `completed` is deliberately ABSENT: no row has ever held it. It was invented
 * by the admin UI, which is what made its refund button dead.
 */
const PAYMENT_STATUS_ALIASES: Readonly<Record<string, AdminPaymentViewStatus>> = {
    cancelled: 'canceled'
} as const;

/**
 * Every spelling `billing_payments.status` can physically hold.
 *
 * @see STORED_SUBSCRIPTION_STATUS_SPELLINGS for why this is a candidate set
 *   rather than a mapping.
 */
export const STORED_PAYMENT_STATUS_SPELLINGS: readonly string[] = [
    ...AdminPaymentViewStatusSchema.options,
    ...Object.keys(PAYMENT_STATUS_ALIASES)
] as const;

/**
 * Translate a raw stored payment status into the normalised vocabulary.
 *
 * @param params.rawStatus - The value read straight from `billing_payments.status`.
 * @returns The normalised status, or `null` when the value is unknown.
 */
export function normalizePaymentStatusForView(params: {
    readonly rawStatus: string;
}): AdminPaymentViewStatus | null {
    const alias = PAYMENT_STATUS_ALIASES[params.rawStatus];
    if (alias !== undefined) {
        return alias;
    }

    const parsed = AdminPaymentViewStatusSchema.safeParse(params.rawStatus);
    return parsed.success ? parsed.data : null;
}

/**
 * Expand one normalised payment status into every spelling that can match it.
 *
 * @param params.status - A normalised status as sent by the admin UI.
 * @returns Every physical spelling to include in the SQL `IN (...)` filter.
 */
export function widenPaymentStatusFilter(params: {
    readonly status: AdminPaymentViewStatus;
}): readonly string[] {
    return STORED_PAYMENT_STATUS_SPELLINGS.filter(
        (spelling) => normalizePaymentStatusForView({ rawStatus: spelling }) === params.status
    );
}

// ---------------------------------------------------------------------------
// Derived fields
// ---------------------------------------------------------------------------

/**
 * Decide whether a payment can be refunded right now.
 *
 * Computed on the server precisely because the previous client-side derivation
 * (`status === 'completed'`) was wrong in a way no test caught. The rule is
 * "money actually moved and some of it is still outstanding".
 *
 * @param params.status - The NORMALISED payment status.
 * @param params.amountInCents - Charged amount, integer centavos.
 * @param params.refundedAmountInCents - Already-refunded amount, integer centavos.
 * @returns `true` when a refund can still be issued against this payment.
 */
export function isPaymentRefundable(params: {
    readonly status: AdminPaymentViewStatus;
    readonly amountInCents: number;
    readonly refundedAmountInCents: number;
}): boolean {
    const { status, amountInCents, refundedAmountInCents } = params;

    if (status !== 'succeeded' && status !== 'partially_refunded') {
        return false;
    }

    return refundedAmountInCents < amountInCents;
}

/**
 * Derive a subscription's recurring charge from its plan's price list.
 *
 * @param params.billingInterval - `billing_subscriptions.billing_interval`.
 * @param params.monthlyPriceInCents - `billing_plans.monthly_price_ars`, or null.
 * @param params.annualPriceInCents - `billing_plans.annual_price_ars`, or null.
 * @returns The recurring amount in integer centavos, or `null` when no price is
 *   on record for that interval. NEVER `0` as a stand-in for "unknown" — a real
 *   `0` means the free tier, and the UI must be able to tell the two apart.
 */
export function resolveRecurringAmountInCents(params: {
    readonly billingInterval: string | null;
    readonly monthlyPriceInCents: number | null;
    readonly annualPriceInCents: number | null;
}): number | null {
    const { billingInterval, monthlyPriceInCents, annualPriceInCents } = params;

    if (billingInterval === 'month') {
        return monthlyPriceInCents ?? null;
    }

    if (billingInterval === 'year') {
        return annualPriceInCents ?? null;
    }

    return null;
}
