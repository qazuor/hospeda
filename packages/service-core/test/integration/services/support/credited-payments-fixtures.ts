/**
 * Fixtures for TEST:B11:11 and the "by the check" half of TEST:B11:27: credited
 * charges of the fake, refunds outside our flow, and the sweep run with only the
 * credited-payments pass, isolated to the payments a case seeds.
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
import { expect, vi } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../../src/services/billing/payment/payment-ledger.js';
import type { ChargebackDetection } from '../../../../src/services/billing/reconciliation/chargeback/chargeback-detection.js';
import { runReconciliationSweep } from '../../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { getServiceTestDb } from '../helpers.js';
import {
    reconciliationDeadlineValues,
    withSeededReconciliationInventory
} from '../reconciliation-sweep-fixtures.js';
import {
    approvedCharge,
    type ChargebackFixture,
    chargebackFixture,
    paymentOfCharge,
    recordCharge
} from './chargeback-fixtures.js';

export const DAY_MS = 86_400_000;
/** The payments this case seeded: the only ones the isolated listing returns. */
export const seededPaymentIds = new Set<string>();

export function deadlines(days: number | null) {
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
export function isolateListing() {
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
export async function creditedCharge(fixture?: ChargebackFixture) {
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
export async function providerRefund(
    fixture: ChargebackFixture,
    chargeId: string,
    amountMinor: number
) {
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

export async function sweep(
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

export async function outOfFlowMarks(subscriptionId: string) {
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

export async function refundCount(paymentId: string) {
    return (await getServiceTestDb().select().from(refunds).where(eq(refunds.paymentId, paymentId)))
        .length;
}

export async function seedPayment(fixture: ChargebackFixture, status: string) {
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

export async function markOpenedEvents(subscriptionId: string): Promise<number> {
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
