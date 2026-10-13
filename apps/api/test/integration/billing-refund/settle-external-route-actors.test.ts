/**
 * TEST:B5:6 (HOS-1540), the refusals of admin action 14 (ACC:14, RF4) on
 * `POST /api/v1/admin/billing-refunds/external`: every foreign actor gets its
 * status and leaves no refund row, no payment change and no audit record
 * (AC:B5:10); malformed or impossible settlements answer their typed rejection.
 *
 * Seeds its own rows with random ids and deletes only them; never TRUNCATE.
 */
import { PermissionEnum } from '@repo/schemas';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    cleanupSettleExternalRows,
    moneyState,
    seedPaidAddonInstance,
    seedPaidSubscription,
    seedUser
} from './settle-external-fixtures';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

const PATH = '/api/v1/admin/billing-refunds/external';
const SETTLER_PERMISSIONS = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.BILLING_SETTLE_EXTERNAL
] as const;

let app: ReturnType<typeof initApp>;
let superAdminId: string;

/** No settlement was audited (a refused request may still leave its ACCESS_DENIED record). */
function expectNoSettlementAudit() {
    expect(audit).not.toHaveBeenCalledWith(
        expect.objectContaining({ auditEvent: AuditEventType.BILLING_MUTATION })
    );
}

type MockActor = {
    readonly id: string;
    readonly role: string;
    readonly permissions: readonly PermissionEnum[];
};

function post(body: Record<string, unknown>, actor?: MockActor) {
    return app.request(PATH, {
        method: 'POST',
        headers: actorHeaders(actor),
        body: JSON.stringify(body)
    });
}

function asSuperAdmin(body: Record<string, unknown>) {
    return post(body, { id: superAdminId, role: 'SUPER_ADMIN', permissions: SETTLER_PERMISSIONS });
}

function transferOf(paymentId: string, amount = 10000) {
    return {
        paymentId,
        amount,
        channel: 'BANK_TRANSFER',
        reference: 'TRX-ACTORS',
        reason: 'OUT_OF_FLOW_REFUND'
    };
}

describe('TEST:B5:6 admin action 14 route refuses every foreign actor (AC:B5:10)', () => {
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

    it('AC:B5:10 answers 401 without a session and writes nothing', async () => {
        // Arrange
        const seeded = await seedPaidSubscription();
        const before = await moneyState(seeded.paymentId);

        // Act
        const response = await post(transferOf(seeded.paymentId));

        // Assert
        expect(response.status).toBe(401);
        expect(await moneyState(seeded.paymentId)).toEqual(before);
        expectNoSettlementAudit();
    });

    it('AC:B5:10 answers 403 to an ADMIN holding every billing permission but the one of action 14', async () => {
        // Arrange
        const seeded = await seedPaidSubscription();
        const adminId = await seedUser('admin');
        const before = await moneyState(seeded.paymentId);

        // Act
        const response = await post(transferOf(seeded.paymentId), {
            id: adminId,
            role: 'ADMIN',
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.REFUND_PROCESS,
                PermissionEnum.PAYMENT_REFUND,
                PermissionEnum.REFUND_APPROVE,
                PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
                PermissionEnum.PARTNER_MANAGE
            ]
        });

        // Assert
        expect(response.status).toBe(403);
        expect((await response.json()).error.code).toBe('FORBIDDEN');
        expect(await moneyState(seeded.paymentId)).toEqual(before);
        expectNoSettlementAudit();
    });

    it('AC:B5:10 answers 403 to a HOST without access to the admin panel', async () => {
        // Arrange
        const seeded = await seedPaidSubscription();
        const hostId = await seedUser('host');
        const before = await moneyState(seeded.paymentId);

        // Act
        const response = await post(transferOf(seeded.paymentId), {
            id: hostId,
            role: 'HOST',
            permissions: [PermissionEnum.BILLING_SETTLE_EXTERNAL]
        });

        // Assert
        expect(response.status).toBe(403);
        expect(await moneyState(seeded.paymentId)).toEqual(before);
        expectNoSettlementAudit();
    });

    it('AC:B5:10 answers 403 FORBIDDEN to the payer settling their own payment (actor = subject)', async () => {
        // Arrange
        const seeded = await seedPaidSubscription();
        const before = await moneyState(seeded.paymentId);

        // Act
        const response = await post(transferOf(seeded.paymentId), {
            id: seeded.ownerId,
            role: 'SUPER_ADMIN',
            permissions: SETTLER_PERMISSIONS
        });

        // Assert
        expect(response.status).toBe(403);
        expect((await response.json()).error).toMatchObject({
            code: 'FORBIDDEN',
            reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN'
        });
        expect(await moneyState(seeded.paymentId)).toEqual(before);
        expectNoSettlementAudit();
    });

    it('AC:B5:10 answers 403 to the owner of an add-on instance settling its payment', async () => {
        // Arrange
        const seeded = await seedPaidAddonInstance();
        const before = await moneyState(seeded.paymentId);

        // Act
        const response = await post(transferOf(seeded.paymentId), {
            id: seeded.ownerId,
            role: 'SUPER_ADMIN',
            permissions: SETTLER_PERMISSIONS
        });

        // Assert
        expect(response.status).toBe(403);
        expect(await moneyState(seeded.paymentId)).toEqual(before);
        expectNoSettlementAudit();
    });

    it('AC:B5:10 answers 404 for a payment that does not exist', async () => {
        const response = await asSuperAdmin(transferOf(crypto.randomUUID()));

        expect(response.status).toBe(404);
        expect((await response.json()).error).toMatchObject({
            code: 'NOT_FOUND',
            reason: 'REFUND_SOURCE_NOT_FOUND'
        });
        expectNoSettlementAudit();
    });

    it('AC:B5:10 answers 400 to a body naming both payments', async () => {
        const seeded = await seedPaidSubscription();
        const before = await moneyState(seeded.paymentId);

        const response = await asSuperAdmin({
            ...transferOf(seeded.paymentId),
            manualPaymentId: crypto.randomUUID()
        });

        expect(response.status).toBe(400);
        expect(await moneyState(seeded.paymentId)).toEqual(before);
    });

    it('AC:B5:10 answers 422 REFUND_EXCEEDS_BALANCE over the payment balance', async () => {
        const seeded = await seedPaidSubscription(10000);
        const before = await moneyState(seeded.paymentId);

        const response = await asSuperAdmin(transferOf(seeded.paymentId, 10001));

        expect(response.status).toBe(422);
        expect((await response.json()).error).toMatchObject({
            code: 'VALIDATION_ERROR',
            reason: 'REFUND_EXCEEDS_BALANCE'
        });
        expect(await moneyState(seeded.paymentId)).toEqual(before);
        expectNoSettlementAudit();
    });

    it('AC:B5:10 answers 409 EXTERNAL_REFERENCE_ALREADY_SETTLED to the same panel reference twice', async () => {
        // Arrange
        const first = await seedPaidSubscription(10000);
        const second = await seedPaidSubscription(10000);
        const panel = {
            amount: 3000,
            channel: 'PROVIDER_PANEL',
            reference: `PANEL-${crypto.randomUUID()}`,
            reason: 'OUT_OF_FLOW_REFUND'
        };
        expect((await asSuperAdmin({ ...panel, paymentId: first.paymentId })).status).toBe(200);
        audit.mockClear();
        const before = await moneyState(second.paymentId);

        // Act
        const response = await asSuperAdmin({ ...panel, paymentId: second.paymentId });

        // Assert
        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'EXTERNAL_REFERENCE_ALREADY_SETTLED'
        });
        expect(await moneyState(second.paymentId)).toEqual(before);
        expectNoSettlementAudit();
    });
});
