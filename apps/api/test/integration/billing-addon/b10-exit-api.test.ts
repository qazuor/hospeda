import { addonInstances, addonProducts, eq, getDb, providerLinks, sql } from '@repo/db';
import { encodeFakeNotice } from '@repo/payments/fake';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { processProviderNotice } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildComplementPolicyPorts } from '../../../src/utils/billing-complement-ports';
import { testDb } from '../../e2e/setup/test-database';
import {
    createListing,
    createOwner,
    createVerticalDestination,
    ensurePublicationCatalog
} from '../listing-publication/publication-routes.helpers';
import {
    makePayingPrincipal,
    ownerHeaders,
    purchaseApp,
    purchaseCatalog,
    retirePurchaseRoutes,
    routeClock
} from './support/addon-purchase-route-fixtures';

const purchasePath = '/api/v1/protected/billing/addons/purchases';
const listings: string[] = [];
const destinations: string[] = [];
const foreignOwners: string[] = [];

async function publishedListing(ownerId: string): Promise<string> {
    // The listing row is seeded because addon purchase does not create listings.
    const destinationId = await createVerticalDestination();
    destinations.push(destinationId);
    const id = await createListing({
        ownerId,
        destinationId,
        status: PublicationStatusEnum.PUBLISHED
    });
    listings.push(id);
    return id;
}

async function cleanup(): Promise<void> {
    await retirePurchaseRoutes();
    for (const id of listings.splice(0))
        await getDb().execute(sql`DELETE FROM accommodations WHERE id = ${id}::uuid`);
    for (const id of destinations.splice(0))
        await getDb().execute(sql`DELETE FROM destinations WHERE id = ${id}::uuid`);
    for (const id of foreignOwners.splice(0))
        await getDb().execute(sql`DELETE FROM users WHERE id = ${id}::uuid`);
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    await ensurePublicationCatalog(VerticalEnum.ACCOMMODATION);
});
afterEach(cleanup);
afterAll(async () => testDb.teardown());

describe('LISTA:B10 clause 6 borrar una ficha dice qué addons se pierden y por cuánto antes de borrarla', () => {
    it('shows the A1 instance with the current product price before purge', async () => {
        const fixture = await purchaseCatalog({ scopeType: 'LISTING', chargeKind: 'PERIODICO' });
        const { app, fake } = purchaseApp();
        await makePayingPrincipal({
            ownerId: fixture.ownerId,
            payerEmail: fixture.payerEmail,
            fake
        });
        const listingId = await publishedListing(fixture.ownerId);
        const orderRequestId = crypto.randomUUID();
        const purchase = await app.request(purchasePath, {
            method: 'POST',
            headers: ownerHeaders(fixture.ownerId),
            body: JSON.stringify(fixture.request(listingId, orderRequestId))
        });
        expect(purchase.status).toBe(201);
        const purchaseData = (await purchase.json()).data as { instanceId: string };
        const [instance] = await getDb()
            .select({ authorizationId: providerLinks.providerId })
            .from(addonInstances)
            .innerJoin(
                providerLinks,
                eq(providerLinks.subscriptionId, addonInstances.complementSubscriptionId)
            )
            .where(eq(addonInstances.id, purchaseData.instanceId));
        if (!instance?.authorizationId) throw new Error('A1 authorization missing');
        await fake.approve({ authorizationId: instance.authorizationId });
        const notice = encodeFakeNotice({
            notice: {
                resourceKind: 'authorization',
                resourceId: instance.authorizationId,
                version: '1'
            },
            format: 'json'
        });
        const applied = await processProviderNotice(
            {
                channel: 'WEBHOOKS',
                delivery: { headers: { 'content-type': 'application/json' }, body: notice.body }
            },
            {
                provider: fake,
                clock: routeClock,
                beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                complements: buildComplementPolicyPorts()
            }
        );
        expect(applied.outcome).toBe('APPLIED');

        const [product] = await getDb()
            .select({ price: addonProducts.price })
            .from(addonProducts)
            .where(eq(addonProducts.id, fixture.productId));
        if (!product) throw new Error('Seeded product missing');
        const preview = await app.request(
            `/api/v1/protected/accommodations/${listingId}/purge-preview`,
            { headers: ownerHeaders(fixture.ownerId) }
        );
        expect(preview.status).toBe(200);
        // The preview quotes the current product price, not the historical amount paid.
        expect((await preview.json()).data.lostAddons).toEqual([
            {
                addonInstanceId: purchaseData.instanceId,
                name: 'Route addon',
                chargeKind: 'PERIODICO',
                cycle: 'monthly',
                price: product.price,
                currency: 'ARS',
                status: 'ACTIVE',
                endsAt: null
            }
        ]);
    });
});

describe('LISTA:V5 clause 7 a foreign PUBLISHED listing as addon target answers not found', () => {
    it('rejects the real foreign listing before creating an instance or calling the provider', async () => {
        const fixture = await purchaseCatalog({ scopeType: 'LISTING', chargeKind: 'PERIODICO' });
        const { app, fake } = purchaseApp();
        await makePayingPrincipal({
            ownerId: fixture.ownerId,
            payerEmail: fixture.payerEmail,
            fake
        });
        const foreign = await createOwner();
        foreignOwners.push(foreign.id);
        const targetId = await publishedListing(foreign.id);
        const orderRequestId = crypto.randomUUID();
        const authorize = vi.spyOn(fake, 'authorize');
        const response = await app.request(purchasePath, {
            method: 'POST',
            headers: ownerHeaders(fixture.ownerId),
            body: JSON.stringify(fixture.request(targetId, orderRequestId))
        });
        expect(response.status).toBe(404);
        expect((await response.json()).error.code).toBe('ADDON_TARGET_NOT_FOUND');
        const rows = await getDb()
            .select({ id: addonInstances.id })
            .from(addonInstances)
            .where(eq(addonInstances.orderRequestId, orderRequestId));
        expect(rows).toHaveLength(0);
        expect(authorize).toHaveBeenCalledTimes(0);
    });
});
