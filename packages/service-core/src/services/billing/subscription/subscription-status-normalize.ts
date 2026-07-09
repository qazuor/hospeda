/**
 * Subscription Status Normalization
 *
 * Single source of truth for translating a *stored* subscription status into
 * Hospeda's {@link SubscriptionStatusEnum} vocabulary.
 *
 * The `billing_subscriptions.status` column can hold values from two different
 * vocabularies depending on which layer last wrote the row:
 *
 * - **qzpay vocabulary** — written by qzpay-core / qzpay-drizzle when a row is
 *   created through the `mode: 'paid'` flow (monthly/commerce/partner recurring
 *   subscriptions). These land on qzpay's internal creation-time values such as
 *   `incomplete`, `incomplete_expired`, `unpaid`, and `canceled` (American, 1 L).
 * - **Hospeda vocabulary** — written by Hospeda's own code (the annual upfront
 *   insert, the webhook handler, the crons), which always uses
 *   {@link SubscriptionStatusEnum} values such as `pending_provider`,
 *   `cancelled` (British, 2 L's), `abandoned`, ...
 *
 * The subscription state machine ({@link ./subscription-status-transitions})
 * is expressed exclusively in Hospeda vocabulary. Any consumer that needs to
 * feed a *stored* status into that state machine (as a transition `from`) MUST
 * normalize it first, otherwise a qzpay-vocabulary value like `incomplete` is
 * rejected as an "unknown source status" and the transition silently no-ops
 * (root cause of HOS-108, where recurring subscriptions never activated).
 *
 * `unpaid` is intentionally mapped to `PAST_DUE` because Hospeda does not model
 * an `unpaid` state separately — an unpaid recurring charge IS the past-due
 * experience for the user.
 *
 * @module services/subscription-status-normalize
 */

import { SubscriptionStatusEnum } from '@repo/schemas';

/**
 * Mapping from qzpay-vocabulary stored statuses to Hospeda's
 * {@link SubscriptionStatusEnum}.
 *
 * Only qzpay-vocabulary keys that differ from Hospeda's vocabulary need an
 * entry here; already-Hospeda values are handled by the pass-through branch in
 * {@link normalizeStoredSubscriptionStatus}.
 *
 * NOT the same map as the `QZPAY_TO_HOSPEDA_STATUS` exported by the MP webhook
 * handler (`apps/api/.../subscription-logic.ts`): that one maps the INCOMING
 * `retrieve()` status (has `finished`/`pending`, never `incomplete`); this one
 * maps the STORED DB `from` status (has `incomplete`/`unpaid`). Do NOT merge.
 */
const QZPAY_TO_HOSPEDA_STATUS: Readonly<Record<string, SubscriptionStatusEnum>> = {
    active: SubscriptionStatusEnum.ACTIVE,
    trialing: SubscriptionStatusEnum.TRIALING,
    past_due: SubscriptionStatusEnum.PAST_DUE,
    paused: SubscriptionStatusEnum.PAUSED,
    /** qzpay uses American spelling (1 L); Hospeda uses British `cancelled`. */
    canceled: SubscriptionStatusEnum.CANCELLED,
    unpaid: SubscriptionStatusEnum.PAST_DUE,
    incomplete: SubscriptionStatusEnum.PENDING_PROVIDER,
    incomplete_expired: SubscriptionStatusEnum.ABANDONED
} as const;

/** Set of all valid Hospeda-vocabulary status strings, for pass-through checks. */
const HOSPEDA_STATUS_VALUES: ReadonlySet<string> = new Set<string>(
    Object.values(SubscriptionStatusEnum)
);

/**
 * Normalize a raw stored subscription status into Hospeda's
 * {@link SubscriptionStatusEnum} vocabulary.
 *
 * Accepts either a qzpay-vocabulary value (mapped via
 * {@link QZPAY_TO_HOSPEDA_STATUS}) or an already-Hospeda value (returned
 * unchanged). Returns `null` when the input is neither — an unknown status is a
 * data-integrity signal the caller should surface (log / Sentry / 500) rather
 * than silently coerce.
 *
 * @param value - The raw status value read from `billing_subscriptions.status`.
 * @returns The equivalent {@link SubscriptionStatusEnum}, or `null` if unknown.
 *
 * @example
 * ```ts
 * normalizeStoredSubscriptionStatus('incomplete'); // => SubscriptionStatusEnum.PENDING_PROVIDER
 * normalizeStoredSubscriptionStatus('active');     // => SubscriptionStatusEnum.ACTIVE
 * normalizeStoredSubscriptionStatus('cancelled');  // => SubscriptionStatusEnum.CANCELLED (pass-through)
 * normalizeStoredSubscriptionStatus('bogus');      // => null
 * ```
 */
export function normalizeStoredSubscriptionStatus(value: unknown): SubscriptionStatusEnum | null {
    if (typeof value !== 'string') {
        return null;
    }

    const mapped = QZPAY_TO_HOSPEDA_STATUS[value];
    if (mapped !== undefined) {
        return mapped;
    }

    return HOSPEDA_STATUS_VALUES.has(value) ? (value as SubscriptionStatusEnum) : null;
}
