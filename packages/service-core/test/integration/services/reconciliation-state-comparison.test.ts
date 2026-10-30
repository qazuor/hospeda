import {
    domainEventModel,
    eq,
    providerLinks,
    reconciliationMarkModel,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStateComparison } from '../../../src/services/billing/reconciliation/sweep/comparisons/state-comparison.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    createReconciliationFake,
    reconciliationClock,
    resetSeededReconciliationInventory,
    seedSubscription,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';
import { attachPendingFakeAuthorization } from './support/period-comparison-fixtures.js';

afterAll(closeServiceTestPool);
beforeEach(resetSeededReconciliationInventory);
const owned: Array<{ readonly subscriptionId: string; readonly userId: string }> = [];

function track(subscriptionId: string, userId: string | null): void {
    if (!userId) throw new Error('Fixture subscription has no user');
    owned.push({ subscriptionId, userId });
}

afterEach(async () => {
    const db = getServiceTestDb();
    for (const row of owned.splice(0)) {
        for (const mark of await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: row.subscriptionId }
        })) {
            await reconciliationMarkModel.lift({
                markId: mark.id,
                expectedVersion: mark.version,
                liftedBy: row.userId,
                now: new Date()
            });
        }
        await db.delete(providerLinks).where(eq(providerLinks.subscriptionId, row.subscriptionId));
        await db
            .update(subscriptions)
            .set({ status: 'ABANDONED' })
            .where(eq(subscriptions.id, row.subscriptionId));
    }
});

describe('TEST:B11:7 AC:B11:8 the state comparison marks what the transition table does not declare', () => {
    it.each([
        ['SUSPENDED', 'ACTIVE'],
        ['SUSPENDED', 'PAUSED'],
        ['PENDING_AUTHORIZATION', 'PAUSED']
    ] as const)('TEST:B11:7 (a) leaves local %s unchanged when provider reads %s', async (localStatus, providerState) => {
        const { fake } = createReconciliationFake();
        const seeded = await seedSubscription({ status: localStatus, withLink: true, fake });
        track(seeded.subscription.id, seeded.subscription.userId);
        if (providerState === 'PAUSED') await fake.pause({ authorizationId: seeded.providerId! });
        const before = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscription.id));
        const beforeLink = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, seeded.subscription.id));
        const calls = [
            vi.spyOn(fake, 'cancel'),
            vi.spyOn(fake, 'changeAmount'),
            vi.spyOn(fake, 'pause'),
            vi.spyOn(fake, 'resume'),
            vi.spyOn(fake, 'charge'),
            vi.spyOn(fake, 'refund')
        ];
        const correlationId = crypto.randomUUID();
        const summary = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { correlationId },
                {
                    provider: fake,
                    clock: reconciliationClock,
                    comparisons: [createStateComparison()]
                }
            )
        );
        expect(summary).toMatchObject({ divergences: 1, marksOpened: 1, rowsFailed: 0 });
        const repeated = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { correlationId },
                {
                    provider: fake,
                    clock: reconciliationClock,
                    comparisons: [createStateComparison()]
                }
            )
        );
        expect(repeated).toMatchObject({ divergences: 1, marksAccumulated: 1, rowsFailed: 0 });
        expect(
            await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscription.id))
        ).toEqual(before);
        expect(
            await getServiceTestDb()
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, seeded.subscription.id))
        ).toEqual(beforeLink);
        const marks = await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: seeded.subscription.id }
        });
        expect(marks.map(({ reason }) => reason)).toEqual(['TRANSICION_NO_DECLARADA']);
        const events = (await domainEventModel.findByCorrelationId({ correlationId })).filter(
            (event) => event.eventType === 'reconciliation.mark_opened'
        );
        expect(events).toHaveLength(2);
        expect(
            events.some((event) =>
                event.changes.some(
                    (change) =>
                        change.field === 'reconciliation_mark.reason' &&
                        change.new === 'TRANSICION_NO_DECLARADA'
                )
            )
        ).toBe(true);
        for (const call of calls) expect(call).not.toHaveBeenCalled();
    });

    it('TEST:1688:2 leaves a GRACE_PERIOD row whose preapproval the provider reads active without a mark', async () => {
        const { fake } = createReconciliationFake();
        const seeded = await seedSubscription({ status: 'GRACE_PERIOD', withLink: true, fake });
        track(seeded.subscription.id, seeded.subscription.userId);
        expect(await fake.readAuthorization({ authorizationId: seeded.providerId! })).toMatchObject(
            { snapshot: { status: 'active' } }
        );
        const before = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, seeded.subscription.id));
        const beforeLink = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, seeded.subscription.id));
        const calls = [
            vi.spyOn(fake, 'cancel'),
            vi.spyOn(fake, 'changeAmount'),
            vi.spyOn(fake, 'pause'),
            vi.spyOn(fake, 'resume'),
            vi.spyOn(fake, 'charge'),
            vi.spyOn(fake, 'refund')
        ];
        const correlationId = crypto.randomUUID();
        const sweep = () =>
            withSeededReconciliationInventory(() =>
                runReconciliationSweep(
                    { correlationId },
                    {
                        provider: fake,
                        clock: reconciliationClock,
                        comparisons: [createStateComparison()]
                    }
                )
            );
        expect(await sweep()).toMatchObject({ divergences: 0, marksOpened: 0, rowsFailed: 0 });
        expect(await sweep()).toMatchObject({ divergences: 0, marksOpened: 0, rowsFailed: 0 });
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: seeded.subscription.id }
            })
        ).toEqual([]);
        expect(
            (await domainEventModel.findByCorrelationId({ correlationId })).filter(
                (event) => event.eventType === 'reconciliation.mark_opened'
            )
        ).toEqual([]);
        expect(
            await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscription.id))
        ).toEqual(before);
        expect(
            await getServiceTestDb()
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, seeded.subscription.id))
        ).toEqual(beforeLink);
        for (const call of calls) expect(call).not.toHaveBeenCalled();
    });

    it('TEST:1688:2 does not mark a GRACE_PERIOD row when the provider reads paused', async () => {
        const { fake } = createReconciliationFake();
        const seeded = await seedSubscription({ status: 'GRACE_PERIOD', withLink: true, fake });
        track(seeded.subscription.id, seeded.subscription.userId);
        await fake.pause({ authorizationId: seeded.providerId! });
        const summary = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                {},
                {
                    provider: fake,
                    clock: reconciliationClock,
                    comparisons: [createStateComparison()]
                }
            )
        );
        expect(summary.divergences).toBe(0);
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: seeded.subscription.id }
            })
        ).toEqual([]);
    });

    it('TEST:B11:7 (b)(c)(d) leaves S2, a delegate and NOOP without a mark and accumulates a divergence', async () => {
        const { fake } = createReconciliationFake();
        const s2 = await seedSubscription({
            status: 'PENDING_AUTHORIZATION',
            withLink: true,
            fake
        });
        const delegate = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const noop = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const providerCancel = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const rows = [s2, delegate, noop, providerCancel];
        for (const row of rows) track(row.subscription.id, row.subscription.userId);
        await fake.pause({ authorizationId: delegate.providerId! });
        await fake.cancel({ authorizationId: providerCancel.providerId! });
        const make = () =>
            withSeededReconciliationInventory(() =>
                runReconciliationSweep(
                    {},
                    {
                        provider: fake,
                        clock: reconciliationClock,
                        comparisons: [createStateComparison()]
                    }
                )
            );
        const first = await make();
        const second = await make();
        expect(first).toMatchObject({ divergences: 0, rowsFailed: 0 });
        expect(second).toMatchObject({ divergences: 0, rowsFailed: 0 });
        for (const row of rows) {
            expect(
                await reconciliationMarkModel.listOpen({
                    subject: { kind: 'SUBSCRIPTION', subscriptionId: row.subscription.id }
                })
            ).toEqual([]);
        }
    });

    it('TEST:B11:7 (a) detects pending provider authorization against a local active row', async () => {
        const { fake } = createReconciliationFake();
        const seeded = await seedSubscription({ status: 'ACTIVE' });
        const link = await attachPendingFakeAuthorization({
            subscriptionId: seeded.subscription.id,
            fake
        });
        track(seeded.subscription.id, seeded.subscription.userId);
        const correlationId = crypto.randomUUID();
        const summary = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { correlationId },
                {
                    provider: fake,
                    clock: reconciliationClock,
                    comparisons: [createStateComparison()]
                }
            )
        );
        expect(summary).toMatchObject({ divergences: 1, marksOpened: 1, rowsFailed: 0 });
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: seeded.subscription.id }
            })
        ).toMatchObject([{ reason: 'TRANSICION_NO_DECLARADA' }]);
        expect(link.providerId).toMatch(/^fake-auth-/);
    });
});
