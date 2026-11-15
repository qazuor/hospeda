import {
    accommodations,
    addonInstances,
    destinations,
    emailOutbox,
    eq,
    getDb,
    providerLinks,
    subscriptions
} from '@repo/db';
import { encodeFakeNotice } from '@repo/payments/fake';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { processProviderNotice } from '@repo/service-core';
import { sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    buildAddonPurchasePorts,
    injectAddonPurchaseListingForTests
} from '../../../src/routes/billing-addon/purchase-ports';
import { beforeCancelNotice } from '../../../src/routes/billing-subscription/before-cancel-notice';
import { buildComplementPolicyPorts } from '../../../src/utils/billing-complement-ports';
import { testDb } from '../../e2e/setup/test-database';
import {
    createListing,
    createVerticalDestination
} from '../listing-publication/publication-routes.helpers';
import {
    makePayingPrincipal,
    ownerHeaders,
    purchaseApp,
    purchaseCatalog,
    retirePurchaseRoutes
} from './support/addon-purchase-route-fixtures';

const base = '/api/v1/protected/billing/addons';
const listingIds: string[] = [];
const destinationIds: string[] = [];

function call(
    app: ReturnType<typeof purchaseApp>['app'],
    ownerId: string,
    path: string,
    method = 'GET'
) {
    return app.request(`${base}${path}`, { method, headers: ownerHeaders(ownerId) });
}

async function purchase(input: {
    readonly app: ReturnType<typeof purchaseApp>['app'];
    readonly ownerId: string;
    readonly request: object;
}) {
    const response = await input.app.request(`${base}/purchases`, {
        method: 'POST',
        headers: ownerHeaders(input.ownerId),
        body: JSON.stringify(input.request)
    });
    expect(response.status).toBe(201);
    return (await response.json()).data.instanceId as string;
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
});
afterEach(async () => {
    vi.restoreAllMocks();
    await retirePurchaseRoutes();
    for (const id of listingIds.splice(0))
        await getDb().delete(accommodations).where(eq(accommodations.id, id));
    for (const id of destinationIds.splice(0))
        await getDb().delete(destinations).where(eq(destinations.id, id));
});
afterAll(async () => testDb.teardown());

describe('TEST:B13b:1 AC:B13b:1 the owner withdrawal route', () => {
    it('requires an owner session and a valid listing filter for the recurring list', async () => {
        const { app } = purchaseApp();
        const guest = await app.request(`${base}/instances`, {
            headers: { ...ownerHeaders(crypto.randomUUID()), 'x-mock-actor-role': 'GUEST' }
        });
        expect(guest.status).toBe(401);
        const invalid = await call(app, crypto.randomUUID(), '/instances?listingId=bad');
        expect(invalid.status).toBe(400);
    });

    it("lists only this actor's live recurring addons, including a listing filter and its name", async () => {
        const recurrent = await purchaseCatalog({ chargeKind: 'PERIODICO', scopeType: 'LISTING' });
        const foreign = await purchaseCatalog({ chargeKind: 'PERIODICO' });
        const once = await purchaseCatalog({
            chargeKind: 'UNA_VEZ',
            owner: { id: recurrent.ownerId, email: recurrent.payerEmail }
        });
        const { app, fake } = purchaseApp();
        await makePayingPrincipal({
            ownerId: recurrent.ownerId,
            payerEmail: recurrent.payerEmail,
            fake
        });
        await makePayingPrincipal({
            ownerId: foreign.ownerId,
            payerEmail: foreign.payerEmail,
            fake
        });
        const destinationId = await createVerticalDestination();
        destinationIds.push(destinationId);
        // The listing is seeded because this route reads an existing listing; purchase still uses A1.
        const listingId = await createListing({
            ownerId: recurrent.ownerId,
            destinationId,
            status: PublicationStatusEnum.DRAFT,
            complete: false
        });
        listingIds.push(listingId);
        injectAddonPurchaseListingForTests({
            listing: async () => ({
                vertical: VerticalEnum.ACCOMMODATION,
                ownerId: recurrent.ownerId,
                acceptsFeature: true
            })
        });
        const ownId = await purchase({
            app,
            ownerId: recurrent.ownerId,
            request: recurrent.request(listingId)
        });
        await purchase({ app, ownerId: foreign.ownerId, request: foreign.request() });
        await purchase({ app, ownerId: recurrent.ownerId, request: once.request() });
        const all = await call(app, recurrent.ownerId, '/instances');
        expect(all.status).toBe(200);
        expect((await all.json()).data.items).toEqual([
            {
                addonInstanceId: ownId,
                name: 'Route addon',
                chargeKind: 'PERIODICO',
                cycle: 'monthly',
                price: 5000,
                currency: 'ARS',
                status: 'PENDING_AUTHORIZATION',
                targetId: listingId,
                targetName: 'Matrix listing'
            }
        ]);
        const filtered = await call(app, recurrent.ownerId, `/instances?listingId=${listingId}`);
        expect(filtered.status).toBe(200);
        expect((await filtered.json()).data.items).toEqual([
            {
                addonInstanceId: ownId,
                name: 'Route addon',
                chargeKind: 'PERIODICO',
                cycle: 'monthly',
                price: 5000,
                currency: 'ARS',
                status: 'PENDING_AUTHORIZATION',
                targetId: listingId,
                targetName: 'Matrix listing'
            }
        ]);
        const otherListing = await call(
            app,
            recurrent.ownerId,
            `/instances?listingId=${crypto.randomUUID()}`
        );
        expect((await otherListing.json()).data.items).toEqual([]);
    });

    it('withdraws the owner addon, persists CANCELLED and cancels its own provider authorization once after mail', async () => {
        const fixture = await purchaseCatalog({ chargeKind: 'PERIODICO' });
        const { app, fake } = purchaseApp();
        await makePayingPrincipal({
            ownerId: fixture.ownerId,
            payerEmail: fixture.payerEmail,
            fake
        });
        const id = await purchase({ app, ownerId: fixture.ownerId, request: fixture.request() });
        const [instance] = await getDb()
            .select()
            .from(addonInstances)
            .where(eq(addonInstances.id, id));
        if (!instance?.complementSubscriptionId) throw new Error('Complement missing');
        const [link] = await getDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, instance.complementSubscriptionId));
        if (!link) throw new Error('Provider link missing');
        await fake.approve({ authorizationId: link.providerId });
        const notice = encodeFakeNotice({
            notice: { resourceKind: 'authorization', resourceId: link.providerId, version: '1' },
            format: 'json'
        });
        const applied = await processProviderNotice(
            {
                channel: 'WEBHOOKS',
                delivery: { headers: { 'content-type': 'application/json' }, body: notice.body }
            },
            {
                ...buildAddonPurchasePorts(),
                complements: buildComplementPolicyPorts(),
                beforeCancelNotice: { beforeCancel: async () => 'SENT' }
            }
        );
        expect(applied.outcome).toBe('APPLIED');
        const realNotice = beforeCancelNotice.beforeCancel.bind(beforeCancelNotice);
        vi.spyOn(beforeCancelNotice, 'beforeCancel').mockImplementation(async (args) => {
            await realNotice(args);
            await getDb()
                .update(emailOutbox)
                .set({ status: 'sent' })
                .where(eq(emailOutbox.recipientUserId, fixture.ownerId));
            return 'SENT';
        });
        const cancel = vi.spyOn(fake, 'cancel');
        const response = await call(app, fixture.ownerId, `/instances/${id}/withdrawal`, 'POST');
        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual({
            instanceId: id,
            status: 'CANCELLED',
            providerCall: 'SENT'
        });
        const [after] = await getDb()
            .select()
            .from(addonInstances)
            .where(eq(addonInstances.id, id));
        expect(after).toMatchObject({
            id,
            ownerId: fixture.ownerId,
            status: 'CANCELLED',
            updatedAt: expect.any(Date)
        });
        const [complement] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, instance.complementSubscriptionId));
        expect(complement).toMatchObject({
            id: instance.complementSubscriptionId,
            status: 'CANCELLED'
        });
        expect(cancel.mock.calls.map(([args]) => args.authorizationId)).toEqual([link.providerId]);
        const outbox = await getDb()
            .select({
                status: emailOutbox.status,
                subscriptionId: sql<string>`${emailOutbox.payload}->>'subscriptionId'`
            })
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, fixture.ownerId));
        expect(
            outbox.filter((row) => row.subscriptionId === instance.complementSubscriptionId)
        ).toEqual([{ status: 'sent', subscriptionId: instance.complementSubscriptionId }]);
        const remaining = await call(app, fixture.ownerId, '/instances');
        expect((await remaining.json()).data.items).toEqual([]);
    });

    it('hides a foreign instance, rejects absent session and invalid ids, and refuses one-time purchases', async () => {
        const foreign = await purchaseCatalog({ chargeKind: 'PERIODICO' });
        const own = await purchaseCatalog({ chargeKind: 'UNA_VEZ' });
        const { app, fake } = purchaseApp();
        await makePayingPrincipal({
            ownerId: foreign.ownerId,
            payerEmail: foreign.payerEmail,
            fake
        });
        await makePayingPrincipal({ ownerId: own.ownerId, payerEmail: own.payerEmail, fake });
        const foreignId = await purchase({
            app,
            ownerId: foreign.ownerId,
            request: foreign.request()
        });
        const onceId = await purchase({ app, ownerId: own.ownerId, request: own.request() });
        const before = await getDb()
            .select()
            .from(addonInstances)
            .where(eq(addonInstances.id, foreignId));
        const cancel = vi.spyOn(fake, 'cancel');
        const denied = await call(app, own.ownerId, `/instances/${foreignId}/withdrawal`, 'POST');
        expect(denied.status).toBe(404);
        expect(await denied.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
        expect(
            await getDb().select().from(addonInstances).where(eq(addonInstances.id, foreignId))
        ).toEqual(before);
        const absent = await app.request(`${base}/instances/${foreignId}/withdrawal`, {
            method: 'POST',
            headers: { 'user-agent': 'vitest' }
        });
        expect(absent.status).toBe(401);
        const guest = await app.request(`${base}/instances/${foreignId}/withdrawal`, {
            method: 'POST',
            headers: { ...ownerHeaders(crypto.randomUUID()), 'x-mock-actor-role': 'GUEST' }
        });
        expect(guest.status).toBe(401);
        const absentList = await app.request(`${base}/instances`, {
            headers: { 'user-agent': 'vitest' }
        });
        expect(absentList.status).toBe(401);
        const missing = await call(
            app,
            own.ownerId,
            `/instances/${crypto.randomUUID()}/withdrawal`,
            'POST'
        );
        expect(missing.status).toBe(404);
        expect(await missing.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
        const invalid = await call(app, own.ownerId, '/instances/bad/withdrawal', 'POST');
        expect(invalid.status).toBe(400);
        const once = await call(app, own.ownerId, `/instances/${onceId}/withdrawal`, 'POST');
        expect(once.status).toBe(409);
        expect(await once.json()).toMatchObject({
            error: { code: 'ALREADY_EXISTS', reason: 'ADDON_NOT_WITHDRAWABLE' }
        });
        expect(cancel.mock.calls).toHaveLength(0);
    });
});
