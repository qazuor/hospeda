import { and, billingOptions, eq, promoCodes, promoRedemptions, subscriptions } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { PromoChargePolicy } from '../payment/payment-ports.js';
import { readAnchoredBillingOption } from '../read-anchored-billing-option.js';
import { readLivePromos } from './live-promos.js';
import { composePromoAmount } from './promo-composition.js';

const logger = createLogger('promo-charge-policy');

/**
 * AC:B9b:4 / TRANS:B:P1 / DEC-RF-006 📌1: a charge spends a promo count only
 * when its recorded amount and currency could have gone out with that discount.
 */
export function createPromoChargePolicy(): PromoChargePolicy {
    return {
        async chargedWithDiscount(input) {
            const [subscription] = await input.tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, input.subscriptionId))
                .limit(1);
            if (!subscription?.planVersionId || !subscription.billingOptionId) {
                logger.warn(
                    { subscriptionId: input.subscriptionId },
                    'Promo charge has no billing anchor'
                );
                return false;
            }
            const option = await readAnchoredBillingOption({
                subscription: {
                    planVersionId: subscription.planVersionId,
                    billingOptionId: subscription.billingOptionId
                },
                reader: {
                    async findByVersionAndId(args) {
                        const [row] = await input.tx
                            .select({
                                id: billingOptions.id,
                                planVersionId: billingOptions.planVersionId,
                                cycle: billingOptions.cycle,
                                amount: billingOptions.amount,
                                currency: billingOptions.currency
                            })
                            .from(billingOptions)
                            .where(
                                and(
                                    eq(billingOptions.planVersionId, args.planVersionId),
                                    eq(billingOptions.id, args.billingOptionId)
                                )
                            )
                            .limit(1);
                        return row ?? null;
                    }
                }
            });
            if (!option) {
                logger.warn(
                    { subscriptionId: input.subscriptionId },
                    'Promo charge billing option was not found'
                );
                return false;
            }
            if (input.currency !== option.currency) return false;
            const [redemption] = await input.tx
                .select({
                    id: promoRedemptions.id,
                    discountKind: promoCodes.discountKind,
                    value: promoCodes.value,
                    effectKind: promoCodes.effectKind
                })
                .from(promoRedemptions)
                .innerJoin(promoCodes, eq(promoCodes.id, promoRedemptions.promoCodeId))
                .where(
                    and(
                        eq(promoRedemptions.id, input.redemptionId),
                        eq(promoRedemptions.subscriptionId, input.subscriptionId)
                    )
                )
                .limit(1);
            if (!redemption) return false;
            if (
                redemption.effectKind !== 'DISCOUNT' ||
                !redemption.value ||
                (redemption.discountKind !== 'PERCENTAGE' && redemption.discountKind !== 'FIXED')
            )
                return false;
            const live = await readLivePromos({
                subscriptionId: input.subscriptionId,
                at: input.chargeCreatedAt,
                executor: input.tx
            });
            const promos = live.some((item) => item.redemptionId === redemption.id)
                ? live
                : [
                      ...live,
                      {
                          discountKind: redemption.discountKind as 'PERCENTAGE' | 'FIXED',
                          value: redemption.value
                      }
                  ];
            return (
                input.amountMinor <=
                composePromoAmount({
                    listAmountMinor: option.amount,
                    promos: promos.map(({ discountKind, value }) => ({ discountKind, value }))
                }).amountMinor
            );
        }
    };
}
