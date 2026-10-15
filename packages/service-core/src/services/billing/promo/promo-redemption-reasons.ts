/**
 * Discarded-reason constants for promo redemption rejections. Values are stable,
 * short, UPPER_SNAKE_CASE strings that map 1:1 to HTTP 4xx bodies in the API layer.
 */
export const PromoRedemptionReason = {
    PROMO_CODE_NOT_FOUND: 'PROMO_CODE_NOT_FOUND',
    PROMO_CODE_NOT_A_TRIAL_EXTENSION: 'PROMO_CODE_NOT_A_TRIAL_EXTENSION',
    PROMO_CODE_NOT_FOR_VERTICAL: 'PROMO_CODE_NOT_FOR_VERTICAL',
    PROMO_NO_ELIGIBLE_SUBSCRIPTION: 'PROMO_NO_ELIGIBLE_SUBSCRIPTION',
    PROMO_NOT_OFFERED_TO_MANUAL_PAYER: 'PROMO_NOT_OFFERED_TO_MANUAL_PAYER',
    PROMO_CODE_ALREADY_REDEEMED: 'PROMO_CODE_ALREADY_REDEEMED',
    PROMO_NOT_COMBINABLE: 'PROMO_NOT_COMBINABLE',
    PROMO_UNSUPPORTED_CURRENCY: 'PROMO_UNSUPPORTED_CURRENCY',
    PROMO_BELOW_PROVIDER_MINIMUM: 'PROMO_BELOW_PROVIDER_MINIMUM',
    PROMO_MUTATION_NOT_APPLIED: 'PROMO_MUTATION_NOT_APPLIED',
    NO_TRIAL: 'NO_TRIAL',
    TRIAL_ENDED: 'TRIAL_ENDED',
    CEILING_REACHED: 'CEILING_REACHED',
    REDEMPTION_KEY_CONFLICT: 'REDEMPTION_KEY_CONFLICT'
} as const;

/**
 * A discriminated union of all promo redemption rejection reason codes.
 * Derived from `PromoRedemptionReason` to preserve exhaustiveness across the codebase.
 */
export type PromoRedemptionReason =
    (typeof PromoRedemptionReason)[keyof typeof PromoRedemptionReason];
