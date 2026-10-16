import {
    and,
    domainEvent,
    eq,
    getDb,
    promoRedemptions,
    providerLinks,
    reconciliationMarkModel,
    reconciliationMarkPayments,
    subscriptions
} from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { runS30 } from '../../../src/services/billing/promo/promo-exhaustion.service.js';
import { createAmountComparison } from '../../../src/services/billing/reconciliation/sweep/comparisons/amount-comparison.js';
import { createRecordedAmountMutationDecisions } from '../../../src/services/billing/reconciliation/sweep/comparisons/amount-mutation-decision.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    reconciliationClock,
    resetSeededReconciliationInventory,
    seedSubscription,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';
import { retirePromoFixtures, seedPromoRedemption } from './support/promo-fixtures.js';

afterAll(closeServiceTestPool);
beforeEach(resetSeededReconciliationInventory);
const owned: Array<{ readonly subscriptionId: string; readonly userId: string }> = [];
function adjustableClock() {
    let offset = 0;
    return {
        clock: { now: () => new Date(reconciliationClock.now().getTime() + offset) },
        advance: (days: number) => {
            offset += days * 86_400_000;
        }
    };
}

function acceptsWithoutApplying(fake: FakePaymentProvider): PaymentProvider {
    return {
        capabilitySupport: fake.capabilitySupport,
        authorize: (input) => fake.authorize(input),
        charge: (input) => fake.charge(input),
        changeAmount: async (input) => ({ accepted: true, resourceId: input.authorizationId }),
        pause: (input) => fake.pause(input),
        resume: (input) => fake.resume(input),
        cancel: (input) => fake.cancel(input),
        refund: (input) => fake.refund(input),
        readAuthorization: (input) => fake.readAuthorization(input),
        searchAuthorizations: (input) => fake.searchAuthorizations(input),
        readCharge: (input) => fake.readCharge(input),
        listCharges: (input) => fake.listCharges(input),
        readOrder: (input) => fake.readOrder(input),
        searchOrders: (input) => fake.searchOrders(input),
        decodeNotice: (input) => fake.decodeNotice(input)
    };
}
afterEach(async () => {
    await retirePromoFixtures();
    const db = getServiceTestDb();
    for (const row of owned.splice(0)) {
        for (const mark of await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: row.subscriptionId }
        })) {
            await db
                .update(reconciliationMarkPayments)
                .set({ resolvedAt: new Date() })
                .where(eq(reconciliationMarkPayments.markId, mark.id));
            await reconciliationMarkModel.lift({
                markId: mark.id,
                expectedVersion: mark.version,
                liftedBy: row.userId,
                now: new Date()
            });
        }
        await db.delete(providerLinks).where(eq(providerLinks.subscriptionId, row.subscriptionId));
        await db
            .update(subscriptions)
            .set({ status: 'ABANDONED' })
            .where(eq(subscriptions.id, row.subscriptionId));
    }
    resetSeededReconciliationInventory();
});

describe('TEST:B9b:5 AC:B9b:5 S30 mutates without the exhausted promo', () => {
    it('(a) records S30 before mutating to the list amount with the other live promo still composed', async () => {
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock: reconciliationClock
        });
        const seeded = await seedSubscription({
            status: 'ACTIVE',
            withLink: true,
            fake,
            amountMinor: 100000
        });
        owned.push({ subscriptionId: seeded.subscription.id, userId: seeded.subscription.userId! });
        const exhausted = await seedPromoRedemption({
            subscriptionId: seeded.subscription.id,
            userId: seeded.subscription.userId!,
            discountKind: 'PERCENTAGE',
            value: 20,
            remainingCharges: 0
        });
        const live = await seedPromoRedemption({
            subscriptionId: seeded.subscription.id,
            userId: seeded.subscription.userId!,
            discountKind: 'FIXED',
            value: 10000,
            remainingCharges: 2
        });
        await fake.changeAmount({
            authorizationId: seeded.providerId!,
            amount: { amountMinor: 70000, currency: 'ARS' }
        });
        const changeAmount = vi.spyOn(fake, 'changeAmount');
        changeAmount.mockImplementation(async (input) => {
            const [decision] = await getDb()
                .select({ id: domainEvent.id })
                .from(domainEvent)
                .where(
                    and(
                        eq(domainEvent.eventType, 'subscription.amount_mutation_decided'),
                        eq(domainEvent.entityId, seeded.subscription.id),
                        eq(domainEvent.reason, 'S30')
                    )
                );
            expect(decision).toBeDefined();
            return FakePaymentProvider.prototype.changeAmount.call(fake, input);
        });
        const outcome = await runS30(
            { subscriptionId: seeded.subscription.id, redemptionId: exhausted.redemptionId },
            {
                provider: fake,
                clock: reconciliationClock
            }
        );
        expect(outcome).toEqual({ outcome: 'MUTATED', amountMinor: 90000 });
        expect(
            (await fake.readAuthorization({ authorizationId: seeded.providerId! })).snapshot.amount
        ).toEqual({ amountMinor: 90000, currency: 'ARS' });
        const events = await getDb()
            .select({ reason: domainEvent.reason })
            .from(domainEvent)
            .where(
                and(
                    eq(domainEvent.eventType, 'subscription.amount_mutation_decided'),
                    eq(domainEvent.entityType, 'subscription'),
                    eq(domainEvent.entityId, seeded.subscription.id),
                    eq(domainEvent.reason, 'S30')
                )
            );
        expect(events).toHaveLength(1);
        await expect(
            createRecordedAmountMutationDecisions().findLatest({
                subscriptionId: seeded.subscription.id
            })
        ).resolves.toMatchObject({ transition: 'S30' });
        const [liveAfter] = await getServiceTestDb()
            .select({ remainingCharges: promoRedemptions.remainingCharges })
            .from(promoRedemptions)
            .where(eq(promoRedemptions.id, live.redemptionId));
        expect(liveAfter?.remainingCharges).toBe(2);
    });

    it('(c) declares PAUSED without a decision or provider mutation', async () => {
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock: reconciliationClock
        });
        const seeded = await seedSubscription({
            status: 'PAUSED',
            withLink: true,
            fake,
            amountMinor: 100000
        });
        owned.push({ subscriptionId: seeded.subscription.id, userId: seeded.subscription.userId! });
        const exhausted = await seedPromoRedemption({
            subscriptionId: seeded.subscription.id,
            userId: seeded.subscription.userId!,
            discountKind: 'FIXED',
            value: 10000,
            remainingCharges: 0
        });
        const mutate = vi.spyOn(fake, 'changeAmount');
        expect(
            await runS30(
                { subscriptionId: seeded.subscription.id, redemptionId: exhausted.redemptionId },
                {
                    provider: fake,
                    clock: reconciliationClock
                }
            )
        ).toMatchObject({ outcome: 'NOT_APPLICABLE' });
        expect(mutate).not.toHaveBeenCalled();
        const events = await getDb()
            .select({ id: domainEvent.id })
            .from(domainEvent)
            .where(
                and(
                    eq(domainEvent.eventType, 'subscription.amount_mutation_decided'),
                    eq(domainEvent.entityId, seeded.subscription.id)
                )
            );
        expect(events).toHaveLength(0);
    });

    it('(d) runs S30 for GRACE_PERIOD', async () => {
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock: reconciliationClock
        });
        const seeded = await seedSubscription({
            status: 'GRACE_PERIOD',
            withLink: true,
            fake,
            amountMinor: 100000
        });
        owned.push({ subscriptionId: seeded.subscription.id, userId: seeded.subscription.userId! });
        const exhausted = await seedPromoRedemption({
            subscriptionId: seeded.subscription.id,
            userId: seeded.subscription.userId!,
            discountKind: 'FIXED',
            value: 10000,
            remainingCharges: 0
        });
        await expect(
            runS30(
                { subscriptionId: seeded.subscription.id, redemptionId: exhausted.redemptionId },
                {
                    provider: fake,
                    clock: reconciliationClock
                }
            )
        ).resolves.toEqual({ outcome: 'MUTATED', amountMinor: 100000 });
    });

    it('(b) retains the decision when the provider accepts but does not apply the mutation', async () => {
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock: reconciliationClock
        });
        const seeded = await seedSubscription({
            status: 'ACTIVE',
            withLink: true,
            fake,
            amountMinor: 100000
        });
        owned.push({ subscriptionId: seeded.subscription.id, userId: seeded.subscription.userId! });
        const exhausted = await seedPromoRedemption({
            subscriptionId: seeded.subscription.id,
            userId: seeded.subscription.userId!,
            discountKind: 'PERCENTAGE',
            value: 20,
            remainingCharges: 0
        });
        await fake.changeAmount({
            authorizationId: seeded.providerId!,
            amount: { amountMinor: 80000, currency: 'ARS' }
        });
        const outcome = await runS30(
            { subscriptionId: seeded.subscription.id, redemptionId: exhausted.redemptionId },
            {
                provider: acceptsWithoutApplying(fake),
                clock: reconciliationClock
            }
        );
        expect(outcome).toEqual({ outcome: 'NOT_APPLIED', amountMinor: 100000 });
        await expect(
            createRecordedAmountMutationDecisions().findLatest({
                subscriptionId: seeded.subscription.id
            })
        ).resolves.toMatchObject({ transition: 'S30' });
    });

    it('(b) retries after one day and opens DIVERGENCIA_DE_MONTO after three days plus one millisecond', async () => {
        const adjustable = adjustableClock();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock: adjustable.clock
        });
        const seeded = await seedSubscription({
            status: 'ACTIVE',
            withLink: true,
            fake,
            amountMinor: 100000
        });
        owned.push({ subscriptionId: seeded.subscription.id, userId: seeded.subscription.userId! });
        const exhausted = await seedPromoRedemption({
            subscriptionId: seeded.subscription.id,
            userId: seeded.subscription.userId!,
            discountKind: 'PERCENTAGE',
            value: 20,
            remainingCharges: 0
        });
        await fake.changeAmount({
            authorizationId: seeded.providerId!,
            amount: { amountMinor: 80000, currency: 'ARS' }
        });
        const provider = acceptsWithoutApplying(fake);
        const retry = vi.spyOn(provider, 'changeAmount');
        await runS30(
            { subscriptionId: seeded.subscription.id, redemptionId: exhausted.redemptionId },
            {
                provider,
                clock: adjustable.clock
            }
        );
        const sweep = () =>
            withSeededReconciliationInventory(() =>
                runReconciliationSweep(
                    {},
                    {
                        provider,
                        clock: adjustable.clock,
                        markPayments: createPaymentReconciliationMarkPayments(adjustable.clock),
                        comparisons: [
                            createAmountComparison({
                                provider,
                                clock: adjustable.clock,
                                mutations: createRecordedAmountMutationDecisions()
                            })
                        ]
                    }
                )
            );
        adjustable.advance(1);
        expect(await sweep()).toMatchObject({ marksOpened: 0, rowsFailed: 0 });
        expect(retry).toHaveBeenCalledTimes(2);
        adjustable.advance(2);
        expect(await sweep()).toMatchObject({ marksOpened: 0, rowsFailed: 0 });
        expect(retry).toHaveBeenCalledTimes(2);
        // The retry window expires at exactly day three; this one millisecond is outside it.
        adjustable.advance(1 / 86_400_000);
        expect(await sweep()).toMatchObject({ marksOpened: 1, rowsFailed: 0 });
        expect(retry).toHaveBeenCalledTimes(2);
    });
});
