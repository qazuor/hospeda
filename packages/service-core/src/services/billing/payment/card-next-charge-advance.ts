import {
    addonInstances,
    addonProducts,
    and,
    billingOptions,
    type DrizzleClient,
    eq,
    inArray,
    isNull,
    lt,
    or,
    type SelectSubscription,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { BILLING_CYCLE_MONTHS } from '@repo/schemas';
import { billingPeriodEnd } from '../subscription/billing-period-end';

const logger = createLogger('card-next-charge-advance');

/** Statuses whose provider debit is still live, so a credited charge moves the next one. */
const LIVE_DEBIT_STATUSES = ['PENDING_AUTHORIZATION', 'ACTIVE', 'GRACE_PERIOD'] as const;

type AdvanceSubscription = Pick<
    SelectSubscription,
    'id' | 'class' | 'paymentMethod' | 'billingOptionId'
>;

/** Outcome of {@link advanceCardNextChargeAt}. */
export interface AdvanceCardNextChargeAtResult {
    readonly outcome: 'ADVANCED' | 'NOT_ADVANCED' | 'NOT_APPLICABLE' | 'CYCLE_UNKNOWN';
}

async function cycleMonths(input: {
    readonly tx: DrizzleClient;
    readonly subscription: AdvanceSubscription;
}): Promise<number | null> {
    const { tx, subscription } = input;
    let cycle: string | null | undefined;
    if (subscription.class === 'PRINCIPAL') {
        if (!subscription.billingOptionId) return null;
        const [option] = await tx
            .select({ cycle: billingOptions.cycle })
            .from(billingOptions)
            .where(eq(billingOptions.id, subscription.billingOptionId))
            .limit(1);
        cycle = option?.cycle;
    } else {
        const [product] = await tx
            .select({ cycle: addonProducts.cycle })
            .from(addonInstances)
            .innerJoin(addonProducts, eq(addonProducts.id, addonInstances.productId))
            .where(eq(addonInstances.complementSubscriptionId, subscription.id))
            .limit(1);
        cycle = product?.cycle;
    }
    if (!cycle || !Object.hasOwn(BILLING_CYCLE_MONTHS, cycle)) return null;
    return BILLING_CYCLE_MONTHS[cycle as keyof typeof BILLING_CYCLE_MONTHS];
}

/**
 * HOS-2223, P1's write: when a card charge is credited, the next charge is one cycle
 * after the charge (`billingPeriodEnd(chargeCreatedAt, cycle months)`).
 *
 * The write only moves the date forward. Right after authorizing, the provider still
 * reports the first-charge instant (PA-3), which S2 copied; this replaces it the moment
 * that charge lands. The nightly sweep (HOS-1685) keeps aligning the column with the
 * provider's own `next_payment_date`, so the minutes of batch lag between the two are
 * corrected there.
 *
 * @param input.tx - P1's transaction
 * @param input.subscription - The charged subscription
 * @param input.chargeCreatedAt - The provider's charge creation instant
 * @param input.now - The act's instant, for `updated_at`
 * @returns Whether the column moved
 */
export async function advanceCardNextChargeAt(input: {
    readonly tx: DrizzleClient;
    readonly subscription: AdvanceSubscription;
    readonly chargeCreatedAt: Date;
    readonly now: Date;
}): Promise<AdvanceCardNextChargeAtResult> {
    const { tx, subscription } = input;
    if (subscription.paymentMethod !== 'CARD') return { outcome: 'NOT_APPLICABLE' };
    if (subscription.class !== 'PRINCIPAL' && subscription.class !== 'COMPLEMENTO')
        return { outcome: 'NOT_APPLICABLE' };
    const everyMonths = await cycleMonths({ tx, subscription });
    if (everyMonths === null) {
        logger.warn(
            { subscriptionId: subscription.id },
            'Card charge credited without a resolvable cycle; next charge date left to the sweep'
        );
        return { outcome: 'CYCLE_UNKNOWN' };
    }
    const { periodEnd } = billingPeriodEnd({ periodStart: input.chargeCreatedAt, everyMonths });
    const rows = await tx
        .update(subscriptions)
        .set({ nextChargeAt: periodEnd, updatedAt: input.now })
        .where(
            and(
                eq(subscriptions.id, subscription.id),
                inArray(subscriptions.status, [...LIVE_DEBIT_STATUSES]),
                or(isNull(subscriptions.nextChargeAt), lt(subscriptions.nextChargeAt, periodEnd))
            )
        )
        .returning({ id: subscriptions.id });
    return { outcome: rows.length > 0 ? 'ADVANCED' : 'NOT_ADVANCED' };
}
