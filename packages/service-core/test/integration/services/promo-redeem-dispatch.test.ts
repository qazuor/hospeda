import type { ExtendTrialArgs } from '@repo/billing-verticals-contract';
import { VerticalsForBillingSimulator } from '@repo/billing-verticals-contract/testing';
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
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { redeemPromoCode } from '../../../src/services';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import {
    createReconciliationFake,
    reconciliationClock,
    resetSeededReconciliationInventory,
    seedSubscription
} from './reconciliation-sweep-fixtures';
import { retirePromoFixtures, seedPromoCode } from './support/promo-fixtures';

const extensionDay = 24 * 60 * 60 * 1000;
const owned: Array<{ readonly subscriptionId: string; readonly userId: string }> = [];
const trialPromoIds: string[] = [];
afterAll(closeServiceTestPool);
beforeAll(() => {
    getServiceTestDb();
});
afterEach(async () => {
    await retirePromoFixtures();
    for (const promoCodeId of trialPromoIds.splice(0)) {
        await getDb().delete(promoRedemptions).where(eq(promoRedemptions.promoCodeId, promoCodeId));
        await getDb().delete(promoCodes).where(eq(promoCodes.id, promoCodeId));
    }
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

describe('TEST:B9b:6 AC:B9b:6 promo redemption dispatches by effect', () => {
    it('returns the same 404 for a missing code', async () => {
        const { provider } = createReconciliationFake(reconciliationClock);
        const simulator = new VerticalsForBillingSimulator({ clock: reconciliationClock });
        await expect(
            redeemPromoCode(
                {
                    userId: crypto.randomUUID(),
                    code: `missing-${crypto.randomUUID()}`,
                    vertical: VerticalEnum.ACCOMMODATION
                },
                {
                    provider,
                    clock: reconciliationClock,
                    extendTrial: (args) => simulator.extendTrial(args)
                }
            )
        ).rejects.toMatchObject({ code: 'NOT_FOUND', reason: 'PROMO_CODE_NOT_FOUND' });
    });

    it('redeems a discount and a trial extension for the same account', async () => {
        const { fake, provider } = createReconciliationFake(reconciliationClock);
        const seeded = await seedSubscription({ amountMinor: 10_000, withLink: true, fake });
        const userId = seeded.subscription.userId;
        if (!userId) throw new Error('Subscription fixture has no user');
        owned.push({ subscriptionId: seeded.subscription.id, userId });
        const simulator = new VerticalsForBillingSimulator({ clock: reconciliationClock });
        const initialEnd = new Date(reconciliationClock.now().getTime() + 10 * extensionDay);
        simulator.setTrial({
            userId,
            vertical: VerticalEnum.ACCOMMODATION,
            endsAt: initialEnd,
            remainingExtensionDays: 10
        });
        const trialCode = await seedTrialCode();
        const discountCode = await seedPromoCode({ discountKind: 'PERCENTAGE', value: 10 });
        const ports = {
            provider,
            clock: reconciliationClock,
            extendTrial: (args: ExtendTrialArgs) => simulator.extendTrial(args)
        };

        await expect(
            redeemPromoCode(
                { userId, code: trialCode.code, vertical: VerticalEnum.ACCOMMODATION },
                ports
            )
        ).resolves.toMatchObject({ kind: 'TRIAL_EXTENSION', outcome: 'REDEEMED', days: 5 });
        await expect(
            redeemPromoCode(
                { userId, code: discountCode.code, vertical: VerticalEnum.ACCOMMODATION },
                ports
            )
        ).resolves.toMatchObject({ kind: 'DISCOUNT' });
        expect(simulator.trialEndsAt({ userId, vertical: VerticalEnum.ACCOMMODATION })).toEqual(
            new Date(initialEnd.getTime() + 5 * extensionDay)
        );
    });
});

async function seedTrialCode() {
    const [code] = await getDb()
        .insert(promoCodes)
        .values({
            code: `TRIAL-${crypto.randomUUID()}`,
            effectKind: 'TRIAL_EXTENSION',
            extensionDays: 5,
            discountKind: null,
            value: null,
            allVerticals: true,
            verticals: null,
            totalQuota: 10,
            validFrom: new Date('2026-01-01T00:00:00.000Z'),
            validUntil: new Date('2027-01-01T00:00:00.000Z'),
            stackable: false,
            usableWithAnotherActive: false,
            durationKind: null,
            durationCharges: null
        })
        .returning();
    if (!code) throw new Error('Could not seed extension code');
    trialPromoIds.push(code.id);
    return code;
}
