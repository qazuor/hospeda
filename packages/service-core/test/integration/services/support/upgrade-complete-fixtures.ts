import {
    addonInstances,
    billingOptions,
    courtesyGrants,
    emailOutbox,
    eq,
    promoCodes,
    promoRedemptions,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { getServiceTestDb } from '../helpers.js';
import { seedOrphanInstance } from './addon-orphan-fixtures.js';
import { retireS17, s17Now, seedS17 } from './succession-s17-fixtures.js';

const owned: {
    grantId: string;
    addonId: string;
    redemptionId: string;
    promoId: string;
    userId: string;
    subscriptionIds: readonly string[];
}[] = [];

/** Seeds the real fake-provider S17 fixture with the assets S18 must dispose or move. */
export async function seedUpgradeCase(input: { readonly cycle?: 'monthly' | 'annual' } = {}) {
    const base = await seedS17({ successorStatus: 'PENDING_AUTHORIZATION' });
    const db = getServiceTestDb();
    if (input.cycle === 'annual') {
        const [successor] = await db
            .select({ planVersionId: subscriptions.planVersionId })
            .from(subscriptions)
            .where(eq(subscriptions.id, base.successorId));
        if (!successor?.planVersionId) throw new Error('Successor plan version missing');
        const [option] = await db
            .insert(billingOptions)
            .values({
                planVersionId: successor.planVersionId,
                cycle: 'annual',
                amount: 2500000,
                currency: 'ARS'
            })
            .returning({ id: billingOptions.id });
        if (!option) throw new Error('Annual option missing');
        await db
            .update(subscriptions)
            .set({ billingOptionId: option.id })
            .where(eq(subscriptions.id, base.successorId));
    }
    const [predecessor] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, base.predecessorId));
    if (!predecessor) throw new Error('Predecessor missing');
    const addon = await seedOrphanInstance(db, {
        ownerId: base.userId,
        scopeType: 'VERTICAL_SUBSCRIPTION',
        compatibleVerticals: ['accommodation'],
        status: 'ACTIVE',
        targetId: base.predecessorId
    });
    const [promo] = await db
        .insert(promoCodes)
        .values({
            code: `upgrade-${crypto.randomUUID()}`,
            discountKind: 'FIXED',
            value: 100,
            allVerticals: true,
            stackable: false,
            usableWithAnotherActive: false,
            durationKind: 'N_CHARGES',
            durationCharges: 3
        })
        .returning({ id: promoCodes.id });
    if (!promo) throw new Error('Promo missing');
    const [redemption] = await db
        .insert(promoRedemptions)
        .values({
            promoCodeId: promo.id,
            userId: base.userId,
            redeemedAt: s17Now,
            subscriptionId: base.predecessorId,
            remainingCharges: 2
        })
        .returning({ id: promoRedemptions.id });
    if (!redemption) throw new Error('Redemption missing');
    const startsAt = new Date('2026-10-01T12:00:00.000Z');
    const endsAt = new Date('2027-01-22T12:00:00.000Z');
    const [grant] = await db
        .insert(courtesyGrants)
        .values({
            beneficiaryUserId: base.userId,
            grantedBy: base.userId,
            subscriptionId: base.predecessorId,
            months: 4,
            startsAt,
            endsAt,
            reason: 'fixture'
        })
        .returning({ id: courtesyGrants.id });
    if (!grant) throw new Error('Grant missing');
    owned.push({
        grantId: grant.id,
        addonId: addon.instanceId,
        redemptionId: redemption.id,
        promoId: promo.id,
        userId: base.userId,
        subscriptionIds: [base.predecessorId, base.successorId]
    });
    return { ...base, addonId: addon.instanceId, grantId: grant.id, redemptionId: redemption.id };
}

/** Deletes the extra rows created by a case before retiring its S17 fixture. */
export async function retireUpgradeCase(): Promise<void> {
    const db = getServiceTestDb();
    // S17 owns user/subscription cleanup; remove only children created by this fixture.
    for (const row of owned.splice(0)) {
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, row.userId));
        await db
            .delete(subscriptionPauses)
            .where(eq(subscriptionPauses.subscriptionId, row.subscriptionIds[1]!));
        await db.delete(promoRedemptions).where(eq(promoRedemptions.id, row.redemptionId));
        await db.delete(promoCodes).where(eq(promoCodes.id, row.promoId));
        await db.delete(courtesyGrants).where(eq(courtesyGrants.id, row.grantId));
        await db.delete(addonInstances).where(eq(addonInstances.id, row.addonId));
    }
    await retireS17();
}
