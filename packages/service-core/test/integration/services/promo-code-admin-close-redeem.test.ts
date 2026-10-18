import { and, eq, getDb, promoRedemptions, providerLinks, subscriptions } from '@repo/db';
import { PermissionEnum, VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
    closePromoCode,
    readLivePromos,
    redeemDiscountCode,
    redeemTrialExtensionCode
} from '../../../src/services';
import type { Actor } from '../../../src/types/index.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import {
    createReconciliationFake,
    reconciliationClock,
    seedSubscription
} from './reconciliation-sweep-fixtures';
import { retirePromoFixtures, seedPromoCode } from './support/promo-fixtures';

const clock = reconciliationClock;
const owned: Array<{ readonly subscriptionId: string; readonly userId: string }> = [];
beforeAll(() => {
    getServiceTestDb();
});
afterAll(closeServiceTestPool);
afterEach(async () => {
    await retirePromoFixtures();
    for (const row of owned.splice(0)) {
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
});

async function setup(fake?: ReturnType<typeof createReconciliationFake>['fake']) {
    const { fake: localFake, provider } = fake
        ? {
              fake,
              provider: fake as unknown as ReturnType<typeof createReconciliationFake>['provider']
          }
        : createReconciliationFake(clock);
    const seeded = await seedSubscription({
        amountMinor: 250_000,
        withLink: true,
        fake: localFake
    });
    owned.push({ subscriptionId: seeded.subscription.id, userId: seeded.subscription.userId! });
    return {
        fake: localFake,
        provider,
        seeded,
        actor: {
            id: seeded.subscription.userId!,
            roles: [],
            permissions: [PermissionEnum.BILLING_MANAGE_PROMO_CODES]
        } satisfies Actor
    };
}

describe('TEST:B9b:9 (support) AC:B9b:9 HOS-1591 closing a code rejects the next redemption and keeps the redeemed ones', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        '(g) closes after a real discount redemption without changing it or mutating the next subscriber',
        async () => {
            const promo = await seedPromoCode({
                discountKind: 'FIXED',
                value: 1_000,
                durationKind: 'N_CHARGES'
            });
            const { fake } = createReconciliationFake(clock);
            const first = await setup(fake);
            const second = await setup(fake);
            await redeemDiscountCode(
                {
                    userId: first.seeded.subscription.userId!,
                    code: promo.code,
                    vertical: VerticalEnum.ACCOMMODATION
                },
                { provider: first.provider, clock }
            );
            const [before] = await getDb()
                .select()
                .from(promoRedemptions)
                .where(eq(promoRedemptions.promoCodeId, promo.id));
            expect(before).toBeDefined();
            await closePromoCode({ actor: first.actor, promoCodeId: promo.id }, { clock });
            const [after] = await getDb()
                .select()
                .from(promoRedemptions)
                .where(eq(promoRedemptions.id, before!.id));
            expect(after?.remainingCharges).toBe(before?.remainingCharges);
            expect(await readLivePromos({ subscriptionId: first.seeded.subscription.id })).toEqual([
                expect.objectContaining({
                    redemptionId: before!.id,
                    remainingCharges: before!.remainingCharges
                })
            ]);
            const mutate = vi.spyOn(fake, 'changeAmount');
            const amountBefore = (
                await fake.readAuthorization({ authorizationId: second.seeded.providerId! })
            ).snapshot.amount.amountMinor;
            await expect(
                redeemDiscountCode(
                    {
                        userId: second.seeded.subscription.userId!,
                        code: promo.code,
                        vertical: VerticalEnum.ACCOMMODATION
                    },
                    { provider: second.provider, clock }
                )
            ).rejects.toMatchObject({ reason: 'PROMO_CODE_NOT_AVAILABLE' });
            expect(mutate).not.toHaveBeenCalled();
            expect(
                (await fake.readAuthorization({ authorizationId: second.seeded.providerId! }))
                    .snapshot.amount.amountMinor
            ).toBe(amountBefore);
            expect(
                await getDb()
                    .select()
                    .from(promoRedemptions)
                    .where(eq(promoRedemptions.promoCodeId, promo.id))
            ).toHaveLength(1);
            expect(
                await getDb()
                    .select()
                    .from(promoRedemptions)
                    .where(
                        and(
                            eq(promoRedemptions.promoCodeId, promo.id),
                            eq(promoRedemptions.userId, second.seeded.subscription.userId!)
                        )
                    )
            ).toHaveLength(0);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(h) rejects a closed trial extension before calling extendTrial',
        async () => {
            const promo = await seedPromoCode({ effectKind: 'TRIAL_EXTENSION', extensionDays: 10 });
            const first = await setup();
            const second = await setup();
            await closePromoCode({ actor: first.actor, promoCodeId: promo.id }, { clock });
            const extendTrial = vi.fn(async () => ({ outcome: 'ACCEPTED' as const }));
            await expect(
                redeemTrialExtensionCode(
                    {
                        userId: second.seeded.subscription.userId!,
                        code: promo.code,
                        vertical: VerticalEnum.ACCOMMODATION
                    },
                    { extendTrial, clock }
                )
            ).rejects.toMatchObject({ reason: 'PROMO_CODE_NOT_AVAILABLE' });
            expect(extendTrial).not.toHaveBeenCalled();
        }
    );
});
