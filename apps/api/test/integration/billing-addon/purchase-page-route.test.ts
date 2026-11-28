/**
 * HOS-2179 T-6: the purchase route sells a one-time (`UNA_VEZ`) addon through a payment page,
 * and the read route confirms it when the owner comes back. The fake lies by default; only M1
 * (a preapproval for the paying principal) is switched off by the shared fixture.
 */
import { addonInstances, eq, getDb, idempotencyKeys, payments } from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { testDb } from '../../e2e/setup/test-database';
import {
    makePayingPrincipal,
    ownerHeaders,
    ownerInstances,
    purchaseApp,
    purchaseCatalog,
    purchasePageId,
    retirePurchaseRoutes,
    routeClock
} from './support/addon-purchase-route-fixtures';

const path = '/api/v1/protected/billing/addons/purchases';
type App = ReturnType<typeof purchaseApp>['app'];

const post = (app: App, ownerId: string, body: object, locale = 'es') =>
    app.request(path, {
        method: 'POST',
        headers: { ...ownerHeaders(ownerId), 'x-client-locale': locale },
        body: JSON.stringify(body)
    });
const read = (app: App, ownerId: string, orderRequestId: string) =>
    app.request(`${path}/${orderRequestId}`, { headers: ownerHeaders(ownerId) });

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
});
afterEach(async () => {
    vi.restoreAllMocks();
    await retirePurchaseRoutes();
});
afterAll(async () => testDb.teardown());

async function payingOwner() {
    const fixture = await purchaseCatalog({});
    const { app, fake } = purchaseApp();
    await makePayingPrincipal({ ownerId: fixture.ownerId, payerEmail: fixture.payerEmail, fake });
    return { fixture, app, fake };
}

describe('HOS-2179 T-6 one-time purchase through a payment page', () => {
    it('opens one page for the purchase and answers its link (AC-1)', async () => {
        const { fixture, app, fake } = await payingOwner();
        const page = vi.spyOn(fake, 'requestOneTimePayment');
        const body = fixture.request();
        const created = await post(app, fixture.ownerId, body, 'en');
        expect(created.status).toBe(201);
        const data = (await created.json()).data;
        expect(data).toEqual({
            outcome: 'CREATED',
            instanceId: expect.any(String),
            chargeKind: 'UNA_VEZ',
            processing: false,
            checkoutUrl: expect.stringMatching(/^https:\/\//)
        });
        expect(page).toHaveBeenCalledTimes(1);
        expect(page.mock.calls[0]?.[0]).toMatchObject({
            reference: body.orderRequestId,
            idempotencyKey: `page:${body.orderRequestId}`,
            amount: { amountMinor: 5000, currency: 'ARS' },
            returnUrl: `http://localhost:4321/en/mi-cuenta/complementos/?compra=${body.orderRequestId}`
        });
        // P-8: no payer email is asked for or sent; the reference identifies the purchase.
        expect(JSON.stringify(page.mock.calls[0]?.[0])).not.toContain(fixture.payerEmail);
        expect(await ownerInstances(fixture.ownerId)).toMatchObject([
            { status: 'PENDING_AUTHORIZATION', paymentPageId: expect.any(String) }
        ]);
    });

    it('replays the same link and opens no second page (AC-3)', async () => {
        const { fixture, app, fake } = await payingOwner();
        const body = fixture.request();
        const first = (await (await post(app, fixture.ownerId, body)).json()).data;
        const page = vi.spyOn(fake, 'requestOneTimePayment');
        const replay = await post(app, fixture.ownerId, body);
        expect(replay.status).toBe(200);
        expect((await replay.json()).data).toEqual({
            ...first,
            outcome: 'EXISTING'
        });
        expect(page).not.toHaveBeenCalled();
    });

    it('answers a retry after coming back without paying with the same page link, never as processing', async () => {
        const { fixture, app, fake } = await payingOwner();
        const first = (await (await post(app, fixture.ownerId, fixture.request())).json()).data;
        const page = vi.spyOn(fake, 'requestOneTimePayment');
        // A fresh order id: the screen reloaded after the owner left the page unpaid.
        const retry = await post(app, fixture.ownerId, fixture.request());
        expect(retry.status).toBe(200);
        expect((await retry.json()).data).toEqual({
            outcome: 'EXISTING',
            instanceId: first.instanceId,
            chargeKind: 'UNA_VEZ',
            processing: false,
            checkoutUrl: first.checkoutUrl
        });
        expect(page).not.toHaveBeenCalled();
        expect(await ownerInstances(fixture.ownerId)).toHaveLength(1);
    });

    it('answers a retry after the page expired unpaid with a new page', async () => {
        const { fixture, app, fake } = await payingOwner();
        const first = (await (await post(app, fixture.ownerId, fixture.request())).json()).data;
        await getDb()
            .update(addonInstances)
            .set({
                // The request clock, not the wall clock: the page stopped taking payments.
                paymentPageExpiresAt: new Date(routeClock.now().getTime() - 60_000),
                createdAt: new Date(routeClock.now().getTime() - 3 * 3_600_000)
            })
            .where(eq(addonInstances.id, first.instanceId));
        const page = vi.spyOn(fake, 'requestOneTimePayment');
        const retry = await post(app, fixture.ownerId, fixture.request());
        expect(retry.status).toBe(201);
        const data = (await retry.json()).data;
        expect(data).toMatchObject({
            outcome: 'CREATED',
            processing: false,
            checkoutUrl: expect.any(String)
        });
        expect(data.instanceId).not.toBe(first.instanceId);
        expect(page).toHaveBeenCalledTimes(1);
        const statuses = Object.fromEntries(
            (await ownerInstances(fixture.ownerId)).map((row) => [row.id, row.status])
        );
        expect(statuses[first.instanceId]).toBe('ABANDONED');
        expect(statuses[data.instanceId]).toBe('PENDING_AUTHORIZATION');
    });

    it('keeps the purchase waiting on a return with no approved payment (AC-7, AC-9)', async () => {
        const { fixture, app, fake } = await payingOwner();
        const body = fixture.request();
        const { instanceId } = (await (await post(app, fixture.ownerId, body)).json()).data;
        const pending = await read(app, fixture.ownerId, body.orderRequestId);
        expect(pending.status).toBe(200);
        expect((await pending.json()).data).toEqual({
            instanceId,
            status: 'PENDING_AUTHORIZATION',
            chargeKind: 'UNA_VEZ',
            processing: true,
            productId: body.productId,
            targetId: null,
            addonVersionId: body.addonVersionId
        });
        fake.payOnPage({ paymentPageId: await purchasePageId(instanceId), outcome: 'rejected' });
        expect(
            (await (await read(app, fixture.ownerId, body.orderRequestId)).json()).data
        ).toMatchObject({
            status: 'PENDING_AUTHORIZATION',
            processing: true
        });
    });

    it('activates on return after an approved payment, re-read by id (AC-6)', async () => {
        const { fixture, app, fake } = await payingOwner();
        const body = fixture.request();
        const { instanceId } = (await (await post(app, fixture.ownerId, body)).json()).data;
        const paid = fake.payOnPage({
            paymentPageId: await purchasePageId(instanceId),
            outcome: 'approved'
        });
        const readCharge = vi.spyOn(fake, 'readCharge');
        const back = await read(app, fixture.ownerId, body.orderRequestId);
        expect((await back.json()).data).toEqual({
            instanceId,
            status: 'ACTIVE',
            chargeKind: 'UNA_VEZ',
            processing: false,
            productId: body.productId,
            targetId: null,
            addonVersionId: body.addonVersionId
        });
        expect(readCharge).toHaveBeenCalledWith(
            expect.objectContaining({ chargeId: paid.chargeId })
        );
        const attached = await getDb()
            .select()
            .from(payments)
            .where(eq(payments.addonInstanceId, instanceId));
        expect(attached).toMatchObject([{ status: 'SUCCEEDED' }]);
        // A replay of the paid purchase never hands out the link to pay it again (§5.5).
        const page = vi.spyOn(fake, 'requestOneTimePayment');
        const replay = await post(app, fixture.ownerId, body);
        expect(replay.status).toBe(200);
        const replayed = (await replay.json()).data;
        expect(replayed).toEqual({
            outcome: 'EXISTING',
            instanceId,
            chargeKind: 'UNA_VEZ',
            processing: false
        });
        expect(page).not.toHaveBeenCalled();
    });

    it("never confirms another owner's purchase on its read", async () => {
        const { fixture, app, fake } = await payingOwner();
        const body = fixture.request();
        await post(app, fixture.ownerId, body);
        const search = vi.spyOn(fake, 'searchCharges');
        const foreign = await read(app, crypto.randomUUID(), body.orderRequestId);
        expect(foreign.status).toBe(404);
        expect(search).not.toHaveBeenCalled();
    });

    it('answers a refused page with 422 in the request locale and releases the order id', async () => {
        const { fixture, app, fake } = await payingOwner();
        vi.spyOn(fake, 'requestOneTimePayment').mockRejectedValueOnce(
            new PaymentProviderError({ code: 'REJECTED', capability: 'charge', message: 'no' })
        );
        const body = fixture.request();
        const refused = await post(app, fixture.ownerId, body, 'en');
        expect(refused.status).toBe(422);
        const { error } = await refused.json();
        expect(error).toMatchObject({ code: 'VALIDATION_ERROR', reason: 'PROVIDER_REJECTED' });
        expect(error.message).toBe(
            'Mercado Pago could not open the payment page. Try again in a few minutes.'
        );
        expect(await ownerInstances(fixture.ownerId)).toMatchObject([{ status: 'ABANDONED' }]);
        const replay = await post(app, fixture.ownerId, body);
        expect(replay.status).toBe(409);
        expect(await replay.json()).toMatchObject({
            error: { code: 'ADDON_ORDER_REQUEST_ABANDONED' }
        });
        const retry = await post(app, fixture.ownerId, fixture.request());
        expect(retry.status).toBe(201);
    });

    it('answers a busy provider with 503 and Retry-After, keeping the purchase to resume', async () => {
        const { fixture, app, fake } = await payingOwner();
        vi.spyOn(fake, 'requestOneTimePayment').mockRejectedValueOnce(
            new PaymentProviderError({
                code: 'UNAVAILABLE',
                capability: 'charge',
                message: 'down',
                transient: { kind: 'UNAVAILABLE', retryAfterSeconds: 7 }
            })
        );
        const body = fixture.request();
        const busy = await post(app, fixture.ownerId, body);
        expect(busy.status).toBe(503);
        expect(busy.headers.get('Retry-After')).toBe('7');
        expect(await busy.json()).toMatchObject({ error: { reason: 'PROVIDER_UNAVAILABLE' } });
        const resumed = await post(app, fixture.ownerId, body);
        expect(resumed.status).toBe(200);
        expect((await resumed.json()).data).toMatchObject({
            outcome: 'EXISTING',
            processing: false,
            checkoutUrl: expect.any(String)
        });
    });

    it('answers a waiting purchase whose link was unsafe as processing, never with a link (G10)', async () => {
        const { fixture, app, fake } = await payingOwner();
        const original = fake.requestOneTimePayment.bind(fake);
        vi.spyOn(fake, 'requestOneTimePayment').mockImplementationOnce(async (input) => ({
            ...(await original(input)),
            approvalUrl: 'http://payments-fake.invalid/pay/unsafe'
        }));
        const body = fixture.request();
        expect((await post(app, fixture.ownerId, body)).status).toBe(500);
        const replay = await post(app, fixture.ownerId, body);
        expect(replay.status).toBe(200);
        expect((await replay.json()).data).toEqual({
            outcome: 'EXISTING',
            instanceId: expect.any(String),
            chargeKind: 'UNA_VEZ',
            processing: true
        });
    });

    it('answers a purchase activated while its page was in flight as settled, with no link', async () => {
        const { fixture, app, fake } = await payingOwner();
        const original = fake.requestOneTimePayment.bind(fake);
        vi.spyOn(fake, 'requestOneTimePayment').mockImplementationOnce(async (input) => {
            const page = await original(input);
            await getDb()
                .update(addonInstances)
                .set({
                    status: 'ACTIVE',
                    startsAt: new Date(),
                    endsAt: new Date(Date.now() + 30 * 86_400_000)
                })
                .where(eq(addonInstances.orderRequestId, input.reference));
            return page;
        });
        const created = await post(app, fixture.ownerId, fixture.request());
        expect(created.status).toBe(201);
        expect((await created.json()).data).toEqual({
            outcome: 'CREATED',
            instanceId: expect.any(String),
            chargeKind: 'UNA_VEZ',
            processing: false
        });
    });

    it('answers a purchase released before its page opened as abandoned', async () => {
        const { fixture, app, fake } = await payingOwner();
        const original = fake.requestOneTimePayment.bind(fake);
        vi.spyOn(fake, 'requestOneTimePayment').mockImplementationOnce(async (input) => {
            const page = await original(input);
            await getDb()
                .update(addonInstances)
                .set({ status: 'ABANDONED' })
                .where(eq(addonInstances.orderRequestId, input.reference));
            return page;
        });
        const released = await post(app, fixture.ownerId, fixture.request());
        expect(released.status).toBe(409);
        expect(await released.json()).toMatchObject({
            error: { code: 'ADDON_ORDER_REQUEST_ABANDONED', reason: 'ORDER_REQUEST_ABANDONED' }
        });
    });

    describe('there is no order channel: a one-time purchase always opens a page (HOS-2179 T-7)', () => {
        const keysOf = async (instanceId: string) =>
            (
                await getDb()
                    .select({ operation: idempotencyKeys.operation })
                    .from(idempotencyKeys)
                    .where(eq(idempotencyKeys.subjectId, instanceId))
            ).map((row) => row.operation);

        it('opens a page, never an order, for a request that names no channel', async () => {
            const { fixture, app, fake } = await payingOwner();
            const page = vi.spyOn(fake, 'requestOneTimePayment');
            const created = await post(app, fixture.ownerId, fixture.request());
            expect(created.status).toBe(201);
            const { instanceId } = (await created.json()).data;
            expect(await keysOf(instanceId)).toEqual(['PAYMENT_PAGE_CREATE']);
            expect(page).toHaveBeenCalledTimes(1);
        });

        it.each([
            ['oneTimeChannel', { oneTimeChannel: 'ORDER' }],
            ['channel', { channel: 'ORDER' }]
        ])('refuses a request that asks for the order channel (%s) with 400 and no purchase', async (_field, extra) => {
            const { fixture, app, fake } = await payingOwner();
            const page = vi.spyOn(fake, 'requestOneTimePayment');
            const refused = await post(app, fixture.ownerId, { ...fixture.request(), ...extra });
            expect(refused.status).toBe(400);
            expect(await ownerInstances(fixture.ownerId)).toEqual([]);
            expect(page).not.toHaveBeenCalled();
        });
    });
});
