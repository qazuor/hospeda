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
    EXPIRED = 'expired',
    /**
     * Local subscription created but not yet confirmed by the payment provider.
     * Transitions to {@link SubscriptionStatusEnum.ACTIVE} when the provider
     * webhook arrives (e.g. MercadoPago subscription_preapproval.created), or to
     * {@link SubscriptionStatusEnum.ABANDONED} if the user never completes
     * checkout within the configured TTL.
     */
    PENDING_PROVIDER = 'pending_provider',
    /**
     * Local subscription that was created in {@link SubscriptionStatusEnum.PENDING_PROVIDER}
     * but never confirmed by the payment provider before the TTL elapsed.
     * Terminal state — the user must restart the flow to subscribe again.
     */
    ABANDONED = 'abandoned',
    /**
     * Subscription is permanently complimentary (free-forever).
     * A subscription in this state short-circuits billing entirely —
     * no MercadoPago preapproval is created or charged. The subscriber
     * retains all entitlements of the plan they were comped on.
     *
     * Set by applying a promo code with effect_kind = 'comp' (SPEC-262).
     * This is an explicit subscription state, NOT a 100% discount computation,
     * so it cannot revert to full price by a discount-engine change.
     */
    COMP = 'comp'
}
