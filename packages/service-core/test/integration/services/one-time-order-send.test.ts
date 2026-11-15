import { addonInstances, eq, idempotencyKeys } from '@repo/db';
import { type PaymentProvider, PaymentProviderError } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { sendOneTimeOrder } from '../../../src/services/billing/addon/send-one-time-order.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    paidOrderClock,
    retirePaidOrderFixtures,
    seedOrderInstance
} from './support/paid-order-fixtures.js';

const skip = !isServiceTestDbAvailable();
const payment = { token: `card-${crypto.randomUUID()}`, brand: 'visa', kind: 'credit' as const };
const request = (orderRequestId: string, token = payment.token) => ({
    orderRequestId,
    payerEmail: 'payer@example.test',
    payment: { ...payment, token }
});

function fakeWithSpy() {
    const fake = new FakePaymentProvider({
        clock: paidOrderClock,
        idNamespace: crypto.randomUUID()
    });
    return { fake, chargeOnce: vi.spyOn(fake, 'chargeOnce') };
}

async function rows(instanceId: string) {
    const db = getServiceTestDb();
    // addon_instance and idempotency_key have no deleted_at column; count all matching rows.
    const [instance] = await db
        .select()
        .from(addonInstances)
        .where(eq(addonInstances.id, instanceId));
    const keys = await db
        .select()
        .from(idempotencyKeys)
        .where(eq(idempotencyKeys.subjectId, instanceId));
    return { instance, keys };
}

function firstResponseLost(fake: FakePaymentProvider): PaymentProvider {
    let calls = 0;
    return new Proxy(fake, {
        get(target, property, receiver) {
            if (property === 'chargeOnce')
                return async (input: Parameters<PaymentProvider['chargeOnce']>[0]) => {
                    calls++;
                    const answer = await target.chargeOnce(input);
                    if (calls === 1)
                        throw new PaymentProviderError({
                            code: 'UNAVAILABLE',
                            capability: 'charge',
                            message: 'first response lost'
                        });
                    return answer;
                };
            return Reflect.get(target, property, receiver);
        }
    });
}

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePaidOrderFixtures();
});
afterAll(closeServiceTestPool);

describe('HOS-1554 TEST:B6:10 one-time order send', () => {
    it.skipIf(skip)('(a) reuses the stored order on a second request', async () => {
        const seeded = await seedOrderInstance({ status: 'PENDING_AUTHORIZATION' });
        const { fake, chargeOnce } = fakeWithSpy();
        const input = request(seeded.orderRequestId);
        const first = await sendOneTimeOrder(input, { provider: fake, clock: paidOrderClock });
        const second = await sendOneTimeOrder(input, { provider: fake, clock: paidOrderClock });
        const stored = await rows(seeded.instanceId);
        expect(first.outcome).toBe('ORDER_PLACED');
        expect(second).toEqual({
            instanceId: seeded.instanceId,
            outcome: 'ORDER_ALREADY_PLACED',
            orderId: first.orderId
        });
        expect(chargeOnce).toHaveBeenCalledTimes(1);
        expect(fake.ordersFor({ reference: seeded.orderRequestId })).toEqual({
            orders: 1,
            paid: 1
        });
        expect(stored.instance?.providerOrderId).toBe(first.orderId);
        expect(stored.keys).toHaveLength(1);
        expect(stored.keys[0]?.completedAt).toEqual(paidOrderClock.now());
    });

    it.skipIf(skip)('(b) concurrent requests share the key and order', async () => {
        const seeded = await seedOrderInstance({ status: 'PENDING_AUTHORIZATION' });
        const { fake, chargeOnce } = fakeWithSpy();
        const input = request(seeded.orderRequestId, `parallel-${crypto.randomUUID()}`);
        let entered = 0;
        let release!: () => void;
        const bothEntered = new Promise<void>((resolve) => {
            release = resolve;
        });
        const provider = new Proxy(fake, {
            get(target, property, receiver) {
                if (property === 'chargeOnce')
                    return async (chargeInput: Parameters<PaymentProvider['chargeOnce']>[0]) => {
                        entered++;
                        if (entered === 2) release();
                        await bothEntered;
                        return target.chargeOnce(chargeInput);
                    };
                return Reflect.get(target, property, receiver);
            }
        });
        const [first, second] = await Promise.all([
            sendOneTimeOrder(input, { provider, clock: paidOrderClock }),
            sendOneTimeOrder(input, { provider, clock: paidOrderClock })
        ]);
        const stored = await rows(seeded.instanceId);
        expect(first.orderId).toBe(second.orderId);
        expect(first.outcome).toBe('ORDER_PLACED');
        expect(second.outcome).toBe('ORDER_PLACED');
        expect(chargeOnce).toHaveBeenCalledTimes(2);
        expect(chargeOnce.mock.calls[0]?.[0].idempotencyKey).toBe(stored.keys[0]?.key);
        expect(chargeOnce.mock.calls[1]?.[0].idempotencyKey).toBe(stored.keys[0]?.key);
        expect(fake.ordersFor({ reference: seeded.orderRequestId })).toEqual({
            orders: 1,
            paid: 1
        });
    });

    it.skipIf(skip)(
        '(c) resends the identical persisted request after one lost response',
        async () => {
            const seeded = await seedOrderInstance({ status: 'PENDING_AUTHORIZATION' });
            const { fake, chargeOnce } = fakeWithSpy();
            const provider = firstResponseLost(fake);
            const input = request(seeded.orderRequestId, `lost-${crypto.randomUUID()}`);
            const first = await sendOneTimeOrder(input, { provider, clock: paidOrderClock });
            const pending = await rows(seeded.instanceId);
            expect(first).toEqual({
                instanceId: seeded.instanceId,
                outcome: 'AWAITING_PROVIDER_ANSWER',
                orderId: null
            });
            expect(pending.instance?.providerOrderId).toBeNull();
            expect(pending.keys[0]?.completedAt).toBeNull();
            const second = await sendOneTimeOrder(input, { provider, clock: paidOrderClock });
            expect(second.outcome).toBe('ORDER_PLACED');
            expect(chargeOnce).toHaveBeenCalledTimes(2);
            expect(chargeOnce).toHaveBeenNthCalledWith(2, chargeOnce.mock.calls[0]?.[0]);
            expect(chargeOnce.mock.calls[0]?.[0].idempotencyKey).toBe(pending.keys[0]?.key);
            expect(fake.ordersFor({ reference: seeded.orderRequestId })).toEqual({
                orders: 1,
                paid: 1
            });
        }
    );

    it.skipIf(skip)('(d) another card gets key conflict without new rows', async () => {
        const seeded = await seedOrderInstance({ status: 'PENDING_AUTHORIZATION' });
        const { fake, chargeOnce } = fakeWithSpy();
        const provider = firstResponseLost(fake);
        const input = request(seeded.orderRequestId, `original-${crypto.randomUUID()}`);
        const first = await sendOneTimeOrder(input, { provider, clock: paidOrderClock });
        const second = await sendOneTimeOrder(
            request(seeded.orderRequestId, `other-${crypto.randomUUID()}`),
            { provider, clock: paidOrderClock }
        );
        const stored = await rows(seeded.instanceId);
        const instances = await getServiceTestDb()
            .select()
            .from(addonInstances)
            .where(eq(addonInstances.orderRequestId, seeded.orderRequestId));
        expect(first.outcome).toBe('AWAITING_PROVIDER_ANSWER');
        expect(second.outcome).toBe('PREVIOUS_PAYMENT_PROCESSING');
        expect(chargeOnce).toHaveBeenCalledTimes(2);
        expect(stored.instance?.providerOrderId).toBeNull();
        expect(stored.keys).toHaveLength(1);
        expect(stored.keys[0]?.completedAt).toBeNull();
        expect(instances).toHaveLength(1);
        expect(fake.ordersFor({ reference: seeded.orderRequestId })).toEqual({
            orders: 1,
            paid: 1
        });
    });

    it.skipIf(skip)('(e) records a declined order without changing instance status', async () => {
        const seeded = await seedOrderInstance({ status: 'PENDING_AUTHORIZATION' });
        const { fake } = fakeWithSpy();
        const token = `declined-${crypto.randomUUID()}`;
        fake.declineOrderPayments({ paymentToken: token });
        const sent = await sendOneTimeOrder(request(seeded.orderRequestId, token), {
            provider: fake,
            clock: paidOrderClock
        });
        const stored = await rows(seeded.instanceId);
        expect(sent.outcome).toBe('ORDER_DECLINED');
        expect(stored.instance?.providerOrderId).toBe(sent.orderId);
        expect(stored.instance?.status).toBe('PENDING_AUTHORIZATION');
        expect(stored.keys[0]?.result).toEqual({ outcome: 'DECLINED', orderId: sent.orderId });
        expect(fake.ordersFor({ reference: seeded.orderRequestId })).toEqual({
            orders: 1,
            paid: 0
        });
    });

    it.skipIf(skip)('(f) rejects inapplicable status, product, and missing key', async () => {
        const abandoned = await seedOrderInstance({ status: 'ABANDONED' });
        const periodic = await seedOrderInstance({
            status: 'PENDING_AUTHORIZATION',
            chargeKind: 'PERIODICO'
        });
        const noKey = await seedOrderInstance({ status: 'PENDING_AUTHORIZATION', key: null });
        const { fake, chargeOnce } = fakeWithSpy();
        for (const seeded of [abandoned, periodic, noKey]) {
            const sent = await sendOneTimeOrder(request(seeded.orderRequestId), {
                provider: fake,
                clock: paidOrderClock
            });
            expect(sent).toEqual({
                instanceId: seeded.instanceId,
                outcome: 'NOT_APPLICABLE',
                orderId: null
            });
        }
        expect(chargeOnce).toHaveBeenCalledTimes(0);
    });
});
