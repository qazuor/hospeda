/**
 * Owner promotion discount type enum
 * Defines the types of discounts that can be offered in owner promotions
 */
export enum OwnerPromotionDiscountTypeEnum {
    /** Percentage-based discount (e.g., 20% off) */
    PERCENTAGE = 'percentage',
    /** Fixed amount discount (e.g., $50 off) */
    FIXED = 'fixed',
    /** Free night offered (e.g., stay 3 nights, get 1 free) */
    FREE_NIGHT = 'free_night',
    /**
     * Free-text benefit of a venue (e.g. "2x1 on drinks", "free dessert", HOS-2270).
     * The text lives in `description` and goes through content moderation;
     * `discountValue` stays 0. Venue-only: accommodations never offer it.
     */
    SPECIAL_OFFER = 'special_offer'
}

/**
 * Benefit types an ACCOMMODATION promotion may use. The accommodation form and
 * validation read this list, so `special_offer` never shows up there (HOS-2270 AC-21).
 */
export const ACCOMMODATION_PROMOTION_DISCOUNT_TYPES = [
    OwnerPromotionDiscountTypeEnum.PERCENTAGE,
    OwnerPromotionDiscountTypeEnum.FIXED,
    OwnerPromotionDiscountTypeEnum.FREE_NIGHT
] as const;

/**
 * Benefit types a VENUE promotion may use. `free_night` makes no sense for a
 * venue, and there is no `minNights` either (HOS-2270).
 */
export const VENUE_PROMOTION_DISCOUNT_TYPES = [
    OwnerPromotionDiscountTypeEnum.PERCENTAGE,
    OwnerPromotionDiscountTypeEnum.FIXED,
    OwnerPromotionDiscountTypeEnum.SPECIAL_OFFER
] as const;
