import {
    eq,
    getDb,
    promoRedemptions,
    providerLinks,
    reconciliationMarkModel,
    reconciliationMarkPayments,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { redeemDiscountCode } from '../../../src/services';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import {
    createReconciliationFake,
    reconciliationClock,
    resetSeededReconciliationInventory,
    seedSubscription
} from './reconciliation-sweep-fixtures';
import { retirePromoFixtures, seedPromoCode } from './support/promo-fixtures';

const owned: Array<{ subscriptionId: string; userId: string }> = [];
beforeAll(() => {
    getServiceTestDb();
});
afterAll(closeServiceTestPool);
afterEach(async () => {
    await retirePromoFixtures();
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

async function setup(
    sharedFake?: ReturnType<typeof createReconciliationFake>['fake'],
    amountMinor = 250_000
) {
    const { fake, provider } = sharedFake
        ? {
              fake: sharedFake,
              provider: sharedFake as unknown as ReturnType<
                  typeof createReconciliationFake
              >['provider']
          }
        : createReconciliationFake(reconciliationClock);
    const seeded = await seedSubscription({ amountMinor, withLink: true, fake });
    owned.push({ subscriptionId: seeded.subscription.id, userId: seeded.subscription.userId! });
    return { fake, provider, seeded };
}

async function redeem(input: Awaited<ReturnType<typeof setup>>, code: string) {
    return redeemDiscountCode(
        { userId: input.seeded.subscription.userId!, code, vertical: 'accommodation' },
        { provider: input.provider, clock: reconciliationClock }
    );
}

describe('TEST:B9b:3 AC:B9b:3 quota, validity window and one use per person', () => {
    it('(a) rejects redemption quota plus one, while NULL quota and end date have no cap', async () => {
        const promo = await seedPromoCode({
            discountKind: 'FIXED',
            value: 1_000,
            totalQuota: 2,
            validUntil: null
        });
        const { fake } = createReconciliationFake(reconciliationClock);
        const first = await setup(fake);
        const second = await setup(fake);
        const third = await setup(fake);
        const mutate = vi.spyOn(fake, 'changeAmount');
        await redeem(first, promo.code);
        await redeem(second, promo.code);
        await expect(redeem(third, promo.code)).rejects.toMatchObject({
            reason: 'PROMO_CODE_NOT_AVAILABLE'
        });
        expect(mutate).toHaveBeenCalledTimes(2);
        expect(
            await getDb()
                .select()
                .from(promoRedemptions)
                .where(eq(promoRedemptions.promoCodeId, promo.id))
        ).toHaveLength(2);
        const unlimited = await seedPromoCode({
            discountKind: 'FIXED',
            value: 1_000,
            totalQuota: null,
            validUntil: null
        });
        const unlimitedSetup = await setup();
        await redeem(unlimitedSetup, unlimited.code);
        expect(
            await getDb()
                .select()
                .from(promoRedemptions)
                .where(eq(promoRedemptions.promoCodeId, unlimited.id))
        ).toHaveLength(1);
    });

    it('(e) serializes five distinct discount redeemers against a quota of two', async () => {
        const promo = await seedPromoCode({ discountKind: 'FIXED', value: 1_000, totalQuota: 2 });
        const { fake } = createReconciliationFake(reconciliationClock);
        const inputs = [];
        for (let index = 0; index < 5; index += 1) inputs.push(await setup(fake));
        const originalMutation = fake.changeAmount.bind(fake);
        const mutate = vi.spyOn(fake, 'changeAmount');
        mutate.mockImplementation(async (input) => {
            await new Promise((resolve) => setTimeout(resolve, 50));
            return originalMutation(input);
        });
        const results = await Promise.allSettled(inputs.map((input) => redeem(input, promo.code)));
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
        expect(results.filter((result) => result.status === 'rejected')).toHaveLength(3);
        expect(mutate).toHaveBeenCalledTimes(2);
        expect(
            await getDb()
                .select()
                .from(promoRedemptions)
                .where(eq(promoRedemptions.promoCodeId, promo.id))
        ).toHaveLength(2);
    });

    it('(f) a rejected provider-floor redemption does not consume the only quota slot', async () => {
        const promo = await seedPromoCode({ discountKind: 'FIXED', value: 3_600, totalQuota: 1 });
        const { fake } = createReconciliationFake(reconciliationClock);
        const belowFloor = await setup(fake, 5_000);
        const accepted = await setup(fake, 10_000);
        await expect(redeem(belowFloor, promo.code)).rejects.toMatchObject({
            reason: 'PROMO_BELOW_PROVIDER_MINIMUM'
        });
        await redeem(accepted, promo.code);
        expect(
            await getDb()
                .select()
                .from(promoRedemptions)
                .where(eq(promoRedemptions.promoCodeId, promo.id))
        ).toHaveLength(1);
    });

    it('(b) enforces the semi-open validity window at both boundaries', async () => {
        const clock = { now: () => new Date('2026-10-11T12:00:00.000Z') };
        const before = await seedPromoCode({
            discountKind: 'FIXED',
            value: 1_000,
            validFrom: new Date('2026-10-11T12:00:00.001Z')
        });
        const expired = await seedPromoCode({
            discountKind: 'FIXED',
            value: 1_000,
            validUntil: new Date('2026-10-11T12:00:00.000Z')
        });
        const valid = await seedPromoCode({
            discountKind: 'FIXED',
            value: 1_000,
            validUntil: new Date('2026-10-11T12:00:00.001Z')
        });
        const a = await setup();
        const b = await setup();
        const c = await setup();
        await expect(
            redeemDiscountCode(
                {
                    userId: a.seeded.subscription.userId!,
                    code: before.code,
                    vertical: 'accommodation'
                },
                { provider: a.provider, clock }
            )
        ).rejects.toMatchObject({ reason: 'PROMO_CODE_NOT_AVAILABLE' });
        await expect(
            redeemDiscountCode(
                {
                    userId: b.seeded.subscription.userId!,
                    code: expired.code,
                    vertical: 'accommodation'
                },
                { provider: b.provider, clock }
            )
        ).rejects.toMatchObject({ reason: 'PROMO_CODE_NOT_AVAILABLE' });
        await redeemDiscountCode(
            { userId: c.seeded.subscription.userId!, code: valid.code, vertical: 'accommodation' },
            { provider: c.provider, clock }
        );
    });

    it('(c,g) rejects repeat use before availability and availability before subscription eligibility', async () => {
        const promo = await seedPromoCode({ discountKind: 'FIXED', value: 1_000, totalQuota: 1 });
        const first = await setup();
        const noSubscription = await setup();
        await redeem(first, promo.code);
        const amountBefore = (
            await first.fake.readAuthorization({ authorizationId: first.seeded.providerId! })
        ).snapshot.amount.amountMinor;
        await expect(redeem(first, promo.code)).rejects.toMatchObject({
            reason: 'PROMO_CODE_ALREADY_REDEEMED'
        });
        expect(
            (await first.fake.readAuthorization({ authorizationId: first.seeded.providerId! }))
                .snapshot.amount.amountMinor
        ).toBe(amountBefore);
        await getDb()
            .update(subscriptions)
            .set({ status: 'ABANDONED' })
            .where(eq(subscriptions.id, noSubscription.seeded.subscription.id));
        await expect(redeem(noSubscription, promo.code)).rejects.toMatchObject({
            reason: 'PROMO_CODE_NOT_AVAILABLE'
        });
    });
});
