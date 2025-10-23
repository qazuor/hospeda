/**
 * Subscription status enum for business model
 * Defines the lifecycle states of subscriptions
 */
export enum SubscriptionStatusEnum {
    /** Subscription is active */
    ACTIVE = 'active',
    /** Subscription is paused */
    PAUSED = 'paused',
    /** Subscription payment is past due */
    PAST_DUE = 'past_due',
    /** Subscription is cancelled */
    CANCELLED = 'cancelled',
    /** Subscription has expired */
    EXPIRED = 'expired',
    /** Subscription is pending */
    PENDING = 'pending'
}
