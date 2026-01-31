/**
 * Owner Promotion Types
 */

export interface OwnerPromotion {
    id: string;
    slug: string;
    ownerId: string;
    accommodationId: string;
    title: string;
    description: string | null;
    discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_NIGHT' | 'SPECIAL_PRICE';
    discountValue: number;
    minNights: number | null;
    validFrom: string;
    validUntil: string;
    maxRedemptions: number | null;
    currentRedemptions: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface OwnerPromotionFilters {
    status?: 'active' | 'inactive';
    discountType?: string;
    page?: number;
    limit?: number;
}

export interface CreateOwnerPromotionInput {
    ownerId: string;
    accommodationId: string;
    title: string;
    description?: string;
    discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_NIGHT' | 'SPECIAL_PRICE';
    discountValue: number;
    minNights?: number;
    validFrom: string;
    validUntil: string;
    maxRedemptions?: number;
    isActive: boolean;
}

export interface UpdateOwnerPromotionInput extends Partial<CreateOwnerPromotionInput> {
    id: string;
}
