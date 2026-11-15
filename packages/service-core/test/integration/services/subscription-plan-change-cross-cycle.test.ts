import { eq, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { requestPlanChange } from '../../../src/services/billing/subscription/request-plan-change.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { retirePlanChanges, seedPlanChange } from './support/plan-change-fixtures.js';
import { scheduledChangesOf } from './support/scheduled-change-fixtures.js';

afterEach(retirePlanChanges);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:27 D1-(b) cross-cycle plan change', () => {
    it('routes an annual-to-monthly DOWN through succession, preserving the predecessor authorization', async () => {
        const seeded = await seedPlanChange({
            rankRelation: 'HIGHER',
            sourceCycle: 'annual',
            targetCycle: 'monthly'
        });
        seeded.verticals.setChangeDirection({
            fromPlanVersionId: seeded.planVersionId,
            toPlanVersionId: seeded.targetPlanVersionId,
            direction: 'DOWN'
        });
        const before = await seeded.fake.readAuthorization({
            authorizationId: seeded.started.authorizationId
        });
        const changeAmount = vi.spyOn(seeded.fake, 'changeAmount');
        const result = await requestPlanChange(seeded.input, seeded.ports);
        const after = await seeded.fake.readAuthorization({
            authorizationId: seeded.started.authorizationId
        });
        expect(result.path).toBe('SUCCESSION');
        if (result.path !== 'SUCCESSION') throw new Error('Expected successor');
        const [successor] = await getServiceTestDb()
            .select({ succeedsId: subscriptions.succeedsId })
            .from(subscriptions)
            .where(eq(subscriptions.id, result.subscriptionId));
        expect(successor?.succeedsId).toBe(seeded.predecessor.id);
        expect(await scheduledChangesOf(seeded.predecessor.id)).toHaveLength(0);
        expect(after.snapshot.amount).toEqual(before.snapshot.amount);
        expect(after.snapshot.cadence).toEqual(before.snapshot.cadence);
        expect(changeAmount).toHaveBeenCalledTimes(0);
    });

    it('keeps same-cycle DOWN in the queue and sends only the amount', async () => {
        const seeded = await seedPlanChange({
            rankRelation: 'HIGHER',
            sourceCycle: 'monthly',
            targetCycle: 'monthly'
        });
        seeded.verticals.setChangeDirection({
            fromPlanVersionId: seeded.planVersionId,
            toPlanVersionId: seeded.targetPlanVersionId,
            direction: 'DOWN'
        });
        const before = await seeded.fake.readAuthorization({
            authorizationId: seeded.started.authorizationId
        });
        const changeAmount = vi.spyOn(seeded.fake, 'changeAmount');
        const result = await requestPlanChange(seeded.input, seeded.ports);
        const after = await seeded.fake.readAuthorization({
            authorizationId: seeded.started.authorizationId
        });
        expect(result.path).toBe('DOWNGRADE');
        expect(await scheduledChangesOf(seeded.predecessor.id)).toHaveLength(1);
        expect(after.snapshot.amount).toEqual({ amountMinor: 500000, currency: 'ARS' });
        expect(after.snapshot.cadence).toEqual(before.snapshot.cadence);
        expect(changeAmount).toHaveBeenCalledWith({
            authorizationId: seeded.started.authorizationId,
            amount: { amountMinor: 500000, currency: 'ARS' }
        });
    });
});
