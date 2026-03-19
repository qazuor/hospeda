/**
 * Re-export shim for backward compatibility.
 * The canonical source has moved to @repo/service-core.
 *
 * @module services/promo-code.redemption
 * @deprecated Import from '@repo/service-core' instead.
 */
export {
    applyPromoCode,
    incrementPromoCodeUsage,
    recordPromoCodeUsage,
    tryRedeemAtomically,
    type RecordUsageInput
} from '@repo/service-core';
