import { billingOptions, eq, promoRedemptions, providerLinks, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { requestPlanChange } from '../../../src/services/billing/subscription/request-plan-change.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    retirePlanChanges,
    seedCoveredPayment,
    seedPlanChange,
    seedPlanChangePromo
} from './support/plan-change-fixtures.js';
import { scheduledChangesOf, seedScheduledChange } from './support/scheduled-change-fixtures.js';
import { successionClock } from './support/succession-fixtures.js';

afterEach(retirePlanChanges);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:7 plan change direction', () => {
    it('(a) follows DOWN for a higher rank, mutates list amount and queues the capability drop', async () => {
        const seeded = await seedPlanChange({ rankRelation: 'HIGHER' });
        seeded.verticals.setChangeDirection({
            fromPlanVersionId: seeded.planVersionId,
            toPlanVersionId: seeded.targetPlanVersionId,
            direction: 'DOWN'
        });
        const promo = await seedPlanChangePromo({
            subscriptionId: seeded.predecessor.id,
            userId: seeded.user.id
        });
        const mutate = vi.spyOn(seeded.fake, 'changeAmount');

        const result = await requestPlanChange(seeded.input, seeded.ports);

        const authorization = await seeded.fake.readAuthorization({
            authorizationId: seeded.started.authorizationId
        });
        const queue = await scheduledChangesOf(seeded.predecessor.id);
        const [row] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.predecessor.id));
        const [redemption] = await getServiceTestDb()
            .select()
            .from(promoRedemptions)
            .where(eq(promoRedemptions.id, promo.id));
        expect(result).toEqual({
            path: 'DOWNGRADE',
            effectiveAt: seeded.nextChargeAt,
            amountMinor: 500000
        });
        expect(mutate).toHaveBeenCalledTimes(1);
        expect(authorization.snapshot.amount).toEqual({ amountMinor: 500000, currency: 'ARS' });
        expect(queue).toHaveLength(1);
        expect(queue[0]).toMatchObject({
            subscriptionId: seeded.predecessor.id,
            targetPlanVersionId: seeded.targetPlanVersionId,
            targetBillingOptionId: seeded.targetBillingOptionId,
            effectiveAt: seeded.nextChargeAt
        });
        expect(row?.planVersionId).toBe(seeded.planVersionId);
        expect(row?.billingOptionId).toBe(seeded.predecessorBillingOptionId);
        expect(redemption?.remainingCharges).toBe(0);
    });

    it('(b) follows UP for a lower rank and defers the new charge by exact value credit', async () => {
        const seeded = await seedPlanChange({ rankRelation: 'LOWER' });
        seeded.verticals.setChangeDirection({
            fromPlanVersionId: seeded.planVersionId,
            toPlanVersionId: seeded.targetPlanVersionId,
            direction: 'UP'
        });
        await seedCoveredPayment({ subscriptionId: seeded.predecessor.id, amountMinor: 250000 });
        const mutate = vi.spyOn(seeded.fake, 'changeAmount');

        const result = await requestPlanChange(seeded.input, seeded.ports);

        expect(result.path).toBe('SUCCESSION');
        if (result.path !== 'SUCCESSION') throw new Error('Expected successor');
        const [successor] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, result.subscriptionId));
        const [predecessor] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.predecessor.id));
        const [link] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, result.subscriptionId));
        if (!link) throw new Error('Successor authorization missing');
        const authorization = await seeded.fake.readAuthorization({
            authorizationId: link.providerId
        });
        // 250000 * (21/31) unused, at 500000/31 per target day: ceil(10.5) = 11 days.
        const expected = new Date(successionClock.now().getTime() + 11 * 86400000);
        expect(result.creditDays).toBe(11);
        expect(successor).toMatchObject({
            status: 'PENDING_AUTHORIZATION',
            succeedsId: seeded.predecessor.id,
            firstChargeAt: expected
        });
        expect(successor?.firstChargeAt?.getTime()).toBeGreaterThan(
            successor?.authorizationWindowEndsAt?.getTime() ?? Infinity
        );
        expect(result.firstChargeAt).toEqual(expected);
        expect(authorization.snapshot.firstChargeAt).toBe(expected.toISOString());
        expect(predecessor?.status).toBe('ACTIVE');
        expect(mutate).toHaveBeenCalledTimes(0);
    });

    it('(c) changes cycle without consulting the unprogrammed direction simulator', async () => {
        const seeded = await seedPlanChange({});
        const [annual] = await getServiceTestDb()
            .insert(billingOptions)
            .values({
                planVersionId: seeded.planVersionId,
                cycle: 'annual',
                amount: 2000000,
                currency: 'ARS'
            })
            .returning();
        if (!annual) throw new Error('Annual option missing');
        const result = await requestPlanChange(
            { ...seeded.input, billingOptionId: annual.id },
            seeded.ports
        );
        expect(result.path).toBe('SUCCESSION');
    });

    it('(d) rejects the same option without provider or queue writes', async () => {
        const seeded = await seedPlanChange({});
        const mutate = vi.spyOn(seeded.fake, 'changeAmount');
        const result = await requestPlanChange(
            { ...seeded.input, billingOptionId: seeded.predecessorBillingOptionId },
            seeded.ports
        );
        expect(result).toEqual({ path: 'REJECTED', reason: 'NO_CHANGE' });
        expect(mutate).toHaveBeenCalledTimes(0);
        expect(await scheduledChangesOf(seeded.predecessor.id)).toHaveLength(0);
    });

    it('(e) preserves an existing queue and does not mutate the amount', async () => {
        const seeded = await seedPlanChange({ rankRelation: 'HIGHER' });
        seeded.verticals.setChangeDirection({
            fromPlanVersionId: seeded.planVersionId,
            toPlanVersionId: seeded.targetPlanVersionId,
            direction: 'DOWN'
        });
        const existing = await seedScheduledChange({
            subscriptionId: seeded.predecessor.id,
            effectiveAt: seeded.nextChargeAt
        });
        const mutate = vi.spyOn(seeded.fake, 'changeAmount');
        const result = await requestPlanChange(seeded.input, seeded.ports);
        expect(result).toEqual({ path: 'REJECTED', reason: 'SCHEDULED_CHANGE_EXISTS' });
        expect(mutate).toHaveBeenCalledTimes(0);
        expect(await scheduledChangesOf(seeded.predecessor.id)).toEqual([existing]);
    });

    it('(f) rejects a DOWN request while paused', async () => {
        const seeded = await seedPlanChange({ status: 'PAUSED', rankRelation: 'HIGHER' });
        seeded.verticals.setChangeDirection({
            fromPlanVersionId: seeded.planVersionId,
            toPlanVersionId: seeded.targetPlanVersionId,
            direction: 'DOWN'
        });
        const mutate = vi.spyOn(seeded.fake, 'changeAmount');
        const result = await requestPlanChange(seeded.input, seeded.ports);
        expect(result).toEqual({ path: 'REJECTED', reason: 'NOT_ACTIVE' });
        expect(mutate).toHaveBeenCalledTimes(0);
        expect(await scheduledChangesOf(seeded.predecessor.id)).toHaveLength(0);
    });

    it('(g) uses B3 default schedule without a covered period', async () => {
        const seeded = await seedPlanChange({ rankRelation: 'LOWER' });
        seeded.verticals.setChangeDirection({
            fromPlanVersionId: seeded.planVersionId,
            toPlanVersionId: seeded.targetPlanVersionId,
            direction: 'UP'
        });
        const result = await requestPlanChange(seeded.input, seeded.ports);
        expect(result.path).toBe('SUCCESSION');
        if (result.path !== 'SUCCESSION') throw new Error('Expected successor');
        const [row] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, result.subscriptionId));
        expect(result.creditDays).toBe(0);
        expect(row?.firstChargeAt?.getTime()).toBe(
            (row?.authorizationWindowEndsAt?.getTime() ?? 0) + 86400000
        );
    });

    it('(h) keeps the suspended and confirmed-cancelled exception at birth', async () => {
        const seeded = await seedPlanChange({
            status: 'SUSPENDED',
            providerState: 'cancelled',
            rankRelation: 'LOWER'
        });
        seeded.verticals.setChangeDirection({
            fromPlanVersionId: seeded.planVersionId,
            toPlanVersionId: seeded.targetPlanVersionId,
            direction: 'UP'
        });
        await seedCoveredPayment({ subscriptionId: seeded.predecessor.id, amountMinor: 250000 });
        const result = await requestPlanChange(seeded.input, seeded.ports);
        expect(result.path).toBe('SUCCESSION');
        if (result.path !== 'SUCCESSION') throw new Error('Expected successor');
        expect(result.firstChargeAt).toEqual(successionClock.now());
        expect(result.creditDays).toBe(0);
    });
});
