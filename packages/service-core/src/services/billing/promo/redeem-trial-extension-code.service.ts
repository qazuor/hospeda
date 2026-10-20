import type { Clock, VerticalsForBilling } from '@repo/billing-verticals-contract';
import { getDb, promoCodes, promoRedemptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import { ServiceErrorCode, type Vertical } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { ServiceError } from '../../../types/index.js';
import { assertPromoCodeAvailable } from './promo-availability.js';
import { PromoRedemptionReason } from './promo-redemption-reasons.js';
import { assertNotRedeemed } from './redeem-discount-eligibility.js';

const logger = createLogger('redeem-trial-extension-code');

/**
 * Redeems a trial-extension promo code under a transaction and code-row lock.
 * The extension port keeps its own transaction; the redemption is recorded here
 * only after it accepts, using the same deterministic idempotency key.
 * @param input - The user id, promo code string, and vertical.
 * @param ports - The vertical trial-extension port and a wall-clock for timestamps.
 * @returns A rejected reason or accepted extension days and replay flag.
 * @throws ServiceError NOT_FOUND `PROMO_CODE_NOT_FOUND`, VALIDATION_ERROR for an
 *   invalid effect, vertical, or unavailable code, or ALREADY_EXISTS when used.
 */
export async function redeemTrialExtensionCode(
    input: { readonly userId: string; readonly code: string; readonly vertical: Vertical },
    ports: { readonly extendTrial: VerticalsForBilling['extendTrial']; readonly clock: Clock }
): Promise<
    | { readonly outcome: 'REJECTED'; readonly reason: string }
    | { readonly outcome: 'REDEEMED'; readonly days: number; readonly replay: boolean }
> {
    return getDb().transaction(async (tx) => {
        const [promo] = await tx
            .select()
            .from(promoCodes)
            .where(eq(promoCodes.code, input.code.trim()))
            .limit(1)
            .for('update');
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
        await assertNotRedeemed({ tx, promoCodeId: promo.id, userId: input.userId });
        await assertPromoCodeAvailable({
            tx,
            promo,
            now: ports.clock.now()
        });
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

        const [redemption] = await tx
            .insert(promoRedemptions)
            .values({
                promoCodeId: promo.id,
                userId: input.userId,
                subscriptionId: null,
                remainingCharges: null,
                redeemedAt: ports.clock.now()
            })
            .onConflictDoNothing({
                target: [promoRedemptions.promoCodeId, promoRedemptions.userId]
            })
            .returning({ id: promoRedemptions.id });
        const replay = redemption === undefined;
        logger.info(
            { userId: input.userId, promoCodeId: promo.id, days, replay },
            'Trial extension code redeemed'
        );
        return { outcome: 'REDEEMED', days, replay };
    });
}
