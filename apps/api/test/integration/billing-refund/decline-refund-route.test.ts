import { eq, getDb, payments } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, NOW } from '../billing-subscription/revocation-route-fixtures';
import {
    baselineFake,
    cleanupConfirmRefundRows,
    confirmClock,
    confirmFake,
    confirmRequest,
    confirmRows,
    seedConfirmRefund
} from './confirm-refund-fixtures';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

const permissions = [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_REFUND];
let app: ReturnType<typeof initApp>;

const decline = (refundId: string, adminId: string, body: unknown = { declined: true }) =>
    app.request(`/api/v1/admin/billing-refunds/${refundId}/decline`, {
        method: 'POST',
        headers: actorHeaders({ id: adminId, role: 'SUPER_ADMIN', permissions }),
        body: JSON.stringify(body)
    });

const paymentState = async (paymentId: string) => {
    const [row] = await getDb()
        .select({
            status: payments.status,
            refundedAmount: payments.refundedAmount,
            version: payments.version
        })
        .from(payments)
        .where(eq(payments.id, paymentId));
    if (!row) throw new Error('Expected seeded payment');
    return row;
};

describe('TEST:B6:2 administrative action 13 decline route', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp({ clock: confirmClock, paymentProvider: confirmFake });
    });
    afterEach(() => {
        confirmClock.set(NOW);
        injectPaymentProvider({ provider: baselineFake });
        vi.restoreAllMocks();
        audit.mockClear();
    });
    afterAll(async () => {
        await cleanupConfirmRefundRows();
        await testDb.teardown();
    });

    it('declines a REQUESTED refund through RF5 and preserves the payment', async () => {
        // Arrange
        const seeded = await seedConfirmRefund();
        const before = await paymentState(seeded.paymentId);
        const refundSpy = vi.spyOn(confirmFake, 'refund');

        // Act
        const response = await decline(seeded.refundId, seeded.adminId);

        // Assert
        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual({
            refundId: seeded.refundId,
            status: 'FAILED'
        });
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('FAILED');
        expect(await paymentState(seeded.paymentId)).toEqual(before);
        expect(refundSpy).toHaveBeenCalledTimes(0);
        expect(audit).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_MUTATION,
                metadata: expect.objectContaining({
                    administrativeAction: 'ACC_13',
                    transition: 'RF5'
                })
            })
        );
    });

    it('answers a typed 409 for a previously declined refund', async () => {
        const seeded = await seedConfirmRefund();
        expect((await decline(seeded.refundId, seeded.adminId)).status).toBe(200);
        const refundSpy = vi.spyOn(confirmFake, 'refund');
        const response = await decline(seeded.refundId, seeded.adminId);
        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'REFUND_NOT_OPEN'
        });
        expect(refundSpy).toHaveBeenCalledTimes(0);
    });

    it('answers REFUND_HAS_PROVIDER_CALLS after an accepted provider refund', async () => {
        const seeded = await seedConfirmRefund();
        const confirmed = await confirmRequest(app, seeded.refundId, {
            id: seeded.adminId,
            role: 'SUPER_ADMIN',
            permissions
        });
        expect(confirmed.status).toBe(200);
        const refundSpy = vi.spyOn(confirmFake, 'refund');
        const response = await decline(seeded.refundId, seeded.adminId);
        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'REFUND_HAS_PROVIDER_CALLS'
        });
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('CONFIRMED');
        expect(refundSpy).toHaveBeenCalledTimes(0);
    });

    it.each([
        {},
        { declined: false },
        { declined: true, extra: true }
    ])('answers 400 for an invalid decline body', async (body) => {
        const seeded = await seedConfirmRefund();
        const refundSpy = vi.spyOn(confirmFake, 'refund');
        const response = await decline(seeded.refundId, seeded.adminId, body);
        expect(response.status).toBe(400);
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('REQUESTED');
        expect(refundSpy).toHaveBeenCalledTimes(0);
    });

    it('answers 404 for an unknown refund', async () => {
        const seeded = await seedConfirmRefund();
        const refundSpy = vi.spyOn(confirmFake, 'refund');
        const response = await decline(crypto.randomUUID(), seeded.adminId);
        expect(response.status).toBe(404);
        expect((await response.json()).error).toMatchObject({
            code: 'NOT_FOUND',
            reason: 'REFUND_NOT_FOUND'
        });
        expect(refundSpy).toHaveBeenCalledTimes(0);
    });
});
