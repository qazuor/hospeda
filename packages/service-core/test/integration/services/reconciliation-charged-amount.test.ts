import {
    coveredPeriods,
    domainEventModel,
    eq,
    payments,
    promoCodes,
    promoRedemptions,
    providerLinks,
    reconciliationMarkModel,
    reconciliationMarkPayments,
    reconciliationMarks,
    refunds,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service.js';
import { createPeriodChargesComparison } from '../../../src/services/billing/reconciliation/sweep/comparisons/period-charges-comparison.js';
import type { ReconciliationDailySummary } from '../../../src/services/billing/reconciliation/sweep/comparisons/reconciliation-daily-summary.port.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    reconciliationClock,
    resetSeededReconciliationInventory,
    seedSubscription,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import { setExpectedPlanAmount } from './support/period-comparison-fixtures.js';

afterAll(closeServiceTestPool);
const owned: Array<{ readonly subscriptionId: string; readonly userId: string }> = [];
const OLD_FACT_AT = new Date('2000-01-01T00:00:00.000Z');

async function setup(input: { readonly expectedMinor?: number; readonly chargedMinor: number }) {
    const provider = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock: reconciliationClock,
        honestAbout: [{ lie: 'M8', why: 'approved charges must be visible to the sweep' }]
    });
    const seeded = await seedSubscription({ status: 'ACTIVE', withLink: true, fake: provider });
    owned.push({ subscriptionId: seeded.subscription.id, userId: seeded.subscription.userId! });
    if (input.expectedMinor !== undefined)
        await setExpectedPlanAmount({
            subscriptionId: seeded.subscription.id,
            amountMinor: input.expectedMinor
        });
    const charged = await provider.charge({
        authorizationId: seeded.providerId!,
        amount: { amountMinor: input.chargedMinor, currency: 'ARS' },
        reference: seeded.subscription.id
    });
    await recordChargeFact(
        { chargeId: charged.chargeId },
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
        .where(eq(payments.providerFactId, charged.chargeId));
    if (!payment) throw new Error('recordChargeFact did not persist a credited payment');
    return { provider, seeded, chargeId: charged.chargeId, payment };
}

async function sweep(input: {
    readonly provider: FakePaymentProvider;
    readonly dailySummary?: ReconciliationDailySummary;
    readonly correlationId?: string;
}) {
    const summary = input.dailySummary ?? { addUndercharge: vi.fn(async () => undefined) };
    const result = await withSeededReconciliationInventory(() =>
        runReconciliationSweep(input.correlationId ? { correlationId: input.correlationId } : {}, {
            provider: input.provider as unknown as PaymentProvider,
            clock: reconciliationClock,
            markPayments: createPaymentReconciliationMarkPayments(reconciliationClock),
            comparisons: [
                createPeriodChargesComparison({
                    provider: input.provider as unknown as PaymentProvider,
                    dailySummary: summary
                })
            ]
        })
    );
    return { result, summary };
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
        const paymentRows = await db
            .select({ id: payments.id })
            .from(payments)
            .where(eq(payments.subscriptionId, row.subscriptionId));
        for (const payment of paymentRows)
            await db.delete(refunds).where(eq(refunds.paymentId, payment.id));
        const redemptions = await db
            .select({ promoCodeId: promoRedemptions.promoCodeId })
            .from(promoRedemptions)
            .where(eq(promoRedemptions.subscriptionId, row.subscriptionId));
        await db
            .delete(promoRedemptions)
            .where(eq(promoRedemptions.subscriptionId, row.subscriptionId));
        for (const redemption of redemptions)
            await db.delete(promoCodes).where(eq(promoCodes.id, redemption.promoCodeId));
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
    await resetSeededReconciliationInventory();
});

describe('TEST:B11:10 AC:B11:11 the charged amount: over opens 24 with the difference, under goes to the daily summary', () => {
    it('TEST:B11:10 (a) opens 24 for the difference even when preapproval is still at 15,000', async () => {
        const fixture = await setup({ expectedMinor: 1_500_000, chargedMinor: 3_000_000 });
        await fixture.provider.changeAmount({
            authorizationId: fixture.seeded.providerId!,
            amount: { amountMinor: 1_500_000, currency: 'ARS' }
        });
        const beforeSubscription = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, fixture.seeded.subscription.id));
        const beforeCoverage = await getServiceTestDb()
            .select()
            .from(coveredPeriods)
            .where(eq(coveredPeriods.subscriptionId, fixture.seeded.subscription.id));
        const correlationId = crypto.randomUUID();
        const { result } = await sweep({ ...fixture, correlationId });
        expect(result).toMatchObject({ marksOpened: 1, rowsFailed: 0 });
        const marks = await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: fixture.seeded.subscription.id }
        });
        expect(marks).toMatchObject([{ reason: 'IMPORTE_COBRADO_DE_MAS' }]);
        const [mark] = marks;
        if (!mark) throw new Error('Expected an overcharge mark');
        const hung = await dbHungPayments(mark.id);
        expect(hung).toEqual([fixture.payment.id]);
        const events = (await domainEventModel.findByCorrelationId({ correlationId })).filter(
            (event) => event.eventType === 'reconciliation.mark_opened'
        );
        expect(events.flatMap((event) => event.changes)).toEqual(
            expect.arrayContaining([
                { field: 'provider.charge_id', new: fixture.chargeId },
                { field: 'provider.charge_amount_minor', new: 3_000_000 },
                { field: 'reconciliation_mark.expected_minor', new: 1_500_000 },
                { field: 'reconciliation_mark.proposed_refund_minor', new: 1_500_000 }
            ])
        );
        expect(
            (
                await getServiceTestDb()
                    .select()
                    .from(payments)
                    .where(eq(payments.id, fixture.payment.id))
            )[0]
        ).toMatchObject({ status: 'SUCCEEDED' });
        expect(
            await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.seeded.subscription.id))
        ).toEqual(beforeSubscription);
        expect(
            await getServiceTestDb()
                .select()
                .from(coveredPeriods)
                .where(eq(coveredPeriods.subscriptionId, fixture.seeded.subscription.id))
        ).toEqual(beforeCoverage);
    });

    it('TEST:B11:10 (a2) compares the charge with the period expected amount, not a changed preapproval', async () => {
        const fixture = await setup({ expectedMinor: 1_500_000, chargedMinor: 3_000_000 });
        await fixture.provider.changeAmount({
            authorizationId: fixture.seeded.providerId!,
            amount: { amountMinor: 3_000_000, currency: 'ARS' }
        });
        const { result } = await sweep(fixture);
        expect(result).toMatchObject({ marksOpened: 1, rowsFailed: 0 });
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: fixture.seeded.subscription.id }
            })
        ).toMatchObject([{ reason: 'IMPORTE_COBRADO_DE_MAS' }]);
    });

    it('TEST:B11:10 (d) does not mark a credited payment already hung on another open reason', async () => {
        const fixture = await setup({ expectedMinor: 1_500_000, chargedMinor: 3_000_000 });
        await openReconciliationMark(
            {
                subject: { kind: 'SUBSCRIPTION', subscriptionId: fixture.seeded.subscription.id },
                reason: 'REEMBOLSO_FUERA_DEL_FLUJO',
                payment: { source: 'PAYMENT', id: fixture.payment.id },
                actor: { type: 'job' },
                correlationId: crypto.randomUUID()
            },
            { markPayments: createPaymentReconciliationMarkPayments(reconciliationClock) }
        );
        const { result } = await sweep({ ...fixture, correlationId: crypto.randomUUID() });
        expect(result).toMatchObject({ divergences: 0, rowsFailed: 0 });
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: fixture.seeded.subscription.id }
            })
        ).toMatchObject([{ reason: 'REEMBOLSO_FUERA_DEL_FLUJO' }]);
    });

    it('TEST:B11:10 (e) equal amount opens no mark and does not call the summary', async () => {
        const fixture = await setup({ expectedMinor: 1_500_000, chargedMinor: 1_500_000 });
        const dailySummary = { addUndercharge: vi.fn(async () => undefined) };
        const { result } = await sweep({ ...fixture, dailySummary });
        expect(result).toMatchObject({ divergences: 0, rowsFailed: 0 });
        expect(dailySummary.addUndercharge).not.toHaveBeenCalled();
    });

    it('TEST:B11:10 (f) undercharge goes to summary with subject and negative difference only', async () => {
        const fixture = await setup({ expectedMinor: 1_200_000, chargedMinor: 1_000_000 });
        const dailySummary = { addUndercharge: vi.fn(async () => undefined) };
        const { result } = await sweep({ ...fixture, dailySummary });
        expect(result).toMatchObject({ divergences: 0, marksOpened: 0, rowsFailed: 0 });
        expect(dailySummary.addUndercharge).toHaveBeenCalledOnce();
        expect(dailySummary.addUndercharge).toHaveBeenCalledWith({
            subscriptionId: fixture.seeded.subscription.id,
            paymentId: fixture.payment.id,
            chargeId: fixture.chargeId,
            expectedMinor: 1_200_000,
            chargedMinor: 1_000_000,
            differenceMinor: -200_000,
            currency: 'ARS'
        });
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: fixture.seeded.subscription.id }
            })
        ).toEqual([]);
    });

    it('TEST:B11:10 (g) ignores a charge whose full amount was returned at the provider', async () => {
        const fixture = await setup({ expectedMinor: 1_500_000, chargedMinor: 3_000_000 });
        await fixture.provider.refund({
            chargeId: fixture.chargeId,
            amount: { amountMinor: 3_000_000, currency: 'ARS' },
            reference: `full-return-${crypto.randomUUID()}`
        });
        const dailySummary = { addUndercharge: vi.fn(async () => undefined) };
        const { result } = await sweep({
            ...fixture,
            dailySummary,
            correlationId: crypto.randomUUID()
        });
        expect(result).toMatchObject({ divergences: 0, marksOpened: 0, rowsFailed: 0 });
        expect(dailySummary.addUndercharge).not.toHaveBeenCalled();
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: fixture.seeded.subscription.id }
            })
        ).toEqual([]);
    });

    it('TEST:B11:10 (h) fails the row visibly when the promo expected-amount policy is absent', async () => {
        const fixture = await setup({ expectedMinor: 1_500_000, chargedMinor: 3_000_000 });
        const [code] = await getServiceTestDb()
            .insert(promoCodes)
            .values({
                code: `CHARGED-${crypto.randomUUID()}`,
                discountKind: 'FIXED',
                value: 5000,
                allVerticals: true,
                verticals: null,
                totalQuota: 2,
                validFrom: new Date('2026-01-01T00:00:00.000Z'),
                validUntil: new Date('2027-01-01T00:00:00.000Z'),
                stackable: false,
                usableWithAnotherActive: false,
                durationKind: 'N_CHARGES',
                durationCharges: 2
            })
            .returning();
        if (!code) throw new Error('Promo code fixture failed');
        await getServiceTestDb().insert(promoRedemptions).values({
            promoCodeId: code.id,
            userId: fixture.seeded.subscription.userId!,
            redeemedAt: reconciliationClock.now(),
            subscriptionId: fixture.seeded.subscription.id,
            remainingCharges: 2
        });
        const { result } = await sweep({ ...fixture, correlationId: crypto.randomUUID() });
        expect(result).toMatchObject({ rowsFailed: 1, marksOpened: 0 });
        expect(result.failures[0]?.message).toContain(
            'Expected amount needs the promo composition'
        );
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: fixture.seeded.subscription.id }
            })
        ).toEqual([]);
    });
});

async function dbHungPayments(markId: string) {
    const rows = await getServiceTestDb()
        .select({ paymentId: reconciliationMarkPayments.paymentId })
        .from(reconciliationMarkPayments)
        .where(eq(reconciliationMarkPayments.markId, markId));
    return rows.map((row) => row.paymentId);
}
