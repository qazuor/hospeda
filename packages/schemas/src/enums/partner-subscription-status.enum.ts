/**
 * Partner subscription status enum
 * Defines the billing lifecycle states of a partner subscription
 * Mirrors SponsorshipStatusEnum but adds PAST_DUE for billing
 */
export enum PartnerSubscriptionStatusEnum {
    /** Partner subscription is awaiting payment */
    PENDING = 'pending',
    /** Partner subscription is active and running */
    ACTIVE = 'active',
    /** Partner subscription payment is overdue */
    PAST_DUE = 'past_due',
    /** Partner subscription was cancelled */
    CANCELLED = 'cancelled'
}
