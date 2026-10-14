/**
 * TEST:B11:11 (AC:B11:12) and the half "by the check" of TEST:B11:27 (AC:B11:27):
 * the daily sweep re-reads every credited subscription payment inside the
 * PLAZO:18 window by id. A refund the provider shows beyond what our flow claims
 * opens reason 18 without suspending; a chargeback goes to the one internal
 * chargeback interface. The listing is isolated to the payments of this test.
 */

import {
    and as dbAnd,
    domainEvent,
    eq,
    payments,
    reconciliationCreditedPaymentModel,
    reconciliationMarks,
    refunds
} from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
import { NOT_REFUNDABLE_MESSAGE } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import type { ChargebackDetection } from '../../../src/services/billing/reconciliation/chargeback/chargeback-detection.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { requestRefund } from '../../../src/services/billing/refund/request-refund.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    reconciliationDeadlineValues,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';
import {
    approvedCharge,
    type ChargebackFixture,
    chargebackFixture,
    chargebackMarks,
    deliverChargeNotice,
    paymentOfCharge,
    recordCharge,
    retireChargebackFixtures,
    untouchedState
} from './support/chargeback-fixtures.js';
import { hungRows } from './support/mark-payment-fixtures.js';
import { seedAdminActor, settleOnPayment } from './support/refund-fixtures.js';

const DAY_MS = 86_400_000;
const skip = !isServiceTestDbAvailable();
const seededPaymentIds = new Set<string>();

afterEach(async () => {
    seededPaymentIds.clear();
    vi.restoreAllMocks();
    await retireChargebackFixtures();
});
afterAll(closeServiceTestPool);

function deadlines(days: number | null) {
    const { '18': _omit, ...rest } = reconciliationDeadlineValues;
    return {
        current: async () => ({
            values: (days === null
                ? rest
                : {
                      ...reconciliationDeadlineValues,
                      '18': { days }
                  }) as typeof reconciliationDeadlineValues
        })
    };
}

/** Lists only the payments this test seeded (other suites leave credited payments the fake does not know). */
function isolateListing() {
    const original = reconciliationCreditedPaymentModel.listCreditedPaymentsInWindowPage.bind(
        reconciliationCreditedPaymentModel
    );
    return vi
        .spyOn(reconciliationCreditedPaymentModel, 'listCreditedPaymentsInWindowPage')
        .mockImplementation(async (input) => {
            const rows: Awaited<ReturnType<typeof original>> = [];
            let after: string | undefined;
            for (;;) {
                const page = await original({ ...input, afterPaymentId: after, limit: 1_000 });
                rows.push(...page.filter((row) => seededPaymentIds.has(row.id)));
                if (page.length < 1_000) break;
                after = page.at(-1)?.id;
            }
            const owned = rows.filter(
                (row) => input.afterPaymentId === undefined || row.id > input.afterPaymentId
            );
            return owned.slice(0, input.limit);
        });
}

/** A 10 000 charge of the fake, credited through `recordChargeFact`. */
async function creditedCharge(fixture?: ChargebackFixture) {
    const owner = fixture ?? (await chargebackFixture());
    const chargeId = await approvedCharge(owner);
    expect((await recordCharge(owner, chargeId)).outcome).toBe('CREDITED');
    const payment = await paymentOfCharge(chargeId);
    seededPaymentIds.add(payment.id);
    return { fixture: owner, chargeId, payment };
}

/**
 * Refunds on the fake's side, outside our flow. The fake tells M13 like the real
 * provider (the first partial refund is refused once), so a refused partial is
 * asked again, as a person in the panel would.
 */
async function providerRefund(fixture: ChargebackFixture, chargeId: string, amountMinor: number) {
    const request = () =>
        fixture.provider.refund({
            chargeId,
            amount: { amountMinor, currency: 'ARS' },
            reference: `panel-${crypto.randomUUID()}`
        });
    try {
        await request();
    } catch (error) {
        if (!(error instanceof PaymentProviderError) || error.message !== NOT_REFUNDABLE_MESSAGE)
            throw error;
        await request();
    }
}

async function sweep(
    fixture: ChargebackFixture,
    extra: {
        readonly days?: number | null;
        readonly chargebacks?: ChargebackDetection;
        readonly livenessPing?: { ping: () => Promise<void> };
    } = {}
) {
    const listing = isolateListing();
    try {
        return await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { correlationId: crypto.randomUUID() },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    markPayments: createPaymentReconciliationMarkPayments(fixture.clock),
                    creditedPayments: {
                        deadlines: deadlines(extra.days === undefined ? 180 : extra.days),
                        ...(extra.chargebacks ? { chargebacks: extra.chargebacks } : {})
                    },
                    ...(extra.livenessPing ? { livenessPing: extra.livenessPing } : {})
                }
            )
        );
    } finally {
        listing.mockRestore();
    }
}

async function outOfFlowMarks(subscriptionId: string) {
    return getServiceTestDb()
        .select()
        .from(reconciliationMarks)
        .where(
            dbAnd(
                eq(reconciliationMarks.subscriptionId, subscriptionId),
                eq(reconciliationMarks.reason, 'REEMBOLSO_FUERA_DEL_FLUJO')
            )
        );
}

async function refundCount(paymentId: string) {
    return (await getServiceTestDb().select().from(refunds).where(eq(refunds.paymentId, paymentId)))
        .length;
}

async function seedPayment(fixture: ChargebackFixture, status: string) {
    const [row] = await getServiceTestDb()
        .insert(payments)
        .values({
            subscriptionId: fixture.started.subscriptionId,
            amount: 10_000,
            currency: 'ARS',
            status,
            provider: fixture.link.provider,
            providerFactId: `b114-unknown-${crypto.randomUUID()}`,
            factAt: fixture.clock.now()
        })
        .returning();
    if (!row) throw new Error('seeded payment missing');
    seededPaymentIds.add(row.id);
    return row;
}

describe('TEST:B11:11 AC:B11:12 credited payments refunded outside our flow', () => {
    it.skipIf(skip)(
        '(a) day 30, refunded in full at the provider: one reason 18 with the payment hung, no suspension',
        async () => {
            // Arrange
            const { fixture, chargeId, payment } = await creditedCharge();
            fixture.clock.advance({ ms: 30 * DAY_MS });
            await providerRefund(fixture, chargeId, 10_000);
            const before = await untouchedState(fixture);

            // Act
            const summary = await sweep(fixture);

            // Assert
            const marks = await outOfFlowMarks(fixture.started.subscriptionId);
            expect(marks).toHaveLength(1);
            expect(
                (await hungRows({ markId: marks[0]?.id as string })).map((r) => r.payment_id)
            ).toEqual([payment.id]);
            const after = await untouchedState(fixture);
            expect(after.subscription).toEqual(before.subscription);
            expect(after.subscription?.status).toBe('ACTIVE');
            expect(await paymentOfCharge(chargeId)).toEqual(payment);
            expect(await refundCount(payment.id)).toBe(0);
            expect(summary.creditedPayments?.outOfFlowRefunds).toBe(1);
            expect(summary.complete).toBe(true);
        }
    );

    it.skipIf(skip)(
        '(b) a PENDING refund of ours covers the provider refund; a smaller one does not',
        async () => {
            // Arrange: our REQUESTED refund covers what the provider refunded
            const covered = await creditedCharge();
            await requestRefund(
                {
                    source: { kind: 'PAYMENT', id: covered.payment.id },
                    amount: 10_000,
                    reason: 'REVOCATION'
                },
                { clock: covered.fixture.clock }
            );
            await providerRefund(covered.fixture, covered.chargeId, 10_000);

            // Act
            const coveredRun = await sweep(covered.fixture);

            // Assert: our flow waiting for its settlement, not an out-of-flow refund
            expect(coveredRun.complete).toBe(true);
            expect(coveredRun.creditedPayments).toMatchObject({ examined: 1, outOfFlowRefunds: 0 });
            expect(await outOfFlowMarks(covered.fixture.started.subscriptionId)).toHaveLength(0);

            // Arrange: a smaller REQUESTED refund (each fixture has its own fake)
            seededPaymentIds.clear();
            const short = await creditedCharge();
            await requestRefund(
                {
                    source: { kind: 'PAYMENT', id: short.payment.id },
                    amount: 4_000,
                    reason: 'REVOCATION'
                },
                { clock: short.fixture.clock }
            );
            await providerRefund(short.fixture, short.chargeId, 10_000);

            // Act
            const shortRun = await sweep(short.fixture);

            // Assert
            expect(shortRun.creditedPayments?.outOfFlowRefunds).toBe(1);
            expect(await outOfFlowMarks(short.fixture.started.subscriptionId)).toHaveLength(1);
        }
    );

    it.skipIf(skip)(
        '(c) an EXECUTED refund of ours equal to the provider refund is nothing; more at the provider opens 18',
        async () => {
            // Arrange
            const admin = await seedAdminActor();
            const { fixture, chargeId, payment } = await creditedCharge();
            await settleOnPayment(admin, { fixture, payment }, { amount: 3_000 });
            await providerRefund(fixture, chargeId, 3_000);

            // Act
            const first = await sweep(fixture);
            vi.restoreAllMocks();
            await providerRefund(fixture, chargeId, 1_000);
            const second = await sweep(fixture);

            // Assert
            expect(first.creditedPayments?.outOfFlowRefunds).toBe(0);
            expect(second.creditedPayments?.outOfFlowRefunds).toBe(1);
            expect(await outOfFlowMarks(fixture.started.subscriptionId)).toHaveLength(1);
        }
    );

    it.skipIf(skip)(
        '(d) a FAILED refund claims nothing: the provider refund opens 18',
        async () => {
            // Arrange
            const { fixture, chargeId, payment } = await creditedCharge();
            await getServiceTestDb().insert(refunds).values({
                paymentId: payment.id,
                amount: 10_000,
                reason: 'REVOCATION',
                status: 'FAILED'
            });
            await providerRefund(fixture, chargeId, 10_000);

            // Act
            const summary = await sweep(fixture);

            // Assert
            expect(summary.creditedPayments?.outOfFlowRefunds).toBe(1);
            expect(await outOfFlowMarks(fixture.started.subscriptionId)).toHaveLength(1);
        }
    );

    it.skipIf(skip)(
        '(e) less refunded at the provider than our EXECUTED refund is nothing',
        async () => {
            // Arrange
            const admin = await seedAdminActor();
            const { fixture, payment } = await creditedCharge();
            await settleOnPayment(admin, { fixture, payment }, { amount: 5_000 });

            // Act
            const summary = await sweep(fixture);

            // Assert
            expect(summary.creditedPayments).toMatchObject({ examined: 1, outOfFlowRefunds: 0 });
            expect(await outOfFlowMarks(fixture.started.subscriptionId)).toHaveLength(0);
        }
    );

    it.skipIf(skip)(
        '(f) the window: 31 days ago is not re-read, 29 days ago is; without deadline 18 nothing is read',
        async () => {
            // Arrange
            const old = await creditedCharge();
            old.fixture.clock.advance({ ms: 2 * DAY_MS });
            const recent = await creditedCharge(old.fixture);
            old.fixture.clock.advance({ ms: 29 * DAY_MS });
            await providerRefund(old.fixture, old.chargeId, 10_000);
            const readCharge = vi.spyOn(old.fixture.provider, 'readCharge');

            // Act
            const windowed = await sweep(old.fixture, { days: 30 });

            // Assert
            const reread = readCharge.mock.calls.map(([input]) => input.chargeId);
            expect(reread).toContain(recent.chargeId);
            expect(reread).not.toContain(old.chargeId);
            expect(await outOfFlowMarks(old.fixture.started.subscriptionId)).toHaveLength(0);
            expect(windowed.creditedPayments?.examined).toBe(1);

            // Act: no deadline 18 at all
            vi.restoreAllMocks();
            const reads = vi.spyOn(old.fixture.provider, 'readCharge');
            const missing = await sweep(old.fixture, { days: null });

            // Assert: fails closed, never an empty window
            expect(reads).not.toHaveBeenCalled();
            expect(missing.complete).toBe(false);
            expect(missing.creditedPayments?.failures).toEqual([
                expect.objectContaining({
                    paymentId: null,
                    message: expect.stringContaining('BILLING_DEADLINE_18_MISSING')
                })
            ]);
        }
    );

    it.skipIf(skip)('(g) PENDING, FAILED and CHARGED_BACK payments are not re-read', async () => {
        // Arrange
        const { fixture, chargeId } = await creditedCharge();
        const others = [
            await seedPayment(fixture, 'PENDING'),
            await seedPayment(fixture, 'FAILED'),
            await seedPayment(fixture, 'CHARGED_BACK')
        ];
        const readCharge = vi.spyOn(fixture.provider, 'readCharge');

        // Act
        const summary = await sweep(fixture);

        // Assert
        const reread = readCharge.mock.calls.map(([input]) => input.chargeId);
        expect(reread).toEqual([chargeId]);
        for (const other of others) expect(reread).not.toContain(other.providerFactId);
        expect(summary.complete).toBe(true);
    });

    it.skipIf(skip)(
        '(h) a second run with reason 18 open is no new mark, no failure and no new event',
        async () => {
            // Arrange
            const { fixture, chargeId } = await creditedCharge();
            await providerRefund(fixture, chargeId, 10_000);
            await sweep(fixture);
            vi.restoreAllMocks();
            const before = await markOpenedEvents(fixture.started.subscriptionId);

            // Act
            const second = await sweep(fixture);

            // Assert
            expect(second.complete).toBe(true);
            expect(second.creditedPayments).toMatchObject({ alreadyOpen: 1, failures: [] });
            expect(await outOfFlowMarks(fixture.started.subscriptionId)).toHaveLength(1);
            expect(await markOpenedEvents(fixture.started.subscriptionId)).toBe(before);
        }
    );

    it.skipIf(skip)(
        '(i) a payment the provider does not know fails the run, and the rest of the page goes on',
        async () => {
            // Arrange
            const { fixture, chargeId } = await creditedCharge();
            await providerRefund(fixture, chargeId, 10_000);
            const unknown = await seedPayment(fixture, 'SUCCEEDED');
            const ping = vi.fn(async () => undefined);

            // Act
            const summary = await sweep(fixture, { livenessPing: { ping } });

            // Assert
            expect(summary.complete).toBe(false);
            expect(summary.pinged).toBe(false);
            expect(ping).not.toHaveBeenCalled();
            expect(summary.creditedPayments?.failures).toEqual([
                expect.objectContaining({ paymentId: unknown.id })
            ]);
            expect(summary.creditedPayments?.outOfFlowRefunds).toBe(1);
            expect(summary.failures).toContainEqual(
                expect.objectContaining({ subscriptionId: fixture.started.subscriptionId })
            );
        }
    );
});

async function markOpenedEvents(subscriptionId: string): Promise<number> {
    const rows = await getServiceTestDb()
        .select({ eventType: domainEvent.eventType })
        .from(domainEvent)
        .where(
            dbAnd(
                eq(domainEvent.entityType, 'subscription'),
                eq(domainEvent.entityId, subscriptionId)
            )
        );
    return rows.filter((row) => row.eventType === 'reconciliation.mark_opened').length;
}

describe('TEST:B11:27 AC:B11:27 by the check: a chargeback is detected and marked, and nothing else', () => {
    it.skipIf(skip)(
        '(j) a SUCCEEDED payment charged back (and refunded): reason 17, never 18, nothing else moves',
        async () => {
            // Arrange
            const { fixture, chargeId, payment } = await creditedCharge();
            await providerRefund(fixture, chargeId, 10_000);
            await fixture.provider.chargeBack({ chargeId });
            const before = await untouchedState(fixture);

            // Act
            const summary = await sweep(fixture);

            // Assert
            const marks = await chargebackMarks(fixture.started.subscriptionId);
            expect(marks).toHaveLength(1);
            expect(
                (await hungRows({ markId: marks[0]?.id as string })).map((r) => r.payment_id)
            ).toEqual([payment.id]);
            expect(await outOfFlowMarks(fixture.started.subscriptionId)).toHaveLength(0);
            expect(await paymentOfCharge(chargeId)).toEqual(payment);
            const after = await untouchedState(fixture);
            expect(after.subscription).toEqual(before.subscription);
            expect(after.coverage).toEqual(before.coverage);
            expect(after.mailCount).toBe(before.mailCount);
            expect(after.subscriptionEvents).toBe(before.subscriptionEvents);
            expect(summary.creditedPayments).toMatchObject({ chargebacks: 1, outOfFlowRefunds: 0 });
        }
    );

    it.skipIf(skip)(
        '(k) a REFUNDED payment charged back: reason 17, it stays REFUNDED',
        async () => {
            // Arrange
            const admin = await seedAdminActor();
            const { fixture, chargeId, payment } = await creditedCharge();
            await settleOnPayment(admin, { fixture, payment }, { amount: 10_000 });
            await providerRefund(fixture, chargeId, 10_000);
            await fixture.provider.chargeBack({ chargeId });

            // Act
            await sweep(fixture);

            // Assert
            const marks = await chargebackMarks(fixture.started.subscriptionId);
            expect(marks).toHaveLength(1);
            expect(
                (await hungRows({ markId: marks[0]?.id as string })).map((r) => r.payment_id)
            ).toEqual([payment.id]);
            expect((await paymentOfCharge(chargeId)).status).toBe('REFUNDED');
        }
    );

    it.skipIf(skip)('(l) a second run opens no other mark', async () => {
        // Arrange
        const { fixture, chargeId } = await creditedCharge();
        await fixture.provider.chargeBack({ chargeId });
        await sweep(fixture);
        vi.restoreAllMocks();
        const before = await markOpenedEvents(fixture.started.subscriptionId);

        // Act
        const second = await sweep(fixture);

        // Assert
        expect(second.complete).toBe(true);
        expect(await chargebackMarks(fixture.started.subscriptionId)).toHaveLength(1);
        expect(await markOpenedEvents(fixture.started.subscriptionId)).toBe(before);
    });

    it.skipIf(skip)(
        '(m) a double of the interface sees one call per charged-back payment and run, as the job',
        async () => {
            // Arrange
            const detect = vi.fn(async () => ({ outcome: 'MARKED' as const }));
            const charged = await creditedCharge();
            await charged.fixture.provider.chargeBack({ chargeId: charged.chargeId });
            await creditedCharge(charged.fixture);

            // Act
            await sweep(charged.fixture, { chargebacks: { detect } });

            // Assert
            expect(detect).toHaveBeenCalledTimes(1);
            expect(detect).toHaveBeenCalledWith(
                expect.objectContaining({
                    payment: expect.objectContaining({ id: charged.payment.id }),
                    actor: 'job'
                })
            );
            expect(await chargebackMarks(charged.fixture.started.subscriptionId)).toHaveLength(0);
        }
    );

    it.skipIf(skip)(
        '(n) the notice and then the sweep reach the same interface: one mark, one hung row',
        async () => {
            // Arrange
            const { fixture, chargeId } = await creditedCharge();
            await fixture.provider.chargeBack({ chargeId });
            expect(await deliverChargeNotice(fixture, chargeId)).toEqual({
                ack: 'OK',
                outcome: 'CHARGEBACK_MARKED'
            });

            // Act
            const summary = await sweep(fixture);

            // Assert
            expect(summary.complete).toBe(true);
            const marks = await chargebackMarks(fixture.started.subscriptionId);
            expect(marks).toHaveLength(1);
            expect(await hungRows({ markId: marks[0]?.id as string })).toHaveLength(1);
        }
    );
});
