import type { PricingPlan, PricingPlanIdType } from '@repo/schemas';
import { BillingIntervalEnum, BillingSchemeEnum } from '@repo/schemas';
import { getMockId } from './utilsFactory';

export function createMockPricingPlan(overrides?: Partial<PricingPlan>): PricingPlan {
    const defaults: PricingPlan = {
        id: getMockId('pricingPlan', 'pp1') as PricingPlanIdType,
        productId: getMockId('product') as string,
        billingScheme: BillingSchemeEnum.RECURRING,
        interval: BillingIntervalEnum.MONTH,
        amountMinor: 10000, // $100.00
        currency: 'ARS',
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

export function createMockPricingPlans(
    count: number,
    overrides?: Partial<PricingPlan>
): PricingPlan[] {
    return Array.from({ length: count }, (_, i) =>
        createMockPricingPlan({
            ...overrides,
            id: getMockId('pricingPlan', `pp${i + 1}`) as PricingPlanIdType,
            amountMinor: 10000 * (i + 1)
        })
    );
}
