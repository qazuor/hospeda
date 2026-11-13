import { addonInstances, domainEvent, eq, idempotencyKeys } from '@repo/db';
import { type PaymentProvider, PaymentProviderError } from '@repo/payments';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { rejectOneTimeOrder } from '../../../src/services/billing/addon/addon-instance-a7';
import { purchaseAddon } from '../../../src/services/billing/addon/purchase-addon.service';
import { sendOneTimeOrder } from '../../../src/services/billing/addon/send-one-time-order.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { payingPrincipal } from './support/addon-a2-fixtures';
import { purchaseFixture, retirePurchaseFixtures } from './support/addon-purchase-fixtures';

const skip = !isServiceTestDbAvailable();
const token = () => `card-${crypto.randomUUID()}`;
const payment = (card: string) => ({ token: card, brand: 'visa', kind: 'credit' as const });

async function setup(chargeKind: 'UNA_VEZ' | 'PERIODICO' = 'UNA_VEZ') {
    const fixture = await purchaseFixture({ chargeKind });
    await payingPrincipal(fixture);
    const input = fixture.input();
    const bought = await purchaseAddon(input, fixture.ports);
    if (bought.outcome !== 'CREATED') throw new Error(`Purchase returned ${bought.outcome}`);
    return { fixture, input, bought };
}

async function instance(id: string) {
    const [row] = await getServiceTestDb()
        .select()
        .from(addonInstances)
        .where(eq(addonInstances.id, id));
    return row;
}

function firstLostResponse(provider: PaymentProvider): PaymentProvider {
    let first = true;
    return new Proxy(provider, {
        get(target, property, receiver) {
            if (property === 'chargeOnce')
                return async (input: Parameters<PaymentProvider['chargeOnce']>[0]) => {
                    if (!first) return target.chargeOnce(input);
                    first = false;
                    await target.chargeOnce(input);
                    throw new PaymentProviderError({
                        code: 'UNAVAILABLE',
                        capability: 'charge',
                        message: 'simulated lostResponse after order creation'
                    });
                };
            return Reflect.get(target, property, receiver);
        }
    });
}

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

describe('TEST:B10:8 AC:B10:7 declined one-time order and second attempt', () => {
    it.skipIf(skip)(
        'abandons a failed order by id without provider writes; another request gets another order',
        async () => {
            const { fixture, input, bought } = await setup();
            const card = token();
            fixture.fake.declineOrderPayments({ paymentToken: card });
            const sent = await sendOneTimeOrder(
                {
                    orderRequestId: input.orderRequestId,
                    payerEmail: input.payerEmail,
                    payment: payment(card)
                },
                fixture.ports
            );
            expect(sent.outcome).toBe('ORDER_DECLINED');
            expect(sent.orderId).toEqual(expect.any(String));
            const charge = vi.spyOn(fixture.fake, 'chargeOnce');
            const cancel = vi.spyOn(fixture.fake, 'cancel');
            const refund = vi.spyOn(fixture.fake, 'refund');
            const before = [
                charge.mock.calls.length,
                cancel.mock.calls.length,
                refund.mock.calls.length
            ];
            expect(
                await rejectOneTimeOrder({ instanceId: bought.instanceId }, fixture.ports)
            ).toEqual({ outcome: 'ABANDONED' });
            expect([
                charge.mock.calls.length,
                cancel.mock.calls.length,
                refund.mock.calls.length
            ]).toEqual(before);
            expect(await instance(bought.instanceId)).toMatchObject({
                status: 'ABANDONED',
                providerOrderId: sent.orderId
            });
            const events = await getServiceTestDb()
                .select()
                .from(domainEvent)
                .where(eq(domainEvent.entityId, bought.instanceId));
            const changed = events.filter(
                (event) =>
                    event.eventType === 'addon_instance.status_changed' &&
                    event.changes.some((change) => change.new === 'ABANDONED')
            );
            expect(changed).toHaveLength(1);
            expect(changed[0]?.changes).toEqual([
                { field: 'status', old: 'PENDING_AUTHORIZATION', new: 'ABANDONED' }
            ]);
            expect(
                await rejectOneTimeOrder({ instanceId: bought.instanceId }, fixture.ports)
            ).toEqual({ outcome: 'NOT_APPLICABLE' });
            const eventsAfter = await getServiceTestDb()
                .select()
                .from(domainEvent)
                .where(eq(domainEvent.entityId, bought.instanceId));
            expect(
                eventsAfter.filter(
                    (event) =>
                        event.eventType === 'addon_instance.status_changed' &&
                        event.changes.some((change) => change.new === 'ABANDONED')
                )
            ).toHaveLength(1);

            const nextInput = fixture.input();
            const next = await purchaseAddon(nextInput, fixture.ports);
            expect(next).toMatchObject({ outcome: 'CREATED', instanceId: expect.any(String) });
            if (next.outcome !== 'CREATED') throw new Error('Second purchase missing');
            const nextSent = await sendOneTimeOrder(
                {
                    orderRequestId: nextInput.orderRequestId,
                    payerEmail: nextInput.payerEmail,
                    payment: payment(token())
                },
                fixture.ports
            );
            expect(nextSent).toMatchObject({
                outcome: 'ORDER_PLACED',
                instanceId: next.instanceId,
                orderId: expect.any(String)
            });
            expect(next.instanceId).not.toBe(bought.instanceId);
            expect(nextSent.orderId).not.toBe(sent.orderId);
            const keys = await getServiceTestDb()
                .select()
                .from(idempotencyKeys)
                .where(eq(idempotencyKeys.subjectId, next.instanceId));
            expect(keys.map((key) => key.key)).toEqual([`order:${nextInput.orderRequestId}`]);
            expect(fixture.fake.ordersFor({ reference: input.orderRequestId })).toEqual({
                orders: 1,
                paid: 0
            });
            expect(fixture.fake.ordersFor({ reference: nextInput.orderRequestId })).toEqual({
                orders: 1,
                paid: 1
            });
        }
    );

    it.skipIf(skip)(
        'resends the same failed order after a lost 402; a different card on the same request stays processing',
        async () => {
            const { fixture, input, bought } = await setup();
            const card = token();
            fixture.fake.declineOrderPayments({ paymentToken: card });
            const ports = { ...fixture.ports, provider: firstLostResponse(fixture.fake) };
            const request = {
                orderRequestId: input.orderRequestId,
                payerEmail: input.payerEmail,
                payment: payment(card)
            };
            expect(await sendOneTimeOrder(request, ports)).toMatchObject({
                outcome: 'AWAITING_PROVIDER_ANSWER',
                orderId: null
            });
            expect(await instance(bought.instanceId)).toMatchObject({
                status: 'PENDING_AUTHORIZATION',
                providerOrderId: null
            });
            expect(
                (await sendOneTimeOrder({ ...request, payment: payment(token()) }, ports)).outcome
            ).toBe('PREVIOUS_PAYMENT_PROCESSING');
            expect(
                await getServiceTestDb()
                    .select()
                    .from(addonInstances)
                    .where(eq(addonInstances.orderRequestId, input.orderRequestId))
            ).toHaveLength(1);
            expect(fixture.fake.ordersFor({ reference: input.orderRequestId })).toEqual({
                orders: 1,
                paid: 0
            });
            const resent = await sendOneTimeOrder(request, ports);
            expect(resent).toMatchObject({
                outcome: 'ORDER_DECLINED',
                orderId: expect.any(String)
            });
            expect(fixture.fake.ordersFor({ reference: input.orderRequestId })).toEqual({
                orders: 1,
                paid: 0
            });
            expect(
                await rejectOneTimeOrder({ instanceId: bought.instanceId }, fixture.ports)
            ).toEqual({ outcome: 'ABANDONED' });
            expect(await instance(bought.instanceId)).toMatchObject({
                status: 'ABANDONED',
                providerOrderId: resent.orderId
            });
        }
    );

    it.skipIf(skip)('keeps a pending order pending and recognizes an approved order', async () => {
        const { fixture, input, bought } = await setup();
        // The customer order is seeded through the fake test handle; A7 must not infer failure from missing approval.
        const pending = fixture.fake.placeOrder({ reference: input.orderRequestId, paid: false });
        await getServiceTestDb()
            .update(addonInstances)
            .set({ providerOrderId: pending.orderId })
            .where(eq(addonInstances.id, bought.instanceId));
        expect(await rejectOneTimeOrder({ instanceId: bought.instanceId }, fixture.ports)).toEqual({
            outcome: 'NOT_FAILED'
        });
        expect((await instance(bought.instanceId))?.status).toBe('PENDING_AUTHORIZATION');
        const approved = fixture.fake.placeOrder({ reference: input.orderRequestId, paid: true });
        await getServiceTestDb()
            .update(addonInstances)
            .set({ providerOrderId: approved.orderId })
            .where(eq(addonInstances.id, bought.instanceId));
        expect(await rejectOneTimeOrder({ instanceId: bought.instanceId }, fixture.ports)).toEqual({
            outcome: 'APPROVED'
        });
        expect((await instance(bought.instanceId))?.status).toBe('PENDING_AUTHORIZATION');
    });

    it.skipIf(skip)(
        'keeps the instance pending when the order reread has a network cut, then retries',
        async () => {
            const { fixture, input, bought } = await setup();
            const card = token();
            fixture.fake.declineOrderPayments({ paymentToken: card });
            const sent = await sendOneTimeOrder(
                {
                    orderRequestId: input.orderRequestId,
                    payerEmail: input.payerEmail,
                    payment: payment(card)
                },
                fixture.ports
            );
            expect(sent.outcome).toBe('ORDER_DECLINED');
            const cut: PaymentProvider = new Proxy(fixture.fake, {
                get(target, property, receiver) {
                    if (property === 'readOrder')
                        return async () => {
                            throw new PaymentProviderError({
                                code: 'UNAVAILABLE',
                                capability: 'read',
                                message: 'simulated networkCut before order read'
                            });
                        };
                    return Reflect.get(target, property, receiver);
                }
            });
            expect(
                await rejectOneTimeOrder(
                    { instanceId: bought.instanceId },
                    { ...fixture.ports, provider: cut }
                )
            ).toEqual({ outcome: 'UNKNOWN' });
            expect((await instance(bought.instanceId))?.status).toBe('PENDING_AUTHORIZATION');
            expect(
                await rejectOneTimeOrder({ instanceId: bought.instanceId }, fixture.ports)
            ).toEqual({ outcome: 'ABANDONED' });
        }
    );

    it.skipIf(skip)('ignores a periodic or already abandoned instance', async () => {
        const periodic = await setup('PERIODICO');
        expect(
            await rejectOneTimeOrder(
                { instanceId: periodic.bought.instanceId },
                periodic.fixture.ports
            )
        ).toEqual({ outcome: 'NOT_APPLICABLE' });
        const oneTime = await setup();
        await getServiceTestDb()
            .update(addonInstances)
            .set({ status: 'ABANDONED' })
            .where(eq(addonInstances.id, oneTime.bought.instanceId));
        expect(
            await rejectOneTimeOrder(
                { instanceId: oneTime.bought.instanceId },
                oneTime.fixture.ports
            )
        ).toEqual({ outcome: 'NOT_APPLICABLE' });
    });
});
