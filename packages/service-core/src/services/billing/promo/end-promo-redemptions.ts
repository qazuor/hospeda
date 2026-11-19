import { type PromoRedemptionEndReason, promoRedemptions, sql } from '@repo/db';

/**
 * HOS-2352: the `promo_redemption` update that ends a subscription's promos
 * before their charges run out (a queued downgrade, an S37 retirement). It
 * zeroes today's counter and records when and why, so the reconciliation can
 * still tell that the promos were in force for every charge made before
 * `endedAt`. A redemption that was already ended keeps its first end.
 *
 * `scripts/check-promo-redemption-end.ts` fails any writer that zeroes
 * `remainingCharges` without going through this function.
 *
 * @param input.endedAt - The instant the writer decided the end
 * @param input.reason - Why the promos end
 * @returns The `.set()` payload for `promoRedemptions`
 */
export function endPromoRedemptions(input: {
    readonly endedAt: Date;
    readonly reason: PromoRedemptionEndReason;
}) {
    return {
        remainingCharges: 0,
        endedAt: sql<Date>`coalesce(${promoRedemptions.endedAt}, ${input.endedAt.toISOString()}::timestamptz)`,
        endedReason: sql<string>`coalesce(${promoRedemptions.endedReason}, ${input.reason})`
    } as const;
}
