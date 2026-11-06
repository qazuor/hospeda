import { billingOptions, eq, promoRedemptions, providerLinks, subscriptions } from '@repo/db';
import { PublicationStatusEnum } from '@repo/schemas';
import { PUBLICATION_LIMIT_KEYS } from '@repo/verticals';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { requestPlanChange } from '../../../src/services/billing/subscription/request-plan-change.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    retirePlanChanges,
    seedCoveredPayment,
    seedPlanChange,
    seedPlanChangePromo,
    seedPlanChangePublications,
    seedPlanChangeTargetWithLimit
} from './support/plan-change-fixtures.js';
import { scheduledChangesOf, seedScheduledChange } from './support/scheduled-change-fixtures.js';
import { successionClock } from './support/succession-fixtures.js';

afterEach(retirePlanChanges);
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:7 plan change direction', () => {
    it('TEST:B8b:17 rejects every plan-change choice from grace without provider or database writes', async () => {
        const cases = ['DOWN', 'UP', 'CYCLE', 'SAME'] as const;
        for (const scenario of cases) {
            const seeded = await seedPlanChange({
                status: 'GRACE_PERIOD',
                rankRelation:
                    scenario === 'DOWN' ? 'HIGHER' : scenario === 'UP' ? 'LOWER' : undefined
            });
            if (scenario === 'DOWN' || scenario === 'UP')
                seeded.verticals.setChangeDirection({
                    fromPlanVersionId: seeded.planVersionId,
                    toPlanVersionId: seeded.targetPlanVersionId,
                    direction: scenario
                });
            const targetId =
                scenario === 'SAME'
                    ? seeded.predecessorBillingOptionId
                    : scenario === 'CYCLE'
                      ? ((
                            await getServiceTestDb()
                                .insert(billingOptions)
                                .values({
                                    planVersionId: seeded.planVersionId,
                                    cycle: 'annual',
                                    amount: 2000000,
                                    currency: 'ARS'
                                })
                                .returning({ id: billingOptions.id })
                        )[0]?.id ?? '')
                      : seeded.targetBillingOptionId;
            const authorize = vi.spyOn(seeded.fake, 'authorize');
            const mutate = vi.spyOn(seeded.fake, 'changeAmount');
            const countBefore = await getServiceTestDb()
                .select({ id: subscriptions.id })
                .from(subscriptions)
                .where(eq(subscriptions.userId, seeded.user.id));

            const result = await requestPlanChange(
                { ...seeded.input, billingOptionId: targetId },
                seeded.ports
            );

            const countAfter = await getServiceTestDb()
                .select({ id: subscriptions.id })
                .from(subscriptions)
                .where(eq(subscriptions.userId, seeded.user.id));
            expect(result).toEqual({ path: 'REJECTED', reason: 'GRACE_PERIOD' });
            expect(authorize).not.toHaveBeenCalled();
            expect(mutate).not.toHaveBeenCalled();
            expect(countAfter).toHaveLength(countBefore.length);
            expect(await scheduledChangesOf(seeded.predecessor.id)).toHaveLength(0);
        }
    });

    it('TEST:B8b:17 applies the same DOWN request when the source is ACTIVE', async () => {
        const seeded = await seedPlanChange({ status: 'GRACE_PERIOD', rankRelation: 'HIGHER' });
        seeded.verticals.setChangeDirection({
            fromPlanVersionId: seeded.planVersionId,
            toPlanVersionId: seeded.targetPlanVersionId,
            direction: 'DOWN'
        });
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'ACTIVE' })
            .where(eq(subscriptions.id, seeded.predecessor.id));
        const result = await requestPlanChange(seeded.input, seeded.ports);
        expect(result.path).toBe('DOWNGRADE');
    });

    it('TEST:B8b:17 rejects a MANUAL grace subscription before the same-option result', async () => {
        const seeded = await seedPlanChange({ status: 'GRACE_PERIOD' });
        await getServiceTestDb()
            .update(subscriptions)
            .set({ paymentMethod: 'MANUAL' })
            .where(eq(subscriptions.id, seeded.predecessor.id));
        const mutate = vi.spyOn(seeded.fake, 'changeAmount');
        const result = await requestPlanChange(
            { ...seeded.input, billingOptionId: seeded.predecessorBillingOptionId },
            seeded.ports
        );
        expect(result).toEqual({ path: 'REJECTED', reason: 'GRACE_PERIOD' });
        expect(mutate).not.toHaveBeenCalled();
        expect(await scheduledChangesOf(seeded.predecessor.id)).toHaveLength(0);
    });

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
        expect(result).toMatchObject({
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
        const oldQueue = await seedScheduledChange({
            subscriptionId: seeded.predecessor.id,
            effectiveAt: seeded.nextChargeAt
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
        expect(await scheduledChangesOf(result.subscriptionId)).toHaveLength(0);
        expect(await scheduledChangesOf(seeded.predecessor.id)).toEqual([oldQueue]);
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

    it('TEST:B8b:16 replaces a downgrade and asks again for keep selection', async () => {
        const seeded = await seedPlanChange({ rankRelation: 'HIGHER' });
        const firstTarget = await seedPlanChangeTargetWithLimit({
            sourcePlanVersionId: seeded.planVersionId,
            targetLimit: 2
        });
        seeded.verticals.setPlanPolicy({
            planVersionId: firstTarget.planVersionId,
            policy: { graceDays: 10, allowsPause: false, current: true, sellable: true }
        });
        seeded.verticals.setChangeDirection({
            fromPlanVersionId: seeded.planVersionId,
            toPlanVersionId: firstTarget.planVersionId,
            direction: 'DOWN'
        });
        const listingIds = await seedPlanChangePublications({
            userId: seeded.user.id,
            statuses: [
                PublicationStatusEnum.PUBLISHED,
                PublicationStatusEnum.PUBLISHED,
                PublicationStatusEnum.PUBLISHED
            ]
        });
        await seedScheduledChange({
            subscriptionId: seeded.predecessor.id,
            effectiveAt: seeded.nextChargeAt,
            keepSelection: { [PUBLICATION_LIMIT_KEYS.accommodation]: ['old-choice'] }
        });
        const promo = await seedPlanChangePromo({
            subscriptionId: seeded.predecessor.id,
            userId: seeded.user.id
        });
        const second = await seedPlanChangeTargetWithLimit({
            sourcePlanVersionId: seeded.planVersionId,
            targetLimit: 2,
            amountMinor: 600000
        });
        seeded.verticals.setPlanPolicy({
            planVersionId: second.planVersionId,
            policy: { graceDays: 10, allowsPause: false, current: true, sellable: true }
        });
        seeded.verticals.setChangeDirection({
            fromPlanVersionId: seeded.planVersionId,
            toPlanVersionId: second.planVersionId,
            direction: 'DOWN'
        });
        const mutate = vi.spyOn(seeded.fake, 'changeAmount');
        const result = await requestPlanChange(
            { ...seeded.input, billingOptionId: firstTarget.billingOptionId },
            seeded.ports
        );
        const queue = await scheduledChangesOf(seeded.predecessor.id);
        const authorization = await seeded.fake.readAuthorization({
            authorizationId: seeded.started.authorizationId
        });
        const [redemption] = await getServiceTestDb()
            .select()
            .from(promoRedemptions)
            .where(eq(promoRedemptions.id, promo.id));
        expect(result).toMatchObject({
            path: 'DOWNGRADE',
            effectiveAt: seeded.nextChargeAt,
            amountMinor: firstTarget.amountMinor,
            replaced: true
        });
        expect(mutate).toHaveBeenCalledTimes(1);
        expect(authorization.snapshot.amount).toEqual({
            amountMinor: firstTarget.amountMinor,
            currency: 'ARS'
        });
        expect(queue).toHaveLength(1);
        expect(queue[0]).toMatchObject({
            targetPlanVersionId: firstTarget.planVersionId,
            targetBillingOptionId: firstTarget.billingOptionId,
            keepSelection: null
        });
        expect(redemption?.remainingCharges).toBe(0);
        const selected = { [PUBLICATION_LIMIT_KEYS.accommodation]: [listingIds[2]!] };
        const selectedResult = await requestPlanChange(
            {
                ...seeded.input,
                billingOptionId: second.billingOptionId,
                keepSelection: selected
            },
            seeded.ports
        );
        expect(selectedResult).toMatchObject({ path: 'DOWNGRADE', replaced: true });
        expect((await scheduledChangesOf(seeded.predecessor.id))[0]?.keepSelection).toEqual(
            selected
        );
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
