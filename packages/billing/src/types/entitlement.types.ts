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
    CREATE_PROMOTIONS = 'create_promotions',

    /** Accommodation feature entitlements */
    CAN_USE_RICH_DESCRIPTION = 'can_use_rich_description',
    CAN_EMBED_VIDEO = 'can_embed_video',
    CAN_USE_CALENDAR = 'can_use_calendar',
    CAN_SYNC_EXTERNAL_CALENDAR = 'can_sync_external_calendar',
    CAN_CONTACT_WHATSAPP_DISPLAY = 'can_contact_whatsapp_display',
    CAN_CONTACT_WHATSAPP_DIRECT = 'can_contact_whatsapp_direct',
    HAS_VERIFICATION_BADGE = 'has_verification_badge',

    /** Complex entitlements (extend owner) */
    MULTI_PROPERTY_MANAGEMENT = 'multi_property_management',
    CONSOLIDATED_ANALYTICS = 'consolidated_analytics',
    CENTRALIZED_BOOKING = 'centralized_booking',
    STAFF_MANAGEMENT = 'staff_management',

    /** Tourist entitlements */
    SAVE_FAVORITES = 'save_favorites',
    WRITE_REVIEWS = 'write_reviews',
    READ_REVIEWS = 'read_reviews',
    AD_FREE = 'ad_free',
    PRICE_ALERTS = 'price_alerts',
    EXCLUSIVE_DEALS = 'exclusive_deals',
    VIP_SUPPORT = 'vip_support',
    VIP_PROMOTIONS_ACCESS = 'vip_promotions_access',
    CAN_COMPARE_ACCOMMODATIONS = 'can_compare_accommodations',
    CAN_ATTACH_REVIEW_PHOTOS = 'can_attach_review_photos',
    CAN_VIEW_SEARCH_HISTORY = 'can_view_search_history',
    CAN_VIEW_RECOMMENDATIONS = 'can_view_recommendations',

    /** AI feature entitlements (SPEC-173) */
    /**
     * Allows the user to use the AI-powered text improvement tool
     * to enhance their accommodation descriptions and other content.
     * Available on owner and complex plans only (not tourist plans,
     * since tourists do not own content to improve).
     */
    AI_TEXT_IMPROVE = 'ai_text_improve',
    /**
     * Allows the user to interact with the AI chat assistant
     * for travel planning, recommendations, and general queries.
     */
    AI_CHAT = 'ai_chat',
    /**
     * Allows the user to use the AI-powered search to get
     * semantically relevant accommodation results.
     */
    AI_SEARCH = 'ai_search',
    /**
     * Allows the user to access the AI-powered support assistant
     * for platform help and troubleshooting.
     */
    AI_SUPPORT = 'ai_support',
    /**
     * Allows the user to use the AI-powered content translation feature
     * to auto-translate accommodation, destination, event, and post content
     * to English and Portuguese.
     */
    AI_TRANSLATE = 'ai_translate',
    /**
     * Allows the user to use the AI-powered accommodation import feature
     * to extract structured listing data from an external URL and pre-fill
     * the accommodation creation form.
     */
    AI_ACCOMMODATION_IMPORT = 'ai_accommodation_import'
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
