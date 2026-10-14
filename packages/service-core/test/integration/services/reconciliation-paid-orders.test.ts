/**
 * TEST:B11:12 (AC:B11:13): the day after an ABANDONED one-time instance's order
 * key, the sweep re-reads its order by id (by the stored id, or by the ids a
 * search by the request identifier yields, EX-57) and, paid, opens reason 23 on
 * the instance. Nothing is created, charged or refunded at the provider.
 */
import { reconciliationMarkModel } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { closeServiceTestPool, isServiceTestDbAvailable } from './helpers.js';
import { hungRows } from './support/mark-payment-fixtures.js';
import {
    instanceStatus,
    markOpenedEventsOf,
    paidOrderClock,
    paidOrderMarks,
    paidOrderNow,
    retirePaidOrderFixtures,
    seedOrderInstance,
    sweepPaidOrders
} from './support/paid-order-fixtures.js';

const DAY_MS = 86_400_000;
const skip = !isServiceTestDbAvailable();

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePaidOrderFixtures();
});
afterAll(closeServiceTestPool);

/** A fake on the sweep's clock, with every provider call spied. */
function spiedFake() {
    const fake = new FakePaymentProvider({
        clock: paidOrderClock,
        idNamespace: crypto.randomUUID()
    });
    const calls = {
        readOrder: vi.spyOn(fake, 'readOrder'),
        searchOrders: vi.spyOn(fake, 'searchOrders'),
        authorize: vi.spyOn(fake, 'authorize'),
        charge: vi.spyOn(fake, 'charge'),
        refund: vi.spyOn(fake, 'refund'),
        cancel: vi.spyOn(fake, 'cancel'),
        changeAmount: vi.spyOn(fake, 'changeAmount')
    };
    return { fake, calls };
}

function expectNothingSentToTheProvider(calls: ReturnType<typeof spiedFake>['calls']) {
    for (const method of ['authorize', 'charge', 'refund', 'cancel', 'changeAmount'] as const)
        expect(calls[method], method).not.toHaveBeenCalled();
}

describe('TEST:B11:12 AC:B11:13 a paid order of an ABANDONED one-time instance opens reason 23', () => {
    it.skipIf(skip)(
        '(a) with its stored order id, paid: one reason 23 on the instance, nothing hung, nothing sent',
        async () => {
            // Arrange
            const { fake, calls } = spiedFake();
            const { orderId } = fake.placeOrder({ reference: 'stored', paid: true });
            const { instanceId } = await seedOrderInstance({ providerOrderId: orderId });

            // Act
            const summary = await sweepPaidOrders({ provider: fake });

            // Assert
            const marks = await paidOrderMarks(instanceId);
            expect(marks).toHaveLength(1);
            expect(marks[0]).toMatchObject({ addonInstanceId: instanceId, subscriptionId: null });
            expect(await hungRows({ markId: marks[0]?.id as string })).toEqual([]);
            expect(await instanceStatus(instanceId)).toBe('ABANDONED');
            expect(calls.readOrder).toHaveBeenCalledWith({ orderId });
            expect(calls.searchOrders).not.toHaveBeenCalled();
            expectNothingSentToTheProvider(calls);
            expect(summary.paidOrders).toMatchObject({ examined: 1, marked: 1, failures: [] });
            expect(summary.complete).toBe(true);
        }
    );

    it.skipIf(skip)(
        '(b) without an order id, the search by the request identifier finds it paid',
        async () => {
            // Arrange
            const { fake, calls } = spiedFake();
            const seeded = await seedOrderInstance({ providerOrderId: null });
            fake.placeOrder({
                reference: seeded.orderRequestId,
                createdAt: new Date(seeded.keyAt.getTime() + 60_000).toISOString(),
                paid: true
            });

            // Act
            const summary = await sweepPaidOrders({ provider: fake });

            // Assert
            expect(await paidOrderMarks(seeded.instanceId)).toHaveLength(1);
            expect(calls.searchOrders).toHaveBeenCalledTimes(1);
            const [search] = calls.searchOrders.mock.calls[0] ?? [];
            const from = Date.parse(search?.createdFrom as string);
            const to = Date.parse(search?.createdTo as string);
            expect(search?.reference).toBe(seeded.orderRequestId);
            expect(from).toBeLessThanOrEqual(seeded.keyAt.getTime());
            expect(to).toBeGreaterThanOrEqual(seeded.keyAt.getTime());
            expect(to - from).toBeLessThanOrEqual(30 * DAY_MS);
            expect(calls.readOrder).toHaveBeenCalledTimes(1);
            expectNothingSentToTheProvider(calls);
            expect(summary.complete).toBe(true);
        }
    );

    it.skipIf(skip)(
        '(c) an order without an approved payment opens nothing, found by id or by search',
        async () => {
            // Arrange
            const { fake, calls } = spiedFake();
            const stored = fake.placeOrder({ reference: 'unpaid-stored', paid: false });
            const byId = await seedOrderInstance({ providerOrderId: stored.orderId });
            const bySearch = await seedOrderInstance({ providerOrderId: null });
            fake.placeOrder({
                reference: bySearch.orderRequestId,
                createdAt: new Date(bySearch.keyAt.getTime() + 60_000).toISOString(),
                paid: false
            });

            // Act
            const summary = await sweepPaidOrders({ provider: fake });

            // Assert
            expect(await paidOrderMarks(byId.instanceId)).toHaveLength(0);
            expect(await paidOrderMarks(bySearch.instanceId)).toHaveLength(0);
            expect(calls.readOrder).toHaveBeenCalledTimes(2);
            expect(summary.paidOrders).toMatchObject({ examined: 2, marked: 0, failures: [] });
        }
    );

    it.skipIf(skip)(
        '(d) an instance without an ORDER_CREATE key: no call to the provider, no mark',
        async () => {
            // Arrange
            const { fake, calls } = spiedFake();
            const { orderId } = fake.placeOrder({ reference: 'no-key', paid: true });
            const { instanceId } = await seedOrderInstance({ providerOrderId: orderId, key: null });

            // Act
            const summary = await sweepPaidOrders({ provider: fake });

            // Assert
            expect(await paidOrderMarks(instanceId)).toHaveLength(0);
            expect(calls.readOrder).not.toHaveBeenCalled();
            expect(calls.searchOrders).not.toHaveBeenCalled();
            expect(summary.paidOrders?.examined).toBe(0);
        }
    );

    it.skipIf(skip)(
        '(e) EXPIRED, CANCELLED and a periodic ABANDONED instance with a paid order open nothing',
        async () => {
            // Arrange
            const { fake, calls } = spiedFake();
            const instances = [];
            for (const input of [
                { status: 'EXPIRED' },
                { status: 'CANCELLED' },
                { chargeKind: 'PERIODICO' as const }
            ]) {
                const { orderId } = fake.placeOrder({ reference: 'other-state', paid: true });
                instances.push(await seedOrderInstance({ ...input, providerOrderId: orderId }));
            }

            // Act
            await sweepPaidOrders({ provider: fake });

            // Assert
            for (const { instanceId } of instances)
                expect(await paidOrderMarks(instanceId)).toHaveLength(0);
            expect(calls.readOrder).not.toHaveBeenCalled();
        }
    );

    it.skipIf(skip)('(f) a key outside deadline 18 is not examined', async () => {
        // Arrange
        const { fake, calls } = spiedFake();
        const { orderId } = fake.placeOrder({ reference: 'old', paid: true });
        const { instanceId } = await seedOrderInstance({
            providerOrderId: orderId,
            key: { createdAt: new Date(paidOrderNow.getTime() - 31 * DAY_MS) }
        });

        // Act
        const summary = await sweepPaidOrders({ provider: fake, days: 30 });

        // Assert
        expect(summary.paidOrders?.examined).toBe(0);
        expect(calls.readOrder).not.toHaveBeenCalled();
        expect(await paidOrderMarks(instanceId)).toHaveLength(0);
    });

    it.skipIf(skip)(
        '(g) once it had its reason 23, open or lifted, the instance is not looked at again (H12)',
        async () => {
            // Arrange
            const { fake, calls } = spiedFake();
            const { orderId } = fake.placeOrder({ reference: 'marked', paid: true });
            const { instanceId, ownerId } = await seedOrderInstance({ providerOrderId: orderId });
            await sweepPaidOrders({ provider: fake });
            const [mark] = await paidOrderMarks(instanceId);
            if (!mark) throw new Error('expected the reason-23 mark');
            const events = await markOpenedEventsOf(instanceId);
            calls.readOrder.mockClear();

            // Act: open
            const whileOpen = await sweepPaidOrders({ provider: fake });

            // Assert
            expect(whileOpen.paidOrders?.examined).toBe(0);
            expect(calls.readOrder).not.toHaveBeenCalled();
            expect(await paidOrderMarks(instanceId)).toHaveLength(1);
            expect(await markOpenedEventsOf(instanceId)).toBe(events);

            // Act: lifted
            const lifted = await reconciliationMarkModel.lift({
                markId: mark.id,
                expectedVersion: mark.version,
                liftedBy: ownerId,
                now: paidOrderNow
            });
            expect(lifted.outcome).toBe('LIFTED');
            const afterLift = await sweepPaidOrders({ provider: fake });

            // Assert
            expect(afterLift.paidOrders?.examined).toBe(0);
            expect(calls.readOrder).not.toHaveBeenCalled();
            expect(await paidOrderMarks(instanceId)).toHaveLength(1);
            expect(await markOpenedEventsOf(instanceId)).toBe(events);
        }
    );

    it.skipIf(skip)(
        '(h) an order id the provider does not know fails the run; the other instances go on',
        async () => {
            // Arrange
            const { fake } = spiedFake();
            const unknown = await seedOrderInstance({
                providerOrderId: `missing-${crypto.randomUUID()}`
            });
            const { orderId } = fake.placeOrder({ reference: 'known', paid: true });
            const known = await seedOrderInstance({ providerOrderId: orderId });
            const ping = vi.fn(async () => undefined);

            // Act
            const summary = await sweepPaidOrders({ provider: fake, livenessPing: { ping } });

            // Assert
            expect(summary.complete).toBe(false);
            expect(summary.pinged).toBe(false);
            expect(summary.paidOrders?.failures).toEqual([
                expect.objectContaining({ addonInstanceId: unknown.instanceId })
            ]);
            expect(await paidOrderMarks(known.instanceId)).toHaveLength(1);
            expect(await paidOrderMarks(unknown.instanceId)).toHaveLength(0);
        }
    );
});
