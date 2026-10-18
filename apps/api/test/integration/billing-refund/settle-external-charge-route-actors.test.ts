import { PermissionEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, seedUser } from '../billing-subscription/revocation-route-fixtures';
import {
    chargeClock,
    chargeFake,
    cleanupExternalChargeRows,
    paymentsForCharge,
    seedUnrecordedApprovedCharge
} from './settle-external-charge-fixtures';

const PATH = '/api/v1/admin/billing-refunds/external-charge';
let app: ReturnType<typeof initApp>;
let adminId: string;
const permitted = [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_SETTLE_EXTERNAL];
function post(
    body: unknown,
    actor?: { id: string; role: string; permissions: readonly PermissionEnum[] }
) {
    return app.request(PATH, {
        method: 'POST',
        headers: actorHeaders(actor),
        body: JSON.stringify(body)
    });
}

describe('TEST:B5:6 AC:B5:11 admin action 14 charge settlement actors', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        injectPaymentProvider({ provider: chargeFake });
        app = initApp({ clock: chargeClock, paymentProvider: chargeFake });
        adminId = await seedUser('charge-actor-admin');
    });
    afterAll(async () => {
        await cleanupExternalChargeRows();
        await testDb.teardown();
    });

    it('returns 401 without a session', async () => {
        const seeded = await seedUnrecordedApprovedCharge();
        const response = await post({ chargeId: seeded.chargeId });
        expect(response.status).toBe(401);
        expect(await paymentsForCharge(seeded.chargeId)).toHaveLength(0);
    });

    it('returns the factory 403 before invalid body parsing and writes no payment', async () => {
        const seeded = await seedUnrecordedApprovedCharge();
        const providerRead = vi.spyOn(chargeFake, 'readCharge');
        const response = await post(
            { chargeId: '' },
            { id: adminId, role: 'ADMIN', permissions: [PermissionEnum.ACCESS_PANEL_ADMIN] }
        );
        expect(response.status).toBe(403);
        expect(providerRead).not.toHaveBeenCalled();
        providerRead.mockRestore();
        expect(await paymentsForCharge(seeded.chargeId)).toHaveLength(0);
    });

    it('forbids the subscription owner after service authorization and writes no payment', async () => {
        const seeded = await seedUnrecordedApprovedCharge();
        const response = await post(
            { chargeId: seeded.chargeId },
            { id: seeded.ownerId, role: 'SUPER_ADMIN', permissions: permitted }
        );
        expect(response.status).toBe(403);
        expect((await response.json()).error).toMatchObject({
            code: 'FORBIDDEN',
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
        });
        expect(await paymentsForCharge(seeded.chargeId)).toHaveLength(0);
    });
});
