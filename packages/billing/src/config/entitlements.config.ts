import { type EntitlementDefinition, EntitlementKey } from '../types/entitlement.types.js';

/**
 * All entitlement definitions for the Hospeda billing system
 */
export const ENTITLEMENT_DEFINITIONS: EntitlementDefinition[] = [
    // Owner entitlements
    {
        key: EntitlementKey.PUBLISH_ACCOMMODATIONS,
        name: 'Publish accommodations',
        description: 'Allows publishing accommodations on the platform'
    },
    {
        key: EntitlementKey.EDIT_ACCOMMODATION_INFO,
        name: 'Edit accommodation info',
        description: 'Allows editing information of owned accommodations'
    },
    {
        key: EntitlementKey.VIEW_BASIC_STATS,
        name: 'Basic statistics',
        description: 'Access to basic visit and booking statistics'
    },
    {
        key: EntitlementKey.VIEW_ADVANCED_STATS,
        name: 'Advanced statistics',
        description: 'Access to advanced statistics with charts and trends'
    },
    {
        key: EntitlementKey.RESPOND_REVIEWS,
        name: 'Respond to reviews',
        description: 'Allows responding to guest reviews'
    },
    {
        key: EntitlementKey.PRIORITY_SUPPORT,
        name: 'Priority support',
        description: 'Access to priority support with reduced response times'
    },
    {
        key: EntitlementKey.FEATURED_LISTING,
        name: 'Featured listing',
        description: 'Accommodation appears featured in search results'
    },
    {
        key: EntitlementKey.CUSTOM_BRANDING,
        name: 'Custom branding',
        description: 'Allows customizing the listing appearance with own branding'
    },
    {
        key: EntitlementKey.API_ACCESS,
        name: 'API access',
        description: 'Access to the API for integrations with external systems'
    },
    {
        key: EntitlementKey.DEDICATED_MANAGER,
        name: 'Dedicated manager',
        description: 'A dedicated account manager for personalized assistance'
    },
    {
        key: EntitlementKey.CREATE_PROMOTIONS,
        name: 'Create promotions',
        description: 'Allows creating exclusive promotions for VIP tourists'
    },
    {
        key: EntitlementKey.SOCIAL_MEDIA_INTEGRATION,
        name: 'Social media integration',
        description: 'Automatic publishing to social media platforms'
    },
    // Accommodation feature entitlements
    {
        key: EntitlementKey.CAN_USE_RICH_DESCRIPTION,
        name: 'Rich description',
        description: 'Allows using rich text formatting in accommodation description'
    },
    {
        key: EntitlementKey.CAN_EMBED_VIDEO,
        name: 'Embed video',
        description: 'Allows embedding videos in accommodation listing'
    },
    {
        key: EntitlementKey.CAN_USE_CALENDAR,
        name: 'Availability calendar',
        description: 'Allows using the availability calendar in listing'
    },
    {
        key: EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR,
        name: 'External calendar sync',
        description: 'Allows syncing with external calendars like Google Calendar or iCal'
    },
    {
        key: EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
        name: 'Display WhatsApp',
        description: 'Allows displaying WhatsApp number in listing'
    },
    {
        key: EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT,
        name: 'Direct WhatsApp contact',
        description: 'Allows tourists to contact directly via WhatsApp'
    },
    {
        key: EntitlementKey.HAS_VERIFICATION_BADGE,
        name: 'Verification badge',
        description: 'Displays a verification badge on the accommodation listing'
    },
    // Complex entitlements
    {
        key: EntitlementKey.MULTI_PROPERTY_MANAGEMENT,
        name: 'Multi-property management',
        description: 'Allows managing multiple properties from a single account'
    },
    {
        key: EntitlementKey.CONSOLIDATED_ANALYTICS,
        name: 'Consolidated analytics',
        description: 'Unified analytics dashboard for all properties'
    },
    {
        key: EntitlementKey.CENTRALIZED_BOOKING,
        name: 'Centralized booking',
        description: 'Centralized booking system for all properties'
    },
    {
        key: EntitlementKey.STAFF_MANAGEMENT,
        name: 'Staff management',
        description: 'Allows creating and managing staff accounts'
    },
    {
        key: EntitlementKey.WHITE_LABEL,
        name: 'White label',
        description: 'Complete white label experience'
    },
    {
        key: EntitlementKey.MULTI_CHANNEL_INTEGRATION,
        name: 'Multi-channel integration',
        description: 'Sync with OTAs and external sales channels'
    },
    // Tourist entitlements
    {
        key: EntitlementKey.SAVE_FAVORITES,
        name: 'Save favorites',
        description: 'Allows saving accommodations as favorites'
    },
    {
        key: EntitlementKey.WRITE_REVIEWS,
        name: 'Write reviews',
        description: 'Allows writing accommodation reviews'
    },
    {
        key: EntitlementKey.READ_REVIEWS,
        name: 'Read reviews',
        description: 'Access to read reviews from other guests'
    },
    {
        key: EntitlementKey.AD_FREE,
        name: 'Ad-free',
        description: 'Ad-free browsing experience'
    },
    {
        key: EntitlementKey.PRICE_ALERTS,
        name: 'Price alerts',
        description: 'Notifications when favorite accommodation prices drop'
    },
    {
        key: EntitlementKey.EARLY_ACCESS_EVENTS,
        name: 'Early access to events',
        description: 'Priority access to event tickets'
    },
    {
        key: EntitlementKey.EXCLUSIVE_DEALS,
        name: 'Exclusive deals',
        description: 'Access to exclusive offers and discounts'
    },
    {
        key: EntitlementKey.VIP_SUPPORT,
        name: 'VIP support',
        description: 'Dedicated VIP support channel'
    },
    {
        key: EntitlementKey.CONCIERGE_SERVICE,
        name: 'Concierge service',
        description: 'Personalized concierge service for trip planning'
    },
    {
        key: EntitlementKey.AIRPORT_TRANSFERS,
        name: 'Airport transfers',
        description: 'Airport transfer coordination included'
    },
    {
        key: EntitlementKey.VIP_PROMOTIONS_ACCESS,
        name: 'VIP promotions access',
        description: 'Access to exclusive promotions created by accommodations'
    },
    {
        key: EntitlementKey.CAN_COMPARE_ACCOMMODATIONS,
        name: 'Compare accommodations',
        description: 'Allows comparing multiple accommodations side by side'
    },
    {
        key: EntitlementKey.CAN_ATTACH_REVIEW_PHOTOS,
        name: 'Attach photos to reviews',
        description: 'Allows adding photos to accommodation reviews'
    },
    {
        key: EntitlementKey.CAN_VIEW_SEARCH_HISTORY,
        name: 'View search history',
        description: 'Access to past search history'
    },
    {
        key: EntitlementKey.CAN_VIEW_RECOMMENDATIONS,
        name: 'Personalized recommendations',
        description: 'Access to personalized accommodation recommendations based on preferences'
    }
];
