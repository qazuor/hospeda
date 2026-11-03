import { eq, getDb, payments, refunds } from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import { NOW } from '../billing-subscription/revocation-route-fixtures';
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

describe('TEST:B6:1 admin action 13 route confirms and sends a refund', () => {
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
    });
    afterAll(async () => {
        await cleanupConfirmRefundRows();
        await testDb.teardown();
    });

    it('AC:B6:1 records the confirmed provider call and its persisted key', async () => {
        const seeded = await seedConfirmRefund();
        const response = await confirmRequest(app, seeded.refundId, {
            id: seeded.adminId,
            role: 'SUPER_ADMIN',
            permissions
        });
        expect(response.status).toBe(200);
        const data = (await response.json()).data;
        expect(data).toMatchObject({
            refundId: seeded.refundId,
            status: 'CONFIRMED',
            outcome: 'SENT'
        });
        const rows = await confirmRows(seeded.refundId);
        expect(rows.refund).toMatchObject({ status: 'CONFIRMED', confirmedBy: seeded.adminId });
        expect(rows.calls).toHaveLength(1);
        expect(rows.calls[0]).toMatchObject({
            amount: 10000,
            providerRefundId: data.calls[0].providerRefundId
        });
        expect(rows.keys).toMatchObject([
            { key: rows.calls[0]?.idempotencyKey, subjectId: seeded.refundId }
        ]);
        expect(audit).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_MUTATION,
                metadata: expect.objectContaining({
                    administrativeAction: 'ACC_13',
                    transition: 'RF2',
                    outcome: 'SENT',
                    calls: 1
                })
            })
        );
    });

    it('AC:B6:2 closes a charged-back refund without sending a refund call', async () => {
        const seeded = await seedConfirmRefund();
        await confirmFake.chargeBack({ chargeId: seeded.chargeId });
        const refundSpy = vi.spyOn(confirmFake, 'refund');
        const response = await confirmRequest(app, seeded.refundId, {
            id: seeded.adminId,
            role: 'SUPER_ADMIN',
            permissions
        });
        expect(response.status).toBe(200);
        expect((await response.json()).data).toMatchObject({
            status: 'FAILED',
            outcome: 'CHARGED_BACK',
            calls: []
        });
        expect(refundSpy).toHaveBeenCalledTimes(0);
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('FAILED');
        const [payment] = await getDb()
            .select({ status: payments.status })
            .from(payments)
            .where(eq(payments.id, seeded.paymentId));
        expect(payment?.status).toBe('SUCCEEDED');
    });

    it('AC:B6:3 and AC:B6:4 keep the confirmed amount within two accepted partial calls', async () => {
        const seeded = await seedConfirmRefund(10000, 5000);
        const response = await confirmRequest(app, seeded.refundId, {
            id: seeded.adminId,
            role: 'SUPER_ADMIN',
            permissions
        });
        expect(response.status).toBe(200);
        const data = (await response.json()).data;
        expect(data).toMatchObject({ status: 'CONFIRMED', outcome: 'SENT' });
        const rows = await confirmRows(seeded.refundId);
        expect(rows.calls).toHaveLength(3);
        const accepted = rows.calls.filter((call) => call.providerRefundId !== null);
        expect(accepted).toHaveLength(2);
        expect(accepted.reduce((total, call) => total + call.amount, 0)).toBe(5000);
        expect(new Set(accepted.map((call) => call.providerRefundId)).size).toBe(2);
        expect(rows.keys).toHaveLength(3);
        expect(rows.refund?.status).toBe('CONFIRMED');
    });

    it('returns a typed 409 when the refund has already been confirmed', async () => {
        const seeded = await seedConfirmRefund();
        const refundSpy = vi.spyOn(confirmFake, 'refund');
        await getDb()
            .update(refunds)
            .set({ status: 'CONFIRMED', confirmedBy: seeded.adminId, version: 2 })
            .where(eq(refunds.id, seeded.refundId));
        const response = await confirmRequest(app, seeded.refundId, {
            id: seeded.adminId,
            role: 'SUPER_ADMIN',
            permissions
        });
        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'REFUND_NOT_OPEN'
        });
        expect(refundSpy).toHaveBeenCalledTimes(0);
    });

    it('answers 404 for a refund that does not exist', async () => {
        const seeded = await seedConfirmRefund();
        const refundSpy = vi.spyOn(confirmFake, 'refund');
        const response = await confirmRequest(app, crypto.randomUUID(), {
            id: seeded.adminId,
            role: 'SUPER_ADMIN',
            permissions
        });
        expect(response.status).toBe(404);
        expect((await response.json()).error).toMatchObject({
            code: 'NOT_FOUND',
            reason: 'REFUND_NOT_FOUND'
        });
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('REQUESTED');
        expect(refundSpy).toHaveBeenCalledTimes(0);
    });

    it('requires confirmed true and answers 400 before service execution', async () => {
        const seeded = await seedConfirmRefund();
        const refundSpy = vi.spyOn(confirmFake, 'refund');
        const response = await confirmRequest(
            app,
            seeded.refundId,
            { id: seeded.adminId, role: 'SUPER_ADMIN', permissions },
            {}
        );
        expect(response.status).toBe(400);
        const falseConfirmation = await confirmRequest(
            app,
            seeded.refundId,
            { id: seeded.adminId, role: 'SUPER_ADMIN', permissions },
            { confirmed: false }
        );
        expect(falseConfirmation.status).toBe(400);
        expect(refundSpy).toHaveBeenCalledTimes(0);
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('REQUESTED');
    });

    it('answers 422 when the requested refund exceeds the remaining balance', async () => {
        const seeded = await seedConfirmRefund();
        await getDb().update(refunds).set({ amount: 10001 }).where(eq(refunds.id, seeded.refundId));
        const refundSpy = vi.spyOn(confirmFake, 'refund');
        const response = await confirmRequest(app, seeded.refundId, {
            id: seeded.adminId,
            role: 'SUPER_ADMIN',
            permissions
        });
        expect(response.status).toBe(422);
        expect((await response.json()).error).toMatchObject({
            code: 'VALIDATION_ERROR',
            reason: 'REFUND_EXCEEDS_BALANCE'
        });
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('REQUESTED');
        expect(refundSpy).toHaveBeenCalledTimes(0);
    });

    it('TEST:B6:5 AC:B6:7 answers 422 past the provider window without reading or refunding', async () => {
        // Arrange
        const seeded = await seedConfirmRefund();
        const [payment] = await getDb()
            .select({ factAt: payments.factAt })
            .from(payments)
            .where(eq(payments.id, seeded.paymentId));
        if (!payment) throw new Error('seeded payment missing');
        confirmClock.set(new Date(payment.factAt.getTime() + 180 * 86400000));
        const readSpy = vi.spyOn(confirmFake, 'readCharge');
        const refundSpy = vi.spyOn(confirmFake, 'refund');

        // Act
        const response = await confirmRequest(app, seeded.refundId, {
            id: seeded.adminId,
            role: 'SUPER_ADMIN',
            permissions
        });

        // Assert
        expect(response.status).toBe(422);
        expect((await response.json()).error).toMatchObject({
            code: 'VALIDATION_ERROR',
            reason: 'REFUND_PAST_PROVIDER_WINDOW'
        });
        const rows = await confirmRows(seeded.refundId);
        expect(rows.refund?.status).toBe('REQUESTED');
        expect(rows.calls).toHaveLength(0);
        expect(rows.keys).toHaveLength(0);
        expect(readSpy).toHaveBeenCalledTimes(0);
        expect(refundSpy).toHaveBeenCalledTimes(0);
    });

    it('TEST:B6:5 AC:B6:7 returns a validated 200 for a definitive provider rejection', async () => {
        // Arrange
        const seeded = await seedConfirmRefund();
        vi.spyOn(confirmFake, 'refund').mockRejectedValueOnce(
            new PaymentProviderError({
                code: 'REJECTED',
                capability: 'refund',
                message: 'refund rejected'
            })
        );

        // Act
        const response = await confirmRequest(app, seeded.refundId, {
            id: seeded.adminId,
            role: 'SUPER_ADMIN',
            permissions
        });

        // Assert
        expect(response.status).toBe(200);
        expect((await response.json()).data).toMatchObject({
            status: 'FAILED',
            outcome: 'PROVIDER_REJECTED_FAILED'
        });
        expect((await confirmRows(seeded.refundId)).refund?.status).toBe('FAILED');
    });
});
