/** Exact subscription scoping and ordering of open RF1 requests (AC:1711:10). */
import { and, eq, getDb, refunds } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    NOW,
    OPTION_AMOUNT,
    REVOKER_PERMISSIONS,
    retireRevocationRouteRows,
    routeClock,
    routeFake,
    seedManualPayment,
    seedOneTimeOrphan,
    seedPrincipal,
    seedRevocable,
    seedUser
} from './revocation-route-fixtures';

const clock = routeClock();
const fake = routeFake(clock);
let app: ReturnType<typeof initApp>;
let readerId: string;
let revokerId: string;

const pathOf = (subscriptionId: string) =>
    `/api/v1/admin/billing-subscription/${subscriptionId}/open-refunds`;
const read = (subscriptionId: string) =>
    app.request(pathOf(subscriptionId), {
        method: 'GET',
        headers: actorHeaders({
            id: readerId,
            role: 'ADMIN',
            permissions: [
                PermissionEnum.ACCESS_PANEL_ADMIN,
                PermissionEnum.BILLING_SUBSCRIPTION_INSPECT
            ]
        })
    });
const revoke = (subscriptionId: string, paymentId: string) =>
    app.request(`/api/v1/admin/billing-subscription/${subscriptionId}/revocation`, {
        method: 'POST',
        headers: actorHeaders({
            id: revokerId,
            role: 'SUPER_ADMIN',
            permissions: REVOKER_PERMISSIONS
        }),
        body: JSON.stringify({ expectedPaymentId: paymentId })
    });

async function seedRefund(input: {
    readonly paymentId?: string;
    readonly manualPaymentId?: string;
    readonly status: 'REQUESTED' | 'CONFIRMED' | 'FAILED';
    readonly createdAt?: Date;
}) {
    const [row] = await getDb()
        .insert(refunds)
        .values({
            paymentId: input.paymentId ?? null,
            manualPaymentId: input.manualPaymentId ?? null,
            amount: OPTION_AMOUNT,
            reason: 'REVOCATION',
            status: input.status,
            createdAt: input.createdAt
        })
        .returning({ id: refunds.id });
    if (!row) throw new Error('Expected refund row');
    return row.id;
}

async function expectedItem(
    refundId: string,
    payment: { source: 'PAYMENT' | 'MANUAL_PAYMENT'; id: string }
) {
    const [row] = await getDb()
        .select({ amount: refunds.amount, reason: refunds.reason, createdAt: refunds.createdAt })
        .from(refunds)
        .where(eq(refunds.id, refundId));
    if (!row) throw new Error('Expected persisted refund');
    return {
        refundId,
        refundAmount: row.amount,
        reason: row.reason,
        requestedAt: row.createdAt.toISOString(),
        payment
    };
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
});
beforeEach(async () => {
    clock.set(NOW);
    readerId = await seedUser('open-refunds-reader');
    revokerId = await seedUser('open-refunds-revoker');
});
afterEach(async () => retireRevocationRouteRows());
afterAll(async () => {
    await retireRevocationRouteRows();
    await testDb.teardown();
});

describe('TEST:1711:10 AC:1711:10 subscription open-refunds contents', () => {
    it('TEST:1711:10 AC:1711:10 lists the real S36 RF1, excluding other states and one-time add-on refunds', async () => {
        const seeded = await seedRevocable();
        const addon = await seedOneTimeOrphan({
            ownerId: seeded.ownerId,
            principalId: seeded.subscriptionId
        });
        const acted = await revoke(seeded.subscriptionId, seeded.paymentId);
        expect(acted.status).toBe(200);
        const result = await acted.json();
        const refundId = result.data.refundId as string;
        const [created] = await getDb()
            .select({ createdAt: refunds.createdAt })
            .from(refunds)
            .where(eq(refunds.id, refundId));
        if (!created) throw new Error('Expected S36 refund');

        await seedRefund({ paymentId: seeded.paymentId, status: 'CONFIRMED' });
        await seedRefund({ paymentId: seeded.paymentId, status: 'FAILED' });
        const addonRows = await getDb()
            .select({ id: refunds.id, status: refunds.status })
            .from(refunds)
            .where(and(eq(refunds.paymentId, addon.paymentId), eq(refunds.status, 'REQUESTED')));
        expect(addonRows.some(({ status }) => status === 'REQUESTED')).toBe(true);

        const response = await read(seeded.subscriptionId);
        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual({
            items: [
                {
                    refundId,
                    refundAmount: OPTION_AMOUNT,
                    reason: 'REVOCATION',
                    requestedAt: created.createdAt.toISOString(),
                    payment: { source: 'PAYMENT', id: seeded.paymentId }
                }
            ]
        });
    });

    it('TEST:1711:10 AC:1711:10 lists a requested manual-payment refund', async () => {
        const ownerId = await seedUser('manual-owner');
        const registrarId = await seedUser('manual-registrar');
        const subscriptionId = await seedPrincipal({ ownerId, paymentMethod: 'MANUAL' });
        const manualPaymentId = await seedManualPayment({
            subscriptionId,
            registeredBy: registrarId
        });
        const refundId = await seedRefund({ manualPaymentId, status: 'REQUESTED' });
        const response = await read(subscriptionId);
        expect(response.status).toBe(200);
        expect((await response.json()).data).toEqual({
            items: [await expectedItem(refundId, { source: 'MANUAL_PAYMENT', id: manualPaymentId })]
        });
    });

    it('TEST:1711:10 AC:1711:10 isolates requested refunds to each subscription and returns them in created order', async () => {
        const first = await seedRevocable();
        const second = await seedRevocable();
        const older = new Date('2026-10-01T10:00:00.000Z');
        const newer = new Date('2026-10-02T10:00:00.000Z');
        const firstLater = await seedRefund({
            paymentId: first.paymentId,
            status: 'REQUESTED',
            createdAt: newer
        });
        const firstEarlier = await seedRefund({
            paymentId: first.paymentId,
            status: 'REQUESTED',
            createdAt: older
        });
        const secondOnly = await seedRefund({ paymentId: second.paymentId, status: 'REQUESTED' });

        const firstResponse = await read(first.subscriptionId);
        expect(firstResponse.status).toBe(200);
        expect((await firstResponse.json()).data).toEqual({
            items: [
                await expectedItem(firstEarlier, { source: 'PAYMENT', id: first.paymentId }),
                await expectedItem(firstLater, { source: 'PAYMENT', id: first.paymentId })
            ]
        });
        const secondResponse = await read(second.subscriptionId);
        expect(secondResponse.status).toBe(200);
        expect((await secondResponse.json()).data).toEqual({
            items: [await expectedItem(secondOnly, { source: 'PAYMENT', id: second.paymentId })]
        });
    });
});
