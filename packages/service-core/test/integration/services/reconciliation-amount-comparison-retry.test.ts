import type { Clock } from '@repo/billing-verticals-contract';
import { eq, providerLinks, reconciliationMarkModel, subscriptions } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { createAmountComparison } from '../../../src/services/billing/reconciliation/sweep/comparisons/amount-comparison.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    reconciliationClock,
    resetSeededReconciliationInventory,
    seedSubscription,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';

afterAll(closeServiceTestPool);
beforeEach(resetSeededReconciliationInventory);
const owned: Array<{ readonly subscriptionId: string; readonly userId: string }> = [];

afterEach(async () => {
    const db = getServiceTestDb();
    for (const row of owned.splice(0)) {
        for (const mark of await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: row.subscriptionId }
        })) {
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
});

function adjustableClock() {
    const start = reconciliationClock.now().getTime();
    let offset = 0;
    const clock = { now: () => new Date(start + offset) } satisfies Clock;
    return {
        clock,
        advance: (days: number) => {
            offset += days * 86_400_000;
        }
    };
}

function providerWithoutAppliedAmount(fake: FakePaymentProvider): PaymentProvider {
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

async function run(input: {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly mutations: {
        findLatest(args: { readonly subscriptionId: string }): Promise<{
            readonly transition: 'S30' | 'S37' | 'S10';
            readonly decidedAt: Date;
        } | null>;
    };
}) {
    return withSeededReconciliationInventory(() =>
        runReconciliationSweep(
            {},
            {
                provider: input.provider,
                clock: input.clock,
                markPayments: createPaymentReconciliationMarkPayments(input.clock),
                comparisons: [
                    createAmountComparison({
                        provider: input.provider,
                        clock: input.clock,
                        mutations: input.mutations
                    })
                ]
            }
        )
    );
}

describe('TEST:B11:8 AC:B11:9 amount mutation retry window (MOT:5)', () => {
    it('(b) retries an unapplied mutation on days one and two, then marks on day three without retry', async () => {
        const adjustable = adjustableClock();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock: adjustable.clock
        });
        const seeded = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        if (!seeded.subscription.userId) throw new Error('Fixture has no user');
        owned.push({ subscriptionId: seeded.subscription.id, userId: seeded.subscription.userId });
        const provider = providerWithoutAppliedAmount(fake);
        const retry = vi.spyOn(provider, 'changeAmount');
        const decidedAt = adjustable.clock.now();
        const mutations = { findLatest: async () => ({ transition: 'S30' as const, decidedAt }) };
        await fake.changeAmount({
            authorizationId: seeded.providerId!,
            amount: { amountMinor: 300000, currency: 'ARS' }
        });
        adjustable.advance(1);
        expect(await run({ provider, clock: adjustable.clock, mutations })).toMatchObject({
            marksOpened: 0,
            rowsFailed: 0
        });
        adjustable.advance(1);
        expect(await run({ provider, clock: adjustable.clock, mutations })).toMatchObject({
            marksOpened: 0,
            rowsFailed: 0
        });
        expect(retry).toHaveBeenCalledTimes(2);
        expect(retry).toHaveBeenNthCalledWith(1, {
            authorizationId: seeded.providerId,
            amount: { amountMinor: 250000, currency: 'ARS' }
        });
        adjustable.advance(1);
        expect(await run({ provider, clock: adjustable.clock, mutations })).toMatchObject({
            marksOpened: 1,
            rowsFailed: 0
        });
        expect(retry).toHaveBeenCalledTimes(2);
    });

    it('(c) does not mark after the fake applies our retry and confirms the read', async () => {
        const adjustable = adjustableClock();
        const fake = new FakePaymentProvider({
            idNamespace: crypto.randomUUID(),
            clock: adjustable.clock
        });
        const seeded = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        if (!seeded.subscription.userId) throw new Error('Fixture has no user');
        owned.push({ subscriptionId: seeded.subscription.id, userId: seeded.subscription.userId });
        await fake.changeAmount({
            authorizationId: seeded.providerId!,
            amount: { amountMinor: 300000, currency: 'ARS' }
        });
        const decidedAt = adjustable.clock.now();
        const mutations = { findLatest: async () => ({ transition: 'S30' as const, decidedAt }) };
        adjustable.advance(1);
        expect(await run({ provider: fake, clock: adjustable.clock, mutations })).toMatchObject({
            marksOpened: 0,
            rowsFailed: 0
        });
        expect(
            (await fake.readAuthorization({ authorizationId: seeded.providerId! })).snapshot.amount
        ).toEqual({ amountMinor: 250000, currency: 'ARS' });
    });
});
