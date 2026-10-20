import {
    coveredPeriods,
    eq,
    payments,
    providerLinks,
    reconciliationMarkModel,
    reconciliationMarkPayments,
    reconciliationMarks,
    refunds,
    subscriptions,
    users
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { createPeriodChargesComparison } from '../../../src/services/billing/reconciliation/sweep/comparisons/period-charges-comparison.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import { settleExternalRefund } from '../../../src/services/billing/refund/settle-external-refund.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    reconciliationClock,
    resetSeededReconciliationInventory,
    seedSubscription,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';
import { resolveHungPayments } from './support/mark-payment-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import { setExpectedPlanAmount } from './support/period-comparison-fixtures.js';
import { seedAdminActor } from './support/refund-fixtures.js';

afterAll(closeServiceTestPool);
const owned: Array<{ readonly subscriptionId: string; readonly userId: string }> = [];
const adminIds: string[] = [];
const OLD_FACT_AT = new Date('2000-01-01T00:00:00.000Z');

async function setup() {
    const provider = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock: reconciliationClock,
        honestAbout: [{ lie: 'M8', why: 'approved charges must be visible to the sweep' }]
    });
    const seeded = await seedSubscription({ status: 'ACTIVE', withLink: true, fake: provider });
    owned.push({ subscriptionId: seeded.subscription.id, userId: seeded.subscription.userId! });
    await setExpectedPlanAmount({ subscriptionId: seeded.subscription.id, amountMinor: 1_500_000 });
    const charge = await provider.charge({
        authorizationId: seeded.providerId!,
        amount: { amountMinor: 3_000_000, currency: 'ARS' },
        reference: seeded.subscription.id
    });
    await recordChargeFact(
        { chargeId: charge.chargeId },
        {
            provider,
            clock: reconciliationClock,
            beforeCancelNotice: outboxBeforeCancelNotice(),
            markPayments: createPaymentReconciliationMarkPayments(reconciliationClock)
        }
    );
    const [payment] = await getServiceTestDb()
        .select()
        .from(payments)
        .where(eq(payments.providerFactId, charge.chargeId));
    if (!payment) throw new Error('recordChargeFact did not persist a credited payment');
    return { provider, seeded, chargeId: charge.chargeId, payment };
}

async function sweep(input: Awaited<ReturnType<typeof setup>>) {
    return withSeededReconciliationInventory(() =>
        runReconciliationSweep(
            { correlationId: crypto.randomUUID() },
            {
                provider: input.provider as unknown as PaymentProvider,
                clock: reconciliationClock,
                markPayments: createPaymentReconciliationMarkPayments(reconciliationClock),
                comparisons: [
                    createPeriodChargesComparison({
                        provider: input.provider as unknown as PaymentProvider
                    })
                ]
            }
        )
    );
}

async function liftMark(input: {
    readonly mark: NonNullable<Awaited<ReturnType<typeof reconciliationMarkModel.findById>>>;
    readonly userId: string;
}) {
    await resolveHungPayments({ markId: input.mark.id });
    await reconciliationMarkModel.lift({
        markId: input.mark.id,
        expectedVersion: input.mark.version,
        liftedBy: input.userId,
        now: reconciliationClock.now()
    });
}

afterEach(async () => {
    const db = getServiceTestDb();
    for (const row of owned.splice(0)) {
        const marks = await db
            .select()
            .from(reconciliationMarks)
            .where(eq(reconciliationMarks.subscriptionId, row.subscriptionId));
        for (const mark of marks) {
            await db
                .update(reconciliationMarkPayments)
                .set({ resolvedAt: new Date() })
                .where(eq(reconciliationMarkPayments.markId, mark.id));
            if (mark.liftedAt === null)
                await reconciliationMarkModel.lift({
                    markId: mark.id,
                    expectedVersion: mark.version,
                    liftedBy: row.userId,
                    now: new Date()
                });
        }
        for (const mark of marks) {
            await db
                .delete(reconciliationMarkPayments)
                .where(eq(reconciliationMarkPayments.markId, mark.id));
            await db.delete(reconciliationMarks).where(eq(reconciliationMarks.id, mark.id));
        }
        const paymentsForRow = await db
            .select({ id: payments.id })
            .from(payments)
            .where(eq(payments.subscriptionId, row.subscriptionId));
        for (const payment of paymentsForRow)
            await db.delete(refunds).where(eq(refunds.paymentId, payment.id));
        await db
            .update(payments)
            .set({ status: 'FAILED', factAt: OLD_FACT_AT })
            .where(eq(payments.subscriptionId, row.subscriptionId));
        await db
            .delete(coveredPeriods)
            .where(eq(coveredPeriods.subscriptionId, row.subscriptionId));
        await db.delete(providerLinks).where(eq(providerLinks.subscriptionId, row.subscriptionId));
        await db
            .update(subscriptions)
            .set({ status: 'ABANDONED' })
            .where(eq(subscriptions.id, row.subscriptionId));
    }
    for (const id of adminIds.splice(0)) await db.delete(users).where(eq(users.id, id));
    await resetSeededReconciliationInventory();
});

describe('TEST:B11:10 resolved overcharge claims prevent a second reason 24', () => {
    it('TEST:B11:10 (b2) leaves a payment on its open mark without another event or failure', async () => {
        const fixture = await setup();
        expect(await sweep(fixture)).toMatchObject({ marksOpened: 1, rowsFailed: 0 });
        expect(await sweep(fixture)).toMatchObject({
            marksOpened: 0,
            marksAccumulated: 0,
            rowsFailed: 0
        });
        const [mark] = await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: fixture.seeded.subscription.id }
        });
        if (!mark) throw new Error('Expected an open overcharge mark');
        const rows = await getServiceTestDb()
            .select({ paymentId: reconciliationMarkPayments.paymentId })
            .from(reconciliationMarkPayments)
            .where(eq(reconciliationMarkPayments.markId, mark.id));
        expect(rows.map((row) => row.paymentId)).toEqual([fixture.payment.id]);
    });

    it('TEST:B11:10 (b) does not reopen a lifted mark, with or without an executed return', async () => {
        const retained = await setup();
        await sweep(retained);
        const [retainedMark] = await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: retained.seeded.subscription.id }
        });
        if (!retainedMark) throw new Error('Expected the first overcharge mark');
        await liftMark({ mark: retainedMark, userId: retained.seeded.subscription.userId! });
        expect(await sweep(retained)).toMatchObject({ divergences: 0, rowsFailed: 0 });
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'ABANDONED' })
            .where(eq(subscriptions.id, retained.seeded.subscription.id));

        const returned = await setup();
        await sweep(returned);
        const [returnedMark] = await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: returned.seeded.subscription.id }
        });
        if (!returnedMark)
            throw new Error('Expected an overcharge mark before settling the return');
        const actor = await seedAdminActor();
        adminIds.push(actor.id);
        await settleExternalRefund(
            {
                actor,
                source: { kind: 'PAYMENT', id: returned.payment.id },
                amount: 1_500_000,
                channel: 'BANK_TRANSFER',
                reference: `overcharge-${crypto.randomUUID()}`,
                reason: 'OUT_OF_FLOW_REFUND'
            },
            { clock: reconciliationClock }
        );
        await liftMark({ mark: returnedMark, userId: returned.seeded.subscription.userId! });
        expect(await sweep(returned)).toMatchObject({ divergences: 0, rowsFailed: 0 });
    });

    it('TEST:B11:10 (c2) counts a REQUESTED refund on a never-marked payment', async () => {
        const fixture = await setup();
        await requestRefund(
            {
                source: { kind: 'PAYMENT', id: fixture.payment.id },
                amount: 1_500_000,
                reason: 'REVOCATION'
            },
            { clock: reconciliationClock }
        );
        expect(await sweep(fixture)).toMatchObject({ divergences: 0, rowsFailed: 0 });
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: fixture.seeded.subscription.id }
            })
        ).toEqual([]);
    });

    it('TEST:B11:10 (c) counts an EXECUTED refund on a never-marked payment', async () => {
        const fixture = await setup();
        const actor = await seedAdminActor();
        adminIds.push(actor.id);
        await settleExternalRefund(
            {
                actor,
                source: { kind: 'PAYMENT', id: fixture.payment.id },
                amount: 1_500_000,
                channel: 'BANK_TRANSFER',
                reference: `overcharge-${crypto.randomUUID()}`,
                reason: 'OUT_OF_FLOW_REFUND'
            },
            { clock: reconciliationClock }
        );
        expect(await sweep(fixture)).toMatchObject({ divergences: 0, rowsFailed: 0 });
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: fixture.seeded.subscription.id }
            })
        ).toEqual([]);
    });
});
