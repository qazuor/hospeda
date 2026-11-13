import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { injectAddonPurchaseListingForTests } from '../../../src/routes/billing-addon/purchase-ports';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import {
    ownerHeaders,
    ownerInstances,
    purchaseCatalog,
    retirePurchaseRoutes,
    routeClock
} from './support/addon-purchase-route-fixtures';

const path = '/api/v1/protected/billing/addons/purchases';

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
});
afterEach(retirePurchaseRoutes);
afterAll(async () => testDb.teardown());

describe('TEST:B10:2 AC:B10:1 target contract and current addon policy', () => {
    it('answers the same 404 for an ineligible or foreign listing and 409 for an old version', async () => {
        const fixture = await purchaseCatalog({ scopeType: 'LISTING' });
        const fake = new FakePaymentProvider({
            clock: routeClock,
            idNamespace: crypto.randomUUID()
        });
        const authorize = vi.spyOn(fake, 'authorize');
        const chargeOnce = vi.spyOn(fake, 'chargeOnce');
        injectClock({ clock: routeClock });
        injectPaymentProvider({ provider: fake });
        const app = initApp({ clock: routeClock, paymentProvider: fake });
        const post = (body: object) =>
            app.request(path, {
                method: 'POST',
                headers: ownerHeaders(fixture.ownerId),
                body: JSON.stringify(body)
            });
        const targetId = crypto.randomUUID();
        injectAddonPurchaseListingForTests({
            listing: async () => ({
                vertical: VerticalEnum.ACCOMMODATION,
                ownerId: fixture.ownerId,
                acceptsFeature: false
            })
        });
        const ineligible = await post(fixture.request(targetId));
        expect(ineligible.status).toBe(404);
        const ineligibleBody = await ineligible.json();
        expect(ineligibleBody).toMatchObject({
            success: false,
            error: { code: 'ADDON_TARGET_NOT_FOUND' }
        });

        injectAddonPurchaseListingForTests({
            listing: async () => ({
                vertical: VerticalEnum.ACCOMMODATION,
                ownerId: crypto.randomUUID(),
                acceptsFeature: true
            })
        });
        const foreign = await post(fixture.request(targetId));
        expect(foreign.status).toBe(404);
        const foreignBody = await foreign.json();
        expect(foreignBody).toEqual({
            ...ineligibleBody,
            metadata: {
                timestamp: expect.any(String),
                requestId: expect.any(String)
            }
        });

        const oldVersion = await post({
            ...fixture.request(targetId),
            addonVersionId: crypto.randomUUID()
        });
        expect(oldVersion.status).toBe(409);
        expect(await oldVersion.json()).toMatchObject({
            error: { code: 'ADDON_VERSION_NOT_CURRENT' }
        });
        expect(await ownerInstances(fixture.ownerId)).toEqual([]);
        expect(authorize).toHaveBeenCalledTimes(0);
        expect(chargeOnce).toHaveBeenCalledTimes(0);
    });
});
