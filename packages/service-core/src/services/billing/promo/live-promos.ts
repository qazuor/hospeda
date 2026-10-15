import {
    and,
    asc,
    type DrizzleClient,
    eq,
    getDb,
    gt,
    isNull,
    lte,
    or,
    promoCodes,
    promoRedemptions
} from '@repo/db';

/** A discount redemption that still has a charge available at the requested cut. */
export interface LivePromo {
    readonly redemptionId: string;
    readonly promoCodeId: string;
    readonly discountKind: 'PERCENTAGE' | 'FIXED';
    readonly value: number;
    readonly remainingCharges: number | null;
    readonly redeemedAt: Date;
    readonly stackable: boolean;
    readonly usableWithAnotherActive: boolean;
}

/**
 * Reads a subscription's unexhausted discount redemptions in stable order.
 * A temporal cut excludes redemptions created after a charge was registered.
 */
export async function readLivePromos(input: {
    readonly subscriptionId: string;
    readonly at?: Date;
    readonly executor?: DrizzleClient;
}): Promise<readonly LivePromo[]> {
    const db = input.executor ?? getDb();
    const predicates = [
        eq(promoRedemptions.subscriptionId, input.subscriptionId),
        eq(promoCodes.effectKind, 'DISCOUNT'),
        or(isNull(promoRedemptions.remainingCharges), gt(promoRedemptions.remainingCharges, 0))
    ];
    if (input.at) predicates.push(lte(promoRedemptions.redeemedAt, input.at));

    const rows = await db
        .select({
            redemptionId: promoRedemptions.id,
            promoCodeId: promoCodes.id,
            discountKind: promoCodes.discountKind,
            value: promoCodes.value,
            remainingCharges: promoRedemptions.remainingCharges,
            redeemedAt: promoRedemptions.redeemedAt,
            stackable: promoCodes.stackable,
            usableWithAnotherActive: promoCodes.usableWithAnotherActive
        })
        .from(promoRedemptions)
        .innerJoin(promoCodes, eq(promoCodes.id, promoRedemptions.promoCodeId))
        .where(and(...predicates))
        .orderBy(asc(promoRedemptions.redeemedAt), asc(promoRedemptions.id));

    return rows.flatMap((row) => {
        const { discountKind, value } = row;
        if ((discountKind !== 'PERCENTAGE' && discountKind !== 'FIXED') || value === null) {
            return [];
        }
        return [{ ...row, discountKind, value }];
    });
}
