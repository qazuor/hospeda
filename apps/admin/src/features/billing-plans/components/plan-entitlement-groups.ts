/**
 * Plan Entitlement Group Definitions
 *
 * Organizes entitlement keys into display groups by category
 * for the plan creation/edit dialog.
 */
import { ENTITLEMENT_DEFINITIONS, EntitlementKey } from '@repo/billing';

/**
 * Entitlement group keys by category
 */
export const ENTITLEMENT_GROUP_KEYS: {
    readonly labelKey: string;
    readonly keys: readonly EntitlementKey[];
}[] = [
    {
        labelKey: 'owner',
        keys: [
            EntitlementKey.PUBLISH_ACCOMMODATIONS,
            EntitlementKey.EDIT_ACCOMMODATION_INFO,
            EntitlementKey.VIEW_BASIC_STATS,
            EntitlementKey.VIEW_ADVANCED_STATS,
            EntitlementKey.RESPOND_REVIEWS,
            EntitlementKey.PRIORITY_SUPPORT,
            EntitlementKey.FEATURED_LISTING,
            EntitlementKey.CUSTOM_BRANDING,
            EntitlementKey.API_ACCESS,
            EntitlementKey.DEDICATED_MANAGER,
            EntitlementKey.CREATE_PROMOTIONS,
            EntitlementKey.SOCIAL_MEDIA_INTEGRATION
        ]
    },
    {
        labelKey: 'accommodation',
        keys: [
            EntitlementKey.CAN_USE_RICH_DESCRIPTION,
            EntitlementKey.CAN_EMBED_VIDEO,
            EntitlementKey.CAN_USE_CALENDAR,
            EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR,
            EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
            EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT,
            EntitlementKey.HAS_VERIFICATION_BADGE
        ]
    },
    {
        labelKey: 'complex',
        keys: [
            EntitlementKey.MULTI_PROPERTY_MANAGEMENT,
            EntitlementKey.CONSOLIDATED_ANALYTICS,
            EntitlementKey.CENTRALIZED_BOOKING,
            EntitlementKey.STAFF_MANAGEMENT,
            EntitlementKey.WHITE_LABEL,
            EntitlementKey.MULTI_CHANNEL_INTEGRATION
        ]
    },
    {
        labelKey: 'tourist',
        keys: [
            EntitlementKey.SAVE_FAVORITES,
            EntitlementKey.WRITE_REVIEWS,
            EntitlementKey.READ_REVIEWS,
            EntitlementKey.AD_FREE,
            EntitlementKey.PRICE_ALERTS,
            EntitlementKey.EARLY_ACCESS_EVENTS,
            EntitlementKey.EXCLUSIVE_DEALS,
            EntitlementKey.VIP_SUPPORT,
            EntitlementKey.CONCIERGE_SERVICE,
            EntitlementKey.AIRPORT_TRANSFERS,
            EntitlementKey.VIP_PROMOTIONS_ACCESS
        ]
    }
];

/**
 * Get display name for an entitlement key
 */
export function getEntitlementName(key: EntitlementKey): string {
    const definition = ENTITLEMENT_DEFINITIONS.find((d) => d.key === key);
    return definition?.name || key.replace(/_/g, ' ');
}
