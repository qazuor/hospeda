import {
    eq,
    getDb,
    promoCodes,
    promoRedemptions,
    providerLinks,
    reconciliationMarkModel,
    reconciliationMarkPayments,
    subscriptions
} from '@repo/db';
import { FAKE_AMOUNT_FLOOR_MINOR } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { PROVIDER_AMOUNT_FLOOR_MINOR, redeemDiscountCode } from '../../../src/services';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger';
import { createAmountComparison } from '../../../src/services/billing/reconciliation/sweep/comparisons/amount-comparison';
import { runReconciliationSweep } from '../../../src/services/billing/reconciliation/sweep/reconciliation-sweep.service';
import { closeServiceTestPool } from './helpers';
import {
    createReconciliationFake,
    reconciliationClock,
    resetSeededReconciliationInventory,
    seedSubscription,
    withSeededReconciliationInventory
} from './reconciliation-sweep-fixtures';
import { retirePromoFixtures, seedPromoCode } from './support/promo-fixtures';
import { deleteScheduledChanges, seedScheduledChange } from './support/scheduled-change-fixtures';

const owned: Array<{ readonly subscriptionId: string; readonly userId: string }> = [];
afterAll(closeServiceTestPool);
afterEach(async () => {
    await retirePromoFixtures();
    await deleteScheduledChanges(owned.map((row) => row.subscriptionId));
    for (const row of owned.splice(0)) {
        for (const mark of await reconciliationMarkModel.listOpen({
            subject: { kind: 'SUBSCRIPTION', subscriptionId: row.subscriptionId }
        })) {
            await getDb()
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
        await getDb()
            .delete(promoRedemptions)
            .where(eq(promoRedemptions.subscriptionId, row.subscriptionId));
        await getDb()
            .delete(providerLinks)
            .where(eq(providerLinks.subscriptionId, row.subscriptionId));
        await getDb()
            .update(subscriptions)
            .set({ status: 'ABANDONED' })
            .where(eq(subscriptions.id, row.subscriptionId));
    }
    resetSeededReconciliationInventory();
});

async function setup(amountMinor: number) {
    const { fake, provider } = createReconciliationFake(reconciliationClock);
    const seeded = await seedSubscription({ amountMinor, withLink: true, fake });
    owned.push({
        subscriptionId: seeded.subscription.id,
        userId: seeded.subscription.userId!
    });
    return { fake, provider, seeded };
}

async function redeem(input: Awaited<ReturnType<typeof setup>>, code: string) {
    return redeemDiscountCode(
        { userId: input.seeded.subscription.userId!, code, vertical: 'accommodation' },
        {
            provider: input.provider,
            clock: reconciliationClock
        }
    );
}

describe('TEST:B9b:2 AC:B9b:2 redeeming a discount code respects the provider floor', () => {
    it('(a) rejects ARS 14 before mutation and leaves the code unconsumed', async () => {
        const setupValue = await setup(5_000);
        const code = await seedPromoCode({ discountKind: 'FIXED', value: 3_600 });
        const mutate = vi.spyOn(setupValue.fake, 'changeAmount');
        await expect(redeem(setupValue, code.code)).rejects.toMatchObject({
            reason: 'PROMO_BELOW_PROVIDER_MINIMUM'
        });
        expect(mutate).toHaveBeenCalledTimes(0);
        expect(
            (
                await setupValue.fake.readAuthorization({
                    authorizationId: setupValue.seeded.providerId!
                })
            ).snapshot.amount.amountMinor
        ).toBe(5_000);
        expect(
            await getDb()
                .select()
                .from(promoRedemptions)
                .where(eq(promoRedemptions.promoCodeId, code.id))
        ).toHaveLength(0);
        expect(
            await getDb().select().from(promoCodes).where(eq(promoCodes.id, code.id))
        ).toHaveLength(1);
    });

    it('(b,c) accepts exactly ARS 15 and rejects ARS 14.99, zero and negative results', async () => {
        const accepted = await setup(5_000);
        const floorCode = await seedPromoCode({ discountKind: 'FIXED', value: 3_500 });
        await expect(redeem(accepted, floorCode.code)).resolves.toMatchObject({
            amountMinor: 1_500
        });
        for (const [list, reduction] of [
            [5_000, 3_501],
            [5_000, 5_500]
        ] as const) {
            const subject = await setup(list);
            const code = await seedPromoCode({ discountKind: 'FIXED', value: reduction });
            await expect(redeem(subject, code.code)).rejects.toMatchObject({
                reason: 'PROMO_BELOW_PROVIDER_MINIMUM'
            });
        }
        const free = await setup(5_000);
        const fullDiscount = await seedPromoCode({ discountKind: 'PERCENTAGE', value: 100 });
        await expect(redeem(free, fullDiscount.code)).rejects.toMatchObject({
            reason: 'PROMO_BELOW_PROVIDER_MINIMUM'
        });
    });

    it('(d) rejects an under-floor stack while preserving the first live discount and amount', async () => {
        const subject = await setup(5_000);
        const first = await seedPromoCode({ discountKind: 'FIXED', value: 3_000 });
        const second = await seedPromoCode({ discountKind: 'FIXED', value: 600 });
        await redeem(subject, first.code);
        await expect(redeem(subject, second.code)).rejects.toMatchObject({
            reason: 'PROMO_BELOW_PROVIDER_MINIMUM'
        });
        expect(
            (await subject.fake.readAuthorization({ authorizationId: subject.seeded.providerId! }))
                .snapshot.amount.amountMinor
        ).toBe(2_000);
        expect(
            await getDb()
                .select()
                .from(promoRedemptions)
                .where(eq(promoRedemptions.promoCodeId, first.id))
        ).toHaveLength(1);
        expect(
            await getDb()
                .select()
                .from(promoRedemptions)
                .where(eq(promoRedemptions.promoCodeId, second.id))
        ).toHaveLength(0);
    });

    it('(e) uses the same composition when mutating a stacked discount', async () => {
        const subject = await setup(999_900);
        const first = await seedPromoCode({ discountKind: 'PERCENTAGE', value: 15 });
        const second = await seedPromoCode({ discountKind: 'PERCENTAGE', value: 10 });
        await redeem(subject, first.code);
        const result = await redeem(subject, second.code);
        expect(result.amountMinor).toBe(764_923);
        expect(result.previousAmountMinor).toBe(849_915);
        expect(
            (await subject.fake.readAuthorization({ authorizationId: subject.seeded.providerId! }))
                .snapshot.amount.amountMinor
        ).toBe(764_923);
        const sweep = await withSeededReconciliationInventory(() =>
            runReconciliationSweep(
                { correlationId: crypto.randomUUID() },
                {
                    provider: subject.provider,
                    clock: reconciliationClock,
                    comparisons: [
                        createAmountComparison({
                            provider: subject.provider,
                            clock: reconciliationClock
                        })
                    ],
                    markPayments: createPaymentReconciliationMarkPayments(reconciliationClock)
                }
            )
        );
        expect(sweep).toMatchObject({ marksOpened: 0, rowsFailed: 0 });

        const fixed = await setup(100_000);
        const percentage = await seedPromoCode({ discountKind: 'PERCENTAGE', value: 20 });
        const fixedDiscount = await seedPromoCode({ discountKind: 'FIXED', value: 10_000 });
        await redeem(fixed, percentage.code);
        await expect(redeem(fixed, fixedDiscount.code)).resolves.toMatchObject({
            amountMinor: 70_000
        });
    });

    it('(f) rejects an acknowledgement that did not apply and writes no redemption', async () => {
        const subject = await setup(10_000);
        const code = await seedPromoCode({ discountKind: 'FIXED', value: 1_000 });
        vi.spyOn(subject.fake, 'changeAmount').mockResolvedValue({
            accepted: true,
            resourceId: subject.seeded.providerId!
        });
        await expect(redeem(subject, code.code)).rejects.toMatchObject({
            reason: 'PROMO_MUTATION_NOT_APPLIED'
        });
        expect(
            await getDb()
                .select()
                .from(promoRedemptions)
                .where(eq(promoRedemptions.promoCodeId, code.id))
        ).toHaveLength(0);
        expect(
            (await subject.fake.readAuthorization({ authorizationId: subject.seeded.providerId! }))
                .snapshot.amount.amountMinor
        ).toBe(10_000);
    });

    it('(g,h) rejects an ineligible payer and a code outside its vertical before provider mutation', async () => {
        const subject = await setup(10_000);
        const code = await seedPromoCode({
            discountKind: 'FIXED',
            value: 1_000,
            allVerticals: false,
            verticals: ['tourist']
        });
        const mutation = vi.spyOn(subject.fake, 'changeAmount');
        await expect(redeem(subject, code.code)).rejects.toMatchObject({
            reason: 'PROMO_CODE_NOT_FOR_VERTICAL'
        });
        const manual = await seedSubscription({
            paymentMethod: 'MANUAL',
            amountMinor: 10_000,
            withLink: true,
            fake: subject.fake
        });
        owned.push({ subscriptionId: manual.subscription.id, userId: manual.subscription.userId! });
        const manualPromo = await seedPromoCode({ discountKind: 'FIXED', value: 1_000 });
        await expect(
            redeemDiscountCode(
                {
                    userId: manual.subscription.userId!,
                    code: manualPromo.code,
                    vertical: 'accommodation'
                },
                { provider: subject.provider, clock: reconciliationClock }
            )
        ).rejects.toMatchObject({ reason: 'PROMO_NOT_OFFERED_TO_MANUAL_PAYER' });
        expect(mutation).not.toHaveBeenCalled();
    });

    it('(g) makes missing, foreign and paused subscriptions indistinguishable and rejects queued changes', async () => {
        const owner = await setup(10_000);
        const code = await seedPromoCode({ discountKind: 'FIXED', value: 1_000 });
        const mutation = vi.spyOn(owner.fake, 'changeAmount');
        const missingUserId = crypto.randomUUID();
        await expect(
            redeemDiscountCode(
                { userId: missingUserId, code: code.code, vertical: 'accommodation' },
                { provider: owner.provider, clock: reconciliationClock }
            )
        ).rejects.toMatchObject({ reason: 'PROMO_NO_ELIGIBLE_SUBSCRIPTION' });
        await expect(
            redeemDiscountCode(
                { userId: crypto.randomUUID(), code: code.code, vertical: 'accommodation' },
                { provider: owner.provider, clock: reconciliationClock }
            )
        ).rejects.toMatchObject({ reason: 'PROMO_NO_ELIGIBLE_SUBSCRIPTION' });

        const paused = await seedSubscription({
            status: 'PAUSED',
            amountMinor: 10_000,
            withLink: true,
            fake: owner.fake
        });
        owned.push({ subscriptionId: paused.subscription.id, userId: paused.subscription.userId! });
        await expect(
            redeemDiscountCode(
                { userId: paused.subscription.userId!, code: code.code, vertical: 'accommodation' },
                { provider: owner.provider, clock: reconciliationClock }
            )
        ).rejects.toMatchObject({ reason: 'PROMO_NO_ELIGIBLE_SUBSCRIPTION' });

        const [successor] = await getDb()
            .insert(subscriptions)
            .values({
                userId: owner.seeded.subscription.userId,
                vertical: 'accommodation',
                planVersionId: owner.seeded.subscription.planVersionId,
                billingOptionId: owner.seeded.subscription.billingOptionId,
                paymentMethod: 'CARD',
                status: 'ACTIVE',
                class: 'PRINCIPAL',
                succeedsId: owner.seeded.subscription.id
            })
            .returning({ id: subscriptions.id });
        if (!successor) throw new Error('Could not create succession fixture');
        owned.push({ subscriptionId: successor.id, userId: owner.seeded.subscription.userId! });
        await getDb()
            .update(subscriptions)
            .set({ succeededById: successor.id })
            .where(eq(subscriptions.id, owner.seeded.subscription.id));
        const authorization = await owner.fake.authorize({
            reference: successor.id,
            amount: { amountMinor: 10_000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'promo succession fixture',
            returnUrl: 'https://example.test/return'
        });
        await owner.fake.approve({ authorizationId: authorization.authorizationId });
        await getDb().insert(providerLinks).values({
            subscriptionId: successor.id,
            provider: 'MERCADO_PAGO',
            providerId: authorization.authorizationId
        });
        await expect(
            redeemDiscountCode(
                {
                    userId: owner.seeded.subscription.userId!,
                    code: code.code,
                    vertical: 'accommodation'
                },
                { provider: owner.provider, clock: reconciliationClock }
            )
        ).rejects.toMatchObject({ reason: 'PROMO_NO_ELIGIBLE_SUBSCRIPTION' });

        const queued = await setup(10_000);
        await seedScheduledChange({
            subscriptionId: queued.seeded.subscription.id,
            effectiveAt: new Date('2026-11-01T00:00:00.000Z')
        });
        await expect(redeem(queued, code.code)).rejects.toMatchObject({
            reason: 'PROMO_NO_ELIGIBLE_SUBSCRIPTION'
        });
        expect(mutation).not.toHaveBeenCalled();
    });

    it('(i) requires the new code to be stackable and usable, and every live code to be stackable', async () => {
        for (const newStackable of [false, true]) {
            for (const usable of [false, true]) {
                for (const liveStackable of [false, true]) {
                    const subject = await setup(100_000);
                    const first = await seedPromoCode({
                        discountKind: 'FIXED',
                        value: 1_000,
                        stackable: liveStackable
                    });
                    const second = await seedPromoCode({
                        discountKind: 'FIXED',
                        value: 1_000,
                        stackable: newStackable,
                        usableWithAnotherActive: usable
                    });
                    await redeem(subject, first.code);
                    const outcome = redeem(subject, second.code);
                    if (newStackable && usable && liveStackable)
                        await expect(outcome).resolves.toMatchObject({ amountMinor: 98_000 });
                    else
                        await expect(outcome).rejects.toMatchObject({
                            reason: 'PROMO_NOT_COMBINABLE'
                        });
                }
            }
        }
    });

    it('(j) rejects a repeat before a second mutation and serializes simultaneous redemptions', async () => {
        const repeat = await setup(20_000);
        const repeatCode = await seedPromoCode({ discountKind: 'FIXED', value: 1_000 });
        const repeatMutation = vi.spyOn(repeat.fake, 'changeAmount');
        await redeem(repeat, repeatCode.code);
        await expect(redeem(repeat, repeatCode.code)).rejects.toMatchObject({
            reason: 'PROMO_CODE_ALREADY_REDEEMED'
        });
        expect(repeatMutation).toHaveBeenCalledTimes(1);

        const race = await setup(30_000);
        const raceCode = await seedPromoCode({ discountKind: 'FIXED', value: 2_000 });
        const originalMutation = race.fake.changeAmount.bind(race.fake);
        const raceMutation = vi
            .spyOn(race.fake, 'changeAmount')
            .mockImplementation(async (input) => {
                await new Promise((resolve) => setTimeout(resolve, 50));
                return originalMutation(input);
            });
        const outcomes = await Promise.allSettled([
            redeem(race, raceCode.code),
            redeem(race, raceCode.code)
        ]);
        expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
        expect(outcomes.filter(({ status }) => status === 'rejected')).toHaveLength(1);
        expect(raceMutation).toHaveBeenCalledTimes(1);
        expect(
            await getDb()
                .select()
                .from(promoRedemptions)
                .where(eq(promoRedemptions.promoCodeId, raceCode.id))
        ).toHaveLength(1);
    });

    it('(k) keeps the provider floor synchronized without production fake imports', () => {
        expect(PROVIDER_AMOUNT_FLOOR_MINOR).toBe(FAKE_AMOUNT_FLOOR_MINOR);
    });
});
