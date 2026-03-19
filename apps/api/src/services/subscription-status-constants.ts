/**
 * Subscription Status Constants
 *
 * Defines typed constants for billing subscription statuses.
 * Subscriptions use British spelling ('cancelled', 2 L's) per MercadoPago/QZPay convention.
 *
 * See also: {@link ADDON_PURCHASE_STATUSES} in `addon-status-transitions.ts`, which
 * uses American spelling ('canceled') to match the `billing_addon_purchases` DB column.
 *
 * @module services/subscription-status-constants
 */

/**
 * All valid subscription status values.
 * British spelling ('cancelled') matches the MercadoPago/QZPay API convention and
 * the `billing_subscriptions.status` column constraint.
 */
export const SUBSCRIPTION_STATUSES = {
    ACTIVE: 'active',
    TRIALING: 'trialing',
    /** British spelling — subscription convention (MercadoPago/QZPay). */
    CANCELLED: 'cancelled',
    PAUSED: 'paused'
} as const;

/**
 * Union type of all subscription status strings.
 */
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[keyof typeof SUBSCRIPTION_STATUSES];
