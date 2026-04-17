/**
 * Owner Promotion Types
 */

import type { LifecycleStatusEnum } from '@repo/schemas';

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
    lifecycleState: LifecycleStatusEnum;
    createdAt: string;
    updatedAt: string;
}

export interface OwnerPromotionFilters {
    lifecycleState?: LifecycleStatusEnum;
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
    lifecycleState: LifecycleStatusEnum;
}

export interface UpdateOwnerPromotionInput extends Partial<CreateOwnerPromotionInput> {
    id: string;
}
