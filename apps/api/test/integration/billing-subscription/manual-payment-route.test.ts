import { eq, getDb, manualPayments } from '@repo/db';
import {
    ManualPaymentListResponseSchema,
    ManualPaymentRegistrationPreviewResponseSchema,
    ManualPaymentRegistrationResponseSchema,
    ManualUnpaidResponseSchema,
    PermissionEnum
} from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    clock,
    fake,
    NOW,
    PERIOD_START,
    retireManualRouteNotices,
    seedManualRoute,
    stateOf
} from './manual-payment-route-fixtures';

let app: ReturnType<typeof initApp>;
const allPermissions = [
    PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
    PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT,
    PermissionEnum.BILLING_DECLARE_MANUAL_UNPAID
] as const;
const pathOf = (subscriptionId: string, manualPaymentId?: string) =>
    `/api/v1/admin/billing-subscription/${subscriptionId}/manual-payments${manualPaymentId ? `/${manualPaymentId}` : ''}`;

function request(input: {
    readonly method: 'GET' | 'POST';
    readonly subscriptionId: string;
    readonly manualPaymentId?: string;
    readonly action?: 'register' | 'declare-unpaid';
    readonly actorId: string;
    readonly permissions?: readonly PermissionEnum[];
    readonly body?: Record<string, unknown>;
}) {
    const path = `${pathOf(input.subscriptionId, input.manualPaymentId)}${input.action ? `/${input.action}` : ''}`;
    return app.request(path, {
        method: input.method,
        headers: actorHeaders(input.actorId, input.permissions ?? allPermissions),
        ...(input.body ? { body: JSON.stringify(input.body) } : {})
    });
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp({ clock, paymentProvider: fake });
    injectPaymentProvider({ provider: fake });
});
afterAll(async () => {
    await retireManualRouteNotices();
    await testDb.teardown();
});
afterEach(retireManualRouteNotices);

describe('HOS-1541 manual payment admin routes (ACC:3, ACC:4)', () => {
    it('(a) previews S29 and the next charge date without writing', async () => {
        const seeded = await seedManualRoute();
        const before = await stateOf(seeded.subscription.id, seeded.installment.id);
        const response = await request({
            method: 'GET',
            subscriptionId: seeded.subscription.id,
            manualPaymentId: seeded.installment.id,
            action: 'register',
            actorId: seeded.admin.id
        });
        expect(response.status).toBe(200);
        expect(
            ManualPaymentRegistrationPreviewResponseSchema.parse((await response.json()).data)
        ).toEqual({
            subscriptionId: seeded.subscription.id,
            manualPaymentId: seeded.installment.id,
            periodStart: PERIOD_START.toISOString(),
            effect: 'S29',
            nextChargeAt: '2026-10-03T12:00:00.000Z'
        });
        const after = await stateOf(seeded.subscription.id, seeded.installment.id);
        expect(after.installment?.status).toBe(before.installment?.status);
        expect(after.subscription?.status).toBe(before.subscription?.status);
        expect(after.subscription?.nextChargeAt).toEqual(before.subscription?.nextChargeAt);
        expect(after.coverage).toHaveLength(0);
        expect(after.receipt).toHaveLength(0);
    });

    it('(b) registers the first installment, receipt and S29 activation', async () => {
        const seeded = await seedManualRoute();
        const response = await request({
            method: 'POST',
            subscriptionId: seeded.subscription.id,
            manualPaymentId: seeded.installment.id,
            action: 'register',
            actorId: seeded.admin.id,
            body: { proofRef: 'transfer-1541' }
        });
        expect(response.status).toBe(200);
        const result = ManualPaymentRegistrationResponseSchema.parse((await response.json()).data);
        expect(result).toMatchObject({
            outcome: 'REGISTERED',
            effect: 'S29',
            nextChargeAt: '2026-10-03T12:00:00.000Z'
        });
        const written = await stateOf(seeded.subscription.id, seeded.installment.id);
        expect(written.installment).toMatchObject({
            status: 'REGISTERED',
            registeredBy: seeded.admin.id,
            registeredAt: NOW,
            proofRef: 'transfer-1541'
        });
        expect(written.subscription).toMatchObject({
            status: 'ACTIVE',
            nextChargeAt: new Date(result.nextChargeAt)
        });
        expect(written.coverage).toHaveLength(1);
        expect(written.receipt).toHaveLength(1);
        expect(written.receipt[0]?.id).toBe(result.receiptId);
    });

    it('(c) registers an installment in grace and returns to ACTIVE', async () => {
        const seeded = await seedManualRoute({ status: 'GRACE_PERIOD', prior: true });
        const response = await request({
            method: 'POST',
            subscriptionId: seeded.subscription.id,
            manualPaymentId: seeded.installment.id,
            action: 'register',
            actorId: seeded.admin.id,
            body: {}
        });
        expect(response.status).toBe(200);
        expect(
            ManualPaymentRegistrationResponseSchema.parse((await response.json()).data)
        ).toMatchObject({
            outcome: 'REGISTERED',
            effect: 'S5'
        });
        const written = await stateOf(seeded.subscription.id, seeded.installment.id);
        expect(written.installment?.status).toBe('REGISTERED');
        expect(written.subscription?.status).toBe('ACTIVE');
    });

    it('(d) declares an installment unpaid in grace and suspends the subscription', async () => {
        const seeded = await seedManualRoute({ status: 'GRACE_PERIOD', prior: true });
        const response = await request({
            method: 'POST',
            subscriptionId: seeded.subscription.id,
            manualPaymentId: seeded.installment.id,
            action: 'declare-unpaid',
            actorId: seeded.admin.id
        });
        expect(response.status).toBe(200);
        expect(ManualUnpaidResponseSchema.parse((await response.json()).data).outcome).toBe(
            'SUSPENDED'
        );
        const written = await stateOf(seeded.subscription.id, seeded.installment.id);
        expect(written.installment?.status).toBe('DECLARED_UNPAID');
        expect(written.subscription?.status).toBe('SUSPENDED');
    });

    it('(e) rejects both acts at the route permission gate', async () => {
        const seeded = await seedManualRoute({ status: 'GRACE_PERIOD', prior: true });
        for (const action of ['register', 'declare-unpaid'] as const) {
            const response = await request({
                method: 'POST',
                subscriptionId: seeded.subscription.id,
                manualPaymentId: seeded.installment.id,
                action,
                actorId: seeded.admin.id,
                permissions: [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT],
                ...(action === 'register' ? { body: {} } : {})
            });
            expect(response.status).toBe(403);
            expect((await response.json()).error).toMatchObject({
                code: 'FORBIDDEN',
                message: 'Insufficient admin permissions'
            });
        }
        const written = await stateOf(seeded.subscription.id, seeded.installment.id);
        expect(written.installment?.status).toBe('AWAITING');
        expect(written.subscription?.status).toBe('GRACE_PERIOD');
    });

    it('(f) returns 404 for a foreign installment, 409 outside grace and 400 for overlong proof', async () => {
        const own = await seedManualRoute({ status: 'ACTIVE', prior: true });
        const foreign = await seedManualRoute();
        const alien = await request({
            method: 'POST',
            subscriptionId: own.subscription.id,
            manualPaymentId: foreign.installment.id,
            action: 'register',
            actorId: own.admin.id,
            body: {}
        });
        expect(alien.status).toBe(404);
        expect((await alien.json()).error).toMatchObject({
            code: 'NOT_FOUND',
            reason: 'MANUAL_PAYMENT_NOT_FOUND'
        });
        const active = await request({
            method: 'POST',
            subscriptionId: own.subscription.id,
            manualPaymentId: own.installment.id,
            action: 'declare-unpaid',
            actorId: own.admin.id
        });
        expect(active.status).toBe(409);
        expect((await active.json()).error).toMatchObject({
            code: 'ALREADY_EXISTS',
            reason: 'MANUAL_PAYMENT_NOT_IN_GRACE'
        });
        const malformed = await request({
            method: 'POST',
            subscriptionId: own.subscription.id,
            manualPaymentId: own.installment.id,
            action: 'register',
            actorId: own.admin.id,
            body: { proofRef: 'x'.repeat(501) }
        });
        expect(malformed.status).toBe(400);
        expect((await malformed.json()).error.code).toBe('VALIDATION_ERROR');
    });

    it('(g) lists exactly the two installments seeded for this subscription', async () => {
        const seeded = await seedManualRoute({ status: 'ACTIVE', prior: true });
        const response = await request({
            method: 'GET',
            subscriptionId: seeded.subscription.id,
            actorId: seeded.admin.id
        });
        expect(response.status).toBe(200);
        const rows = ManualPaymentListResponseSchema.parse((await response.json()).data);
        expect(rows).toHaveLength(2);
        expect(rows.map((row) => ({ id: row.id, status: row.status }))).toEqual([
            { id: seeded.priorId, status: 'REGISTERED' },
            { id: seeded.installment.id, status: 'AWAITING' }
        ]);
        const persisted = await getDb()
            .select()
            .from(manualPayments)
            .where(eq(manualPayments.subscriptionId, seeded.subscription.id));
        expect(persisted).toHaveLength(2);
    });
});
