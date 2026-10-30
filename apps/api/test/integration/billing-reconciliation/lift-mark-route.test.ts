import { and, eq, getDb, reconciliationMarkPayments, reconciliationMarks } from '@repo/db';
import {
    PermissionEnum,
    ReconciliationMarkLiftResponseSchema,
    ReconciliationMarkListResponseSchema
} from '@repo/schemas';
import { openReconciliationMark } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    cleanupSettleExternalRows,
    seedPaidSubscription,
    seedUser
} from '../billing-refund/settle-external-fixtures';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

const BASE = '/api/v1/admin/billing-reconciliation/marks';
const permissions = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK
];
let app: ReturnType<typeof initApp>;
let actorId: string;
let subject: Awaited<ReturnType<typeof seedPaidSubscription>>;
const markIds: string[] = [];

async function markWithPayment(includePayment = true) {
    const opened = await openReconciliationMark({
        subject: { kind: 'SUBSCRIPTION', subscriptionId: subject.subscriptionId },
        reason: 'DIVERGENCIA_DE_MONTO',
        actor: { type: 'admin', id: actorId },
        correlationId: crypto.randomUUID()
    });
    markIds.push(opened.mark.id);
    if (includePayment)
        await getDb()
            .insert(reconciliationMarkPayments)
            .values({
                markId: opened.mark.id,
                paymentId: subject.paymentId,
                hungAt: new Date('2026-10-01T03:00:00.000Z')
            });
    return opened.mark;
}

function post(markId: string, body: Record<string, unknown>) {
    return app.request(`${BASE}/${markId}/lift`, {
        method: 'POST',
        headers: actorHeaders({ id: actorId, role: 'SUPER_ADMIN', permissions }),
        body: JSON.stringify(body)
    });
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp();
});
beforeEach(async () => {
    audit.mockClear();
    actorId = await seedUser('lift-route-admin');
    subject = await seedPaidSubscription();
});
afterEach(async () => {
    for (const markId of markIds.splice(0)) {
        await getDb()
            .delete(reconciliationMarkPayments)
            .where(eq(reconciliationMarkPayments.markId, markId));
        await getDb().delete(reconciliationMarks).where(eq(reconciliationMarks.id, markId));
    }
    await cleanupSettleExternalRows();
});
afterAll(async () => {
    await cleanupSettleExternalRows();
    await testDb.teardown();
});

describe('TEST:1697:10 AC:1697:1 AC:1697:2 action 7 lift route', () => {
    it('(a) lifts and audits the mark', async () => {
        const mark = await markWithPayment(false);
        const response = await post(mark.id, { expectedVersion: mark.version });
        expect(response.status).toBe(200);
        const parsed = ReconciliationMarkLiftResponseSchema.parse((await response.json()).data);
        expect(parsed).toEqual({
            markId: mark.id,
            reason: mark.reason,
            liftedAt: expect.any(String),
            liftedBy: actorId,
            version: mark.version + 1,
            resolvedWithoutRefund: []
        });
        const [stored] = await getDb()
            .select()
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.id, mark.id));
        expect(stored?.liftedAt).not.toBeNull();
        expect(parsed.liftedAt).toBe(stored?.liftedAt?.toISOString());
        expect(stored?.liftedBy).toBe(actorId);
        expect(stored?.version).toBe(mark.version + 1);
        expect(audit).toHaveBeenCalledTimes(1);
        expect(audit).toHaveBeenCalledWith(
            expect.objectContaining({
                auditEvent: AuditEventType.BILLING_MUTATION,
                resourceId: mark.id,
                metadata: expect.objectContaining({
                    administrativeAction: 'ACC_7',
                    transition: 'S15',
                    reason: mark.reason,
                    subjectId: subject.ownerId,
                    expectedVersion: mark.version,
                    version: mark.version + 1
                })
            })
        );
    });

    it('(b) resolves and audits only a named hung payment without refund', async () => {
        const mark = await markWithPayment();
        const response = await post(mark.id, {
            expectedVersion: mark.version,
            resolveWithoutRefund: [{ source: 'PAYMENT', paymentId: subject.paymentId }]
        });
        expect(response.status).toBe(200);
        const [payment] = await getDb()
            .select()
            .from(reconciliationMarkPayments)
            .where(
                and(
                    eq(reconciliationMarkPayments.markId, mark.id),
                    eq(reconciliationMarkPayments.paymentId, subject.paymentId)
                )
            );
        expect(payment?.resolvedAt).not.toBeNull();
        expect(payment?.refundId).toBeNull();
        expect(audit).toHaveBeenCalledWith(
            expect.objectContaining({
                metadata: expect.objectContaining({
                    resolvedWithoutRefund: [{ source: 'PAYMENT', paymentId: subject.paymentId }]
                })
            })
        );
    });

    it('(c) rejects an unnamed hung payment without writing or auditing a mutation', async () => {
        const mark = await markWithPayment();
        const response = await post(mark.id, { expectedVersion: mark.version });
        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({
            error: { code: 'ALREADY_EXISTS', reason: 'MARK_HAS_UNRESOLVED_PAYMENTS' }
        });
        const [stored] = await getDb()
            .select()
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.id, mark.id));
        expect(stored).toMatchObject({ liftedAt: null, version: mark.version });
        expect(audit).not.toHaveBeenCalledWith(
            expect.objectContaining({ auditEvent: AuditEventType.BILLING_MUTATION })
        );
    });

    it('(d) rejects a stale version', async () => {
        const mark = await markWithPayment();
        const response = await post(mark.id, {
            expectedVersion: mark.version + 1,
            resolveWithoutRefund: [{ source: 'PAYMENT', paymentId: subject.paymentId }]
        });
        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({
            error: { code: 'ALREADY_EXISTS', reason: 'MARK_VERSION_CONFLICT' }
        });
    });

    it('(e) rejects lifting the same mark twice', async () => {
        const mark = await markWithPayment();
        expect(
            (
                await post(mark.id, {
                    expectedVersion: mark.version,
                    resolveWithoutRefund: [{ source: 'PAYMENT', paymentId: subject.paymentId }]
                })
            ).status
        ).toBe(200);
        const repeated = await post(mark.id, { expectedVersion: mark.version + 1 });
        expect(repeated.status).toBe(409);
        expect(await repeated.json()).toMatchObject({
            error: { code: 'ALREADY_EXISTS', reason: 'MARK_ALREADY_LIFTED' }
        });
    });

    it('(f) rejects a payment not hung on this mark', async () => {
        const mark = await markWithPayment();
        const response = await post(mark.id, {
            expectedVersion: mark.version,
            resolveWithoutRefund: [{ source: 'PAYMENT', paymentId: crypto.randomUUID() }]
        });
        expect(response.status).toBe(422);
        expect(await response.json()).toMatchObject({
            error: { code: 'VALIDATION_ERROR', reason: 'MARK_PAYMENT_NOT_HUNG' }
        });
    });

    it('(g) reports an unknown UUID mark as not found', async () => {
        const response = await post(crypto.randomUUID(), { expectedVersion: 1 });
        expect(response.status).toBe(404);
        expect(await response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
    });

    it('(h) rejects malformed path and request bodies', async () => {
        const mark = await markWithPayment();
        for (const [id, body] of [
            ['bad', { expectedVersion: mark.version }],
            [mark.id, {}],
            [
                mark.id,
                {
                    expectedVersion: mark.version,
                    resolveWithoutRefund: [
                        { source: 'PAYMENT', paymentId: subject.paymentId },
                        { source: 'PAYMENT', paymentId: subject.paymentId }
                    ]
                }
            ],
            [mark.id, { expectedVersion: mark.version, extra: true }]
        ] as const) {
            expect((await post(id, body)).status).toBe(400);
        }
    });

    it('(i) lists the version used by the lift request', async () => {
        const mark = await markWithPayment();
        const listed = await app.request(BASE, {
            headers: actorHeaders({
                id: actorId,
                role: 'SUPER_ADMIN',
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.BILLING_SUBSCRIPTION_INSPECT
                ]
            })
        });
        expect(listed.status).toBe(200);
        const list = ReconciliationMarkListResponseSchema.parse((await listed.json()).data);
        const item = list.items.find(({ markId }) => markId === mark.id);
        expect(item?.version).toBe(mark.version);
        expect(
            (
                await post(mark.id, {
                    expectedVersion: item!.version,
                    resolveWithoutRefund: [{ source: 'PAYMENT', paymentId: subject.paymentId }]
                })
            ).status
        ).toBe(200);
    });
});
