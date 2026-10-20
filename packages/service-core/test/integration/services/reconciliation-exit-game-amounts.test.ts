import type { SelectReconciliationSummaryWindow } from '@repo/db';
import {
    coveredPeriods,
    domainEventModel,
    eq,
    payments,
    reconciliationMarkModel,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { buildReconciliationSummaryPayload } from '../../../src/services/billing/reconciliation/summary/build-summary-payload.js';
import { createPersistedReconciliationDailySummary } from '../../../src/services/billing/reconciliation/sweep/comparisons/persisted-daily-summary.js';
import { settleExternalRefund } from '../../../src/services/billing/refund/settle-external-refund.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    exitGameClock,
    exitGameFake,
    retireExitGameRows,
    runExitGameSweep,
    seedChargedExitGameRow
} from './reconciliation-exit-game-fixtures.js';
import { hungRows, resolveHungPayments } from './support/mark-payment-fixtures.js';
import {
    instanceStatus,
    paidOrderClock,
    paidOrderMarks,
    retirePaidOrderFixtures,
    seedOrderInstance,
    sweepPaidOrders
} from './support/paid-order-fixtures.js';
import { seedAdminActor } from './support/refund-fixtures.js';

const adminIds: string[] = [];

afterEach(async () => {
    vi.restoreAllMocks();
    await retireExitGameRows();
    await retirePaidOrderFixtures();
    for (const id of adminIds.splice(0))
        await getServiceTestDb().delete(users).where(eq(users.id, id));
});
afterAll(closeServiceTestPool);

async function reason24Marks(subscriptionId: string) {
    return getServiceTestDb()
        .select()
        .from(reconciliationMarks)
        .where(eq(reconciliationMarks.subscriptionId, subscriptionId))
        .then((rows) => rows.filter((row) => row.reason === 'IMPORTE_COBRADO_DE_MAS'));
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
        now: new Date('2026-11-01T10:00:00.000Z')
    });
}

function spiedOrderFake() {
    const fake = new FakePaymentProvider({
        clock: paidOrderClock,
        idNamespace: crypto.randomUUID()
    });
    return {
        fake,
        calls: {
            readOrder: vi.spyOn(fake, 'readOrder'),
            authorize: vi.spyOn(fake, 'authorize'),
            charge: vi.spyOn(fake, 'charge'),
            refund: vi.spyOn(fake, 'refund'),
            cancel: vi.spyOn(fake, 'cancel'),
            changeAmount: vi.spyOn(fake, 'changeAmount')
        }
    };
}

describe('TEST:B11:20 el juego de salida contra el falso — importes y órdenes', () => {
    it('LISTA:B11 cláusula 12: abre el motivo 24 por la diferencia aunque cambie el preapproval, y no marca un importe igual', async () => {
        const { clock } = exitGameClock();
        const provider = exitGameFake({
            clock,
            honestAbout: [{ lie: 'M8', why: 'approved charges must be visible to reconciliation' }]
        });
        const over = await seedChargedExitGameRow({
            provider,
            clock,
            expectedMinor: 1_500_000,
            chargedMinor: 3_000_000
        });
        const equal = await seedChargedExitGameRow({
            provider,
            clock,
            expectedMinor: 1_500_000,
            chargedMinor: 1_500_000
        });
        await provider.changeAmount({
            authorizationId: equal.providerId,
            amount: { amountMinor: 1_500_000, currency: 'ARS' }
        });
        await provider.changeAmount({
            authorizationId: over.providerId,
            amount: { amountMinor: 1_500_000, currency: 'ARS' }
        });
        const beforeSubscription = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, over.subscription.id));
        const beforeCoverage = await getServiceTestDb()
            .select()
            .from(coveredPeriods)
            .where(eq(coveredPeriods.subscriptionId, over.subscription.id));
        const correlationId = crypto.randomUUID();
        const summary = createPersistedReconciliationDailySummary({ correlationId, clock });

        const result = await runExitGameSweep({
            provider,
            clock,
            correlationId,
            dailySummary: summary
        });

        expect(result).toMatchObject({ marksOpened: 1, rowsFailed: 0 });
        const overMarks = await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: over.subscription.id }
        });
        expect(overMarks).toMatchObject([{ reason: 'IMPORTE_COBRADO_DE_MAS' }]);
        const mark = overMarks[0];
        if (!mark) throw new Error('Expected an open overcharge mark');
        const hung = await getServiceTestDb()
            .select({ paymentId: reconciliationMarkPayments.paymentId })
            .from(reconciliationMarkPayments)
            .where(eq(reconciliationMarkPayments.markId, mark.id));
        expect(hung.map((row) => row.paymentId)).toEqual([over.payment.id]);
        const opened = (await domainEventModel.findByCorrelationId({ correlationId })).filter(
            (event) => event.eventType === 'reconciliation.mark_opened'
        );
        expect(opened.flatMap((event) => event.changes)).toContainEqual({
            field: 'reconciliation_mark.proposed_refund_minor',
            new: 1_500_000
        });
        expect(
            await getServiceTestDb().select().from(payments).where(eq(payments.id, over.payment.id))
        ).toMatchObject([{ status: 'SUCCEEDED' }]);
        expect(
            await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, over.subscription.id))
        ).toEqual(beforeSubscription);
        expect(
            await getServiceTestDb()
                .select()
                .from(coveredPeriods)
                .where(eq(coveredPeriods.subscriptionId, over.subscription.id))
        ).toEqual(beforeCoverage);
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: equal.subscription.id }
            })
        ).toEqual([]);
    });

    it('LISTA:B11 cláusula 13: no repite el 24 después de levantarlo sin devolver o devolver la diferencia', async () => {
        const { clock } = exitGameClock();
        const provider = exitGameFake({
            clock,
            honestAbout: [{ lie: 'M8', why: 'approved charges must be visible to reconciliation' }]
        });
        const lifted = await seedChargedExitGameRow({
            provider,
            clock,
            expectedMinor: 1_500_000,
            chargedMinor: 3_000_000
        });
        const refunded = await seedChargedExitGameRow({
            provider,
            clock,
            expectedMinor: 1_500_000,
            chargedMinor: 3_000_000
        });
        for (const row of [lifted, refunded])
            await provider.changeAmount({
                authorizationId: row.providerId,
                amount: { amountMinor: 1_500_000, currency: 'ARS' }
            });
        const firstCorrelationId = crypto.randomUUID();
        const first = await runExitGameSweep({
            provider,
            clock,
            correlationId: firstCorrelationId,
            dailySummary: createPersistedReconciliationDailySummary({
                correlationId: firstCorrelationId,
                clock
            })
        });
        expect(first).toMatchObject({ marksOpened: 2, rowsFailed: 0 });
        const liftedMark = (await reason24Marks(lifted.subscription.id))[0];
        const refundedMark = (await reason24Marks(refunded.subscription.id))[0];
        if (!liftedMark || !refundedMark)
            throw new Error('Expected reason-24 marks for both payments');
        expect(await hungRows({ markId: liftedMark.id })).toMatchObject([
            { payment_id: lifted.payment.id, resolved_at: null }
        ]);
        await liftMark({ mark: liftedMark, userId: lifted.subscription.userId! });

        const actor = await seedAdminActor();
        adminIds.push(actor.id);
        await settleExternalRefund(
            {
                actor,
                source: { kind: 'PAYMENT', id: refunded.payment.id },
                amount: 1_500_000,
                channel: 'BANK_TRANSFER',
                reference: `exit-game-refund-${crypto.randomUUID()}`,
                reason: 'OUT_OF_FLOW_REFUND'
            },
            { clock }
        );
        await liftMark({ mark: refundedMark, userId: refunded.subscription.userId! });
        const countsBefore = [
            (await reason24Marks(lifted.subscription.id)).length,
            (await reason24Marks(refunded.subscription.id)).length
        ];

        const secondCorrelationId = crypto.randomUUID();
        const second = await runExitGameSweep({
            provider,
            clock,
            correlationId: secondCorrelationId,
            dailySummary: createPersistedReconciliationDailySummary({
                correlationId: secondCorrelationId,
                clock
            })
        });

        expect(second).toMatchObject({ divergences: 0, rowsFailed: 0 });
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: lifted.subscription.id }
            })
        ).toEqual([]);
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: refunded.subscription.id }
            })
        ).toEqual([]);
        expect([
            (await reason24Marks(lifted.subscription.id)).length,
            (await reason24Marks(refunded.subscription.id)).length
        ]).toEqual(countsBefore);
        expect(countsBefore).toEqual([1, 1]);
    });

    it('LISTA:B11 cláusula 14: el cobro de menos no abre marca y aparece en el resumen con sujeto y diferencia negativa', async () => {
        const { clock } = exitGameClock();
        const provider = exitGameFake({
            clock,
            honestAbout: [{ lie: 'M8', why: 'approved charges must be visible to reconciliation' }]
        });
        const row = await seedChargedExitGameRow({
            provider,
            clock,
            expectedMinor: 1_200_000,
            chargedMinor: 1_000_000
        });
        await provider.changeAmount({
            authorizationId: row.providerId,
            amount: { amountMinor: 1_200_000, currency: 'ARS' }
        });
        const correlationId = crypto.randomUUID();
        const dailySummary = createPersistedReconciliationDailySummary({ correlationId, clock });

        const result = await runExitGameSweep({ provider, clock, correlationId, dailySummary });

        expect(result).toMatchObject({ marksOpened: 0, rowsFailed: 0 });
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: row.subscription.id }
            })
        ).toEqual([]);
        const events = (
            await domainEventModel.findByEntity({
                entityType: 'payment',
                entityId: row.payment.id
            })
        ).filter((event) => event.eventType === 'reconciliation.undercharge_detected');
        expect(events).toHaveLength(1);
        const event = events[0];
        if (!event) throw new Error('Expected undercharge domain event');
        expect(event.changes).toEqual([
            { field: 'subscription.id', new: row.subscription.id },
            { field: 'provider.charge_id', new: row.chargeId },
            { field: 'payment.currency', new: 'ARS' },
            { field: 'payment.expected_minor', new: 1_200_000 },
            { field: 'payment.charged_minor', new: 1_000_000 },
            { field: 'payment.difference_minor', new: -200_000 }
        ]);
        const eventAt = event.occurredAt;
        const window: SelectReconciliationSummaryWindow = {
            id: crypto.randomUUID(),
            coversFrom: new Date(eventAt.getTime() - 1_000),
            openedAt: new Date(eventAt.getTime() - 1_000),
            closesAt: new Date(eventAt.getTime() + 86_400_000),
            windowMinutes: 1_440,
            deadlinesVersion: 1,
            sentAt: null,
            eventCount: null
        };
        const payload = buildReconciliationSummaryPayload({ window, events: [event] });
        expect(payload.underCharges).toEqual([
            {
                subscriptionId: row.subscription.id,
                paymentId: row.payment.id,
                currency: 'ARS',
                expectedMinor: 1_200_000,
                chargedMinor: 1_000_000,
                differenceMinor: -200_000
            }
        ]);
        expect(payload.marks).toEqual([]);
    });

    it('LISTA:B11 cláusula 7: una orden pagada de instancia ABANDONED abre el 23 sin llamar operaciones de proveedor', async () => {
        const { fake, calls } = spiedOrderFake();
        const { orderId } = fake.placeOrder({ reference: 'abandoned-instance-order', paid: true });
        const { instanceId } = await seedOrderInstance({ providerOrderId: orderId });

        const summary = await sweepPaidOrders({ provider: fake });

        const marks = await paidOrderMarks(instanceId);
        expect(marks).toHaveLength(1);
        expect(marks[0]).toMatchObject({
            reason: 'ORDEN_PAGADA_SIN_INSTANCIA',
            addonInstanceId: instanceId,
            subscriptionId: null
        });
        expect(marks[0] ? await hungRows({ markId: marks[0].id }) : []).toEqual([]);
        expect(await instanceStatus(instanceId)).toBe('ABANDONED');
        expect(calls.readOrder).toHaveBeenCalledWith({ orderId });
        for (const method of ['authorize', 'charge', 'refund', 'cancel', 'changeAmount'] as const)
            expect(calls[method], method).not.toHaveBeenCalled();
        expect(summary.paidOrders).toMatchObject({ examined: 1, marked: 1, failures: [] });
    });
});
