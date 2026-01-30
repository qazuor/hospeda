/**
 * Entitlement key identifiers used across the billing system.
 * These keys map to features that can be enabled/disabled per plan.
 */
export enum EntitlementKey {
    /** Owner entitlements */
    PUBLISH_ACCOMMODATIONS = 'publish_accommodations',
    EDIT_ACCOMMODATION_INFO = 'edit_accommodation_info',
    VIEW_BASIC_STATS = 'view_basic_stats',
    VIEW_ADVANCED_STATS = 'view_advanced_stats',
    RESPOND_REVIEWS = 'respond_reviews',
    PRIORITY_SUPPORT = 'priority_support',
    FEATURED_LISTING = 'featured_listing',
    CUSTOM_BRANDING = 'custom_branding',
    API_ACCESS = 'api_access',
    DEDICATED_MANAGER = 'dedicated_manager',
    CREATE_PROMOTIONS = 'create_promotions',
    SOCIAL_MEDIA_INTEGRATION = 'social_media_integration',

    /** Complex entitlements (extend owner) */
    MULTI_PROPERTY_MANAGEMENT = 'multi_property_management',
    CONSOLIDATED_ANALYTICS = 'consolidated_analytics',
    CENTRALIZED_BOOKING = 'centralized_booking',
    STAFF_MANAGEMENT = 'staff_management',
    WHITE_LABEL = 'white_label',
    MULTI_CHANNEL_INTEGRATION = 'multi_channel_integration',

    /** Tourist entitlements */
    SAVE_FAVORITES = 'save_favorites',
    WRITE_REVIEWS = 'write_reviews',
    READ_REVIEWS = 'read_reviews',
    AD_FREE = 'ad_free',
    PRICE_ALERTS = 'price_alerts',
    EARLY_ACCESS_EVENTS = 'early_access_events',
    EXCLUSIVE_DEALS = 'exclusive_deals',
    VIP_SUPPORT = 'vip_support',
    CONCIERGE_SERVICE = 'concierge_service',
    AIRPORT_TRANSFERS = 'airport_transfers',
    VIP_PROMOTIONS_ACCESS = 'vip_promotions_access'
}

/**
 * Entitlement definition for a plan
 */
export interface EntitlementDefinition {
    /** The entitlement key */
    key: EntitlementKey;
    /** Human-readable name */
    name: string;
    /** Description of the entitlement */
    description: string;
}
