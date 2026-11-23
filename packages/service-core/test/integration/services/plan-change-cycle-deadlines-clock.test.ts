import { eq, sql, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { readCycleDeadlines } from '../../../src/services/billing/subscription/plan-change-cycle-deadlines.js';
import {
    closeServiceTestPool,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers.js';
import { retirePlanChanges, seedPlanChange } from './support/plan-change-fixtures.js';

afterEach(retirePlanChanges);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:HOS-2174 plan change cycle deadlines', () => {
    it('stamps the renewal clock with the injected instant, not the system time', async () => {
        const seeded = await seedPlanChange({
            nextChargeAt: new Date('2026-10-12T15:00:00.000Z')
        });
        // A far-past instant the system clock cannot produce during this run.
        const injected = new Date('2019-01-02T03:04:05.000Z');
        const clock = { now: vi.fn(() => injected) };

        await withServiceTestTransaction(async (tx) => {
            // The database owns `updated_at` through the `set_updated_at` trigger
            // (extras 002). Disable it inside this rolled-back transaction so the value
            // readCycleDeadlines writes is observable; without this the trigger would
            // overwrite it with NOW() and hide the system-clock bug.
            await tx.execute(
                sql`ALTER TABLE subscription DISABLE TRIGGER trg_set_updated_at_subscription`
            );
            const result = await readCycleDeadlines({
                tx,
                subscriptionId: seeded.predecessor.id,
                clock
            });
            expect(result.stamped).toBe(true);
            expect(clock.now).toHaveBeenCalled();
            const [row] = await tx
                .select({
                    updatedAt: subscriptions.updatedAt,
                    chargeAt: subscriptions.renewalNoticeChargeAt
                })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.predecessor.id));
            expect(row?.updatedAt).toEqual(injected);
            expect(row?.chargeAt).toEqual(new Date('2026-10-12T15:00:00.000Z'));
        });
    });
});
