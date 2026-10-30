/**
 * TEST:B5:6 (HOS-1540), the route half of admin action 14 (ACC:14, RF4):
 * `POST /api/v1/admin/billing-refunds/external` settles a refund that already
 * happened outside our flow (AC:B5:10) and closes the open RF1 request
 * (AC:B5:41). The refusals of every foreign actor live in
 * `settle-external-route-actors.test.ts`.
 *
 * Seeds its own rows with random ids and deletes only them; never TRUNCATE.
 */
import { REFUND_EXTERNAL_CHANNELS } from '@repo/db';
import {
    ExternalRefundSettlementChannelSchema,
    ExternalRefundSettlementReasonSchema,
    ExternalRefundSettlementResponseSchema,
    PermissionEnum
} from '@repo/schemas';
import { RF4_REASONS } from '@repo/service-core';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    cleanupSettleExternalRows,
    coveredPeriodRow,
    moneyState,
    refundsOfPayment,
    seedOpenRetention,
    seedPaidAddonInstance,
    seedPaidSubscription,
    seedRequestedRefund,
    seedUser
} from './settle-external-fixtures';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

const PATH = '/api/v1/admin/billing-refunds/external';

let app: ReturnType<typeof initApp>;
let superAdminId: string;

function settle(body: Record<string, unknown>, actorId = superAdminId) {
    return app.request(PATH, {
        method: 'POST',
        headers: actorHeaders({
            id: actorId,
            role: 'SUPER_ADMIN',
            permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_SETTLE_EXTERNAL]
        }),
        body: JSON.stringify(body)
    });
}

describe('TEST:B5:6 admin action 14 route (AC:B5:10, AC:B5:41)', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp();
        superAdminId = await seedUser('super-admin');
    });
    beforeEach(() => audit.mockClear());
    afterAll(async () => {
        await cleanupSettleExternalRows();
        await testDb.teardown();
    });

    it('AC:B5:10 settles a total refund by bank transfer, audited once on the payer', async () => {
        // Arrange
        const seeded = await seedPaidSubscription(10000);

        // Act
        const response = await settle({
            paymentId: seeded.paymentId,
            amount: 10000,
            channel: 'BANK_TRANSFER',
            reference: 'TRX-0001',
            reason: 'OUT_OF_FLOW_REFUND',
            note: 'Refunded by transfer'
        });

        // Assert
        expect(response.status).toBe(200);
        const body = (await response.json()).data;
        expect(ExternalRefundSettlementResponseSchema.parse(body)).toEqual({
            refundId: expect.any(String),
            status: 'EXECUTED',
            closedRequestedRefund: false,
            paymentOutcome: 'P3',
            coverageReleased: true
        });
        const after = await moneyState(seeded.paymentId);
        expect(after.payment?.status).toBe('REFUNDED');
        expect(after.payment?.refundedAmount).toBe(10000);
        expect(after.refunds).toHaveLength(1);
        expect(after.refunds[0]).toMatchObject({
            id: body.refundId,
            status: 'EXECUTED',
            executedVia: 'EXTERNAL',
            externalChannel: 'BANK_TRANSFER',
            externalRef: 'TRX-0001',
            settledBy: superAdminId,
            confirmedBy: null,
            amount: 10000,
            reason: 'OUT_OF_FLOW_REFUND'
        });
        expect((await coveredPeriodRow(seeded.coveredPeriodId))?.releasedAt).not.toBeNull();
        expect(audit).toHaveBeenCalledTimes(1);
        expect(audit).toHaveBeenCalledWith({
            auditEvent: AuditEventType.BILLING_MUTATION,
            actorId: superAdminId,
            action: 'create',
            resourceType: 'refund',
            resourceId: body.refundId,
            metadata: {
                administrativeAction: 'ACC_14',
                transition: 'RF4',
                subjectId: seeded.ownerId,
                paymentId: seeded.paymentId,
                amount: 10000,
                channel: 'BANK_TRANSFER',
                reference: 'TRX-0001',
                reason: 'OUT_OF_FLOW_REFUND',
                closedRequestedRefundId: null,
                paymentOutcome: 'P3',
                coverageReleased: true,
                note: 'Refunded by transfer'
            }
        });
    });

    it('AC:B5:41 closes the open REQUESTED with a panel refund of the same amount', async () => {
        // Arrange
        const seeded = await seedPaidSubscription(10000);
        const requestedId = await seedRequestedRefund({
            paymentId: seeded.paymentId,
            amount: 10000
        });
        const reference = `PANEL-${crypto.randomUUID()}`;

        // Act
        const response = await settle({
            paymentId: seeded.paymentId,
            amount: 10000,
            channel: 'PROVIDER_PANEL',
            reference,
            reason: 'OUT_OF_FLOW_REFUND'
        });

        // Assert
        expect(response.status).toBe(200);
        const body = (await response.json()).data;
        expect(body).toMatchObject({ refundId: requestedId, closedRequestedRefund: true });
        const after = await moneyState(seeded.paymentId);
        expect(after.payment?.status).toBe('REFUNDED');
        expect(after.refunds).toHaveLength(1);
        expect(after.refunds[0]).toMatchObject({
            id: requestedId,
            status: 'EXECUTED',
            externalChannel: 'PROVIDER_PANEL',
            externalRef: reference,
            settledBy: superAdminId,
            reason: 'REVOCATION'
        });
        expect(audit).toHaveBeenCalledWith(
            expect.objectContaining({
                action: 'update',
                resourceId: requestedId,
                metadata: expect.objectContaining({ closedRequestedRefundId: requestedId })
            })
        );
    });

    it('AC:B5:41 says the requested amount before closing on a mismatch, then closes by choice', async () => {
        // Arrange
        const seeded = await seedPaidSubscription(10000);
        const requestedId = await seedRequestedRefund({
            paymentId: seeded.paymentId,
            amount: 10000
        });
        const body = {
            paymentId: seeded.paymentId,
            amount: 6000,
            channel: 'PROVIDER_PANEL',
            reference: `PANEL-${crypto.randomUUID()}`,
            reason: 'OUT_OF_FLOW_REFUND'
        };
        const before = await moneyState(seeded.paymentId);

        // Act
        const mismatch = await settle(body);

        // Assert
        expect(mismatch.status).toBe(409);
        const error = (await mismatch.json()).error;
        expect(error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'REQUESTED_AMOUNT_MISMATCH'
        });
        expect(error.message).toContain('10000');
        expect(await moneyState(seeded.paymentId)).toEqual(before);
        expect(audit).not.toHaveBeenCalled();

        // Act
        const closed = await settle({ ...body, onAmountMismatch: 'CLOSE_WITH_SETTLED_AMOUNT' });

        // Assert
        expect(closed.status).toBe(200);
        expect((await closed.json()).data).toMatchObject({
            refundId: requestedId,
            closedRequestedRefund: true,
            paymentOutcome: 'P4'
        });
        const after = await refundsOfPayment(seeded.paymentId);
        expect(after).toHaveLength(1);
        expect(after[0]).toMatchObject({ id: requestedId, status: 'EXECUTED', amount: 6000 });
    });

    it('AC:B5:10 takes the subject of an add-on payment from the instance owner', async () => {
        // Arrange
        const seeded = await seedPaidAddonInstance(10000);

        // Act
        const response = await settle({
            paymentId: seeded.paymentId,
            amount: 4000,
            channel: 'BANK_TRANSFER',
            reference: 'TRX-ADDON',
            reason: 'STALE_CHARGE_REFUND'
        });

        // Assert
        expect(response.status).toBe(200);
        expect((await response.json()).data).toMatchObject({
            paymentOutcome: 'P4',
            coverageReleased: false
        });
        expect(audit).toHaveBeenCalledWith(
            expect.objectContaining({
                metadata: expect.objectContaining({
                    subjectId: seeded.ownerId,
                    paymentId: seeded.paymentId
                })
            })
        );
    });

    it('TEST:B7:10 h12 answers 409 RETAINED_PAYMENT_SUCCESSION_OPEN on a payment S19 retains (AC:B7:17)', async () => {
        // Arrange
        const seeded = await seedPaidSubscription(10000);
        await seedOpenRetention({
            subscriptionId: seeded.subscriptionId,
            paymentId: seeded.paymentId
        });
        const before = await moneyState(seeded.paymentId);

        // Act
        const response = await settle({
            paymentId: seeded.paymentId,
            amount: 10000,
            channel: 'BANK_TRANSFER',
            reference: `TRX-${crypto.randomUUID()}`,
            reason: 'OUT_OF_FLOW_REFUND'
        });

        // Assert
        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'RETAINED_PAYMENT_SUCCESSION_OPEN'
        });
        const after = await moneyState(seeded.paymentId);
        expect(after).toEqual(before);
        expect(after.refunds).toHaveLength(0);
        expect(audit).not.toHaveBeenCalled();
    });

    it('keeps the contract literals equal to the service and the database', () => {
        expect([...ExternalRefundSettlementChannelSchema.options]).toEqual([
            ...REFUND_EXTERNAL_CHANNELS
        ]);
        expect([...ExternalRefundSettlementReasonSchema.options]).toEqual([...RF4_REASONS]);
    });
});
