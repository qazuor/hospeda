/**
 * Subscription status enum
 */
export enum SubscriptionStatusEnum {
    /** Subscription is active */
    ACTIVE = 'active',
    /** Subscription is paused */
    PAUSED = 'paused',
    /** Subscription is cancelled */
    CANCELLED = 'cancelled',
    /** Subscription has expired */
    EXPIRED = 'expired',
    /** Subscription is pending activation */
    PENDING = 'pending'
}
