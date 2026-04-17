import type {
    AccommodationIdType,
    OwnerPromotion,
    OwnerPromotionCreateInput,
    OwnerPromotionIdType,
    UserIdType
} from '@repo/schemas';
import { LifecycleStatusEnum, OwnerPromotionDiscountTypeEnum } from '@repo/schemas';
import { getMockId } from './utilsFactory';

export class OwnerPromotionFactoryBuilder {
    private promotion: Partial<OwnerPromotion> = {};

    with(fields: Partial<OwnerPromotion>): this {
        Object.assign(this.promotion, fields);
        return this;
    }

    build(): OwnerPromotion {
        return {
            id: getMockId('ownerPromotion') as OwnerPromotionIdType,
            slug: 'test-promotion',
            ownerId: getMockId('user') as UserIdType,
            accommodationId: getMockId('accommodation') as AccommodationIdType,
            title: 'Test Promotion',
            description: 'A valid promotion description',
            discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
            discountValue: 20,
            minNights: 2,
            validFrom: new Date(),
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            maxRedemptions: 100,
            currentRedemptions: 0,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: getMockId('user') as UserIdType,
            updatedById: getMockId('user') as UserIdType,
            deletedAt: undefined,
            deletedById: undefined,
            ...this.promotion
        };
    }
}

export const createMockOwnerPromotion = (fields: Partial<OwnerPromotion> = {}): OwnerPromotion =>
    new OwnerPromotionFactoryBuilder().with(fields).build();

/**
 * Factory for a valid OwnerPromotionCreateInput (only user-provided fields)
 */
export const createMockOwnerPromotionCreateInput = (
    overrides: Partial<OwnerPromotionCreateInput> = {}
): OwnerPromotionCreateInput => {
    return {
        ownerId: getMockId('user') as UserIdType,
        accommodationId: getMockId('accommodation') as AccommodationIdType,
        title: 'Test Promotion',
        description: 'A valid promotion description',
        discountType: OwnerPromotionDiscountTypeEnum.PERCENTAGE,
        discountValue: 20,
        minNights: 2,
        validFrom: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        maxRedemptions: 100,
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        ...overrides
    };
};

export const getMockOwnerPromotionId = (id?: string): OwnerPromotionIdType =>
    getMockId('ownerPromotion', id) as OwnerPromotionIdType;
