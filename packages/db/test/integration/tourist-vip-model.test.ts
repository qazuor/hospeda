import { afterAll, describe, expect, it } from 'vitest';
import { touristVipModel } from '../../src/models/subscription/tourist-vip.model.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

describe('TouristVipModel (TEST:B3:28, TEST:B3:37)', () => {
    it('returns no title or cancellable rows for an unrelated user and does not close a missing row', async () => {
        await withTestTransaction(async (tx) => {
            const userId = crypto.randomUUID();
            expect(await touristVipModel.findTitleRows({ userId, tx })).toEqual([]);
            expect(await touristVipModel.findCancellableRows({ userId, tx })).toEqual([]);
            expect(await touristVipModel.findUserIdsWithCancellableVip({ limit: 10, tx })).toEqual(
                []
            );
            expect(
                await touristVipModel.closeCancelledVip({
                    subscriptionId: crypto.randomUUID(),
                    now: new Date(),
                    tx
                })
            ).toBe(false);
        });
    });
});
