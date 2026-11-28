/**
 * HOS-2680: the actions the return screen offers on a recurring add-on purchase. The read
 * carries the purchase identity, and every action re-POSTs it under a FRESH order id, which is
 * what routes the request through the HOS-2668 decision (provider read first) instead of the
 * plain replay of the stored link.
 */
import { addonInstances, eq, getDb, providerLinks } from '@repo/db';
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
type App = ReturnType<typeof purchaseApp>['app'];
const post = (app: App, ownerId: string, body: object) =>
    app.request(path, {
        method: 'POST',
        headers: ownerHeaders(ownerId),
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

/** A paying owner with one pending recurring add-on purchase, created through the route. */
async function pendingRecurringPurchase() {
    const fixture = await purchaseCatalog({ chargeKind: 'PERIODICO' });
    const { app, fake } = purchaseApp();
    await makePayingPrincipal({ ownerId: fixture.ownerId, payerEmail: fixture.payerEmail, fake });
    const body = fixture.request();
    const created = await post(app, fixture.ownerId, body);
    expect(created.status).toBe(201);
    const first = (await created.json()).data as { instanceId: string; checkoutUrl: string };
    return { fixture, app, fake, body, first };
}

/** The identity the screen re-sends, as it reads it, under a fresh order id. */
function retryBodyFrom(identity: {
    readonly productId: string;
    readonly targetId: string | null;
    readonly addonVersionId: string;
}) {
    return {
        productId: identity.productId,
        targetId: identity.targetId,
        addonVersionId: identity.addonVersionId,
        orderRequestId: crypto.randomUUID()
    };
}

describe('HOS-2680 return actions on a recurring add-on purchase', () => {
    it('the owner read carries the purchase identity, and a foreign read is still 404', async () => {
        // Arrange
        const { fixture, app, body, first } = await pendingRecurringPurchase();

        // Act
        const own = await read(app, fixture.ownerId, body.orderRequestId);
        const foreign = await read(app, crypto.randomUUID(), body.orderRequestId);

        // Assert
        expect(own.status).toBe(200);
        expect((await own.json()).data).toEqual({
            instanceId: first.instanceId,
            status: 'PENDING_AUTHORIZATION',
            chargeKind: 'PERIODICO',
            processing: true,
            productId: fixture.productId,
            targetId: null,
            addonVersionId: fixture.versionId
        });
        expect(foreign.status).toBe(404);
        expect(await foreign.json()).toMatchObject({ error: { code: 'ADDON_PURCHASE_NOT_FOUND' } });
    });

    it('«Reintentar el pago» (fresh order id, no payer email) reopens the same checkout and creates nothing', async () => {
        // Arrange
        const { fixture, app, fake, body, first } = await pendingRecurringPurchase();
        const identity = (await (await read(app, fixture.ownerId, body.orderRequestId)).json())
            .data;
        const authorize = vi.spyOn(fake, 'authorize');
        const providerRead = vi.spyOn(fake, 'readAuthorization');

        // Act
        const retried = await post(app, fixture.ownerId, retryBodyFrom(identity));

        // Assert
        expect(retried.status).toBe(200);
        expect((await retried.json()).data).toMatchObject({
            outcome: 'EXISTING',
            instanceId: first.instanceId,
            processing: false,
            checkoutUrl: first.checkoutUrl
        });
        expect(providerRead).toHaveBeenCalled();
        expect(authorize).toHaveBeenCalledTimes(0);
        expect(await ownerInstances(fixture.ownerId)).toHaveLength(1);
    });

    it('«Reintentar el pago» after the owner paid but before the webhook never hands out a link to pay again', async () => {
        // Arrange: the owner approved the preapproval at the provider; no notice was processed.
        const { fixture, app, fake, body, first } = await pendingRecurringPurchase();
        const [instance] = await getDb()
            .select({ complementId: addonInstances.complementSubscriptionId })
            .from(addonInstances)
            .where(eq(addonInstances.id, first.instanceId));
        const [link] = await getDb()
            .select({ providerId: providerLinks.providerId })
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, instance?.complementId ?? ''));
        if (!link) throw new Error('Missing addon preapproval link');
        await fake.approve({ authorizationId: link.providerId });
        const identity = (await (await read(app, fixture.ownerId, body.orderRequestId)).json())
            .data;
        expect(identity.status).toBe('PENDING_AUTHORIZATION');
        const authorize = vi.spyOn(fake, 'authorize');

        // Act
        const retried = await post(app, fixture.ownerId, retryBodyFrom(identity));

        // Assert
        expect(retried.status).toBe(409);
        const answer = await retried.json();
        expect(answer).toMatchObject({ error: { code: 'ADDON_ALREADY_ACTIVE' } });
        expect(JSON.stringify(answer)).not.toContain(first.checkoutUrl);
        expect(authorize).toHaveBeenCalledTimes(0);
        expect(await ownerInstances(fixture.ownerId)).toMatchObject([
            { id: first.instanceId, status: 'PENDING_AUTHORIZATION' }
        ]);
    });

    it('«Usar otro mail» releases the pending purchase and opens a new checkout for the new payer', async () => {
        // Arrange
        const { fixture, app, fake, body, first } = await pendingRecurringPurchase();
        const identity = (await (await read(app, fixture.ownerId, body.orderRequestId)).json())
            .data;
        const authorize = vi.spyOn(fake, 'authorize');

        // Act
        const changed = await post(app, fixture.ownerId, {
            ...retryBodyFrom(identity),
            payerEmail: `other-${crypto.randomUUID()}@example.test`
        });

        // Assert
        expect(changed.status).toBe(201);
        const answer = (await changed.json()).data;
        expect(answer).toMatchObject({
            outcome: 'CREATED',
            processing: false,
            checkoutUrl: expect.any(String)
        });
        expect(answer.instanceId).not.toBe(first.instanceId);
        expect(authorize).toHaveBeenCalledTimes(1);
        const rows = await ownerInstances(fixture.ownerId);
        expect(rows.find((row) => row.id === first.instanceId)?.status).toBe('ABANDONED');
        expect(rows.find((row) => row.id === answer.instanceId)?.status).toBe(
            'PENDING_AUTHORIZATION'
        );
    });

    it('«Empezar una compra nueva» after the purchase closed creates a new checkout from the read identity', async () => {
        // Arrange: the pending purchase was closed (as the window expiry leaves it).
        const { fixture, app, body, first } = await pendingRecurringPurchase();
        await getDb()
            .update(addonInstances)
            .set({ status: 'EXPIRED' })
            .where(eq(addonInstances.id, first.instanceId));
        const identity = (await (await read(app, fixture.ownerId, body.orderRequestId)).json())
            .data;
        expect(identity.status).toBe('EXPIRED');

        // Act
        const fresh = await post(app, fixture.ownerId, {
            ...retryBodyFrom(identity),
            payerEmail: fixture.payerEmail
        });

        // Assert
        expect(fresh.status).toBe(201);
        const answer = (await fresh.json()).data;
        expect(answer).toMatchObject({ outcome: 'CREATED', checkoutUrl: expect.any(String) });
        expect(answer.instanceId).not.toBe(first.instanceId);
    });
});
