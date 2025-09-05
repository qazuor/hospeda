/**
 * Payment type enum for different payment models
 */
export enum PaymentTypeEnum {
    /** One-time payment for premium features */
    ONE_TIME = 'one_time',
    /** Recurring subscription payment */
    SUBSCRIPTION = 'subscription'
}

/**
 * Subscription billing cycle enum
 */
export enum BillingCycleEnum {
    /** Monthly billing */
    MONTHLY = 'monthly',
    /** Yearly billing (with discount) */
    YEARLY = 'yearly'
}

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
