import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { discardScheduledChange } from '../../../src/services/billing/subscription/scheduled-change-discard.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { retirePlanChanges, seedPlanChange } from './support/plan-change-fixtures.js';
import { scheduledChangesOf, seedScheduledChange } from './support/scheduled-change-fixtures.js';

afterEach(retirePlanChanges);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:16 scheduled change discard', () => {
    it('deletes exactly the target subscription queue with the caller transaction', async () => {
        const seeded = await seedPlanChange({});
        const other = await seedPlanChange({});
        await seedScheduledChange({
            subscriptionId: seeded.predecessor.id,
            effectiveAt: seeded.nextChargeAt
        });
        const otherChange = await seedScheduledChange({
            subscriptionId: other.predecessor.id,
            effectiveAt: other.nextChargeAt
        });
        const result = await getServiceTestDb().transaction((tx) =>
            discardScheduledChange({ subscriptionId: seeded.predecessor.id, tx })
        );
        expect(result).toEqual({ discarded: true });
        expect(await scheduledChangesOf(seeded.predecessor.id)).toHaveLength(0);
        expect(await scheduledChangesOf(other.predecessor.id)).toEqual([otherChange]);
    });

    it('reports an empty queue without changing another subscription', async () => {
        const seeded = await seedPlanChange({});
        const result = await getServiceTestDb().transaction((tx) =>
            discardScheduledChange({ subscriptionId: seeded.predecessor.id, tx })
        );
        expect(result).toEqual({ discarded: false });
        expect(await scheduledChangesOf(seeded.predecessor.id)).toHaveLength(0);
    });
});
