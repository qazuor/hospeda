import type { Clock, VerticalsForBilling } from '@repo/billing-verticals-contract';
import { getDb, PROMO_EFFECT_KINDS, promoCodes } from '@repo/db';
import type { PaymentProvider } from '@repo/payments';
import { ServiceErrorCode, type Vertical } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { ServiceError } from '../../../types/index.js';
import { PromoRedemptionReason } from './promo-redemption-reasons.js';
import { redeemDiscountCode } from './redeem-discount-code.service.js';
import { redeemTrialExtensionCode } from './redeem-trial-extension-code.service.js';

type PromoEffectKind = (typeof PROMO_EFFECT_KINDS)[number];
type DiscountResult = Awaited<ReturnType<typeof redeemDiscountCode>>;
type RedeemResult =
    | ({ readonly kind: 'DISCOUNT' } & DiscountResult)
    | {
          readonly kind: 'TRIAL_EXTENSION';
          readonly outcome: 'REDEEMED';
          readonly days: number;
          readonly replay: boolean;
      }
    | { readonly kind: 'TRIAL_EXTENSION'; readonly outcome: 'REJECTED'; readonly reason: string };

function isPromoEffectKind(value: string): value is PromoEffectKind {
    return PROMO_EFFECT_KINDS.some((kind) => kind === value);
}

/**
 * Dispatches a promo code redemption to the service matching its persisted `effectKind`.
 * Resolves the promo row, classifies the effect, and delegates to the correct handler
 * (discount or trial extension).
 *
 * Does not hold a database transaction — each handler opens its own boundary.
 *
 * @param input - The user id, promo code string, and vertical.
 * @param ports - The payment provider, wall-clock, and vertical trial-extension port.
 * @returns The typed redemption result (discount or trial extension).
 * @throws ServiceError NOT_FOUND `PROMO_CODE_NOT_FOUND` when the code does not exist;
 *   INTERNAL_ERROR when the effect kind is unrecognised.
 */
export async function redeemPromoCode(
    input: { readonly userId: string; readonly code: string; readonly vertical: Vertical },
    ports: {
        readonly provider: PaymentProvider;
        readonly clock: Clock;
        readonly extendTrial: VerticalsForBilling['extendTrial'];
    }
): Promise<RedeemResult> {
    const [promo] = await getDb()
        .select({ effectKind: promoCodes.effectKind })
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
    if (!isPromoEffectKind(promo.effectKind)) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Promo code has an invalid effect kind'
        );
    }

    const handlers: Record<PromoEffectKind, () => Promise<RedeemResult>> = {
        DISCOUNT: async () => ({
            kind: 'DISCOUNT',
            ...(await redeemDiscountCode(input, { provider: ports.provider, clock: ports.clock }))
        }),
        TRIAL_EXTENSION: async () => ({
            kind: 'TRIAL_EXTENSION',
            ...(await redeemTrialExtensionCode(input, {
                extendTrial: ports.extendTrial,
                clock: ports.clock
            }))
        })
    };
    return handlers[promo.effectKind]();
}
