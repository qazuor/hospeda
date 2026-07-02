/**
 * Tourist audience enum
 * Defines which tourist tier an owner promotion is visible to.
 * Additive: 'vip' tourists see 'plus' + 'vip' rows, 'plus' tourists see 'plus' only.
 */
export enum TouristAudienceEnum {
    /** Visible to tourist-plus and tourist-vip tiers (default) */
    PLUS = 'plus',
    /** Reserved for tourist-vip tier only */
    VIP = 'vip'
}
