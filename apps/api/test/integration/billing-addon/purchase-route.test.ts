import { PaymentProviderError } from '@repo/payments';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    resetAnalyticsFactSinkForTests,
    setAnalyticsFactSinkForTests
} from '../../../src/utils/analytics/analytics-facts';
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
    resetAnalyticsFactSinkForTests();
    await retirePurchaseRoutes();
});
afterAll(async () => testDb.teardown());

describe('AC:B10:1 AC:B10:2 protected addon purchase route', () => {
    it('emits addon_checkout_started once for a created purchase and never answers it (HOS-1883 AC-1)', async () => {
        // Arrange
        const fixture = await purchaseCatalog({ chargeKind: 'PERIODICO' });
        const { app, fake } = purchaseApp();
        await makePayingPrincipal({
            ownerId: fixture.ownerId,
            payerEmail: fixture.payerEmail,
            fake
        });
        const emit = vi.fn();
        setAnalyticsFactSinkForTests({ emit });
        const body = fixture.request();

        // Act
        const created = await post(app, fixture.ownerId, body);
        const replay = await post(app, fixture.ownerId, body);

        // Assert
        expect(created.status).toBe(201);
        const answer = (await created.json()).data;
        expect(answer).not.toHaveProperty('startedFact');
        expect((await replay.json()).data).not.toHaveProperty('startedFact');
        const started = emit.mock.calls
            .map(([fact]) => fact)
            .filter((fact) => fact.kind === 'ADDON_CHECKOUT_STARTED');
        expect(started).toHaveLength(1);
        expect(started[0]).toMatchObject({
            userId: fixture.ownerId,
            addonInstanceId: answer.instanceId,
            chargeKind: 'PERIODICO',
            actorKind: 'USER',
            currency: 'ARS'
        });
    });

    it('rejects absent session, extra body fields, card data, and missing title', async () => {
        const fixture = await purchaseCatalog({});
        const { app, fake } = purchaseApp();
        const page = vi.spyOn(fake, 'requestOneTimePayment');
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
        // HOS-2179 AC-2: card data never reaches the route, whatever its field name.
        for (const card of [
            { payment: { token: 'tok', brand: 'visa', kind: 'credit' } },
            { token: 'tok' },
            { cardToken: 'tok' }
        ])
            expect((await post(app, fixture.ownerId, { ...body, ...card })).status).toBe(400);
        const noTitle = await post(app, fixture.ownerId, body);
        expect(noTitle.status).toBe(409);
        expect(await noTitle.json()).toMatchObject({ error: { code: 'ADDON_NO_VALID_TITLE' } });
        expect(await ownerInstances(fixture.ownerId)).toEqual([]);
        expect(page).toHaveBeenCalledTimes(0);
    });

    it('creates one recurring checkout, replays it, and resumes it for a second request (HOS-2668)', async () => {
        const fixture = await purchaseCatalog({ chargeKind: 'PERIODICO' });
        const { app, fake } = purchaseApp();
        await makePayingPrincipal({
            ownerId: fixture.ownerId,
            payerEmail: fixture.payerEmail,
            fake
        });
        const authorize = vi.spyOn(fake, 'authorize');
        const page = vi.spyOn(fake, 'requestOneTimePayment');
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
        // A second request for the same pending purchase (same payer, open window)
        // resumes the stored checkout instead of a dead-end "processing" wait.
        const resumed = await post(app, fixture.ownerId, fixture.request(null));
        expect(resumed.status).toBe(200);
        expect((await resumed.json()).data).toMatchObject({
            outcome: 'EXISTING',
            instanceId: first.instanceId,
            processing: false,
            checkoutUrl: first.checkoutUrl
        });
        expect(authorize).toHaveBeenCalledTimes(1);
        expect(page).toHaveBeenCalledTimes(0);
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

    it.each([
        {
            error: new PaymentProviderError({
                code: 'REJECTED',
                capability: 'authorize',
                message: 'Rejected'
            }),
            status: 422,
            reason: 'PROVIDER_REJECTED'
        },
        {
            error: new PaymentProviderError({
                code: 'UNAVAILABLE',
                capability: 'authorize',
                message: 'Busy',
                transient: { kind: 'RATE_LIMITED', retryAfterSeconds: 42 }
            }),
            status: 503,
            reason: 'PROVIDER_BUSY'
        }
    ])('maps recurring provider failure to $status $reason', async ({ error, status, reason }) => {
        const fixture = await purchaseCatalog({ chargeKind: 'PERIODICO' });
        const { app, fake } = purchaseApp();
        await makePayingPrincipal({
            ownerId: fixture.ownerId,
            payerEmail: fixture.payerEmail,
            fake
        });
        vi.spyOn(fake, 'authorize').mockRejectedValueOnce(error);
        const response = await post(app, fixture.ownerId, fixture.request());
        expect(response.status).toBe(status);
        expect(await response.json()).toMatchObject({ error: { reason } });
        if (status === 503) expect(response.headers.get('Retry-After')).toBe('42');
    });
    it('HOS-2321/HOS-2322: a rejected creation leaves no blocker and answers in the request locale', async () => {
        const fixture = await purchaseCatalog({ chargeKind: 'PERIODICO' });
        const { app, fake } = purchaseApp();
        await makePayingPrincipal({
            ownerId: fixture.ownerId,
            payerEmail: fixture.payerEmail,
            fake
        });
        vi.spyOn(fake, 'authorize').mockRejectedValueOnce(
            new PaymentProviderError({
                code: 'REJECTED',
                capability: 'authorize',
                message: 'Rejected'
            })
        );
        const rejected = await app.request(path, {
            method: 'POST',
            headers: { ...ownerHeaders(fixture.ownerId), 'x-client-locale': 'en' },
            body: JSON.stringify(fixture.request())
        });
        expect(rejected.status).toBe(422);
        const { error } = await rejected.json();
        expect(error).toMatchObject({ reason: 'PROVIDER_REJECTED' });
        expect(error.message).toContain('Mercado Pago');
        expect(error.message).not.toBe('The payment provider rejected the payment details');
        expect(await ownerInstances(fixture.ownerId)).toMatchObject([{ status: 'ABANDONED' }]);

        const retry = await post(app, fixture.ownerId, fixture.request());
        expect(retry.status).toBe(201);
        expect((await retry.json()).data).toMatchObject({
            outcome: 'CREATED',
            processing: false,
            checkoutUrl: expect.any(String)
        });
    });
});
