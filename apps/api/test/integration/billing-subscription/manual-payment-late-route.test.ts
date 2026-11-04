import {
    coveredPeriods,
    eq,
    getDb,
    manualPayments,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import {
    LateManualPaymentPreviewResponseSchema,
    LateManualPaymentResponseSchema,
    PermissionEnum,
    UnallocatedManualPaymentPreviewResponseSchema,
    UnallocatedManualPaymentResponseSchema
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
    seedManualRoute
} from './manual-payment-route-fixtures';

let app: ReturnType<typeof initApp>;
const permission = PermissionEnum.BILLING_REGISTER_MANUAL_PAYMENT;
type Action = 'register-late' | 'unallocated';

function request(input: {
    readonly method: 'GET' | 'POST';
    readonly action: Action;
    readonly subscriptionId: string;
    readonly manualPaymentId?: string;
    readonly actorId: string;
    readonly permissions?: readonly PermissionEnum[];
}) {
    const suffix =
        input.action === 'register-late'
            ? `/${input.manualPaymentId}/register-late`
            : '/unallocated';
    return app.request(
        `/api/v1/admin/billing-subscription/${input.subscriptionId}/manual-payments${suffix}`,
        {
            method: input.method,
            headers: actorHeaders(input.actorId, input.permissions ?? [permission]),
            ...(input.method === 'POST'
                ? { body: JSON.stringify({ proofRef: 'transfer-1542' }) }
                : {})
        }
    );
}

async function snapshot(subscriptionId: string) {
    const db = getDb();
    const [subscription] = await db
        .select({ status: subscriptions.status, nextChargeAt: subscriptions.nextChargeAt })
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId));
    const installments = await db
        .select({
            id: manualPayments.id,
            status: manualPayments.status,
            periodStart: manualPayments.periodStart
        })
        .from(manualPayments)
        .where(eq(manualPayments.subscriptionId, subscriptionId));
    const marks = await db
        .select({ id: reconciliationMarks.id, reason: reconciliationMarks.reason })
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.subscriptionId, subscriptionId));
    return { subscription, installments, marks };
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

describe('TEST:B5:10 AC:B5:18, AC:B5:19 MP4 and MP6 admin routes', () => {
    for (const method of ['GET', 'POST'] as const) {
        it(`MP4 ${method} returns 200 and preview preserves seeded state`, async () => {
            const seeded = await seedManualRoute({
                status: 'SUSPENDED',
                installmentStatus: 'DECLARED_UNPAID'
            });
            const before = await snapshot(seeded.subscription.id);
            const response = await request({
                method,
                action: 'register-late',
                subscriptionId: seeded.subscription.id,
                manualPaymentId: seeded.installment.id,
                actorId: seeded.admin.id
            });
            expect(response.status).toBe(200);
            const data = (await response.json()).data;
            if (method === 'GET') {
                const parsed = LateManualPaymentPreviewResponseSchema.parse(data);
                expect(parsed).toMatchObject({
                    subscriptionId: seeded.subscription.id,
                    manualPaymentId: seeded.installment.id,
                    effect: 'S7'
                });
                expect(await snapshot(seeded.subscription.id)).toEqual(before);
            } else {
                const parsed = LateManualPaymentResponseSchema.parse(data);
                expect(parsed.effect).toBe('S7');
                const after = await snapshot(seeded.subscription.id);
                expect(after.subscription?.status).toBe('ACTIVE');
                expect(after.installments).toMatchObject([
                    { id: seeded.installment.id, status: 'REGISTERED' }
                ]);
            }
        });

        it(`MP6 ${method} returns 200 and preview preserves seeded state`, async () => {
            const seeded = await seedManualRoute({
                status: 'ACTIVE',
                installmentStatus: 'REGISTERED'
            });
            await getDb().insert(coveredPeriods).values({
                subscriptionId: seeded.subscription.id,
                manualPaymentId: seeded.installment.id,
                periodStart: PERIOD_START,
                creditedAt: NOW
            });
            const before = await snapshot(seeded.subscription.id);
            const response = await request({
                method,
                action: 'unallocated',
                subscriptionId: seeded.subscription.id,
                actorId: seeded.admin.id
            });
            expect(response.status).toBe(200);
            const data = (await response.json()).data;
            if (method === 'GET') {
                expect(UnallocatedManualPaymentPreviewResponseSchema.parse(data)).toEqual({
                    subscriptionId: seeded.subscription.id,
                    periodStart: PERIOD_START.toISOString(),
                    mark: 'COBRO_DUPLICADO'
                });
                expect(await snapshot(seeded.subscription.id)).toEqual(before);
            } else {
                const parsed = UnallocatedManualPaymentResponseSchema.parse(data);
                expect(parsed.mark).toBe('COBRO_DUPLICADO');
                const after = await snapshot(seeded.subscription.id);
                expect(after.installments).toHaveLength(2);
                expect(after.marks).toHaveLength(1);
                expect(after.subscription).toEqual(before.subscription);
            }
        });

        for (const action of ['register-late', 'unallocated'] as const) {
            it(`${action} ${method} returns 403 without the action permission`, async () => {
                const seeded = await seedManualRoute();
                const response = await request({
                    method,
                    action,
                    subscriptionId: seeded.subscription.id,
                    manualPaymentId: seeded.installment.id,
                    actorId: seeded.admin.id,
                    permissions: [PermissionEnum.BILLING_SUBSCRIPTION_INSPECT]
                });
                expect(response.status).toBe(403);
                expect((await response.json()).error).toMatchObject({
                    code: 'FORBIDDEN',
                    message: 'Insufficient admin permissions'
                });
            });

            it(`${action} ${method} returns 404 for a foreign subscription or installment`, async () => {
                const own = await seedManualRoute();
                const foreign = await seedManualRoute();
                const response = await request({
                    method,
                    action,
                    subscriptionId: own.subscription.id,
                    manualPaymentId: foreign.installment.id,
                    actorId: own.admin.id
                });
                if (action === 'unallocated') {
                    const absent = await request({
                        method,
                        action,
                        subscriptionId: crypto.randomUUID(),
                        actorId: own.admin.id
                    });
                    expect(absent.status).toBe(404);
                    expect((await absent.json()).error.reason).toBe('SUBSCRIPTION_NOT_FOUND');
                } else {
                    expect(response.status).toBe(404);
                    expect((await response.json()).error.reason).toBe('MANUAL_PAYMENT_NOT_FOUND');
                }
            });

            it(`${action} ${method} returns 409 for incompatible state`, async () => {
                const seeded = await seedManualRoute({ status: 'ACTIVE' });
                const response = await request({
                    method,
                    action,
                    subscriptionId: seeded.subscription.id,
                    manualPaymentId: seeded.installment.id,
                    actorId: seeded.admin.id
                });
                expect(response.status).toBe(409);
                expect((await response.json()).error.code).toBe('ALREADY_EXISTS');
            });

            it(`${action} ${method} returns 422 for an unmet business rule`, async () => {
                const seeded = await seedManualRoute({
                    status: 'SUSPENDED',
                    installmentStatus: 'DECLARED_UNPAID'
                });
                if (action === 'unallocated')
                    await getDb()
                        .delete(manualPayments)
                        .where(eq(manualPayments.id, seeded.installment.id));
                else
                    await getDb()
                        .update(subscriptions)
                        .set({ paymentMethod: 'CARD' })
                        .where(eq(subscriptions.id, seeded.subscription.id));
                const response = await request({
                    method,
                    action,
                    subscriptionId: seeded.subscription.id,
                    manualPaymentId: seeded.installment.id,
                    actorId: seeded.admin.id
                });
                expect(response.status).toBe(422);
                expect((await response.json()).error.code).toBe('VALIDATION_ERROR');
            });
        }
    }
});
