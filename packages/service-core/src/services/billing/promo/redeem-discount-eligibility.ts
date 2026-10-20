import {
    type DrizzleClient,
    eq,
    promoCodes,
    promoRedemptions,
    providerLinks,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { and as drizzleAnd, isNull } from 'drizzle-orm';
import { ServiceError } from '../../../types/index.js';
import { PromoRedemptionReason } from './promo-redemption-reasons.js';

function fail(reason: string, code = ServiceErrorCode.VALIDATION_ERROR): never {
    throw new ServiceError(code, reason, undefined, reason);
}

/**
 * Reads a promo code by its code string, validates its discount kind, and returns
 * the code row enriched with typed discount and duration fields.
 * @param input - The transaction, code, and vertical to look up.
 * @returns The promo code with resolved `discountKind` and `durationKind`.
 * @throws ServiceError NOT_FOUND `PROMO_CODE_NOT_FOUND` when the code does not exist;
 *   INTERNAL_ERROR when the code is not a discount, has an invalid kind, a null value,
 *   an invalid duration kind, or is not valid for the requested vertical.
 */
export async function readPromoCode(input: { tx: DrizzleClient; code: string; vertical: string }) {
    const [promo] = await input.tx
        .select()
        .from(promoCodes)
        .where(eq(promoCodes.code, input.code))
        .limit(1)
        .for('update');
    if (!promo) fail(PromoRedemptionReason.PROMO_CODE_NOT_FOUND, ServiceErrorCode.NOT_FOUND);
    if (promo.effectKind !== 'DISCOUNT') {
        throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Promo code is not a discount');
    }
    if (promo.discountKind !== 'PERCENTAGE' && promo.discountKind !== 'FIXED') {
        throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Promo discount kind is invalid');
    }
    if (promo.value === null) {
        throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Promo discount value is missing');
    }
    if (
        promo.durationKind !== 'FIRST_CHARGE' &&
        promo.durationKind !== 'N_CHARGES' &&
        promo.durationKind !== 'FOREVER'
    ) {
        throw new ServiceError(ServiceErrorCode.INTERNAL_ERROR, 'Promo duration kind is invalid');
    }
    if (!promo.allVerticals && !(promo.verticals ?? []).includes(input.vertical))
        fail(PromoRedemptionReason.PROMO_CODE_NOT_FOR_VERTICAL);
    const discountKind: 'PERCENTAGE' | 'FIXED' =
        promo.discountKind === 'PERCENTAGE' ? 'PERCENTAGE' : 'FIXED';
    const durationKind: 'FIRST_CHARGE' | 'N_CHARGES' | 'FOREVER' =
        promo.durationKind === 'FIRST_CHARGE'
            ? 'FIRST_CHARGE'
            : promo.durationKind === 'N_CHARGES'
              ? 'N_CHARGES'
              : 'FOREVER';
    return {
        ...promo,
        discountKind,
        durationKind,
        value: promo.value
    };
}

/**
 * Reads the active principal subscription for the user and vertical, locks it
 * `FOR UPDATE`, and rejects manual payers or subscriptions with pending changes.
 * @param input - The transaction, user id, and vertical.
 * @returns The subscription row and its provider link id.
 * @throws ServiceError VALIDATION_ERROR `PROMO_NO_ELIGIBLE_SUBSCRIPTION` when no
 *   matching subscription exists or it has scheduled changes;
 *   `PROMO_NOT_OFFERED_TO_MANUAL_PAYER` when the payment method is manual.
 */
export async function readEligibleSubscription(input: {
    tx: DrizzleClient;
    userId: string;
    vertical: string;
}) {
    const rows = await input.tx
        .select({ subscription: subscriptions, providerId: providerLinks.providerId })
        .from(subscriptions)
        .leftJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(
            drizzleAnd(
                eq(subscriptions.userId, input.userId),
                eq(subscriptions.vertical, input.vertical),
                eq(subscriptions.class, 'PRINCIPAL'),
                eq(subscriptions.status, 'ACTIVE'),
                isNull(subscriptions.succeedsId),
                isNull(subscriptions.succeededById)
            )
        )
        .for('update', { of: subscriptions });
    const row = rows[0];
    if (!row) fail(PromoRedemptionReason.PROMO_NO_ELIGIBLE_SUBSCRIPTION);
    if (row.subscription.paymentMethod === 'MANUAL')
        fail(PromoRedemptionReason.PROMO_NOT_OFFERED_TO_MANUAL_PAYER);
    if (!row.providerId) fail(PromoRedemptionReason.PROMO_NO_ELIGIBLE_SUBSCRIPTION);
    const [scheduled] = await input.tx
        .select({ id: subscriptionScheduledChanges.id })
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, row.subscription.id))
        .limit(1);
    if (scheduled) fail(PromoRedemptionReason.PROMO_NO_ELIGIBLE_SUBSCRIPTION);
    return { ...row.subscription, providerId: row.providerId };
}

/**
 * Asserts that the user has not already redeemed the given promo code.
 * @param input - The transaction, promo code id, and user id.
 * @throws ServiceError ALREADY_EXISTS `PROMO_CODE_ALREADY_REDEEMED` when a redemption
 *   row already exists for the pair.
 */
export async function assertNotRedeemed(input: {
    tx: DrizzleClient;
    promoCodeId: string;
    userId: string;
}): Promise<void> {
    const [existing] = await input.tx
        .select({ id: promoRedemptions.id })
        .from(promoRedemptions)
        .where(
            drizzleAnd(
                eq(promoRedemptions.promoCodeId, input.promoCodeId),
                eq(promoRedemptions.userId, input.userId)
            )
        )
        .limit(1);
    if (existing)
        fail(PromoRedemptionReason.PROMO_CODE_ALREADY_REDEEMED, ServiceErrorCode.ALREADY_EXISTS);
}
