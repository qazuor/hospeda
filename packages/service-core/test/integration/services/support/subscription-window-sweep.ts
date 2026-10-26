import { subscriptionModel, touristVipModel } from '@repo/db';
import { vi } from 'vitest';

/** IDs of subscriptions created by the current integration test. */
export const seededSubscriptionIds = new Set<string>();

/**
 * Runs an authorization-window sweep using the production selector while
 * restricting its candidates to subscriptions seeded by the current test.
 */
export async function withSeededSubscriptionSweep<T>(
    limit: number,
    run: () => Promise<T>
): Promise<T> {
    const original = subscriptionModel.findExpiredAuthorizationWindows;
    const findExpired = vi.spyOn(subscriptionModel, 'findExpiredAuthorizationWindows');
    findExpired.mockImplementation(async (input) => {
        if (seededSubscriptionIds.size === 0) return [];
        const rows = await original({ ...input, limit: 10_000 });
        return rows.filter((row) => seededSubscriptionIds.has(row.subscription.id)).slice(0, limit);
    });
    try {
        return await run();
    } finally {
        findExpired.mockRestore();
    }
}

/** Runs the inherited-VIP retry sweep for subscriptions seeded by this test. */
export async function withSeededInheritedTouristVipSweep<T>(run: () => Promise<T>): Promise<T> {
    const original = touristVipModel.findUserIdsWithCancellableVip;
    const findUserIds = vi.spyOn(touristVipModel, 'findUserIdsWithCancellableVip');
    findUserIds.mockImplementation(async (input) => {
        if (seededSubscriptionIds.size === 0) return [];
        const userIds = await original({ ...input, limit: 10_000 });
        const seededUserIds = await Promise.all(
            userIds.map(async (userId) => {
                const rows = await touristVipModel.findCancellableRows({ userId });
                return rows.some((row) => seededSubscriptionIds.has(row.subscription.id))
                    ? userId
                    : null;
            })
        );
        return seededUserIds
            .filter((userId): userId is string => userId !== null)
            .slice(0, input.limit);
    });
    try {
        return await run();
    } finally {
        findUserIds.mockRestore();
    }
}
