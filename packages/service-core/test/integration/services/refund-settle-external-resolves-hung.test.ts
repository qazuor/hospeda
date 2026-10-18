import { eq, reconciliationMarkModel, reconciliationMarkPayments } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { liftReconciliationMarkByAdmin } from '../../../src/services/billing/reconciliation/lift-reconciliation-mark-by-admin.service.js';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import { settleExternalRefund } from '../../../src/services/billing/refund/settle-external-refund.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import { seedLiftAdmin } from './support/admin-lift-fixtures.js';
import { markPaymentClock } from './support/mark-payment-fixtures.js';
import {
    creditedPayment,
    manualPaymentWithCoverage,
    refundsOfPayment,
    seedAdminActor,
    settleOnPayment
} from './support/refund-fixtures.js';

const marked: { subscriptionId: string; markId: string }[] = [];
afterAll(closeServiceTestPool);
afterEach(async () => {
    const db = getServiceTestDb();
    for (const { markId } of marked.splice(0)) {
        await db
            .update(reconciliationMarkPayments)
            .set({ resolvedAt: markPaymentClock.now() })
            .where(eq(reconciliationMarkPayments.markId, markId));
        const row = await reconciliationMarkModel.findById({ markId });
        if (row?.liftedAt === null)
            await liftReconciliationMarkByAdmin(
                {
                    actor: await seedLiftAdmin(),
                    markId,
                    expectedVersion: row.version,
                    resolveWithoutRefund: []
                },
                { clock: markPaymentClock }
            );
    }
});

async function hang(
    subscriptionId: string,
    payment: { source: 'PAYMENT' | 'MANUAL_PAYMENT'; id: string },
    reason: 'COBRO_POSTERIOR_A_LA_BAJA' | 'TRANSICION_NO_DECLARADA' = 'COBRO_POSTERIOR_A_LA_BAJA'
) {
    const { mark } = await openReconciliationMark(
        {
            subject: { kind: 'SUBSCRIPTION', subscriptionId },
            reason,
            payment,
            actor: { type: 'admin', id: (await seedAdminActor()).id },
            correlationId: crypto.randomUUID()
        },
        { markPayments: createPaymentReconciliationMarkPayments(markPaymentClock) }
    );
    marked.push({ subscriptionId, markId: mark.id });
    return mark;
}

async function rows(markId: string) {
    return getServiceTestDb()
        .select({
            paymentId: reconciliationMarkPayments.paymentId,
            manualPaymentId: reconciliationMarkPayments.manualPaymentId,
            resolvedAt: reconciliationMarkPayments.resolvedAt,
            refundId: reconciliationMarkPayments.refundId
        })
        .from(reconciliationMarkPayments)
        .where(eq(reconciliationMarkPayments.markId, markId));
}

describe('TEST:1697:8 AC:1697:3 RF4 resolves hung payments with the executed refund', () => {
    it('(a) resolves all marks hung on the refunded provider payment', async () => {
        const credited = await creditedPayment();
        const one = await hang(credited.fixture.started.subscriptionId, {
            source: 'PAYMENT',
            id: credited.payment.id
        });
        const two = await hang(
            credited.fixture.started.subscriptionId,
            { source: 'PAYMENT', id: credited.payment.id },
            'TRANSICION_NO_DECLARADA'
        );
        const result = await settleOnPayment(await seedAdminActor(), credited);
        expect(await rows(one.id)).toEqual([
            {
                paymentId: credited.payment.id,
                manualPaymentId: null,
                resolvedAt: credited.fixture.clock.now(),
                refundId: result.refundId
            }
        ]);
        expect(await rows(two.id)).toEqual([
            {
                paymentId: credited.payment.id,
                manualPaymentId: null,
                resolvedAt: credited.fixture.clock.now(),
                refundId: result.refundId
            }
        ]);
    });

    it('(b) resolves a registered manual payment settled totally', async () => {
        const manual = await manualPaymentWithCoverage();
        const mark = await hang(manual.fixture.started.subscriptionId, {
            source: 'MANUAL_PAYMENT',
            id: manual.manual.id
        });
        const result = await settleExternalRefund(
            {
                actor: await seedAdminActor(),
                source: { kind: 'MANUAL_PAYMENT', id: manual.manual.id },
                amount: 250000,
                channel: 'BANK_TRANSFER',
                reference: `hos1697-${crypto.randomUUID()}`,
                reason: 'OUT_OF_FLOW_REFUND',
                manualPaymentScope: 'TOTAL'
            },
            { clock: manual.fixture.clock }
        );
        expect(await rows(mark.id)).toEqual([
            {
                paymentId: null,
                manualPaymentId: manual.manual.id,
                resolvedAt: manual.fixture.clock.now(),
                refundId: result.refundId
            }
        ]);
    });

    it('(c) resolves a hung provider payment after a partial settlement', async () => {
        const credited = await creditedPayment();
        const mark = await hang(credited.fixture.started.subscriptionId, {
            source: 'PAYMENT',
            id: credited.payment.id
        });
        const result = await settleOnPayment(await seedAdminActor(), credited, { amount: 5000 });
        expect(result.paymentOutcome).toBe('P4');
        expect((await rows(mark.id))[0]).toMatchObject({
            resolvedAt: credited.fixture.clock.now(),
            refundId: result.refundId
        });
    });

    it('(d) leaves another payment unresolved and preserves an already resolved attachment', async () => {
        const credited = await creditedPayment();
        const other = await creditedPayment();
        const mark = await hang(credited.fixture.started.subscriptionId, {
            source: 'PAYMENT',
            id: credited.payment.id
        });
        await getServiceTestDb().transaction((tx) =>
            createPaymentReconciliationMarkPayments(markPaymentClock).hang({
                markId: mark.id,
                payment: { source: 'PAYMENT', id: other.payment.id },
                tx
            })
        );
        await getServiceTestDb()
            .update(reconciliationMarkPayments)
            .set({ resolvedAt: new Date('2026-10-01T00:00:00Z') })
            .where(eq(reconciliationMarkPayments.paymentId, credited.payment.id));
        const result = await settleOnPayment(await seedAdminActor(), credited);
        const attached = await rows(mark.id);
        expect(attached.find((row) => row.paymentId === other.payment.id)?.resolvedAt).toBeNull();
        expect(attached.find((row) => row.paymentId === credited.payment.id)).toEqual({
            paymentId: credited.payment.id,
            manualPaymentId: null,
            resolvedAt: new Date('2026-10-01T00:00:00Z'),
            refundId: null
        });
        expect(result.refundId).toBeTruthy();
    });

    it('(e) leaves the hung attachment unchanged when RF4 exceeds the refundable balance', async () => {
        const credited = await creditedPayment();
        const mark = await hang(credited.fixture.started.subscriptionId, {
            source: 'PAYMENT',
            id: credited.payment.id
        });
        const before = await rows(mark.id);
        const refundsBefore = await refundsOfPayment(credited.payment.id);
        await expect(
            settleOnPayment(await seedAdminActor(), credited, { amount: 10001 })
        ).rejects.toMatchObject({ reason: 'REFUND_EXCEEDS_BALANCE' });
        expect(await rows(mark.id)).toEqual(before);
        expect(await refundsOfPayment(credited.payment.id)).toEqual(refundsBefore);
    });

    it('(f) lifts the mark after RF4 resolved its only hung payment', async () => {
        const credited = await creditedPayment();
        const mark = await hang(credited.fixture.started.subscriptionId, {
            source: 'PAYMENT',
            id: credited.payment.id
        });
        await settleOnPayment(await seedAdminActor(), credited);
        await expect(
            liftReconciliationMarkByAdmin(
                {
                    actor: await seedLiftAdmin(),
                    markId: mark.id,
                    expectedVersion: mark.version,
                    resolveWithoutRefund: []
                },
                { clock: credited.fixture.clock }
            )
        ).resolves.toMatchObject({ markId: mark.id, version: mark.version + 1 });
        expect((await reconciliationMarkModel.findById({ markId: mark.id }))?.liftedAt).toEqual(
            credited.fixture.clock.now()
        );
    });
});
