import { eq, getDb, refunds } from '@repo/db';
import { PermissionEnum, ProposedRefundListResponseSchema } from '@repo/schemas';
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
    seedConfirmRefund
} from './confirm-refund-fixtures';

const permissions = [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_REFUND];
const PATH = '/api/v1/admin/billing-refunds/proposed';
let app: ReturnType<typeof initApp>;

const list = (headers: HeadersInit, query = '?page=1&pageSize=100') =>
    app.request(`${PATH}${query}`, { method: 'GET', headers });

describe('HOS-2400 proposed refunds list route', () => {
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

    it('lists a MARK_PROPOSAL refund in the declared response shape', async () => {
        // Arrange
        const seeded = await seedConfirmRefund();
        await getDb()
            .update(refunds)
            .set({ reason: 'MARK_PROPOSAL' })
            .where(eq(refunds.id, seeded.refundId));

        // Act
        const response = await list(
            actorHeaders({ id: seeded.adminId, role: 'SUPER_ADMIN', permissions })
        );

        // Assert
        expect(response.status).toBe(200);
        const data = ProposedRefundListResponseSchema.parse((await response.json()).data);
        const item = data.items.find((entry) => entry.refundId === seeded.refundId);
        expect(item).toMatchObject({
            status: 'REQUESTED',
            payment: { source: 'PAYMENT', id: seeded.paymentId },
            providerCallCount: 0,
            closesHeldCharge: false
        });
        expect(data.pagination.page).toBe(1);
    });

    it('leaves out a refund that is not a mark proposal', async () => {
        // Arrange: seedConfirmRefund requests a REVOCATION refund.
        const seeded = await seedConfirmRefund();

        // Act
        const response = await list(
            actorHeaders({ id: seeded.adminId, role: 'SUPER_ADMIN', permissions })
        );

        // Assert
        const data = ProposedRefundListResponseSchema.parse((await response.json()).data);
        expect(data.items.map((entry) => entry.refundId)).not.toContain(seeded.refundId);
    });

    it('answers 401 without a session', async () => {
        const response = await list(actorHeaders(undefined));
        expect(response.status).toBe(401);
    });

    it('answers 403 to an admin without billing.refund', async () => {
        const seeded = await seedConfirmRefund();
        const response = await list(
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
    });

    it('rejects a page size above the limit with 400', async () => {
        const seeded = await seedConfirmRefund();
        const response = await list(
            actorHeaders({ id: seeded.adminId, role: 'SUPER_ADMIN', permissions }),
            '?page=1&pageSize=101'
        );
        expect(response.status).toBe(400);
    });
});
