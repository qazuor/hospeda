import { describe, expect, it, vi } from 'vitest';
import { SubscriptionModel } from '../../src/models/subscription/subscription.model.ts';
import type { DrizzleClient } from '../../src/types.ts';

function fakeDb(rows: readonly { readonly id: string }[]) {
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));
    return { db: { select } as unknown as DrizzleClient, select, from, where, limit };
}

describe('SubscriptionModel.existsAnyForUser', () => {
    it('returns true when any history row exists', async () => {
        const { db, select, from, where, limit } = fakeDb([{ id: 'subscription-1' }]);
        const model = new SubscriptionModel();
        await expect(
            model.existsAnyForUser({ userId: 'user-1', vertical: 'accommodation', tx: db })
        ).resolves.toBe(true);
        expect(select).toHaveBeenCalledTimes(1);
        expect(from).toHaveBeenCalledTimes(1);
        expect(where).toHaveBeenCalledTimes(1);
        expect(limit).toHaveBeenCalledWith(1);
    });

    it('returns false when the user has no history rows', async () => {
        const { db } = fakeDb([]);
        await expect(
            new SubscriptionModel().existsAnyForUser({
                userId: 'user-1',
                vertical: 'accommodation',
                tx: db
            })
        ).resolves.toBe(false);
    });
});
