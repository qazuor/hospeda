import { domainEventModel, eq, reconciliationMarks, subscriptions } from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { compareCreditedChargeAmount } from '../../../src/services/billing/reconciliation/sweep/comparisons/credited-charge-amount.js';
import { createPersistedReconciliationDailySummary } from '../../../src/services/billing/reconciliation/sweep/comparisons/persisted-daily-summary.js';
import { closeServiceTestPool, withServiceTestTransaction } from './helpers.js';
import { seedRenewalSubscription } from './support/renewal-notice-fixtures.js';

afterAll(closeServiceTestPool);

describe('TEST:1607:6 persisted undercharge summary', () => {
    it('writes one six-field event per payment without opening a mark', async () => {
        await withServiceTestTransaction(async (tx) => {
            const paymentId = crypto.randomUUID();
            const correlationId = crypto.randomUUID();
            const summary = createPersistedReconciliationDailySummary({
                correlationId,
                clock: { now: () => new Date('2026-10-15T12:00:00Z') },
                tx
            });
            const fixture = await seedRenewalSubscription(tx, {
                nextChargeAt: new Date('2026-11-01T12:00:00Z')
            });
            const [subscription] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.subscriptionId));
            if (!subscription) throw new Error('subscription fixture was not persisted');
            const comparedPaymentId = crypto.randomUUID();
            await compareCreditedChargeAmount({
                subscription,
                paymentId: comparedPaymentId,
                chargeId: 'actual-charge-under-expected',
                chargedMinor: 10_000,
                chargeCurrency: 'ARS',
                chargeCreatedAt: new Date('2026-11-01T12:00:00Z'),
                isAlreadyHung: async () => false,
                ports: {
                    expectedAmounts: {
                        expectedAmount: async () => ({
                            kind: 'COMPARABLE',
                            amountMinor: 12_000,
                            currency: 'ARS',
                            source: 'ANCHORED'
                        })
                    },
                    dailySummary: summary
                }
            });
            const input = {
                subscriptionId: crypto.randomUUID(),
                paymentId,
                chargeId: 'charge-1',
                expectedMinor: 12_000,
                chargedMinor: 10_000,
                differenceMinor: -2_000,
                currency: 'ARS'
            };
            await summary.addUndercharge(input);
            await summary.addUndercharge(input);
            await summary.addUndercharge({
                ...input,
                paymentId: crypto.randomUUID(),
                chargeId: 'charge-2'
            });
            const rows = (
                await domainEventModel.findByEntity({
                    entityType: 'payment',
                    entityId: paymentId,
                    tx
                })
            ).filter((event) => event.eventType === 'reconciliation.undercharge_detected');
            expect(rows).toHaveLength(1);
            expect(rows[0]?.changes).toEqual([
                { field: 'subscription.id', new: input.subscriptionId },
                { field: 'provider.charge_id', new: 'charge-1' },
                { field: 'payment.currency', new: 'ARS' },
                { field: 'payment.expected_minor', new: 12_000 },
                { field: 'payment.charged_minor', new: 10_000 },
                { field: 'payment.difference_minor', new: -2_000 }
            ]);
            expect(
                (
                    await domainEventModel.findByEntity({
                        entityType: 'payment',
                        entityId: paymentId,
                        tx
                    })
                ).filter((event) => event.eventType === 'reconciliation.undercharge_detected')
            ).toHaveLength(1);
            expect(
                (
                    await domainEventModel.findByEntity({
                        entityType: 'payment',
                        entityId: input.paymentId,
                        tx
                    })
                ).filter((event) => event.eventType === 'reconciliation.undercharge_detected')
            ).toHaveLength(1);
            const allEvents = await domainEventModel.findByCorrelationId({ correlationId, tx });
            expect(
                allEvents.filter(
                    (event) => event.eventType === 'reconciliation.undercharge_detected'
                )
            ).toHaveLength(3);
            expect(
                (
                    await domainEventModel.findByEntity({
                        entityType: 'payment',
                        entityId: comparedPaymentId,
                        tx
                    })
                ).find((event) => event.eventType === 'reconciliation.undercharge_detected')
                    ?.changes
            ).toEqual([
                { field: 'subscription.id', new: subscription.id },
                { field: 'provider.charge_id', new: 'actual-charge-under-expected' },
                { field: 'payment.currency', new: 'ARS' },
                { field: 'payment.expected_minor', new: 12_000 },
                { field: 'payment.charged_minor', new: 10_000 },
                { field: 'payment.difference_minor', new: -2_000 }
            ]);
            expect(
                await tx
                    .select()
                    .from(reconciliationMarks)
                    .where(eq(reconciliationMarks.subscriptionId, input.subscriptionId))
            ).toHaveLength(0);
        });
    });
});
