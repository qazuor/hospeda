/**
 * Tourist audience enum
 * Defines which tourist tier an owner promotion is visible to.
 * Additive: 'vip' tourists see 'plus' + 'vip' rows, 'plus' tourists see 'plus' only.
 */
export enum TouristAudienceEnum {
    /**
     * Visible to every entitled tourist tier (default).
     *
     * Named for `tourist-plus`, which HOS-1224 retired. The value stays because
     * it is a property of the DEAL, not of a plan — but with tourist-vip the
     * only paid tourist tier left, nothing a tourist can buy now lands in this
     * branch WITHOUT also carrying VIP_PROMOTIONS_ACCESS. Reported as a
     * HOS-1224 follow-up rather than changed here.
     */
    PLUS = 'plus',
    /** Reserved for tourist-vip tier only */
    VIP = 'vip'
}
