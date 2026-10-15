import type { Clock, VerticalsForBilling } from '@repo/billing-verticals-contract';
import { getDb, promoCodes, promoRedemptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode, type Vertical } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { ServiceError } from '../../../types/index.js';
import { PromoRedemptionReason } from './promo-redemption-reasons.js';

const logger = createLogger('redeem-trial-extension-code');

/**
 * Redeems a trial-extension promo code: validates the code, calls the verticals
 * trial-extension port (idempotent via `redemptionKey`), and records the redemption.
 *
 * Does not hold a database transaction — the code lookup, the vertical call, and the
 * redemption insert each open their own boundaries.
 *
 * @param input - The user id, promo code string, and vertical.
 * @param ports - The vertical trial-extension port and a wall-clock for timestamps.
 * @returns The redemption outcome: rejected with a reason, or redeemed with days and
 *   a replay flag.
 * @throws ServiceError NOT_FOUND `PROMO_CODE_NOT_FOUND` when the code does not exist;
 *   VALIDATION_ERROR `PROMO_CODE_NOT_A_TRIAL_EXTENSION` | `PROMO_CODE_NOT_FOR_VERTICAL`
 *   when the code's effect kind or vertical does not match.
 */
export async function redeemTrialExtensionCode(
    input: { readonly userId: string; readonly code: string; readonly vertical: Vertical },
    ports: { readonly extendTrial: VerticalsForBilling['extendTrial']; readonly clock: Clock }
): Promise<
    | { readonly outcome: 'REJECTED'; readonly reason: string }
    | { readonly outcome: 'REDEEMED'; readonly days: number; readonly replay: boolean }
> {
    const [promo] = await getDb()
        .select()
        .from(promoCodes)
        .where(eq(promoCodes.code, input.code.trim()))
        .limit(1);
    if (!promo) {
        throw new ServiceError(
            ServiceErrorCode.NOT_FOUND,
            PromoRedemptionReason.PROMO_CODE_NOT_FOUND,
            undefined,
            PromoRedemptionReason.PROMO_CODE_NOT_FOUND
        );
    }
    if (promo.effectKind !== 'TRIAL_EXTENSION') {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            PromoRedemptionReason.PROMO_CODE_NOT_A_TRIAL_EXTENSION,
            undefined,
            PromoRedemptionReason.PROMO_CODE_NOT_A_TRIAL_EXTENSION
        );
    }
    if (!promo.allVerticals && !(promo.verticals ?? []).includes(input.vertical)) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            PromoRedemptionReason.PROMO_CODE_NOT_FOR_VERTICAL,
            undefined,
            PromoRedemptionReason.PROMO_CODE_NOT_FOR_VERTICAL
        );
    }
    if (promo.extensionDays === null || promo.extensionDays < 1) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Trial extension code has invalid days'
        );
    }

    const days = promo.extensionDays;
    const redemptionKey = `promo-redemption:${promo.id}:${input.userId}`;
    const response = await ports.extendTrial({
        userId: input.userId,
        vertical: input.vertical,
        days,
        redemptionKey
    });
    if (response.outcome === 'REJECTED') {
        return { outcome: 'REJECTED', reason: response.reason };
    }

    const [redemption] = await getDb()
        .insert(promoRedemptions)
        .values({
            promoCodeId: promo.id,
            userId: input.userId,
            subscriptionId: null,
            remainingCharges: null,
            redeemedAt: ports.clock.now()
        })
        .onConflictDoNothing({ target: [promoRedemptions.promoCodeId, promoRedemptions.userId] })
        .returning({ id: promoRedemptions.id });
    const replay = redemption === undefined;
    logger.info(
        { userId: input.userId, promoCodeId: promo.id, days, replay },
        'Trial extension code redeemed'
    );
    return { outcome: 'REDEEMED', days, replay };
}
