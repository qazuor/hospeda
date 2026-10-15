import { eq, getDb, promoCodes, promoRedemptions } from '@repo/db';

const created: Array<{ readonly redemptionId: string; readonly promoCodeId: string }> = [];

/** Seeds one unique discount code and redemption for reconciliation tests. */
export async function seedPromoRedemption(input: {
    readonly subscriptionId: string;
    readonly userId: string;
    readonly discountKind: 'PERCENTAGE' | 'FIXED';
    readonly value: number;
    readonly remainingCharges: number | null;
    readonly redeemedAt?: Date;
    readonly durationKind?: 'FIRST_CHARGE' | 'N_CHARGES' | 'FOREVER';
    readonly stackable?: boolean;
    readonly usableWithAnotherActive?: boolean;
}) {
    const db = getDb();
    const durationKind = input.durationKind ?? 'N_CHARGES';
    const durationCharges =
        durationKind === 'FOREVER' ? null : durationKind === 'FIRST_CHARGE' ? 1 : 2;
    const [code] = await db
        .insert(promoCodes)
        .values({
            code: `B9B-${crypto.randomUUID()}`,
            discountKind: input.discountKind,
            value: input.value,
            allVerticals: true,
            verticals: null,
            totalQuota: 10,
            validFrom: new Date('2026-01-01T00:00:00.000Z'),
            validUntil: new Date('2027-01-01T00:00:00.000Z'),
            stackable: input.stackable ?? true,
            usableWithAnotherActive: input.usableWithAnotherActive ?? true,
            durationKind,
            durationCharges
        })
        .returning({ id: promoCodes.id });
    if (!code) throw new Error('Promo code fixture failed');

    const [redemption] = await db
        .insert(promoRedemptions)
        .values({
            promoCodeId: code.id,
            userId: input.userId,
            subscriptionId: input.subscriptionId,
            redeemedAt: input.redeemedAt ?? new Date(),
            remainingCharges: input.remainingCharges
        })
        .returning({ id: promoRedemptions.id });
    if (!redemption) throw new Error('Promo redemption fixture failed');
    created.push({ redemptionId: redemption.id, promoCodeId: code.id });
    return { redemptionId: redemption.id, promoCodeId: code.id };
}

/** Removes only promo rows created by this test fixture. */
export async function retirePromoFixtures(): Promise<void> {
    const db = getDb();
    for (const fixture of created.splice(0)) {
        await db.delete(promoRedemptions).where(eq(promoRedemptions.id, fixture.redemptionId));
        await db.delete(promoCodes).where(eq(promoCodes.id, fixture.promoCodeId));
    }
}
