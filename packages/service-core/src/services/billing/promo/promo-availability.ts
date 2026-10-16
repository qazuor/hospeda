import type { DrizzleClient } from '@repo/db';
import { promoRedemptions } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { eq, sql } from 'drizzle-orm';
import { ServiceError } from '../../../types/index.js';
import { PromoRedemptionReason } from './promo-redemption-reasons.js';

/**
 * Enforces AC:B9b:3 and DEC-PROMO-001 while the caller holds the promo-code lock.
 * The window is semi-open; NULL quota and end date mean no cap (H1/H2/H3).
 * @throws ServiceError VALIDATION_ERROR `PROMO_CODE_NOT_AVAILABLE` when outside
 *   the validity window or the total redemption quota has been reached.
 */
export async function assertPromoCodeAvailable(input: {
    readonly tx: DrizzleClient;
    readonly promo: {
        readonly id: string;
        readonly totalQuota: number | null;
        readonly validFrom: Date;
        readonly validUntil: Date | null;
    };
    readonly now: Date;
}): Promise<void> {
    if (
        input.now < input.promo.validFrom ||
        (input.promo.validUntil !== null && input.now >= input.promo.validUntil)
    ) {
        unavailable();
    }
    if (input.promo.totalQuota === null) return;
    const [redemptions] = await input.tx
        .select({ count: sql<number>`count(*)::int` })
        .from(promoRedemptions)
        .where(eq(promoRedemptions.promoCodeId, input.promo.id));
    if ((redemptions?.count ?? 0) >= input.promo.totalQuota) unavailable();
}

function unavailable(): never {
    throw new ServiceError(
        ServiceErrorCode.VALIDATION_ERROR,
        PromoRedemptionReason.PROMO_CODE_NOT_AVAILABLE,
        undefined,
        PromoRedemptionReason.PROMO_CODE_NOT_AVAILABLE
    );
}
