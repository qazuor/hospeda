/**
 * Subscription item source type enum for polymorphic system
 * Defines the source of a subscription item (subscription vs purchase)
 */
export enum SubscriptionItemSourceTypeEnum {
    /** Item comes from a recurring subscription */
    SUBSCRIPTION = 'subscription',
    /** Item comes from a one-time purchase */
    PURCHASE = 'purchase'
}
