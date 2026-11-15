import {
    billingOptions,
    domainEvent,
    eq,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    previewCyclePrice,
    setCyclePrice
} from '../../../src/services/billing/pricing/cycle-price.service.js';
import { countPlanVersionCustomers } from '../../../src/services/billing/pricing/cycle-price-customers.js';
import { PROVIDER_AMOUNT_FLOOR_MINOR } from '../../../src/services/billing/promo/provider-amount-floor.js';
import { activateSubscription } from '../../../src/services/billing/subscription/activate-subscription.service.js';
import { applyScheduledChangeInTx } from '../../../src/services/billing/subscription/apply-scheduled-change.service.js';
import { SCHEDULED_CHANGE_MAX_ATTEMPTS } from '../../../src/services/billing/subscription/scheduled-change-attempts.js';
import { discardScheduledChange } from '../../../src/services/billing/subscription/scheduled-change-discard.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    seedCyclePriceDeadlines,
    seedCyclePriceVersion,
    startCyclePriceCustomer
} from './support/cycle-price-fixtures.js';
import {
    deleteScheduledChanges,
    scheduledChangesOf,
    seedScheduledChange
} from './support/scheduled-change-fixtures.js';
import { noTouristVip } from './support/tourist-vip.js';

beforeAll(seedCyclePriceDeadlines);
const seeded: string[] = [];
afterAll(async () => {
    await deleteScheduledChanges(seeded);
    await closeServiceTestPool();
});

const price = PROVIDER_AMOUNT_FLOOR_MINOR + 100;
const nextPrice = price + 100;
const request = (planVersionId: string, amount = price, cycle = 'monthly') => ({
    planVersionId,
    cycle,
    amount
});

async function eventRows(optionId: string) {
    return getServiceTestDb().select().from(domainEvent).where(eq(domainEvent.entityId, optionId));
}

async function optionRows(planVersionId: string) {
    return getServiceTestDb()
        .select()
        .from(billingOptions)
        .where(eq(billingOptions.planVersionId, planVersionId));
}

async function confirm(
    actor: Awaited<ReturnType<typeof seedCyclePriceVersion>>['actor'],
    planVersionId: string,
    amount = price,
    expectedPreviousAmount: number | null = null,
    cycle = 'monthly'
) {
    return setCyclePrice({
        actor,
        input: {
            ...request(planVersionId, amount, cycle),
            expectedPreviousAmount,
            confirmed: true
        },
        correlationId: crypto.randomUUID()
    });
}

const customersOf = (planVersionId: string) =>
    countPlanVersionCustomers({ tx: getServiceTestDb(), planVersionId });

async function queuedCase(
    input: {
        readonly effectiveAt?: Date;
        readonly target?: { readonly planVersionId: string; readonly optionId: string };
    } = {}
) {
    const versionA = await seedCyclePriceVersion();
    const optionA = await confirm(versionA.actor, versionA.planVersionId);
    const juan = await startCyclePriceCustomer(optionA.billingOption.id);
    const versionB = await seedCyclePriceVersion();
    const optionB = await confirm(versionB.actor, versionB.planVersionId);
    const target = input.target ?? {
        planVersionId: versionB.planVersionId,
        optionId: optionB.billingOption.id
    };
    const change = await seedScheduledChange({
        subscriptionId: juan.subscriptionId,
        targetPlanVersionId: target.planVersionId,
        targetBillingOptionId: target.optionId,
        effectiveAt: input.effectiveAt ?? new Date('2099-01-01T00:00:00.000Z')
    });
    seeded.push(juan.subscriptionId);
    return {
        actorB: versionB.actor,
        versionA: versionA.planVersionId,
        versionB: versionB.planVersionId,
        optionB: optionB.billingOption,
        juan,
        change
    };
}

async function expectRejectedWithoutWrite(input: {
    readonly actor: Awaited<ReturnType<typeof seedCyclePriceVersion>>['actor'];
    readonly planVersionId: string;
    readonly optionId: string;
}) {
    await expect(
        previewCyclePrice({
            actor: input.actor,
            input: request(input.planVersionId, nextPrice)
        })
    ).rejects.toMatchObject({ reason: 'PLAN_VERSION_HAS_CUSTOMERS' });
    await expect(confirm(input.actor, input.planVersionId, nextPrice, price)).rejects.toMatchObject(
        { reason: 'PLAN_VERSION_HAS_CUSTOMERS' }
    );
    expect((await optionRows(input.planVersionId))[0]?.amount).toBe(price);
    expect(
        (await eventRows(input.optionId)).filter(
            (row) => row.eventType === 'billing_option.price_set'
        )
    ).toHaveLength(1);
}

describe.skipIf(!isServiceTestDbAvailable())(
    'HOS-1628 action 19 counts a queued S38 as a customer of its target version',
    () => {
        it('TEST:B3:41 TEST:B2:12 rejects a version whose only customer is a row with its S38 queued toward it, and sets the price once the queue entry is gone', async () => {
            // Arrange
            const fixture = await queuedCase();
            expect(await customersOf(fixture.versionB)).toBe(1);
            expect(await customersOf(fixture.versionA)).toBe(1);

            // Act
            await expectRejectedWithoutWrite({
                actor: fixture.actorB,
                planVersionId: fixture.versionB,
                optionId: fixture.optionB.id
            });
            const discarded = await getServiceTestDb().transaction((tx) =>
                discardScheduledChange({ subscriptionId: fixture.juan.subscriptionId, tx })
            );
            const result = await confirm(fixture.actorB, fixture.versionB, nextPrice, price);

            // Assert
            expect(discarded.discarded).toBe(true);
            expect(await customersOf(fixture.versionB)).toBe(0);
            expect(result.billingOption.amount).toBe(nextPrice);
        });

        it('AC:B3:40 an overdue S38 that has not run yet still counts', async () => {
            // Arrange
            const fixture = await queuedCase({
                effectiveAt: new Date('2020-01-01T00:00:00.000Z')
            });

            // Act
            const count = await customersOf(fixture.versionB);
            await expectRejectedWithoutWrite({
                actor: fixture.actorB,
                planVersionId: fixture.versionB,
                optionId: fixture.optionB.id
            });

            // Assert
            expect(count).toBe(1);
        });

        it('AC:B3:40 an S38 exhausted by failed attempts still counts', async () => {
            // Arrange
            const fixture = await queuedCase();
            await getServiceTestDb()
                .update(subscriptionScheduledChanges)
                .set({ attemptCount: SCHEDULED_CHANGE_MAX_ATTEMPTS })
                .where(eq(subscriptionScheduledChanges.id, fixture.change.id));

            // Act
            const count = await customersOf(fixture.versionB);
            await expectRejectedWithoutWrite({
                actor: fixture.actorB,
                planVersionId: fixture.versionB,
                optionId: fixture.optionB.id
            });

            // Assert
            expect(count).toBe(1);
        });

        it('AC:B3:40 an S38 queued toward another version does not count', async () => {
            // Arrange
            const versionC = await seedCyclePriceVersion();
            const optionC = await confirm(versionC.actor, versionC.planVersionId);
            const fixture = await queuedCase({
                target: {
                    planVersionId: versionC.planVersionId,
                    optionId: optionC.billingOption.id
                }
            });

            // Act
            const countB = await customersOf(fixture.versionB);
            const countC = await customersOf(versionC.planVersionId);
            const result = await confirm(fixture.actorB, fixture.versionB, nextPrice, price);

            // Assert
            expect(countB).toBe(0);
            expect(countC).toBe(1);
            expect(result.billingOption.amount).toBe(nextPrice);
        });

        it('AC:B3:40 an applied S38 counts once, as a customer anchored to its target', async () => {
            // Arrange
            const fixture = await queuedCase({
                effectiveAt: new Date('2026-10-01T00:00:00.000Z')
            });
            await fixture.juan.fake.approve({
                authorizationId: fixture.juan.authorizationId.split(':').at(-1) ?? ''
            });
            const activation = await activateSubscription(fixture.juan.subscriptionId, {
                provider: fixture.juan.provider,
                clock: { now: () => new Date('2026-10-08T20:00:00.000Z') },
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                touristVipInheritance: noTouristVip
            });
            expect(activation.activated).toBe(true);

            // Act
            const applied = await getServiceTestDb().transaction((tx) =>
                applyScheduledChangeInTx({
                    subscriptionId: fixture.juan.subscriptionId,
                    now: new Date('2026-10-08T21:00:00.000Z'),
                    tx
                })
            );
            const [subscription] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.juan.subscriptionId));
            const countB = await customersOf(fixture.versionB);
            const countA = await customersOf(fixture.versionA);
            const queue = await scheduledChangesOf(fixture.juan.subscriptionId);
            await expectRejectedWithoutWrite({
                actor: fixture.actorB,
                planVersionId: fixture.versionB,
                optionId: fixture.optionB.id
            });

            // Assert
            expect(applied.outcome).toBe('APPLIED');
            expect(queue).toEqual([]);
            expect(subscription?.planVersionId).toBe(fixture.versionB);
            expect(countB).toBe(1);
            expect(countA).toBe(0);
        });

        it('AC:B3:40 a row anchored to the version and queued toward it counts once', async () => {
            // Arrange
            const version = await seedCyclePriceVersion();
            const monthly = await confirm(version.actor, version.planVersionId);
            const annual = await confirm(
                version.actor,
                version.planVersionId,
                price,
                null,
                'annual'
            );
            const juan = await startCyclePriceCustomer(monthly.billingOption.id);
            const change = await seedScheduledChange({
                subscriptionId: juan.subscriptionId,
                targetPlanVersionId: version.planVersionId,
                targetBillingOptionId: annual.billingOption.id,
                effectiveAt: new Date('2099-01-01T00:00:00.000Z')
            });
            seeded.push(juan.subscriptionId);

            // Act
            const count = await customersOf(version.planVersionId);

            // Assert
            expect(change.targetPlanVersionId).toBe(version.planVersionId);
            expect(count).toBe(1);
        });
    }
);
