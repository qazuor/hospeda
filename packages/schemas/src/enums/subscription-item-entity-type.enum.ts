/**
 * Subscription item entity type enum for polymorphic system
 * Defines the target entity types that can be linked to subscription items
 */
export enum SubscriptionItemEntityTypeEnum {
    /** Sponsorship entity (POST/EVENT sponsorships) */
    SPONSORSHIP = 'sponsorship',
    /** Campaign entity (advertising campaigns) */
    CAMPAIGN = 'campaign',
    /** Featured accommodation entity */
    FEATURED_ACCOMMODATION = 'featured_accommodation',
    /** Professional service order entity */
    PROFESSIONAL_SERVICE_ORDER = 'professional_service_order',
    /** Accommodation listing entity */
    ACCOMMODATION_LISTING = 'accommodation_listing',
    /** Benefit listing entity */
    BENEFIT_LISTING = 'benefit_listing',
    /** Service listing entity */
    SERVICE_LISTING = 'service_listing'
}
