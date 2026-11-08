import { addonInstances, eq, getDb, payments } from '@repo/db';
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
afterEach(retirePurchaseRoutes);
afterAll(async () => testDb.teardown());

describe('AC:B10:1 AC:B10:2 protected addon purchase route', () => {
    it('rejects absent session, extra body fields, missing one-time payment, and missing title', async () => {
        const fixture = await purchaseCatalog({});
        const { app, fake } = purchaseApp();
        const send = vi.spyOn(fake, 'chargeOnce');
        const body = fixture.request();
        const guest = await app.request(path, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
            body: JSON.stringify(body)
        });
        expect(guest.status).toBe(401);
        const guestActor = await app.request(path, {
            method: 'POST',
            headers: { ...ownerHeaders(crypto.randomUUID()), 'x-mock-actor-role': 'GUEST' },
            body: JSON.stringify(body)
        });
        expect(guestActor.status).toBe(401);
        expect((await post(app, fixture.ownerId, { ...body, extra: true })).status).toBe(400);
        const { payment: _payment, ...withoutPayment } = body;
        expect((await post(app, fixture.ownerId, withoutPayment)).status).toBe(400);
        const noTitle = await post(app, fixture.ownerId, body);
        expect(noTitle.status).toBe(409);
        expect(await noTitle.json()).toMatchObject({ error: { code: 'ADDON_NO_VALID_TITLE' } });
        expect(await ownerInstances(fixture.ownerId)).toEqual([]);
        expect(send).toHaveBeenCalledTimes(0);
    });

    it('creates one recurring checkout, replays it, and reports a second request as processing', async () => {
        const fixture = await purchaseCatalog({ chargeKind: 'PERIODICO' });
        const { app, fake } = purchaseApp();
        await makePayingPrincipal({
            ownerId: fixture.ownerId,
            payerEmail: fixture.payerEmail,
            fake
        });
        const authorize = vi.spyOn(fake, 'authorize');
        const charge = vi.spyOn(fake, 'chargeOnce');
        const body = fixture.request();
        expect(
            (
                await post(app, fixture.ownerId, {
                    ...body,
                    payment: { token: 'tok', brand: 'visa', kind: 'credit' }
                })
            ).status
        ).toBe(400);
        const created = await post(app, fixture.ownerId, body);
        expect(created.status).toBe(201);
        const first = (await created.json()).data;
        expect(first).toMatchObject({
            outcome: 'CREATED',
            chargeKind: 'PERIODICO',
            processing: false,
            checkoutUrl: expect.any(String)
        });
        const replay = await post(app, fixture.ownerId, body);
        expect(replay.status).toBe(200);
        expect((await replay.json()).data).toMatchObject({
            outcome: 'EXISTING',
            instanceId: first.instanceId,
            checkoutUrl: first.checkoutUrl
        });
        const elsewhere = await post(app, fixture.ownerId, fixture.request(null));
        expect(elsewhere.status).toBe(200);
        expect((await elsewhere.json()).data).toMatchObject({
            outcome: 'PENDING_ELSEWHERE',
            instanceId: first.instanceId,
            processing: true
        });
        expect(authorize).toHaveBeenCalledTimes(1);
        expect(charge).toHaveBeenCalledTimes(0);
        expect(await ownerInstances(fixture.ownerId)).toHaveLength(1);
        const read = await app.request(`${path}/${body.orderRequestId}`, {
            headers: ownerHeaders(fixture.ownerId)
        });
        expect(read.status).toBe(200);
        expect((await read.json()).data).toMatchObject({
            instanceId: first.instanceId,
            status: 'PENDING_AUTHORIZATION'
        });
        const foreign = await app.request(`${path}/${body.orderRequestId}`, {
            headers: ownerHeaders(crypto.randomUUID())
        });
        expect(foreign.status).toBe(404);
        expect(await foreign.json()).toMatchObject({ error: { code: 'ADDON_PURCHASE_NOT_FOUND' } });
    });

    it('activates an approved one-time order and attaches its payment to the instance', async () => {
        const fixture = await purchaseCatalog({});
        const { app, fake } = purchaseApp();
        await makePayingPrincipal({
            ownerId: fixture.ownerId,
            payerEmail: fixture.payerEmail,
            fake
        });
        const charge = vi.spyOn(fake, 'chargeOnce');
        const created = await post(app, fixture.ownerId, fixture.request());
        expect([200, 201]).toContain(created.status);
        const data = (await created.json()).data;
        expect(data).toMatchObject({
            chargeKind: 'UNA_VEZ',
            processing: false,
            order: { outcome: 'ACTIVATED' }
        });
        const [instance] = await getDb()
            .select()
            .from(addonInstances)
            .where(eq(addonInstances.id, data.instanceId));
        expect(instance?.status).toBe('ACTIVE');
        const attached = await getDb()
            .select()
            .from(payments)
            .where(eq(payments.addonInstanceId, data.instanceId));
        expect(attached).toHaveLength(1);
        expect(attached[0]?.status).toBe('SUCCEEDED');
        expect(charge).toHaveBeenCalledTimes(1);
        const replay = await post(
            app,
            fixture.ownerId,
            fixture.request(null, instance!.orderRequestId!)
        );
        expect(replay.status).toBe(200);
        expect((await replay.json()).data).toMatchObject({
            outcome: 'EXISTING',
            instanceId: data.instanceId,
            processing: false,
            order: { outcome: 'ORDER_ALREADY_PLACED' }
        });
        expect(charge).toHaveBeenCalledTimes(1);
    });
});
