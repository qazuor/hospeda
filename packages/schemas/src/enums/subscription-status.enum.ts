/**
 * Subscription status enum
 * Defines the lifecycle states of a subscription
 */
export enum SubscriptionStatusEnum {
    /** Subscription is active and in good standing */
    ACTIVE = 'active',
    /** Subscription is in trial period */
    TRIALING = 'trialing',
    /** Payment is past due but subscription is still active */
    PAST_DUE = 'past_due',
    /** Subscription has been temporarily paused */
    PAUSED = 'paused',
    /** Subscription has been cancelled by user */
    CANCELLED = 'cancelled',
    /** Subscription period has ended */
    EXPIRED = 'expired'
}
