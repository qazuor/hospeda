import {
    eq,
    getDb,
    manualPayments,
    reconciliationMarkPayments,
    reconciliationMarks,
    sql,
    subscriptions
} from '@repo/db';
import {
    ActionableReconciliationMarkSchema,
    PermissionEnum,
    ReconciliationMarkEventsResponseSchema
} from '@repo/schemas';
import { openReconciliationMark } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    actorHeaders,
    cleanupSettleExternalRows,
    seedPaidAddonInstance,
    seedPaidSubscription,
    seedUser
} from '../billing-refund/settle-external-fixtures';

const BASE = '/api/v1/admin/billing-reconciliation/marks';
const inspect = [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.BILLING_SUBSCRIPTION_INSPECT];
let app: ReturnType<typeof initApp>;
let adminId: string;
const markIds: string[] = [];
const manualPaymentIds: string[] = [];

async function seedMark(
    subject: Awaited<ReturnType<typeof seedPaidSubscription>>,
    reason: 'PAGO_TARDIO_RECHAZADO' | 'DIVERGENCIA_DE_MONTO'
) {
    const opened = await openReconciliationMark({
        subject: { kind: 'SUBSCRIPTION', subscriptionId: subject.subscriptionId },
        reason,
        actor: { type: 'admin', id: adminId },
        correlationId: crypto.randomUUID(),
        ...(reason === 'PAGO_TARDIO_RECHAZADO'
            ? { detail: [{ field: 'late_payment.failed_condition', new: 2 }] }
            : {})
    });
    markIds.push(opened.mark.id);
    await getDb()
        .insert(reconciliationMarkPayments)
        .values({
            markId: opened.mark.id,
            paymentId: subject.paymentId,
            hungAt: new Date('2026-10-01T03:00:00.000Z')
        });
    return { markId: opened.mark.id };
}

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
    validateApiEnv();
    app = initApp();
});
beforeEach(async () => {
    adminId = await seedUser('reconciliation-admin');
});
afterEach(async () => {
    for (const markId of markIds.splice(0)) {
        await getDb()
            .delete(reconciliationMarkPayments)
            .where(eq(reconciliationMarkPayments.markId, markId));
        await getDb().delete(reconciliationMarks).where(eq(reconciliationMarks.id, markId));
    }
    if (manualPaymentIds.length > 0) {
        await getDb().delete(manualPayments).where(eq(manualPayments.id, manualPaymentIds.pop()!));
    }
    await cleanupSettleExternalRows();
});
afterAll(async () => {
    await cleanupSettleExternalRows();
    await testDb.teardown();
});

const requestHeaders = () =>
    actorHeaders({ id: adminId, role: 'SUPER_ADMIN', permissions: inspect });

describe('TEST:1620:7 actionable reconciliation mark routes', () => {
    it('keeps an unresolved open subject in the list response', async () => {
        const subject = await seedPaidSubscription();
        const normal = await seedMark(subject, 'DIVERGENCIA_DE_MONTO');
        const orphanId = crypto.randomUUID();
        const orphan = await getDb().transaction(async (tx) => {
            await tx.execute(sql`SET LOCAL session_replication_role = 'replica'`);
            const [inserted] = await tx
                .insert(reconciliationMarks)
                .values({ subscriptionId: orphanId, reason: 'DIVERGENCIA_DE_MONTO' })
                .returning({ id: reconciliationMarks.id });
            if (!inserted) throw new Error('Expected orphan reconciliation mark');
            return inserted;
        });
        markIds.push(orphan.id);

        const response = await app.request(`${BASE}?page=1&pageSize=100`, {
            headers: requestHeaders()
        });
        expect(response.status).toBe(200);
        const items = (await response.json()).data.items as any[];
        expect(items).toHaveLength(2);
        expect(items.find((item) => item.markId === normal.markId)?.subject.status).toBeTruthy();
        expect(items.find((item) => item.markId === orphan.id)?.subject.status).toBeNull();
    });

    it('(a) lists its reason 7 and 5 marks, payment evidence, ordering, and schema-valid response', async () => {
        const subject = await seedPaidSubscription();
        const reason5 = await seedMark(subject, 'DIVERGENCIA_DE_MONTO');
        const reason7 = await seedMark(subject, 'PAGO_TARDIO_RECHAZADO');
        const addon = await seedPaidAddonInstance();
        const addonMark = await openReconciliationMark({
            subject: { kind: 'ADDON_INSTANCE', addonInstanceId: addon.addonInstanceId },
            reason: 'ORDEN_PAGADA_SIN_INSTANCIA',
            actor: { type: 'admin', id: adminId },
            correlationId: crypto.randomUUID()
        });
        markIds.push(addonMark.mark.id);
        await getDb()
            .insert(reconciliationMarkPayments)
            .values({
                markId: addonMark.mark.id,
                paymentId: addon.paymentId,
                hungAt: new Date('2026-10-01T03:00:00.000Z')
            });
        const unknown = await seedPaidSubscription();
        await getDb()
            .update(subscriptions)
            .set({ class: 'COMPLEMENTO', planVersionId: null, billingOptionId: null })
            .where(eq(subscriptions.id, unknown.subscriptionId));
        const [manual] = await getDb()
            .insert(manualPayments)
            .values({
                subscriptionId: unknown.subscriptionId,
                periodStart: new Date('2026-10-01T03:00:00.000Z'),
                status: 'REGISTERED',
                registeredBy: adminId,
                registeredAt: new Date('2026-10-01T03:00:00.000Z')
            })
            .returning({ id: manualPayments.id });
        if (!manual) throw new Error('Expected manual payment');
        manualPaymentIds.push(manual.id);
        const unknownMark = await openReconciliationMark({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: unknown.subscriptionId },
            reason: 'DIVERGENCIA_DE_MONTO',
            actor: { type: 'admin', id: adminId },
            correlationId: crypto.randomUUID()
        });
        markIds.push(unknownMark.mark.id);
        await getDb()
            .insert(reconciliationMarkPayments)
            .values({
                markId: unknownMark.mark.id,
                manualPaymentId: manual.id,
                hungAt: new Date('2026-10-01T03:00:00.000Z')
            });
        const response = await app.request(`${BASE}?page=1&pageSize=100`, {
            headers: requestHeaders()
        });
        expect(response.status).toBe(200);
        const body = await response.json();
        const items = body.data.items as unknown[];
        items.forEach((item) => {
            expect(ActionableReconciliationMarkSchema.safeParse(item).success).toBe(true);
        });
        const seven = items.find((row: any) => row.markId === reason7.markId) as any;
        const five = items.find((row: any) => row.markId === reason5.markId) as any;
        expect(seven).toMatchObject({
            reasonNumber: 7,
            eventLink: { markId: reason7.markId },
            paymentCount: 1,
            totalAmount: [{ currency: 'ARS', amountMinor: 10000 }],
            defaultProposal: 'REFUND'
        });
        expect(seven.payments).toHaveLength(1);
        expect(five).toMatchObject({
            reasonNumber: 5,
            eventLink: null,
            paymentCount: 1,
            defaultProposal: 'NONE'
        });
        expect(items).toContainEqual(
            expect.objectContaining({
                markId: addonMark.mark.id,
                subject: expect.objectContaining({
                    kind: 'ADDON_INSTANCE',
                    id: addon.addonInstanceId
                }),
                eventLink: null,
                payments: [expect.objectContaining({ amountMinor: 10000, currency: 'ARS' })]
            })
        );
        const manualItem = items.find((row: any) => row.markId === unknownMark.mark.id) as any;
        expect(manualItem).toMatchObject({
            eventLink: null,
            paymentCount: 1,
            unknownAmountCount: 1,
            payments: [
                expect.objectContaining({
                    source: 'MANUAL_PAYMENT',
                    amountMinor: null,
                    currency: null
                })
            ]
        });
        expect(items.findIndex((row: any) => row.markId === reason7.markId)).toBeLessThan(
            items.findIndex((row: any) => row.markId === reason5.markId)
        );
    });
    it('(b) reads the critical reason 7 event and its recorded failed condition', async () => {
        const seeded = await seedMark(await seedPaidSubscription(), 'PAGO_TARDIO_RECHAZADO');
        const response = await app.request(`${BASE}/${seeded.markId}/events`, {
            headers: requestHeaders()
        });
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(ReconciliationMarkEventsResponseSchema.safeParse(body.data).success).toBe(true);
        expect(body.data.events).toContainEqual(
            expect.objectContaining({ failedCondition: 2, conditionRecorded: true })
        );
    });
    it('(c) returns typed 404 for an unknown UUID and (d) rejects malformed mark ids', async () => {
        const missing = await app.request(`${BASE}/${crypto.randomUUID()}/events`, {
            headers: requestHeaders()
        });
        expect(missing.status).toBe(404);
        expect((await missing.json()).error.code).toBe('NOT_FOUND');
        const malformed = await app.request(`${BASE}/bad/events`, { headers: requestHeaders() });
        expect(malformed.status).toBe(400);
    });
});
