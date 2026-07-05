/**
 * Re-export shim for backward compatibility.
 * The canonical source has moved to @repo/service-core.
 *
 * @module services/promo-code.service
 * @deprecated Import from '@repo/service-core' instead.
 */
export {
    type CreatePromoCodeInput,
    type DiscountType,
    type ListPromoCodesFilters,
    type PromoCode,
    PromoCodeService,
    type PromoCodeValidationContext,
    type PromoCodeValidationResult,
    type UpdatePromoCodeInput
} from '@repo/service-core';
