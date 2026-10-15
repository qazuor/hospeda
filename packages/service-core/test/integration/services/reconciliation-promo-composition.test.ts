import {
    eq,
    promoRedemptions,
    providerLinks,
    reconciliationMarkModel,
    reconciliationMarkPayments,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { createAmountComparison } from '../../../src/services/billing/reconciliation/sweep/comparisons/amount-comparison.js';
import { createCutExpectedAmountPolicy } from '../../../src/services/billing/reconciliation/sweep/comparisons/expected-amount.js';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    createReconciliationFake,
    reconciliationClock,
    resetSeededReconciliationInventory,
    seedSubscription,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures.js';
import { seedDifferentScheduledAmount } from './support/period-comparison-fixtures.js';
import { retirePromoFixtures, seedPromoRedemption } from './support/promo-fixtures.js';

afterAll(closeServiceTestPool);
beforeEach(resetSeededReconciliationInventory);
const owned: Array<{ readonly subscriptionId: string; readonly userId: string }> = [];

async function setup(input: { readonly amountMinor: number }) {
    const { fake, provider } = createReconciliationFake(reconciliationClock);
    const seeded = await seedSubscription({
        status: 'ACTIVE',
        withLink: true,
        fake,
        amountMinor: input.amountMinor
    });
    owned.push({ subscriptionId: seeded.subscription.id, userId: seeded.subscription.userId! });
    return { fake, provider, seeded };
}

async function seedPromo(
    seeded: Awaited<ReturnType<typeof seedSubscription>>,
    promo: {
        readonly discountKind: 'PERCENTAGE' | 'FIXED';
        readonly value: number;
        readonly remainingCharges: number | null;
        readonly redeemedAt?: Date;
    }
) {
    return seedPromoRedemption({
        subscriptionId: seeded.subscription.id,
        userId: seeded.subscription.userId!,
        ...promo
    });
}

async function sweep(input: Awaited<ReturnType<typeof setup>>) {
    return withSeededReconciliationInventory(() =>
        runReconciliationSweep(
            { correlationId: crypto.randomUUID() },
            {
                provider: input.provider,
                clock: reconciliationClock,
                comparisons: [
                    createAmountComparison({ provider: input.provider, clock: reconciliationClock })
                ],
                markPayments: createPaymentReconciliationMarkPayments(reconciliationClock)
            }
        )
    );
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
        await db
            .delete(promoRedemptions)
            .where(eq(promoRedemptions.subscriptionId, row.subscriptionId));
        await db.delete(providerLinks).where(eq(providerLinks.subscriptionId, row.subscriptionId));
        await db
            .update(subscriptions)
            .set({ status: 'ABANDONED' })
            .where(eq(subscriptions.id, row.subscriptionId));
    }
});

describe('TEST:B9b:1 AC:B9b:1 the sweep derives the composed amount', () => {
    it('(a) accepts 7,649.23 and marks the uncomposed list amount', async () => {
        const matched = await setup({ amountMinor: 999_900 });
        await seedPromo(matched.seeded, {
            discountKind: 'PERCENTAGE',
            value: 15,
            remainingCharges: 2
        });
        await seedPromo(matched.seeded, {
            discountKind: 'PERCENTAGE',
            value: 10,
            remainingCharges: 2
        });
        await matched.fake.changeAmount({
            authorizationId: matched.seeded.providerId!,
            amount: { amountMinor: 764_923, currency: 'ARS' }
        });
        expect(await sweep(matched)).toMatchObject({ marksOpened: 0, rowsFailed: 0 });

        resetSeededReconciliationInventory();
        const divergent = await setup({ amountMinor: 999_900 });
        await seedPromo(divergent.seeded, {
            discountKind: 'PERCENTAGE',
            value: 15,
            remainingCharges: 2
        });
        await seedPromo(divergent.seeded, {
            discountKind: 'PERCENTAGE',
            value: 10,
            remainingCharges: 2
        });
        expect(await sweep(divergent)).toMatchObject({
            marksOpened: 1,
            rowsFailed: 0,
            failures: []
        });
    });

    it('(b) derives 700 from 20% plus 100 and marks the wrong-order result 720', async () => {
        const matched = await setup({ amountMinor: 100_000 });
        await seedPromo(matched.seeded, {
            discountKind: 'PERCENTAGE',
            value: 20,
            remainingCharges: 2
        });
        await seedPromo(matched.seeded, {
            discountKind: 'FIXED',
            value: 10_000,
            remainingCharges: 2
        });
        await matched.fake.changeAmount({
            authorizationId: matched.seeded.providerId!,
            amount: { amountMinor: 70_000, currency: 'ARS' }
        });
        expect(await sweep(matched)).toMatchObject({ marksOpened: 0, rowsFailed: 0 });

        resetSeededReconciliationInventory();
        const divergent = await setup({ amountMinor: 100_000 });
        await seedPromo(divergent.seeded, {
            discountKind: 'PERCENTAGE',
            value: 20,
            remainingCharges: 2
        });
        await seedPromo(divergent.seeded, {
            discountKind: 'FIXED',
            value: 10_000,
            remainingCharges: 2
        });
        await divergent.fake.changeAmount({
            authorizationId: divergent.seeded.providerId!,
            amount: { amountMinor: 72_000, currency: 'ARS' }
        });
        expect(await sweep(divergent)).toMatchObject({ marksOpened: 1, rowsFailed: 0 });
    });

    it('(c) excludes exhausted redemptions and includes FOREVER redemptions', async () => {
        const exhausted = await setup({ amountMinor: 250_000 });
        await seedPromo(exhausted.seeded, {
            discountKind: 'FIXED',
            value: 5_000,
            remainingCharges: 0
        });
        expect(await sweep(exhausted)).toMatchObject({ marksOpened: 0, rowsFailed: 0 });

        resetSeededReconciliationInventory();
        const forever = await setup({ amountMinor: 250_000 });
        await seedPromo(forever.seeded, {
            discountKind: 'FIXED',
            value: 5_000,
            remainingCharges: null
        });
        await forever.fake.changeAmount({
            authorizationId: forever.seeded.providerId!,
            amount: { amountMinor: 245_000, currency: 'ARS' }
        });
        expect(await sweep(forever)).toMatchObject({ marksOpened: 0, rowsFailed: 0 });
    });

    it('(d) applies the period cut and skips promos for a non-preserving scheduled destination', async () => {
        const at = new Date('2026-10-11T12:00:00.000Z');
        const composed = await setup({ amountMinor: 999_900 });
        await seedPromo(composed.seeded, {
            discountKind: 'PERCENTAGE',
            value: 15,
            remainingCharges: 2,
            redeemedAt: new Date(at.getTime() - 2)
        });
        await seedPromo(composed.seeded, {
            discountKind: 'PERCENTAGE',
            value: 10,
            remainingCharges: 2,
            redeemedAt: new Date(at.getTime() - 1)
        });
        const policy = createCutExpectedAmountPolicy();
        const beforeChange = await policy.expectedAmount({
            subscription: composed.seeded.subscription,
            purpose: { kind: 'PERIOD', chargeCreatedAt: at }
        });
        expect(beforeChange).toMatchObject({ kind: 'COMPARABLE', amountMinor: 764_923 });

        const future = await setup({ amountMinor: 999_900 });
        await seedPromo(future.seeded, {
            discountKind: 'PERCENTAGE',
            value: 15,
            remainingCharges: 2,
            redeemedAt: new Date(at.getTime() + 1)
        });
        const afterRedemption = await policy.expectedAmount({
            subscription: future.seeded.subscription,
            purpose: { kind: 'PERIOD', chargeCreatedAt: at }
        });
        expect(afterRedemption).toMatchObject({
            kind: 'COMPARABLE',
            amountMinor: 999_900,
            source: 'ANCHORED'
        });

        await seedDifferentScheduledAmount({
            subscriptionId: future.seeded.subscription.id,
            effectiveAt: new Date(at.getTime() - 1)
        });
        const afterChange = await policy.expectedAmount({
            subscription: future.seeded.subscription,
            purpose: { kind: 'PERIOD', chargeCreatedAt: at }
        });
        expect(afterChange).toMatchObject({
            kind: 'COMPARABLE',
            amountMinor: 350_000,
            source: 'SCHEDULED_CHANGE'
        });
        const authorization = await policy.expectedAmount({
            subscription: future.seeded.subscription,
            purpose: { kind: 'AUTHORIZATION' }
        });
        expect(authorization).toMatchObject({ kind: 'COMPARABLE', amountMinor: 350_000 });
    });

    it('(e) keeps COMPLEMENTO and a missing anchor NOT_COMPARABLE', async () => {
        const complement = await seedSubscription({ status: 'ACTIVE', class: 'COMPLEMENTO' });
        owned.push({
            subscriptionId: complement.subscription.id,
            userId: complement.subscription.userId!
        });
        const policy = createCutExpectedAmountPolicy();
        expect(
            await policy.expectedAmount({
                subscription: complement.subscription,
                purpose: { kind: 'AUTHORIZATION' }
            })
        ).toEqual({ kind: 'NOT_COMPARABLE', reason: 'NOT_PRINCIPAL' });

        const unanchored = {
            ...complement.subscription,
            class: 'PRINCIPAL',
            planVersionId: null,
            billingOptionId: null
        };
        expect(
            await policy.expectedAmount({
                subscription: unanchored,
                purpose: { kind: 'AUTHORIZATION' }
            })
        ).toEqual({ kind: 'NOT_COMPARABLE', reason: 'NO_ANCHOR' });
    });
});
