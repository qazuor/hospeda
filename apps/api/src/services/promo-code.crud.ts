/**
 * Re-export shim for backward compatibility.
 * The canonical source has moved to @repo/service-core.
 *
 * @module services/promo-code.crud
 * @deprecated Import from '@repo/service-core' instead.
 */
export {
    createPromoCode,
    deletePromoCode,
    getPromoCodeByCode,
    getPromoCodeById,
    listPromoCodes,
    mapDbToPromoCode,
    updatePromoCode
} from '@repo/service-core';
