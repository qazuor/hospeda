import type { DrizzleClient } from '@repo/db';
import { promoRedemptions } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { eq, sql } from 'drizzle-orm';
import { ServiceError } from '../../../types/index.js';
import { PromoRedemptionReason } from './promo-redemption-reasons.js';

/** Possible availability states for a promotional code. */
export const PROMO_CODE_AVAILABILITIES = [
    'OPEN',
    'CLOSED',
    'NOT_YET_VALID',
    'EXPIRED',
    'EXHAUSTED'
] as const;

/** Availability state resolved for a promotional code. */
export type PromoCodeAvailability = (typeof PROMO_CODE_AVAILABILITIES)[number];

/**
 * Resolve promotional code availability in the single place shared by redemption and the admin editor (B/19 §1).
 * @param input Code state, redemption count and evaluation time.
 * @returns The state using the canonical precedence.
 */
export function resolvePromoCodeAvailability(input: {
    readonly promo: {
        readonly closedAt: Date | null;
        readonly validFrom: Date;
        readonly validUntil: Date | null;
        readonly totalQuota: number | null;
    };
    readonly redemptionCount: number;
    readonly now: Date;
}): PromoCodeAvailability {
    if (input.promo.closedAt !== null) return 'CLOSED';
    if (input.now < input.promo.validFrom) return 'NOT_YET_VALID';
    if (input.promo.validUntil !== null && input.now >= input.promo.validUntil) return 'EXPIRED';
    if (input.promo.totalQuota !== null && input.redemptionCount >= input.promo.totalQuota)
        return 'EXHAUSTED';
    return 'OPEN';
}

/** Enforces promo availability while the caller holds the promo-code lock. */
export async function assertPromoCodeAvailable(input: {
    readonly tx: DrizzleClient;
    readonly promo: {
        readonly id: string;
        readonly closedAt: Date | null;
        readonly totalQuota: number | null;
        readonly validFrom: Date;
        readonly validUntil: Date | null;
    };
    readonly now: Date;
}): Promise<void> {
    let redemptionCount = 0;
    if (input.promo.totalQuota !== null) {
        const [redemptions] = await input.tx
            .select({ count: sql<number>`count(*)::int` })
            .from(promoRedemptions)
            .where(eq(promoRedemptions.promoCodeId, input.promo.id));
        redemptionCount = redemptions?.count ?? 0;
    }
    if (
        resolvePromoCodeAvailability({
            promo: input.promo,
            redemptionCount,
            now: input.now
        }) !== 'OPEN'
    ) {
        unavailable();
    }
}

function unavailable(): never {
    throw new ServiceError(
        ServiceErrorCode.VALIDATION_ERROR,
        PromoRedemptionReason.PROMO_CODE_NOT_AVAILABLE,
        undefined,
        PromoRedemptionReason.PROMO_CODE_NOT_AVAILABLE
    );
}
