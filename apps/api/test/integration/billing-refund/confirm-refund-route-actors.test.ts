import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import {
    baselineFake,
    cleanupConfirmRefundRows,
    confirmClock,
    confirmFake,
    confirmRequest,
    confirmRows,
    seedConfirmRefund
} from './confirm-refund-fixtures';

let app: ReturnType<typeof initApp>;
const validBody = { confirmed: true };

describe('TEST:B6:1 admin action 13 route actor gates', () => {
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

    it('answers 401 without a session before reading a valid confirmation body', async () => {
        const seeded = await seedConfirmRefund();
        const refundSpy = vi.spyOn(confirmFake, 'refund');
        const response = await confirmRequest(app, seeded.refundId, undefined, validBody);
        expect(response.status).toBe(401);
        expect(refundSpy).toHaveBeenCalledTimes(0);
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('REQUESTED');
    });

    it('answers 403 to an ADMIN without billing.refund', async () => {
        const seeded = await seedConfirmRefund();
        const refundSpy = vi.spyOn(confirmFake, 'refund');
        const response = await confirmRequest(
            app,
            seeded.refundId,
            {
                id: seeded.adminId,
                role: 'ADMIN',
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.BILLING_SETTLE_EXTERNAL
                ]
            },
            validBody
        );
        expect(response.status).toBe(403);
        expect(refundSpy).toHaveBeenCalledTimes(0);
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('REQUESTED');
    });

    it('answers 403 to an actor with billing.settleExternal but without billing.refund', async () => {
        const seeded = await seedConfirmRefund();
        const refundSpy = vi.spyOn(confirmFake, 'refund');
        const response = await confirmRequest(
            app,
            seeded.refundId,
            {
                id: seeded.adminId,
                role: 'SUPER_ADMIN',
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.BILLING_SETTLE_EXTERNAL
                ]
            },
            validBody
        );
        expect(response.status).toBe(403);
        expect(refundSpy).toHaveBeenCalledTimes(0);
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('REQUESTED');
    });

    it('checks the route permission before rejecting a malformed body', async () => {
        const seeded = await seedConfirmRefund();
        const response = await confirmRequest(
            app,
            seeded.refundId,
            {
                id: seeded.adminId,
                role: 'ADMIN',
                permissions: [PermissionEnum.ACCESS_PANEL_ADMIN]
            },
            { confirmed: false }
        );
        expect(response.status).toBe(403);
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('REQUESTED');
    });

    it('allows a SUPER_ADMIN holding billing.refund', async () => {
        const seeded = await seedConfirmRefund();
        const response = await confirmRequest(
            app,
            seeded.refundId,
            {
                id: seeded.adminId,
                role: 'SUPER_ADMIN',
                permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_REFUND]
            },
            validBody
        );
        expect(response.status).toBe(200);
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('CONFIRMED');
    });
});
