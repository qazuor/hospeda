import { subscriptionModel } from '@repo/db';
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
