import { PaymentProviderError } from '@repo/payments';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { testDb } from '../../e2e/setup/test-database';
import {
    makePayingPrincipal,
    ownerHeaders,
    ownerInstances,
    purchaseApp,
    purchaseCatalog,
    retirePurchaseRoutes
} from './support/addon-purchase-route-fixtures';

const path = '/api/v1/protected/billing/addons/purchases';
const post = (app: ReturnType<typeof purchaseApp>['app'], ownerId: string, body: object) =>
    app.request(path, {
        method: 'POST',
        headers: ownerHeaders(ownerId),
        body: JSON.stringify(body)
    });

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
});
afterEach(async () => {
    vi.restoreAllMocks();
    await retirePurchaseRoutes();
});
afterAll(async () => testDb.teardown());

describe('TEST:B10:8 AC:B10:7 purchase route closes a declined order', () => {
    it('returns the existing HTTP shape and exposes ABANDONED immediately through GET', async () => {
        const fixture = await purchaseCatalog({});
        const { app, fake } = purchaseApp();
        await makePayingPrincipal({
            ownerId: fixture.ownerId,
            payerEmail: fixture.payerEmail,
            fake
        });
        const body = fixture.request();
        if (!body.payment) throw new Error('One-time payment missing');
        fake.declineOrderPayments({ paymentToken: body.payment.token });
        const response = await post(app, fixture.ownerId, body);
        expect(response.status).toBe(202);
        const result = (await response.json()).data;
        expect(result).toMatchObject({
            outcome: 'CREATED',
            processing: true,
            order: { outcome: 'ORDER_DECLINED' }
        });
        const read = await app.request(`${path}/${body.orderRequestId}`, {
            headers: ownerHeaders(fixture.ownerId)
        });
        expect(read.status).toBe(200);
        expect((await read.json()).data).toMatchObject({
            instanceId: result.instanceId,
            status: 'ABANDONED'
        });
        expect((await ownerInstances(fixture.ownerId))[0]?.providerOrderId).toEqual(
            expect.any(String)
        );
        expect(fake.ordersFor({ reference: body.orderRequestId })).toEqual({ orders: 1, paid: 0 });

        const another = fixture.request();
        const next = await post(app, fixture.ownerId, another);
        expect(next.status).toBe(201);
        const nextResult = (await next.json()).data;
        expect(nextResult).toMatchObject({ outcome: 'CREATED', order: { outcome: 'ACTIVATED' } });
        expect(nextResult.instanceId).not.toBe(result.instanceId);
        expect(fake.ordersFor({ reference: another.orderRequestId })).toEqual({
            orders: 1,
            paid: 1
        });
        expect(await ownerInstances(fixture.ownerId)).toHaveLength(2);
    });

    it('replays one failed order after a lost 402 and keeps another card on the same request processing', async () => {
        const fixture = await purchaseCatalog({});
        const { app, fake } = purchaseApp();
        await makePayingPrincipal({
            ownerId: fixture.ownerId,
            payerEmail: fixture.payerEmail,
            fake
        });
        const body = fixture.request();
        if (!body.payment) throw new Error('One-time payment missing');
        fake.declineOrderPayments({ paymentToken: body.payment.token });
        const actualCharge = fake.chargeOnce.bind(fake);
        vi.spyOn(fake, 'chargeOnce').mockImplementationOnce(async (input) => {
            await actualCharge(input);
            throw new PaymentProviderError({
                code: 'UNAVAILABLE',
                capability: 'charge',
                message: 'simulated lostResponse'
            });
        });
        const first = await post(app, fixture.ownerId, body);
        expect(first.status).toBe(202);
        expect((await first.json()).data.order).toEqual({ outcome: 'AWAITING_PROVIDER_ANSWER' });
        const otherCard = await post(app, fixture.ownerId, {
            ...body,
            payment: { ...body.payment, token: `other-${crypto.randomUUID()}` }
        });
        expect(otherCard.status).toBe(202);
        expect((await otherCard.json()).data.order).toEqual({
            outcome: 'PREVIOUS_PAYMENT_PROCESSING'
        });
        expect(await ownerInstances(fixture.ownerId)).toHaveLength(1);
        expect(fake.ordersFor({ reference: body.orderRequestId })).toEqual({ orders: 1, paid: 0 });

        const replay = await post(app, fixture.ownerId, body);
        expect(replay.status).toBe(202);
        expect((await replay.json()).data.order).toEqual({ outcome: 'ORDER_DECLINED' });
        const read = await app.request(`${path}/${body.orderRequestId}`, {
            headers: ownerHeaders(fixture.ownerId)
        });
        expect((await read.json()).data).toMatchObject({ status: 'ABANDONED' });
        expect((await ownerInstances(fixture.ownerId))[0]?.providerOrderId).toEqual(
            expect.any(String)
        );
        expect(fake.ordersFor({ reference: body.orderRequestId })).toEqual({ orders: 1, paid: 0 });
    });

    it('runs A7 after NOT_APPROVED for an already placed failed order', async () => {
        const fixture = await purchaseCatalog({});
        const { app, fake } = purchaseApp();
        await makePayingPrincipal({
            ownerId: fixture.ownerId,
            payerEmail: fixture.payerEmail,
            fake
        });
        const body = fixture.request();
        if (!body.payment) throw new Error('One-time payment missing');
        fake.declineOrderPayments({ paymentToken: body.payment.token });
        vi.spyOn(fake, 'readOrder').mockRejectedValueOnce(
            new PaymentProviderError({
                code: 'UNAVAILABLE',
                capability: 'read',
                message: 'simulated networkCut'
            })
        );
        const first = await post(app, fixture.ownerId, body);
        expect(first.status).toBe(202);
        expect((await first.json()).data.order).toEqual({ outcome: 'ORDER_DECLINED' });
        const pending = await app.request(`${path}/${body.orderRequestId}`, {
            headers: ownerHeaders(fixture.ownerId)
        });
        expect((await pending.json()).data.status).toBe('PENDING_AUTHORIZATION');
        const replay = await post(app, fixture.ownerId, body);
        expect(replay.status).toBe(202);
        expect((await replay.json()).data.order).toEqual({ outcome: 'NOT_APPROVED' });
        const read = await app.request(`${path}/${body.orderRequestId}`, {
            headers: ownerHeaders(fixture.ownerId)
        });
        expect((await read.json()).data.status).toBe('ABANDONED');
        expect(fake.ordersFor({ reference: body.orderRequestId })).toEqual({ orders: 1, paid: 0 });
    });
});
