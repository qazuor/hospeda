import { addonInstances, eq, getDb, platformSettings } from '@repo/db';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { testDb } from '../../e2e/setup/test-database';
import {
    makePayingPrincipal,
    ownerHeaders,
    purchaseApp,
    purchaseCatalog,
    retirePurchaseRoutes
} from './support/addon-purchase-route-fixtures';

async function setFreeze(key: string, frozen: boolean, updatedBy: string) {
    await getDb()
        .insert(platformSettings)
        .values({ key, value: { frozen }, updatedBy })
        .onConflictDoUpdate({
            target: platformSettings.key,
            set: { value: { frozen }, updatedBy }
        });
}

const post = (app: ReturnType<typeof purchaseApp>['app'], ownerId: string, body: object) =>
    app.request('/api/v1/protected/billing/addons/purchases', {
        method: 'POST',
        headers: ownerHeaders(ownerId),
        body: JSON.stringify(body)
    });

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
});
beforeEach(async () => {
    await testDb.clean();
});
afterEach(async () => {
    await getDb()
        .delete(platformSettings)
        .where(eq(platformSettings.key, 'billing.addonPurchasesFreeze'));
    await getDb()
        .delete(platformSettings)
        .where(eq(platformSettings.key, 'billing.paidSignupsFreeze'));
    await retirePurchaseRoutes();
});
afterAll(async () => testDb.teardown());

describe('HOS-1749 A1 addon purchase freeze', () => {
    it('answers 409 and creates no addon instance while frozen', async () => {
        const fixture = await purchaseCatalog({ chargeKind: 'PERIODICO' });
        const { app, fake } = purchaseApp();
        await makePayingPrincipal({
            ownerId: fixture.ownerId,
            payerEmail: fixture.payerEmail,
            fake
        });
        await setFreeze('billing.addonPurchasesFreeze', true, fixture.ownerId);
        const response = await post(app, fixture.ownerId, fixture.request());
        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ error: { code: 'ADDON_PURCHASES_FROZEN' } });
        expect(
            await getDb()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.ownerId, fixture.ownerId))
        ).toEqual([]);
    });

    it('allows purchases when the addon freeze row is false', async () => {
        const fixture = await purchaseCatalog({ chargeKind: 'PERIODICO' });
        const { app, fake } = purchaseApp();
        await makePayingPrincipal({
            ownerId: fixture.ownerId,
            payerEmail: fixture.payerEmail,
            fake
        });
        await setFreeze('billing.addonPurchasesFreeze', false, fixture.ownerId);
        expect((await post(app, fixture.ownerId, fixture.request())).status).toBe(201);
    });

    it('does not let the paid signup freeze block addon purchases', async () => {
        const fixture = await purchaseCatalog({ chargeKind: 'PERIODICO' });
        const { app, fake } = purchaseApp();
        await makePayingPrincipal({
            ownerId: fixture.ownerId,
            payerEmail: fixture.payerEmail,
            fake
        });
        await setFreeze('billing.paidSignupsFreeze', true, fixture.ownerId);
        expect((await post(app, fixture.ownerId, fixture.request())).status).toBe(201);
    });
});
