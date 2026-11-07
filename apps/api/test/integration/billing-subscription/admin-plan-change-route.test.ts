import { eq, subscriptions } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PermissionEnum } from '@repo/schemas';
import { createAdjustableClock } from '@repo/test-clock';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { injectPaymentProvider } from '../../../src/utils/payment-provider';
import { testDb } from '../../e2e/setup/test-database';
import { actorHeaders } from './revocation-route-fixtures';
import { startPlanChangeScenario, withCompositionRollback } from './succession-wiring-fixtures';

const clock = createAdjustableClock({ start: new Date('2026-10-05T12:00:00.000Z') });
const fake = new FakePaymentProvider({
    idNamespace: crypto.randomUUID(),
    clock,
    honestAbout: [{ lie: 'M1', why: 'fixture signup' }]
});
const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));
const adminId = '00000000-0000-4000-8000-000000000092';
let app: ReturnType<typeof initApp>;
const pathOf = (id: string) => `/api/v1/admin/billing-subscription/${id}/plan-change`;
const headers = (permission: boolean, id = adminId) =>
    actorHeaders({
        id,
        role: permission ? 'SUPER_ADMIN' : 'ADMIN',
        permissions: permission
            ? [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_CHANGE_SUBSCRIPTION_PLAN]
            : [PermissionEnum.ACCESS_PANEL_ADMIN]
    });
const post = (id: string, billingOptionId: string, permission = true, actorId = adminId) =>
    app.request(pathOf(id), {
        method: 'POST',
        headers: headers(permission, actorId),
        body: JSON.stringify({ billingOptionId, expectedStatus: 'ACTIVE', confirmed: true })
    });
const mutationAudits = () =>
    audit.mock.calls
        .map(([event]) => event)
        .filter((event) => event.auditEvent === AuditEventType.BILLING_MUTATION);
const scenario = (
    tx: Parameters<Parameters<typeof withCompositionRollback>[0]>[0],
    direction?: 'UP' | 'DOWN'
) =>
    startPlanChangeScenario(tx, {
        provider: fake,
        clock,
        approve: async (authorizationId) => {
            await fake.approve({ authorizationId });
        },
        direction
    });

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock });
    injectPaymentProvider({ provider: fake });
    app = initApp({ clock, paymentProvider: fake });
});
beforeEach(() => {
    audit.mockClear();
    injectPaymentProvider({ provider: fake });
});
afterAll(async () => testDb.teardown());

describe('TEST:B8b:22 AC:B8b:22 administrative plan change (ACC:10)', () => {
    it('returns 404 for a missing subscription', async () => {
        const response = await post(crypto.randomUUID(), crypto.randomUUID());
        expect(response.status).toBe(404);
        expect(await response.json()).toMatchObject({
            error: { code: 'NOT_FOUND', reason: 'SUBSCRIPTION_NOT_FOUND' }
        });
        expect(mutationAudits()).toEqual([]);
    });

    it('rejects a valid body without permission', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await scenario(tx);
            const response = await post(row.subscriptionId, row.targetOptionId, false);
            expect(response.status).toBe(403);
            expect(await response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
            expect(mutationAudits()).toEqual([]);
        });
    });

    it('rejects actor equal to subject', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await scenario(tx);
            const response = await post(row.subscriptionId, row.targetOptionId, true, row.userId);
            expect(response.status).toBe(403);
            expect(await response.json()).toMatchObject({
                error: { code: 'FORBIDDEN', reason: 'ADMINISTRATIVE_ACTION_FORBIDDEN' }
            });
            expect(mutationAudits()).toEqual([]);
        });
    });

    it('rejects absent confirmation and a changed observed status', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await scenario(tx);
            const unconfirmed = await app.request(pathOf(row.subscriptionId), {
                method: 'POST',
                headers: headers(true),
                body: JSON.stringify({
                    billingOptionId: row.targetOptionId,
                    expectedStatus: 'ACTIVE'
                })
            });
            expect(unconfirmed.status).toBe(400);
            await tx
                .update(subscriptions)
                .set({ status: 'PAUSED' })
                .where(eq(subscriptions.id, row.subscriptionId));
            const changed = await post(row.subscriptionId, row.targetOptionId);
            expect(changed.status).toBe(409);
            expect(await changed.json()).toMatchObject({
                error: { reason: 'ADMINISTRATIVE_ACTION_STATE_CHANGED' }
            });
            expect(mutationAudits()).toEqual([]);
        });
    });

    it('creates a subject-owned pending successor and audits the administrator', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await scenario(tx);
            const response = await post(row.subscriptionId, row.targetOptionId);
            expect(response.status).toBe(200);
            const result = await response.json();
            expect(result).toMatchObject({
                data: {
                    outcome: 'SUCCESSION',
                    checkoutUrl: expect.any(String),
                    firstChargeAt: expect.any(String),
                    creditDays: expect.any(Number)
                }
            });
            const [predecessor] = await tx
                .select({
                    status: subscriptions.status,
                    succeededById: subscriptions.succeededById
                })
                .from(subscriptions)
                .where(eq(subscriptions.id, row.subscriptionId));
            expect(predecessor?.status).toBe('ACTIVE');
            const [successor] = await tx
                .select({ userId: subscriptions.userId, status: subscriptions.status })
                .from(subscriptions)
                .where(
                    eq(
                        subscriptions.id,
                        predecessor?.succeededById ?? '00000000-0000-4000-8000-000000000000'
                    )
                );
            expect(successor).toEqual({ userId: row.userId, status: 'PENDING_AUTHORIZATION' });
            expect(mutationAudits()).toEqual([
                expect.objectContaining({
                    actorId: adminId,
                    metadata: expect.objectContaining({
                        administrativeAction: 'ACC_10',
                        act: 'PLAN_CHANGE',
                        outcome: 'SUCCESSION',
                        subjectId: row.userId,
                        billingOptionId: row.targetOptionId
                    })
                })
            ]);
        });
    });

    it('returns a scheduled downgrade date and audits the administrator', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await scenario(tx, 'DOWN');
            const response = await post(row.subscriptionId, row.targetOptionId);
            expect(response.status).toBe(200);
            expect(await response.json()).toMatchObject({
                data: { outcome: 'DOWNGRADE', effectiveAt: expect.any(String) }
            });
            expect(mutationAudits()).toEqual([
                expect.objectContaining({
                    actorId: adminId,
                    metadata: expect.objectContaining({
                        administrativeAction: 'ACC_10',
                        outcome: 'DOWNGRADE'
                    })
                })
            ]);
        });
    });

    it('applies regret of a queued downgrade and audits the administrator', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await scenario(tx, 'DOWN');
            const downgrade = await post(row.subscriptionId, row.targetOptionId);
            expect(downgrade.status).toBe(200);
            audit.mockClear();
            const response = await post(row.subscriptionId, row.sourceOptionId);
            expect(response.status).toBe(200);
            expect(await response.json()).toMatchObject({
                data: { outcome: 'REGRET', amountMinor: expect.any(Number) }
            });
            expect(mutationAudits()).toEqual([
                expect.objectContaining({
                    actorId: adminId,
                    metadata: expect.objectContaining({
                        administrativeAction: 'ACC_10',
                        outcome: 'REGRET',
                        subjectId: row.userId
                    })
                })
            ]);
        });
    });

    it('maps NO_CHANGE like the owner route and writes no mutation audit', async () => {
        await withCompositionRollback(async (tx) => {
            const row = await scenario(tx);
            const response = await post(row.subscriptionId, row.sourceOptionId);
            expect(response.status).toBe(422);
            expect(await response.json()).toMatchObject({
                error: { code: 'VALIDATION_ERROR', reason: 'NO_CHANGE' }
            });
            expect(mutationAudits()).toEqual([]);
        });
    });
});
