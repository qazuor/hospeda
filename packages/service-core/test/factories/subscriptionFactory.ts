import type {
    ClientIdType,
    PricingPlanIdType,
    Subscription,
    SubscriptionIdType
} from '@repo/schemas';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { getMockId } from './utilsFactory';

/**
 * Factory para crear subscriptions mock para testing
 */
export function createMockSubscription(overrides?: Partial<Subscription>): Subscription {
    const now = new Date();
    const startAt = new Date();
    const endAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    const defaults: Subscription = {
        id: getMockId('subscription', 's1') as SubscriptionIdType,
        clientId: getMockId('client', 'c1') as ClientIdType,
        pricingPlanId: getMockId('pricingPlan', 'pp1') as PricingPlanIdType,
        status: SubscriptionStatusEnum.ACTIVE,
        startAt,
        endAt,
        trialEndsAt: null,

        // Lifecycle state
        lifecycleState: 'published',

        // Base audit fields
        createdAt: now,
        updatedAt: now,
        createdById: getMockId('user') as string,
        updatedById: getMockId('user') as string,
        deletedAt: null,
        deletedById: null,

        // Admin info
        adminInfo: null
    };

    return { ...defaults, ...overrides };
}

/**
 * Factory para crear múltiples subscriptions
 */
export function createMockSubscriptions(
    count: number,
    overrides?: Partial<Subscription>
): Subscription[] {
    return Array.from({ length: count }, (_, i) =>
        createMockSubscription({
            ...overrides,
            id: getMockId('subscription', `s${i + 1}`) as SubscriptionIdType
        })
    );
}
