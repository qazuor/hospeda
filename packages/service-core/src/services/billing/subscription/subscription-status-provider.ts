/**
 * Provider Subscription Status Mapping
 *
 * Single source of truth for translating the status a payment provider reports
 * for a subscription (via `paymentAdapter.subscriptions.retrieve()`) into
 * Hospeda's {@link SubscriptionStatusEnum} vocabulary.
 *
 * Two consumers share this map, which is why it lives here rather than beside
 * either of them: the MercadoPago webhook (`processSubscriptionUpdated`, which
 * re-exports it for backwards compatibility) and the trial reconciler cron,
 * which re-reads the preapproval to decide whether an elapsed trial converted.
 * Both must agree on what `canceled` means, so neither owns the map.
 *
 * NOT the same map as {@link ./subscription-status-normalize}: this one maps the
 * INCOMING status returned by `retrieve()` (has `finished`, and `pending` → null;
 * never `incomplete`), whereas the normalizer maps the STORED DB `from` status
 * (has `incomplete`, `unpaid`, `incomplete_expired`). They serve different
 * inputs — do NOT merge them.
 *
 * @module services/subscription-status-provider
 */

import { SubscriptionStatusEnum } from '@repo/schemas';

/**
 * Maps QZPay subscription statuses (returned by `retrieve()`) to internal
 * {@link SubscriptionStatusEnum}.
 *
 * - A non-null value means "update the local subscription to this status".
 * - A `null` value means "no status change, log only".
 * - A key absent from this map means the status is unknown (WARN + Sentry).
 *
 * @remarks
 * QZPay uses "canceled" (1 L) while Hospeda uses "cancelled" (2 L's).
 * The `mapStatus()` in `@qazuor/qzpay-mercadopago` passes through unknown
 * statuses, so "finished" arrives as-is.
 *
 * MercadoPago reports an authorized preapproval as `authorized`, which qzpay
 * normalizes to `active` before it reaches this map — including for a card-first
 * trial, whose first charge is merely deferred. `active` therefore does NOT
 * imply "paying"; see `deriveTrialingStatus` for how the trial window
 * distinguishes the two.
 */
export const QZPAY_TO_HOSPEDA_STATUS: Record<string, SubscriptionStatusEnum | null> = {
    active: SubscriptionStatusEnum.ACTIVE,
    paused: SubscriptionStatusEnum.PAUSED,
    canceled: SubscriptionStatusEnum.CANCELLED,
    finished: SubscriptionStatusEnum.EXPIRED,
    past_due: SubscriptionStatusEnum.PAST_DUE,
    pending: null
} as const;
