import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders } from '../billing-subscription/revocation-route-fixtures';
import {
    baselineFake,
    cleanupConfirmRefundRows,
    confirmClock,
    confirmFake,
    confirmRows,
    seedConfirmRefund
} from './confirm-refund-fixtures';

let app: ReturnType<typeof initApp>;
const post = (refundId: string, headers: HeadersInit) =>
    app.request(`/api/v1/admin/billing-refunds/${refundId}/decline`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ declined: true })
    });

describe('TEST:B6:2 administrative action 13 decline actor gates', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp({ clock: confirmClock, paymentProvider: confirmFake });
    });
    afterEach(() => {
        injectPaymentProvider({ provider: baselineFake });
        vi.restoreAllMocks();
    });
    afterAll(async () => {
        await cleanupConfirmRefundRows();
        await testDb.teardown();
    });

    it('answers 401 without a session', async () => {
        const seeded = await seedConfirmRefund();
        const refundSpy = vi.spyOn(confirmFake, 'refund');
        const response = await post(seeded.refundId, actorHeaders(undefined));
        expect(response.status).toBe(401);
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('REQUESTED');
        expect(refundSpy).toHaveBeenCalledTimes(0);
    });

    it('answers 403 to an admin without billing.refund before changing the row', async () => {
        const seeded = await seedConfirmRefund();
        const refundSpy = vi.spyOn(confirmFake, 'refund');
        const response = await post(
            seeded.refundId,
            actorHeaders({
                id: seeded.adminId,
                role: 'ADMIN',
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.BILLING_SETTLE_EXTERNAL
                ]
            })
        );
        expect(response.status).toBe(403);
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('REQUESTED');
        expect(refundSpy).toHaveBeenCalledTimes(0);
    });
});
