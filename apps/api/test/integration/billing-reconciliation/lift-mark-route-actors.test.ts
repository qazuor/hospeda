import { and, eq, getDb, reconciliationMarkPayments, reconciliationMarks } from '@repo/db';
import { PermissionEnum } from '@repo/schemas';
import { openReconciliationMark } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { AuditEventType } from '../../../src/utils/audit-logger';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    cleanupSettleExternalRows,
    seedPaidAddonInstance,
    seedPaidSubscription,
    seedUser
} from '../billing-refund/settle-external-fixtures';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));
const BASE = '/api/v1/admin/billing-reconciliation/marks';
const liftPermissions = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.BILLING_LIFT_RECONCILIATION_MARK
];
let app: ReturnType<typeof initApp>;
let adminId: string;
const markIds: string[] = [];

async function makeMark(
    subject:
        | { kind: 'SUBSCRIPTION'; subscriptionId: string }
        | { kind: 'ADDON_INSTANCE'; addonInstanceId: string },
    paymentId: string
) {
    const opened = await openReconciliationMark({
        subject,
        reason:
            subject.kind === 'ADDON_INSTANCE'
                ? 'ORDEN_PAGADA_SIN_INSTANCIA'
                : 'DIVERGENCIA_DE_MONTO',
        actor: { type: 'admin', id: adminId },
        correlationId: crypto.randomUUID()
    });
    markIds.push(opened.mark.id);
    await getDb()
        .insert(reconciliationMarkPayments)
        .values({
            markId: opened.mark.id,
            paymentId,
            hungAt: new Date('2026-10-01T03:00:00.000Z')
        });
    return opened.mark;
}

function request(
    markId: string,
    actor?: { id: string; role: string; permissions: PermissionEnum[] },
    body: unknown = {
        expectedVersion: 1,
        resolveWithoutRefund: [{ source: 'PAYMENT', paymentId: crypto.randomUUID() }]
    }
) {
    return app.request(`${BASE}/${markId}/lift`, {
        method: 'POST',
        headers: actorHeaders(actor),
        body: JSON.stringify(body)
    });
}

async function expectUntouched(markId: string, version: number, paymentId: string) {
    const [mark] = await getDb()
        .select()
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.id, markId));
    const [payment] = await getDb()
        .select()
        .from(reconciliationMarkPayments)
        .where(
            and(
                eq(reconciliationMarkPayments.markId, markId),
                eq(reconciliationMarkPayments.paymentId, paymentId)
            )
        );
    expect(mark).toMatchObject({ liftedAt: null, version });
    expect(payment?.resolvedAt).toBeNull();
    expect(audit).not.toHaveBeenCalledWith(
        expect.objectContaining({ auditEvent: AuditEventType.BILLING_MUTATION })
    );
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp();
});
beforeEach(async () => {
    audit.mockClear();
    adminId = await seedUser('lift-actor-admin');
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

describe('TEST:1697:11 AC:1697:1 action 7 actor authorization', () => {
    it('(a) requires a session', async () => {
        const subject = await seedPaidSubscription();
        const mark = await makeMark(
            { kind: 'SUBSCRIPTION', subscriptionId: subject.subscriptionId },
            subject.paymentId
        );
        const response = await request(mark.id, undefined, {
            expectedVersion: mark.version,
            resolveWithoutRefund: [{ source: 'PAYMENT', paymentId: subject.paymentId }]
        });
        expect(response.status).toBe(401);
        expect(await response.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
        await expectUntouched(mark.id, mark.version, subject.paymentId);
    });
    it('(b) checks the action permission before invalid body validation', async () => {
        const subject = await seedPaidSubscription();
        const mark = await makeMark(
            { kind: 'SUBSCRIPTION', subscriptionId: subject.subscriptionId },
            subject.paymentId
        );
        const id = await seedUser('lift-actor-no-permission');
        const response = await request(
            mark.id,
            {
                id,
                role: 'ADMIN',
                permissions: [
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    PermissionEnum.BILLING_SUBSCRIPTION_INSPECT,
                    PermissionEnum.BILLING_SETTLE_EXTERNAL,
                    PermissionEnum.BILLING_CANCEL_SUBSCRIPTION
                ]
            },
            { invalid: true }
        );
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
        await expectUntouched(mark.id, mark.version, subject.paymentId);
    });
    it('(c) denies a host without the admin panel', async () => {
        const subject = await seedPaidSubscription();
        const mark = await makeMark(
            { kind: 'SUBSCRIPTION', subscriptionId: subject.subscriptionId },
            subject.paymentId
        );
        const response = await request(mark.id, {
            id: await seedUser('lift-host'),
            role: 'HOST',
            permissions: []
        });
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
        await expectUntouched(mark.id, mark.version, subject.paymentId);
    });
    it('(d) refuses the subscription owner even with the action permission', async () => {
        const subject = await seedPaidSubscription();
        const mark = await makeMark(
            { kind: 'SUBSCRIPTION', subscriptionId: subject.subscriptionId },
            subject.paymentId
        );
        const response = await request(
            mark.id,
            { id: subject.ownerId, role: 'SUPER_ADMIN', permissions: liftPermissions },
            {
                expectedVersion: mark.version,
                resolveWithoutRefund: [{ source: 'PAYMENT', paymentId: subject.paymentId }]
            }
        );
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
        await expectUntouched(mark.id, mark.version, subject.paymentId);
    });
    it('(e) refuses the owner of an add-on instance mark', async () => {
        const addon = await seedPaidAddonInstance();
        const mark = await makeMark(
            { kind: 'ADDON_INSTANCE', addonInstanceId: addon.addonInstanceId },
            addon.paymentId
        );
        const response = await request(
            mark.id,
            { id: addon.ownerId, role: 'SUPER_ADMIN', permissions: liftPermissions },
            {
                expectedVersion: mark.version,
                resolveWithoutRefund: [{ source: 'PAYMENT', paymentId: addon.paymentId }]
            }
        );
        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
        await expectUntouched(mark.id, mark.version, addon.paymentId);
    });
    it('(f) allows another SUPER_ADMIN based on the permission', async () => {
        const subject = await seedPaidSubscription();
        const mark = await makeMark(
            { kind: 'SUBSCRIPTION', subscriptionId: subject.subscriptionId },
            subject.paymentId
        );
        const response = await request(
            mark.id,
            {
                id: await seedUser('lift-peer-admin'),
                role: 'SUPER_ADMIN',
                permissions: liftPermissions
            },
            {
                expectedVersion: mark.version,
                resolveWithoutRefund: [{ source: 'PAYMENT', paymentId: subject.paymentId }]
            }
        );
        expect(response.status).toBe(200);
    });
});
