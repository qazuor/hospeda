import { LifecycleStatusEnum, type PricingTier, type PricingTierId } from '@repo/schemas';
import { getMockId } from './utilsFactory';

export function createMockPricingTier(overrides?: Partial<PricingTier>): PricingTier {
    const defaults: PricingTier = {
        id: getMockId('pricingTier', 'pt1') as PricingTierId,
        pricingPlanId: getMockId('pricingPlan') as string,
        minQuantity: 1,
        maxQuantity: 10,
        unitPriceMinor: 1000, // $10.00 per unit
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        adminInfo: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: getMockId('user') as string | null,
        updatedById: getMockId('user') as string | null,
        deletedAt: null,
        deletedById: null
    };
    return { ...defaults, ...overrides };
}
