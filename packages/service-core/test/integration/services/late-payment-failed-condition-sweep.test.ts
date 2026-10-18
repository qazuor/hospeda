import {
    and,
    coveredPeriods,
    domainEvent,
    eq,
    isNull,
    payments,
    reconciliationMarks,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { createPeriodChargesComparison } from '../../../src/services/billing/reconciliation/sweep/comparisons/period-charges-comparison.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    reconciliationClock,
    resetSeededReconciliationInventory,
    seedSubscription,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';
import {
    createChargingFake,
    handleCharge,
    unknownCharge
} from './reconciliation-tombstone-fixtures.js';

afterAll(closeServiceTestPool);
beforeAll(() => getServiceTestDb());
const owned: Array<{ subscriptionId: string; userId: string }> = [];

afterEach(async () => {
    const db = getServiceTestDb();
    for (const row of owned.splice(0)) {
        await db
            .update(reconciliationMarks)
            .set({ liftedAt: new Date(), liftedBy: row.userId })
            .where(
                and(
                    eq(reconciliationMarks.subscriptionId, row.subscriptionId),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        await db
            .update(payments)
            .set({ status: 'FAILED' })
            .where(eq(payments.subscriptionId, row.subscriptionId));
        await db
            .delete(coveredPeriods)
            .where(eq(coveredPeriods.subscriptionId, row.subscriptionId));
        await db
            .update(subscriptions)
            .set({ status: 'ABANDONED' })
            .where(eq(subscriptions.id, row.subscriptionId));
    }
});

async function assertCondition(input: {
    correlationId: string;
    subscriptionId: string;
    condition: number | null;
}) {
    const events = await getServiceTestDb()
        .select()
        .from(domainEvent)
        .where(eq(domainEvent.entityId, input.subscriptionId));
    const event = events.find(
        (candidate) =>
            candidate.eventType === 'reconciliation.mark_opened' &&
            candidate.entityId === input.subscriptionId &&
            candidate.changes.some(
                (change) =>
                    change.field === 'reconciliation_mark.reason' &&
                    change.new === 'PAGO_TARDIO_RECHAZADO'
            )
    );
    expect(event?.changes).toEqual(
        expect.arrayContaining([
            { field: 'reconciliation_mark.id', new: expect.any(String) },
            { field: 'reconciliation_mark.reason', new: 'PAGO_TARDIO_RECHAZADO' },
            { field: 'reconciliation_mark.outcome', new: expect.any(String) },
            { field: 'late_payment.failed_condition', new: input.condition }
        ])
    );
}

describe('TEST:1620:4 sweep writers record the failed late-payment condition', () => {
    it.skipIf(!isServiceTestDbAvailable())('receipt tombstone records condition 1', async () => {
        const { fake, provider } = createChargingFake();
        const charge = await unknownCharge(fake);
        const { result, correlationId } = await handleCharge(charge, { provider });
        await assertCondition({
            correlationId,
            subscriptionId: result.subscriptionId,
            condition: 1
        });
    });

    it.skipIf(!isServiceTestDbAvailable())('H5 on a PAUSED row records condition 1', async () => {
        await resetSeededReconciliationInventory();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock: reconciliationClock,
            honestAbout: [
                { lie: 'M8', why: 'the paused-row test needs an approved charge immediately' }
            ]
        });
        const seeded = await seedSubscription({ status: 'PAUSED', withLink: true, fake });
        owned.push({ subscriptionId: seeded.subscription.id, userId: seeded.subscription.userId! });
        await getServiceTestDb()
            .insert(subscriptionPauses)
            .values({
                subscriptionId: seeded.subscription.id,
                reason: 'CUSTOMER_REQUEST',
                startsAt: new Date('2026-10-10T00:00:00.000Z')
            });
        await fake.charge({
            authorizationId: seeded.providerId!,
            amount: { amountMinor: 250000, currency: 'ARS' },
            reference: seeded.subscription.id
        });
        const correlationId = crypto.randomUUID();
        await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { correlationId },
                {
                    provider: fake,
                    clock: reconciliationClock,
                    markPayments: createPaymentReconciliationMarkPayments(reconciliationClock),
                    comparisons: [createPeriodChargesComparison({ provider: fake })]
                }
            )
        );
        await assertCondition({
            correlationId,
            subscriptionId: seeded.subscription.id,
            condition: 1
        });
    });

    it.skipIf(!isServiceTestDbAvailable())(
        'H5 on GRACE_PERIOD records condition 4 from the verdict',
        async () => {
            await resetSeededReconciliationInventory();
            const fake = new FakePaymentProvider({
                idNamespace: crypto.randomUUID(),
                clock: reconciliationClock,
                honestAbout: [
                    { lie: 'M8', why: 'the grace-row test needs an approved charge immediately' }
                ]
            });
            const seeded = await seedSubscription({ status: 'GRACE_PERIOD', withLink: true, fake });
            owned.push({
                subscriptionId: seeded.subscription.id,
                userId: seeded.subscription.userId!
            });
            await getServiceTestDb()
                .update(subscriptions)
                .set({
                    graceStartedAt: new Date('2026-10-01T00:00:00.000Z'),
                    graceEndsAt: new Date('2026-10-20T00:00:00.000Z')
                })
                .where(eq(subscriptions.id, seeded.subscription.id));
            const [priorPayment] = await getServiceTestDb()
                .insert(payments)
                .values({
                    subscriptionId: seeded.subscription.id,
                    amount: 250000,
                    currency: 'ARS',
                    status: 'SUCCEEDED',
                    provider: 'MERCADO_PAGO',
                    providerFactId: `prior-${crypto.randomUUID()}`,
                    factAt: new Date('2026-10-05T00:00:00.000Z')
                })
                .returning();
            if (!priorPayment) throw new Error('Expected the prior credited payment');
            await getServiceTestDb()
                .insert(coveredPeriods)
                .values({
                    subscriptionId: seeded.subscription.id,
                    periodStart: new Date('2026-10-05T00:00:00.000Z'),
                    paymentId: priorPayment.id,
                    creditedAt: new Date('2026-10-05T00:00:00.000Z')
                });
            await fake.charge({
                authorizationId: seeded.providerId!,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: seeded.subscription.id
            });
            const correlationId = crypto.randomUUID();
            await withSeededReconciliationInventory(() =>
                runReconciliationSweep(
                    { correlationId },
                    {
                        provider: fake,
                        clock: reconciliationClock,
                        markPayments: createPaymentReconciliationMarkPayments(reconciliationClock),
                        comparisons: [createPeriodChargesComparison({ provider: fake })]
                    }
                )
            );
            await assertCondition({
                correlationId,
                subscriptionId: seeded.subscription.id,
                condition: 4
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'H5 keeps non-reason-7 event changes exactly as before',
        async () => {
            await resetSeededReconciliationInventory();
            const fake = new FakePaymentProvider({
                idNamespace: crypto.randomUUID(),
                clock: reconciliationClock,
                honestAbout: [
                    { lie: 'M8', why: 'the comparison test needs an approved charge immediately' }
                ]
            });
            const seeded = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
            owned.push({
                subscriptionId: seeded.subscription.id,
                userId: seeded.subscription.userId!
            });
            const charge = await fake.charge({
                authorizationId: seeded.providerId!,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: seeded.subscription.id
            });
            const correlationId = crypto.randomUUID();
            await withSeededReconciliationInventory(() =>
                runReconciliationSweep(
                    { correlationId },
                    {
                        provider: fake,
                        clock: reconciliationClock,
                        markPayments: createPaymentReconciliationMarkPayments(reconciliationClock),
                        comparisons: [createPeriodChargesComparison({ provider: fake })]
                    }
                )
            );
            const events = await getServiceTestDb()
                .select()
                .from(domainEvent)
                .where(eq(domainEvent.entityId, seeded.subscription.id));
            const event = events.find(
                (candidate) =>
                    candidate.eventType === 'reconciliation.mark_opened' &&
                    candidate.changes.some(
                        (change) =>
                            change.field === 'reconciliation_mark.reason' &&
                            change.new === 'COBRO_SIN_REGISTRAR'
                    )
            );
            expect(event?.changes).toEqual([
                { field: 'reconciliation_mark.id', new: expect.any(String) },
                { field: 'reconciliation_mark.reason', new: 'COBRO_SIN_REGISTRAR' },
                { field: 'reconciliation_mark.outcome', new: 'OPENED' },
                { field: 'provider.charge_id', new: charge.chargeId },
                { field: 'provider.charge_amount_minor', new: 250000 }
            ]);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'unknown linked charge uses null because it does not evaluate the four conditions',
        async () => {
            const { fake, provider } = createChargingFake();
            const ownedSubscription = await seedSubscription({
                status: 'ACTIVE',
                withLink: true,
                fake
            });
            owned.push({
                subscriptionId: ownedSubscription.subscription.id,
                userId: ownedSubscription.subscription.userId!
            });
            const charge = await unknownCharge(fake, {
                reference: ownedSubscription.subscription.id
            });
            const { result, correlationId } = await handleCharge(charge, { provider });
            await assertCondition({
                correlationId,
                subscriptionId: ownedSubscription.subscription.id,
                condition: null
            });
            expect(result).toMatchObject({ reason: 'PAGO_TARDIO_RECHAZADO' });
        }
    );
});
