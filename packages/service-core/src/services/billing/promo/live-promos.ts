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
    promoRedemptionCharges,
    promoRedemptions,
    sql
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

/**
 * HOS-2352 (AC:B11:11, B/14 §2.4): reads the discount redemptions that were in
 * force when a charge was made at `at`, instead of today's counters.
 *
 * A redemption was in force at `at` when it was redeemed at or before `at`, no
 * writer had ended it by then (`ended_at` NULL or after `at`), and it still had
 * a charge left: `initial_charges` is NULL (unlimited) or larger than the
 * ledger rows (`promo_redemption_charge`) of charges made strictly before `at`.
 * A row written without `initial_charges` and never ended falls back to
 * today's counter plus every charge the ledger recorded, which is the same
 * number when nothing zeroed it.
 */
export async function readPromosInForceAt(input: {
    readonly subscriptionId: string;
    readonly at: Date;
    readonly executor?: DrizzleClient;
}): Promise<readonly LivePromo[]> {
    const db = input.executor ?? getDb();
    const spentBefore = sql<number>`(select count(*)::int from ${promoRedemptionCharges} where ${promoRedemptionCharges.redemptionId} = ${promoRedemptions.id} and ${promoRedemptionCharges.chargeCreatedAt} < ${input.at})`;
    const spentTotal = sql<number>`(select count(*)::int from ${promoRedemptionCharges} where ${promoRedemptionCharges.redemptionId} = ${promoRedemptions.id})`;
    const rows = await db
        .select({
            redemptionId: promoRedemptions.id,
            promoCodeId: promoCodes.id,
            discountKind: promoCodes.discountKind,
            value: promoCodes.value,
            remainingCharges: promoRedemptions.remainingCharges,
            initialCharges: promoRedemptions.initialCharges,
            endedAt: promoRedemptions.endedAt,
            redeemedAt: promoRedemptions.redeemedAt,
            stackable: promoCodes.stackable,
            usableWithAnotherActive: promoCodes.usableWithAnotherActive,
            spentBefore,
            spentTotal
        })
        .from(promoRedemptions)
        .innerJoin(promoCodes, eq(promoCodes.id, promoRedemptions.promoCodeId))
        .where(
            and(
                eq(promoRedemptions.subscriptionId, input.subscriptionId),
                eq(promoCodes.effectKind, 'DISCOUNT'),
                lte(promoRedemptions.redeemedAt, input.at),
                or(isNull(promoRedemptions.endedAt), gt(promoRedemptions.endedAt, input.at))
            )
        )
        .orderBy(asc(promoRedemptions.redeemedAt), asc(promoRedemptions.id));

    return rows.flatMap((row) => {
        const { discountKind, value } = row;
        if ((discountKind !== 'PERCENTAGE' && discountKind !== 'FIXED') || value === null) {
            return [];
        }
        // NULL initial charges means unlimited. A row an older writer left without
        // them falls back to today's counter plus the charges the ledger recorded,
        // unless a writer ended it: its zeroed counter then says nothing about `at`.
        const initial =
            row.initialCharges ??
            (row.remainingCharges === null || row.endedAt !== null
                ? null
                : row.remainingCharges + Number(row.spentTotal));
        const remainingAtCharge = initial === null ? null : initial - Number(row.spentBefore);
        if (remainingAtCharge !== null && remainingAtCharge <= 0) return [];
        return [
            {
                redemptionId: row.redemptionId,
                promoCodeId: row.promoCodeId,
                discountKind,
                value,
                remainingCharges: remainingAtCharge,
                redeemedAt: row.redeemedAt,
                stackable: row.stackable,
                usableWithAnotherActive: row.usableWithAnotherActive
            }
        ];
    });
}
