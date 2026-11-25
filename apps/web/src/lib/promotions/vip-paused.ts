/**
 * The in-app notice of the «Solo VIP» pause (HOS-2589 D-8, AC-36).
 *
 * The pause sweep stamps `vipPausedAt` when it stops a «Solo VIP» promotion whose
 * owner lost `vip_only_promotions`. A promotion still paused by that sweep (stamp
 * set and not ACTIVE again) is listed on the owner's promotions page.
 *
 * @module lib/promotions/vip-paused
 */

/** The fields the notice reads from an owner promotion row. */
export interface VipPausableRow {
    readonly title: string;
    readonly lifecycleState: string;
    readonly vipPausedAt?: string | Date | null;
}

/**
 * Titles of the promotions the «Solo VIP» pause is still holding.
 *
 * @param input - The owner's promotion rows.
 * @returns `{ titles }`, in row order.
 */
export function listVipPausedTitles(input: { readonly items: readonly VipPausableRow[] }): {
    readonly titles: readonly string[];
} {
    return {
        titles: input.items
            .filter((item) => item.vipPausedAt != null && item.lifecycleState !== 'ACTIVE')
            .map((item) => item.title)
    };
}
