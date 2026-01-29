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
    FREE_NIGHT = 'free_night'
}
