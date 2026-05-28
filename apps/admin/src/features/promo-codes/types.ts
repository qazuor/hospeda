/**
 * Promo code discount type
 */
export type DiscountType = 'percentage' | 'fixed';

/**
 * Promo code status (derived client-side from active + expiry)
 */
export type PromoCodeStatus = 'active' | 'expired' | 'inactive';

/**
 * Promo code data structure.
 *
 * Mirrors the API response DTO (`PromoCodeResponseSchema` / the service's
 * `mapDbToPromoCode`). `status` is derived client-side. `description` and
 * `minAmount` are unpacked from the response `metadata` object by the hook.
 */
export interface PromoCode {
    readonly id: string;
    readonly code: string;
    readonly type: DiscountType;
    /** Discount value: percentage (1-100) or fixed amount in cents */
    readonly value: number;
    readonly description: string;
    readonly active: boolean;
    /** ISO date the code stops being valid (null = no expiry) */
    readonly expiresAt: string | null;
    /** ISO date the code starts being valid (null = immediately) */
    readonly validFrom: string | null;
    readonly maxUses: number | null;
    readonly maxUsesPerUser: number | null;
    readonly timesRedeemed: number;
    /** Plan IDs this code is restricted to (empty = all plans) */
    readonly validPlans: readonly string[];
    readonly newCustomersOnly: boolean;
    readonly isStackable: boolean;
    /** Minimum order amount in cents required to use the code (null = none) */
    readonly minAmount: number | null;
    readonly status: PromoCodeStatus;
    readonly createdAt?: string;
}

/**
 * Promo code filters for UI
 */
export interface PromoCodeFilters {
    readonly status?: PromoCodeStatus | 'all';
    readonly type?: DiscountType | 'all';
    readonly search?: string;
    readonly page?: number;
    readonly pageSize?: number;
}

/**
 * Create promo code payload — matches the API request contract
 * (`CreatePromoCodeSchema` in @repo/schemas). The form holds nullable fields
 * for controlled inputs; the hook strips empties before sending.
 */
export interface CreatePromoCodePayload {
    code: string;
    description: string;
    discountType: DiscountType;
    discountValue: number;
    maxUses: number | null;
    maxUsesPerUser: number | null;
    /** ISO date (or null) the code starts being valid */
    validFrom: string | null;
    /** ISO date (or null) the code expires */
    expiryDate: string | null;
    /** Plan IDs this code is restricted to (empty = all plans) */
    planRestrictions: string[];
    isStackable: boolean;
    isActive: boolean;
    firstPurchaseOnly: boolean;
    minAmount: number | null;
}

/**
 * Update promo code payload. Only mutable fields are accepted by the API
 * (`UpdatePromoCodeSchema`): description, expiryDate, maxUses, isActive.
 */
export interface UpdatePromoCodePayload {
    id: string;
    description?: string;
    expiryDate?: string | null;
    maxUses?: number | null;
    isActive?: boolean;
}
