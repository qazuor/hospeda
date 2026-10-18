import { and, eq, reconciliationMarkModel, reconciliationMarkPayments } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { liftReconciliationMarkByAdmin } from '../../../src/services/billing/reconciliation/lift-reconciliation-mark-by-admin.service.js';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import type { HangablePayment } from '../../../src/services/billing/reconciliation/reconciliation-mark-payments.port.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import { seedLiftAdmin } from './support/admin-lift-fixtures.js';
import {
    markPaymentClock as clock,
    markPaymentFixture,
    retireMarkPaymentFixtures,
    seedManualPayment,
    seedProviderPayment
} from './support/mark-payment-fixtures.js';

afterAll(closeServiceTestPool);
afterEach(retireMarkPaymentFixtures);

async function open(
    subscriptionId: string,
    userId: string,
    payment?: HangablePayment,
    reason: 'COBRO_DUPLICADO' | 'DIVERGENCIA_DE_MONTO' = 'COBRO_DUPLICADO'
) {
    return openReconciliationMark(
        {
            subject: { kind: 'SUBSCRIPTION', subscriptionId },
            reason,
            ...(payment ? { payment } : {}),
            actor: { type: 'admin', id: userId },
            correlationId: crypto.randomUUID()
        },
        { markPayments: createPaymentReconciliationMarkPayments(clock) }
    );
}

async function lift(markId: string, expectedVersion: number, payments: readonly HangablePayment[]) {
    return liftReconciliationMarkByAdmin(
        { actor: await seedLiftAdmin(), markId, expectedVersion, resolveWithoutRefund: payments },
        { clock }
    );
}

async function resolved(payment: HangablePayment) {
    return getServiceTestDb()
        .select({
            resolvedAt: reconciliationMarkPayments.resolvedAt,
            refundId: reconciliationMarkPayments.refundId
        })
        .from(reconciliationMarkPayments)
        .where(
            payment.source === 'PAYMENT'
                ? eq(reconciliationMarkPayments.paymentId, payment.id)
                : eq(reconciliationMarkPayments.manualPaymentId, payment.id)
        );
}

describe('TEST:1697:6 AC:1697:2 named no-refund payment resolution', () => {
    it('(a) rejects when no unresolved hung payments are named', async () => {
        const f = await markPaymentFixture();
        const payment = await seedProviderPayment({ subscriptionId: f.subscriptionId });
        const { mark } = await open(f.subscriptionId, f.userId, payment);
        await expect(lift(mark.id, mark.version, [])).rejects.toMatchObject({
            reason: 'MARK_HAS_UNRESOLVED_PAYMENTS'
        });
        const reread = await reconciliationMarkModel.findById({ markId: mark.id });
        expect(reread?.liftedAt).toBeNull();
        expect(reread?.version).toBe(mark.version);
        expect(await resolved(payment)).toEqual([{ resolvedAt: null, refundId: null }]);
    });

    it('(b) rolls back a named resolution when another hung payment is omitted', async () => {
        const f = await markPaymentFixture();
        const one = await seedProviderPayment({ subscriptionId: f.subscriptionId });
        const two = await seedManualPayment({ subscriptionId: f.subscriptionId });
        const { mark } = await open(f.subscriptionId, f.userId, one);
        await getServiceTestDb().transaction(async (tx) => {
            const port = createPaymentReconciliationMarkPayments(clock);
            await port.hang({ markId: mark.id, payment: two, tx });
        });
        await expect(lift(mark.id, mark.version, [one])).rejects.toMatchObject({
            reason: 'MARK_HAS_UNRESOLVED_PAYMENTS'
        });
        const reread = await reconciliationMarkModel.findById({ markId: mark.id });
        expect(reread?.liftedAt).toBeNull();
        expect(reread?.version).toBe(mark.version);
        expect(await resolved(one)).toEqual([{ resolvedAt: null, refundId: null }]);
        expect(await resolved(two)).toEqual([{ resolvedAt: null, refundId: null }]);
    });

    it('(c) deduplicates named provider and manual payments and leaves refund IDs null', async () => {
        const f = await markPaymentFixture();
        const one = await seedProviderPayment({ subscriptionId: f.subscriptionId });
        const two = await seedManualPayment({ subscriptionId: f.subscriptionId });
        const { mark } = await open(f.subscriptionId, f.userId, one);
        await getServiceTestDb().transaction((tx) =>
            createPaymentReconciliationMarkPayments(clock).hang({
                markId: mark.id,
                payment: two,
                tx
            })
        );
        const admin = await seedLiftAdmin();
        const result = await liftReconciliationMarkByAdmin(
            {
                actor: admin,
                markId: mark.id,
                expectedVersion: mark.version,
                resolveWithoutRefund: [one, two, one]
            },
            { clock }
        );
        expect(result).toEqual({
            markId: mark.id,
            reason: 'COBRO_DUPLICADO',
            subjectId: f.userId,
            liftedAt: clock.now(),
            liftedBy: admin.id,
            version: mark.version + 1,
            resolvedWithoutRefund: [one, two]
        });
        expect(await resolved(one)).toMatchObject([{ resolvedAt: clock.now(), refundId: null }]);
        expect(await resolved(two)).toMatchObject([{ resolvedAt: clock.now(), refundId: null }]);
    });

    it('(d) rejects a payment hung on another mark and changes neither mark', async () => {
        const f = await markPaymentFixture();
        const payment = await seedProviderPayment({ subscriptionId: f.subscriptionId });
        const other = await open(f.subscriptionId, f.userId, payment);
        const target = await open(f.subscriptionId, f.userId, undefined, 'DIVERGENCIA_DE_MONTO');
        await expect(lift(target.mark.id, target.mark.version, [payment])).rejects.toMatchObject({
            reason: 'MARK_PAYMENT_NOT_HUNG'
        });
        expect(
            (await reconciliationMarkModel.findById({ markId: target.mark.id }))?.liftedAt
        ).toBeNull();
        expect(
            (await reconciliationMarkModel.findById({ markId: other.mark.id }))?.liftedAt
        ).toBeNull();
        expect((await reconciliationMarkModel.findById({ markId: target.mark.id }))?.version).toBe(
            target.mark.version
        );
        expect((await reconciliationMarkModel.findById({ markId: other.mark.id }))?.version).toBe(
            other.mark.version
        );
        expect(await resolved(payment)).toEqual([{ resolvedAt: null, refundId: null }]);
    });

    it('(e) rejects a previously resolved hung payment without changing its timestamp', async () => {
        const f = await markPaymentFixture();
        const payment = await seedProviderPayment({ subscriptionId: f.subscriptionId });
        const { mark } = await open(f.subscriptionId, f.userId, payment);
        await getServiceTestDb()
            .update(reconciliationMarkPayments)
            .set({ resolvedAt: new Date('2026-10-01T00:00:00Z') })
            .where(eq(reconciliationMarkPayments.markId, mark.id));
        await expect(lift(mark.id, mark.version, [payment])).rejects.toMatchObject({
            reason: 'MARK_PAYMENT_NOT_HUNG'
        });
        const reread = await reconciliationMarkModel.findById({ markId: mark.id });
        expect(reread?.liftedAt).toBeNull();
        expect(reread?.version).toBe(mark.version);
        expect(await resolved(payment)).toEqual([
            { resolvedAt: new Date('2026-10-01T00:00:00Z'), refundId: null }
        ]);
    });

    it('(f) rolls back named resolutions when S15 detects a stale version', async () => {
        const f = await markPaymentFixture();
        const one = await seedProviderPayment({ subscriptionId: f.subscriptionId });
        const two = await seedManualPayment({ subscriptionId: f.subscriptionId });
        const { mark } = await open(f.subscriptionId, f.userId, one);
        await getServiceTestDb().transaction((tx) =>
            createPaymentReconciliationMarkPayments(clock).hang({
                markId: mark.id,
                payment: two,
                tx
            })
        );
        await expect(lift(mark.id, mark.version - 1, [one, two])).rejects.toMatchObject({
            reason: 'MARK_VERSION_CONFLICT'
        });
        const reread = await reconciliationMarkModel.findById({ markId: mark.id });
        expect(reread?.liftedAt).toBeNull();
        expect(reread?.version).toBe(mark.version);
        expect(await resolved(one)).toEqual([{ resolvedAt: null, refundId: null }]);
        expect(await resolved(two)).toEqual([{ resolvedAt: null, refundId: null }]);
    });

    it('(g) preserves a resolved sibling while resolving only the named unresolved payment', async () => {
        const f = await markPaymentFixture();
        const one = await seedProviderPayment({ subscriptionId: f.subscriptionId });
        const two = await seedManualPayment({ subscriptionId: f.subscriptionId });
        const { mark } = await open(f.subscriptionId, f.userId, one);
        await getServiceTestDb().transaction((tx) =>
            createPaymentReconciliationMarkPayments(clock).hang({
                markId: mark.id,
                payment: two,
                tx
            })
        );
        const prior = new Date('2026-10-01T00:00:00Z');
        await getServiceTestDb()
            .update(reconciliationMarkPayments)
            .set({ resolvedAt: prior })
            .where(
                and(
                    eq(reconciliationMarkPayments.markId, mark.id),
                    eq(reconciliationMarkPayments.manualPaymentId, two.id)
                )
            );
        await lift(mark.id, mark.version, [one]);
        expect(await resolved(one)).toMatchObject([{ resolvedAt: clock.now(), refundId: null }]);
        expect(await resolved(two)).toMatchObject([{ resolvedAt: prior, refundId: null }]);
    });
});
