import type { PricingTier, PricingTierIdType } from '@repo/schemas';
import { getMockId } from './utilsFactory';

export function createMockPricingTier(overrides?: Partial<PricingTier>): PricingTier {
    const defaults: PricingTier = {
        id: getMockId('pricingTier', 'pt1') as PricingTierIdType,
        pricingPlanId: getMockId('pricingPlan') as string,
        minQuantity: 1,
        maxQuantity: 10,
        unitPriceMinor: 1000, // $10.00 per unit
        metadata: {},
        lifecycleState: 'ACTIVE',
        adminInfo: null,
        isActive: true,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: getMockId('user') as string,
        updatedById: getMockId('user') as string,
        deletedAt: null,
        deletedById: null
    };
    return { ...defaults, ...overrides };
}
