import { coveredPeriods, eq, getDb, receipts } from '@repo/db';
import {
    ExternalChargeReceptionSchema,
    ExternalChargeSettlementResponseSchema,
    PermissionEnum
} from '@repo/schemas';
import type { ChargeReception } from '@repo/service-core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders, seedUser } from '../billing-subscription/revocation-route-fixtures';
import {
    chargeClock,
    chargeFake,
    cleanupExternalChargeRows,
    paymentsForCharge,
    seedUnrecordedApprovedCharge,
    seedUnrecordedRejectedCharge
} from './settle-external-charge-fixtures';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));
const PATH = '/api/v1/admin/billing-refunds/external-charge';
let app: ReturnType<typeof initApp>;
let adminId: string;
const permissions = [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_SETTLE_EXTERNAL];

function post(chargeId: string, actorId = adminId, note?: string) {
    return app.request(PATH, {
        method: 'POST',
        headers: actorHeaders({ id: actorId, role: 'SUPER_ADMIN', permissions }),
        body: JSON.stringify({ chargeId, ...(note ? { note } : {}) })
    });
}

describe('TEST:B5:6 AC:B5:11 admin action 14 charge settlement route', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        injectPaymentProvider({ provider: chargeFake });
        app = initApp({ clock: chargeClock, paymentProvider: chargeFake });
        adminId = await seedUser('charge-admin');
    });
    afterAll(async () => {
        await cleanupExternalChargeRows();
        await testDb.teardown();
    });

    it('settles and audits a previously unrecorded approved charge', async () => {
        const seeded = await seedUnrecordedApprovedCharge();
        const response = await post(seeded.chargeId, adminId, 'Reviewed');
        expect(response.status).toBe(200);
        const body = ExternalChargeSettlementResponseSchema.parse((await response.json()).data);
        expect(body).toMatchObject({
            paymentStatus: 'SUCCEEDED',
            coverage: 'WRITTEN',
            reception: 'P1'
        });
        const rows = await paymentsForCharge(seeded.chargeId);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            id: body.paymentId,
            status: 'SUCCEEDED',
            providerFactId: seeded.chargeId
        });
        expect(
            await getDb()
                .select()
                .from(coveredPeriods)
                .where(eq(coveredPeriods.paymentId, body.paymentId))
        ).toHaveLength(1);
        expect(
            await getDb().select().from(receipts).where(eq(receipts.paymentId, body.paymentId))
        ).toHaveLength(1);
        expect(audit).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_MUTATION,
                resourceType: 'payment',
                resourceId: body.paymentId,
                metadata: expect.objectContaining({
                    administrativeAction: 'ACC_14',
                    transition: 'P1',
                    chargeId: seeded.chargeId,
                    note: 'Reviewed'
                })
            })
        );
        expect((await post(seeded.chargeId)).status).toBe(409);
        expect((await (await post(seeded.chargeId)).json()).error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'CHARGE_ALREADY_RECORDED'
        });
    });

    it('maps unknown provider ids and rejects invalid request shape', async () => {
        const missing = await post(`missing-${crypto.randomUUID()}`);
        expect(missing.status).toBe(404);
        expect((await missing.json()).error).toMatchObject({
            code: 'NOT_FOUND',
            reason: 'CHARGE_NOT_FOUND'
        });
        expect(
            (
                await app.request(PATH, {
                    method: 'POST',
                    headers: actorHeaders({ id: adminId, role: 'SUPER_ADMIN', permissions }),
                    body: JSON.stringify({ chargeId: '' })
                })
            ).status
        ).toBe(400);
    });

    it('rejects a rejected provider charge without writing a payment', async () => {
        const seeded = await seedUnrecordedRejectedCharge();
        const response = await post(seeded.chargeId);
        expect(response.status).toBe(409);
        expect((await response.json()).error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'CHARGE_NOT_APPROVED'
        });
        expect(await paymentsForCharge(seeded.chargeId)).toHaveLength(0);
    });

    it('keeps the response reception enum aligned with service-core', () => {
        const serviceValues: ChargeReception[] = [
            'P1',
            'S5',
            'S7',
            'S19_RETAINED',
            'CONDITION_FAILED',
            'EXTENDED',
            'NOT_EXTENDED',
            'CROSSING_MARKED'
        ];
        expect(ExternalChargeReceptionSchema.options).toEqual(serviceValues);
    });
});
