/**
 * Search-card promotion badges (HOS-2589 D-6, AC-33, AC-34).
 *
 * «Promo» when the place has at least one active «Para todos» promotion, «VIP» when
 * it has at least one active «Solo VIP» promotion, both when both exist. The flags
 * come from the cacheable list responses and say nothing else about the promotions;
 * the free quota never applies to badges.
 *
 * @module lib/promotions/promotion-badges
 */
import type { PromotionWindow, VenuePromoBadge } from '@repo/schemas';

/** Which badges a card shows. */
export interface PromotionBadges {
    readonly free: boolean;
    readonly vip: boolean;
}

/**
 * Badges of an accommodation card.
 *
 * @param input - The list item's presence flags.
 * @returns `{ free, vip }`.
 */
export function resolvePromotionBadges(input: {
    readonly hasFreePromotion?: unknown;
    readonly hasVipPromotion?: unknown;
}): PromotionBadges {
    return { free: input.hasFreePromotion === true, vip: input.hasVipPromotion === true };
}

/**
 * Badges of a venue card. An older payload without the two flags falls back to the
 * single `vipOnly` flag it carried.
 *
 * @param input - The venue's `promoBadge`, if any.
 * @returns `{ free, vip, windows }`; `windows` feed the «Ahora» swap of «Promo».
 */
export function resolveVenuePromoBadges(input: {
    readonly badge?: VenuePromoBadge;
}): PromotionBadges & { readonly windows: readonly PromotionWindow[] } {
    const { badge } = input;
    if (!badge?.hasPromo) return { free: false, vip: false, windows: [] };
    return {
        free: badge.hasFreePromotion ?? !badge.vipOnly,
        vip: badge.hasVipPromotion ?? badge.vipOnly,
        windows: badge.windows
    };
}
