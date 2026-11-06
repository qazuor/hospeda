import { eq, planMigrationSubscriptions, promoRedemptions, subscriptions } from '@repo/db';
import { PublicationStatusEnum } from '@repo/schemas';
import { PUBLICATION_LIMIT_KEYS } from '@repo/verticals';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { applyScheduledChangeInTx } from '../../../src/services/billing/subscription/apply-scheduled-change.service.js';
import { pauseSubscription } from '../../../src/services/billing/subscription/pause-subscription.service.js';
import { requestPlanChange } from '../../../src/services/billing/subscription/request-plan-change.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    adjustablePauseHarness,
    pausePlanPolicy,
    retirePauseRows,
    seedPausePrincipal
} from './support/pause-fixtures.js';
import {
    retirePlanChanges,
    seedAdditionalPlanChangeTarget,
    seedPlanChange,
    seedPlanChangePromo,
    seedPlanChangePublications,
    seedPlanChangeTargetWithLimit,
    seedSiblingPlanChangeSubscription
} from './support/plan-change-fixtures.js';
import { retirePriceIncreases, seedPriceIncrease } from './support/price-increase-fixtures.js';
import {
    deleteScheduledChanges,
    scheduledChangesOf,
    seedScheduledChange
} from './support/scheduled-change-fixtures.js';

const pausedQueueIds: string[] = [];

afterEach(async () => {
    await retirePriceIncreases();
    await deleteScheduledChanges(pausedQueueIds.splice(0));
    await retirePauseRows();
    await retirePlanChanges();
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B8b:16 scheduled change collisions', () => {
    it('TEST:B8b:16 rejects foreign and non-published keep ids before provider or queue writes', async () => {
        const seeded = await seedPlanChange({ rankRelation: 'HIGHER' });
        const target = await seedPlanChangeTargetWithLimit({
            sourcePlanVersionId: seeded.planVersionId,
            targetLimit: 1
        });
        seeded.verticals.setPlanPolicy({
            planVersionId: target.planVersionId,
            policy: { graceDays: 10, allowsPause: false, current: true, sellable: true }
        });
        seeded.verticals.setChangeDirection({
            fromPlanVersionId: seeded.planVersionId,
            toPlanVersionId: target.planVersionId,
            direction: 'DOWN'
        });
        const ids = await seedPlanChangePublications({
            userId: seeded.user.id,
            statuses: [PublicationStatusEnum.PUBLISHED, PublicationStatusEnum.DRAFT]
        });
        const mutate = vi.spyOn(seeded.fake, 'changeAmount');
        const foreign = await requestPlanChange(
            {
                ...seeded.input,
                billingOptionId: target.billingOptionId,
                keepSelection: { [PUBLICATION_LIMIT_KEYS.accommodation]: ['foreign-listing'] }
            },
            seeded.ports
        );
        const draft = await requestPlanChange(
            {
                ...seeded.input,
                billingOptionId: target.billingOptionId,
                keepSelection: { [PUBLICATION_LIMIT_KEYS.accommodation]: [ids[1]!] }
            },
            seeded.ports
        );
        expect(foreign).toEqual({ path: 'REJECTED', reason: 'KEEP_SELECTION_INVALID' });
        expect(draft).toEqual({ path: 'REJECTED', reason: 'KEEP_SELECTION_INVALID' });
        expect(mutate).toHaveBeenCalledTimes(0);
        expect(await scheduledChangesOf(seeded.predecessor.id)).toHaveLength(0);
    });

    it('(a) ends the row promo with the requested amount mutation', async () => {
        const seeded = await seedPlanChange({ rankRelation: 'HIGHER' });
        seeded.verticals.setChangeDirection({
            fromPlanVersionId: seeded.planVersionId,
            toPlanVersionId: seeded.targetPlanVersionId,
            direction: 'DOWN'
        });
        const redemption = await seedPlanChangePromo({
            subscriptionId: seeded.predecessor.id,
            userId: seeded.user.id
        });
        const sibling = await seedSiblingPlanChangeSubscription({
            userId: seeded.user.id
        });
        const otherPromo = await seedPlanChangePromo({
            subscriptionId: sibling.id,
            userId: seeded.user.id
        });
        const result = await requestPlanChange(seeded.input, seeded.ports);
        const [ownPromo] = await getServiceTestDb()
            .select()
            .from(promoRedemptions)
            .where(eq(promoRedemptions.id, redemption.id));
        const [otherRow] = await getServiceTestDb()
            .select()
            .from(promoRedemptions)
            .where(eq(promoRedemptions.id, otherPromo.id));
        const authorization = await seeded.fake.readAuthorization({
            authorizationId: seeded.started.authorizationId
        });
        expect(result).toMatchObject({ path: 'DOWNGRADE', effectiveAt: seeded.nextChargeAt });
        expect((await scheduledChangesOf(seeded.predecessor.id))[0]).toMatchObject({
            targetPlanVersionId: seeded.targetPlanVersionId,
            effectiveAt: seeded.nextChargeAt
        });
        expect(authorization.snapshot.amount).toEqual({ amountMinor: 500000, currency: 'ARS' });
        expect(ownPromo?.remainingCharges).toBe(0);
        expect(otherRow?.remainingCharges).toBe(2);
    });

    it('(b) regrets a queued downgrade by mutating to the current list price and removing the queue', async () => {
        const seeded = await seedPlanChange({ rankRelation: 'HIGHER' });
        const redemption = await seedPlanChangePromo({
            subscriptionId: seeded.predecessor.id,
            userId: seeded.user.id
        });
        await seedScheduledChange({
            subscriptionId: seeded.predecessor.id,
            effectiveAt: seeded.nextChargeAt,
            targetPlanVersionId: seeded.targetPlanVersionId,
            targetBillingOptionId: seeded.targetBillingOptionId
        });
        await getServiceTestDb()
            .update(promoRedemptions)
            .set({ remainingCharges: 0 })
            .where(eq(promoRedemptions.id, redemption.id));
        const mutate = vi.spyOn(seeded.fake, 'changeAmount');
        const result = await requestPlanChange(
            { ...seeded.input, billingOptionId: seeded.predecessorBillingOptionId },
            seeded.ports
        );
        const [promo] = await getServiceTestDb()
            .select()
            .from(promoRedemptions)
            .where(eq(promoRedemptions.id, redemption.id));
        const authorization = await seeded.fake.readAuthorization({
            authorizationId: seeded.started.authorizationId
        });
        expect(result).toEqual({ path: 'REGRET', amountMinor: 250000 });
        expect(mutate).toHaveBeenCalledTimes(1);
        expect(authorization.snapshot.amount).toEqual({ amountMinor: 250000, currency: 'ARS' });
        expect(await scheduledChangesOf(seeded.predecessor.id)).toHaveLength(0);
        expect(promo?.remainingCharges).toBe(0);
    });

    it('(c) keeps NO_CHANGE when no queued downgrade exists', async () => {
        const seeded = await seedPlanChange({});
        const result = await requestPlanChange(
            { ...seeded.input, billingOptionId: seeded.predecessorBillingOptionId },
            seeded.ports
        );
        const [row] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.predecessor.id));
        expect(result).toEqual({ path: 'REJECTED', reason: 'NO_CHANGE' });
        expect(row?.status).toBe('ACTIVE');
        expect(await scheduledChangesOf(seeded.predecessor.id)).toHaveLength(0);
    });

    it.each([
        'GRACE_PERIOD',
        'PAUSED'
    ] as const)('(g) rejects regret from %s without mutating or removing the queue', async (status) => {
        const seeded = await seedPlanChange({ status });
        const queued = await seedScheduledChange({
            subscriptionId: seeded.predecessor.id,
            effectiveAt: seeded.nextChargeAt
        });
        const mutate = vi.spyOn(seeded.fake, 'changeAmount');
        const result = await requestPlanChange(
            { ...seeded.input, billingOptionId: seeded.predecessorBillingOptionId },
            seeded.ports
        );
        expect(result).toEqual({ path: 'REJECTED', reason: 'NOT_ACTIVE' });
        expect(mutate).toHaveBeenCalledTimes(0);
        expect(await scheduledChangesOf(seeded.predecessor.id)).toEqual([queued]);
    });

    it('(d) rejects replacing a migration queue without mutating the provider or queue', async () => {
        const seeded = await seedPlanChange({ rankRelation: 'HIGHER' });
        const migration = await seedPriceIncrease({
            subscriptionId: seeded.predecessor.id,
            userId: seeded.user.id,
            sourcePlanVersionId: seeded.planVersionId,
            announcedAt: new Date('2026-01-01T00:00:00Z'),
            effectiveAt: seeded.nextChargeAt
        });
        const target = await seedAdditionalPlanChangeTarget({
            planVersionId: seeded.planVersionId
        });
        seeded.verticals.setPlanPolicy({
            planVersionId: target.planVersionId,
            policy: { graceDays: 7, allowsPause: false, current: true, sellable: true }
        });
        seeded.verticals.setChangeDirection({
            fromPlanVersionId: seeded.planVersionId,
            toPlanVersionId: target.planVersionId,
            direction: 'DOWN'
        });
        const mutate = vi.spyOn(seeded.fake, 'changeAmount');
        const result = await requestPlanChange(
            { ...seeded.input, billingOptionId: target.billingOptionId },
            seeded.ports
        );
        const queue = await scheduledChangesOf(seeded.predecessor.id);
        const [participation] = await getServiceTestDb()
            .select()
            .from(planMigrationSubscriptions)
            .where(eq(planMigrationSubscriptions.id, migration.participation.id));
        expect(result).toEqual({ path: 'REJECTED', reason: 'MIGRATION_CHANGE_QUEUED' });
        expect(mutate).toHaveBeenCalledTimes(0);
        expect(queue).toEqual([migration.scheduled]);
        expect(participation?.status).toBe('PENDIENTE');
    });

    it('(e) reports PLAN_CHANGE_STATE_CHANGED when S38 applies during provider mutation', async () => {
        const seeded = await seedPlanChange({ rankRelation: 'HIGHER' });
        const second = await seedAdditionalPlanChangeTarget({
            planVersionId: seeded.planVersionId
        });
        seeded.verticals.setPlanPolicy({
            planVersionId: second.planVersionId,
            policy: { graceDays: 7, allowsPause: false, current: true, sellable: true }
        });
        seeded.verticals.setChangeDirection({
            fromPlanVersionId: seeded.planVersionId,
            toPlanVersionId: second.planVersionId,
            direction: 'DOWN'
        });
        await seedScheduledChange({
            subscriptionId: seeded.predecessor.id,
            effectiveAt: seeded.nextChargeAt,
            targetPlanVersionId: seeded.targetPlanVersionId,
            targetBillingOptionId: seeded.targetBillingOptionId
        });
        const provider = new Proxy(seeded.ports.provider, {
            get(target, property, receiver) {
                if (property === 'changeAmount')
                    return async (input: Parameters<typeof target.changeAmount>[0]) => {
                        const result = await target.changeAmount(input);
                        await getServiceTestDb().transaction((tx) =>
                            applyScheduledChangeInTx({
                                subscriptionId: seeded.predecessor.id,
                                now: new Date(seeded.nextChargeAt.getTime() + 1),
                                tx
                            })
                        );
                        return result;
                    };
                const method = Reflect.get(target, property, receiver);
                return typeof method === 'function' ? method.bind(target) : method;
            }
        });
        await expect(
            requestPlanChange(
                { ...seeded.input, billingOptionId: second.billingOptionId },
                { ...seeded.ports, provider }
            )
        ).rejects.toMatchObject({ reason: 'PLAN_CHANGE_STATE_CHANGED' });
    });

    it('(f) keeps the queue identical through pause while S38 waits', async () => {
        const harness = adjustablePauseHarness();
        const principal = await seedPausePrincipal({ harness });
        await seedScheduledChange({
            subscriptionId: principal.subscriptionId,
            effectiveAt: harness.clock.now()
        });
        pausedQueueIds.push(principal.subscriptionId);
        const before = await scheduledChangesOf(principal.subscriptionId);
        const paused = await pauseSubscription(
            { subscriptionId: principal.subscriptionId, requestedMonths: 2 },
            {
                provider: harness.provider,
                clock: harness.clock,
                planPolicy: pausePlanPolicy(),
                complements: {
                    addonPolicy: async () => {
                        throw new Error('unexpected addon policy');
                    },
                    listing: async () => {
                        throw new Error('unexpected listing policy');
                    }
                }
            }
        );
        expect(paused.outcome).toBe('PAUSED');
        const application = await getServiceTestDb().transaction((tx) =>
            applyScheduledChangeInTx({
                subscriptionId: principal.subscriptionId,
                now: new Date(harness.clock.now().getTime() + 1000),
                tx
            })
        );
        expect(application).toEqual({ outcome: 'NOT_APPLICABLE', reason: 'WAITS_PAUSED' });
        expect(await scheduledChangesOf(principal.subscriptionId)).toEqual(before);
    });
});
