/**
 * Plan Entitlement Group Definitions
 *
 * Organizes entitlement keys into display groups by category
 * for the plan creation/edit dialog.
 *
 * Every `EntitlementKey` MUST appear in exactly one group: a key missing here
 * is invisible in the plan editor, so an operator cannot grant or revoke it at
 * all. That is not theoretical — the whole AI suite and five tourist
 * entitlements had been unreachable since they were introduced (HOS-331).
 * `plan-entitlement-groups.test.ts` fails when a key is left ungrouped, so the
 * omission surfaces in CI instead of as a silently incomplete dialog.
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
            EntitlementKey.CREATE_PROMOTIONS
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
            EntitlementKey.STAFF_MANAGEMENT
        ]
    },
    {
        labelKey: 'tourist',
        keys: [
            EntitlementKey.SAVE_FAVORITES,
            EntitlementKey.WRITE_REVIEWS,
            EntitlementKey.READ_REVIEWS,
            EntitlementKey.PRICE_ALERTS,
            EntitlementKey.EXCLUSIVE_DEALS,
            EntitlementKey.VIP_SUPPORT,
            EntitlementKey.VIP_VISIBILITY_ACCESS,
            EntitlementKey.VIP_PROMOTIONS_ACCESS,
            EntitlementKey.CAN_COMPARE_ACCOMMODATIONS,
            EntitlementKey.CAN_ATTACH_REVIEW_PHOTOS,
            EntitlementKey.CAN_VIEW_SEARCH_HISTORY,
            EntitlementKey.CAN_VIEW_RECOMMENDATIONS,
            EntitlementKey.CAN_USE_COLLECTIONS
        ]
    },
    {
        labelKey: 'ai',
        keys: [
            EntitlementKey.AI_TEXT_IMPROVE,
            EntitlementKey.AI_CHAT,
            EntitlementKey.AI_SEARCH,
            EntitlementKey.AI_SUPPORT,
            EntitlementKey.AI_TRANSLATE,
            EntitlementKey.AI_ACCOMMODATION_IMPORT
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
