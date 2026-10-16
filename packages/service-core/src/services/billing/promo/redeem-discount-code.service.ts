import type { Clock } from '@repo/billing-verticals-contract';
import { getDb, promoRedemptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import {
    actStartInstant,
    assertFreshForAct,
    confirmAuthorizationMutation,
    type PaymentProvider
} from '@repo/payments';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../types/index.js';
import { readAnchoredBillingOption } from '../read-anchored-billing-option.js';
import { readLivePromos } from './live-promos.js';
import { assertPromoCodeAvailable } from './promo-availability.js';
import { composePromoAmount, type PromoDiscount } from './promo-composition.js';
import { PromoRedemptionReason } from './promo-redemption-reasons.js';
import { assertAboveProviderFloor } from './provider-amount-floor.js';
import {
    assertNotRedeemed,
    readEligibleSubscription,
    readPromoCode
} from './redeem-discount-eligibility.js';

const logger = createLogger('redeem-discount-code');

/**
 * Redeems a discount promo code: validates the code and subscription, composes the
 * applied amount, asserts it meets the provider floor, mutates the MercadoPago
 * preapproval, and records the redemption.
 *
 * Runs inside one transaction: locks the promo code, checks prior use and availability,
 * then locks the eligible subscription before mutation and redemption insert.
 *
 * @param input - The user id, promo code string, and vertical.
 * @param ports - The payment provider and a wall-clock for activity timestamps.
 * @returns The redemption id, the amount before and after the promo, currency, duration kind,
 *   and the remaining charges for multi-cycle discounts.
 * @throws ServiceError NOT_FOUND `PROMO_CODE_NOT_FOUND` when the code does not exist;
 *   ALREADY_EXISTS `PROMO_NOT_COMBINABLE` | `PROMO_CODE_ALREADY_REDEEMED` when stacking is
 *   forbidden or the user already redeemed the code; VALIDATION_ERROR `PROMO_UNSUPPORTED_CURRENCY`
 *   when the subscription is not in ARS; INTERNAL_ERROR `PROMO_MUTATION_NOT_APPLIED` when the
 *   provider rejects the amount change, or when the billing anchor / billing option is missing.
 */
export async function redeemDiscountCode(
    input: { readonly userId: string; readonly code: string; readonly vertical: string },
    ports: { readonly provider: PaymentProvider; readonly clock: Clock }
): Promise<{
    readonly redemptionId: string;
    readonly previousAmountMinor: number;
    readonly amountMinor: number;
    readonly currency: string;
    readonly durationKind: 'FIRST_CHARGE' | 'N_CHARGES' | 'FOREVER';
    readonly remainingCharges: number | null;
}> {
    return getDb().transaction(async (tx) => {
        const promo = await readPromoCode({
            tx,
            code: input.code.trim(),
            vertical: input.vertical
        });
        await assertNotRedeemed({ tx, promoCodeId: promo.id, userId: input.userId });
        await assertPromoCodeAvailable({ tx, promo, now: ports.clock.now() });
        const subscription = await readEligibleSubscription({
            tx,
            userId: input.userId,
            vertical: input.vertical
        });
        const live = await readLivePromos({ subscriptionId: subscription.id, executor: tx });
        if (
            live.length > 0 &&
            (!promo.usableWithAnotherActive ||
                !promo.stackable ||
                live.some((item) => !item.stackable))
        ) {
            throw new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                PromoRedemptionReason.PROMO_NOT_COMBINABLE,
                undefined,
                PromoRedemptionReason.PROMO_NOT_COMBINABLE
            );
        }
        if (!subscription.planVersionId || !subscription.billingOptionId) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Active subscription has no billing anchor'
            );
        }
        const option = await readAnchoredBillingOption({
            subscription: {
                planVersionId: subscription.planVersionId,
                billingOptionId: subscription.billingOptionId
            }
        });
        if (!option)
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Anchored billing option missing'
            );
        if (option.currency !== 'ARS')
            throw new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                PromoRedemptionReason.PROMO_UNSUPPORTED_CURRENCY,
                undefined,
                PromoRedemptionReason.PROMO_UNSUPPORTED_CURRENCY
            );
        const priorPromos: PromoDiscount[] = live.map(({ discountKind, value }) => ({
            discountKind,
            value
        }));
        const previousAmountMinor = composePromoAmount({
            listAmountMinor: option.amount,
            promos: priorPromos
        }).amountMinor;
        const amountMinor = composePromoAmount({
            listAmountMinor: option.amount,
            promos: [...priorPromos, { discountKind: promo.discountKind, value: promo.value }]
        }).amountMinor;
        const amount = { amountMinor, currency: option.currency };
        assertAboveProviderFloor({ amountMinor });
        const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
        actStartInstant({ act });
        const acknowledgement = await ports.provider.changeAmount({
            authorizationId: subscription.providerId,
            amount
        });
        const confirmation = await confirmAuthorizationMutation({
            provider: ports.provider,
            acknowledgement,
            sent: { amount }
        });
        assertFreshForAct({ read: confirmation.read, act });
        if (confirmation.outcome !== 'applied') {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'Provider did not apply promo amount',
                undefined,
                PromoRedemptionReason.PROMO_MUTATION_NOT_APPLIED
            );
        }
        const remainingCharges =
            promo.durationKind === 'FIRST_CHARGE'
                ? 1
                : promo.durationKind === 'N_CHARGES'
                  ? promo.durationCharges
                  : null;
        try {
            const [redemption] = await tx
                .insert(promoRedemptions)
                .values({
                    promoCodeId: promo.id,
                    userId: input.userId,
                    subscriptionId: subscription.id,
                    redeemedAt: ports.clock.now(),
                    remainingCharges
                })
                .returning({ id: promoRedemptions.id });
            if (!redemption) throw new Error('Promo redemption insert returned no row');
            logger.info(
                { userId: input.userId, promoCodeId: promo.id, subscriptionId: subscription.id },
                'Discount code redeemed'
            );
            return {
                redemptionId: redemption.id,
                previousAmountMinor,
                amountMinor,
                currency: option.currency,
                durationKind: promo.durationKind,
                remainingCharges
            };
        } catch (error) {
            let current: unknown = error;
            while (current && typeof current === 'object') {
                if ('code' in current && current.code === '23505')
                    throw new ServiceError(
                        ServiceErrorCode.ALREADY_EXISTS,
                        PromoRedemptionReason.PROMO_CODE_ALREADY_REDEEMED,
                        undefined,
                        PromoRedemptionReason.PROMO_CODE_ALREADY_REDEEMED
                    );
                current = 'cause' in current ? current.cause : undefined;
            }
            throw error;
        }
    });
}
