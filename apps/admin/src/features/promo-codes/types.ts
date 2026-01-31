/**
 * Promo code discount type
 */
export type DiscountType = 'percentage' | 'fixed';

/**
 * Promo code status
 */
export type PromoCodeStatus = 'active' | 'expired' | 'inactive';

/**
 * Plan category for promo code restrictions
 */
export type PlanCategory = 'owner' | 'complex' | 'tourist';

/**
 * Promo code data structure
 */
export interface PromoCode {
    readonly id: string;
    readonly code: string;
    readonly description: string;
    readonly type: DiscountType;
    readonly discountValue: number;
    readonly maxUses: number | null;
    readonly maxUsesPerUser: number | null;
    readonly usedCount: number;
    readonly validFrom: Date;
    readonly validUntil: Date | null;
    readonly applicablePlans: ReadonlyArray<PlanCategory>;
    readonly isStackable: boolean;
    readonly isActive: boolean;
    readonly requiresFirstPurchase: boolean;
    readonly minimumAmount: number | null;
    readonly status: PromoCodeStatus;
    readonly createdAt?: Date;
    readonly updatedAt?: Date;
}

/**
 * Promo code filters for UI
 */
export interface PromoCodeFilters {
    status?: PromoCodeStatus | 'all';
    type?: DiscountType | 'all';
    search?: string;
    page?: number;
    limit?: number;
}

/**
 * Create promo code payload
 */
export interface CreatePromoCodePayload {
    code: string;
    description: string;
    type: DiscountType;
    discountValue: number;
    maxUses: number | null;
    maxUsesPerUser: number | null;
    validFrom: Date;
    validUntil: Date | null;
    applicablePlans: PlanCategory[];
    isStackable: boolean;
    isActive: boolean;
    requiresFirstPurchase: boolean;
    minimumAmount: number | null;
}

/**
 * Update promo code payload
 */
export interface UpdatePromoCodePayload extends Partial<CreatePromoCodePayload> {
    id: string;
}
