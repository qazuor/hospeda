import {
    eq,
    getDb,
    planMigrationSubscriptions,
    planMigrations,
    type SelectSubscription,
    subscriptionScheduledChanges
} from '@repo/db';
import { readLivePromos } from '../../../promo/live-promos.js';
import { composePromoAmount } from '../../../promo/promo-composition.js';
import {
    type BillingOptionReader,
    readAnchoredBillingOption
} from '../../../read-anchored-billing-option.js';

export type ExpectedAmount =
    | {
          readonly kind: 'COMPARABLE';
          readonly amountMinor: number;
          readonly currency: string;
          readonly source: 'ANCHORED' | 'SCHEDULED_CHANGE';
      }
    | { readonly kind: 'NOT_COMPARABLE'; readonly reason: 'NOT_PRINCIPAL' | 'NO_ANCHOR' };

/**
 * AC:B11:9 and AC:B11:11: derives the amount to compare for authorization or
 * for a charge period. It must use the same calculation as the mutating writer.
 * AC:B9b:1 (HOS-1588) composes live promos through the shared promo arithmetic
 * and rounds once down; callers keep using this policy (B/14 §1.2).
 */
export interface ExpectedAmountPolicy {
    expectedAmount(input: {
        readonly subscription: SelectSubscription;
        readonly purpose:
            | { readonly kind: 'AUTHORIZATION' }
            | { readonly kind: 'PERIOD'; readonly chargeCreatedAt: Date };
    }): Promise<ExpectedAmount>;
}

async function scheduledChange(subscriptionId: string) {
    const [change] = await getDb()
        .select()
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, subscriptionId))
        .limit(1);
    return change ?? null;
}

async function preservesPromo(change: NonNullable<Awaited<ReturnType<typeof scheduledChange>>>) {
    if (!change.planMigrationSubscriptionId) return false;
    const [migration] = await getDb()
        .select({ reason: planMigrations.reason })
        .from(planMigrationSubscriptions)
        .innerJoin(
            planMigrations,
            eq(planMigrations.id, planMigrationSubscriptions.planMigrationId)
        )
        .where(eq(planMigrationSubscriptions.id, change.planMigrationSubscriptionId))
        .limit(1);
    return migration?.reason === 'PRICE_INCREASE';
}

/** Creates the expected-amount policy, including applicable live promo composition. */
export function createCutExpectedAmountPolicy(
    ports: { readonly reader?: BillingOptionReader } = {}
): ExpectedAmountPolicy {
    return {
        async expectedAmount({ subscription, purpose }) {
            if (subscription.class !== 'PRINCIPAL')
                return { kind: 'NOT_COMPARABLE', reason: 'NOT_PRINCIPAL' };
            if (!subscription.planVersionId || !subscription.billingOptionId)
                return { kind: 'NOT_COMPARABLE', reason: 'NO_ANCHOR' };
            const anchoredSubscription = {
                planVersionId: subscription.planVersionId,
                billingOptionId: subscription.billingOptionId
            };

            const change = await scheduledChange(subscription.id);
            const startsAt =
                change !== null &&
                (purpose.kind === 'AUTHORIZATION' ||
                    purpose.chargeCreatedAt.getTime() >= change.effectiveAt.getTime());
            const destination = startsAt ? change : null;
            const option = destination
                ? await readAnchoredBillingOption({
                      subscription: {
                          planVersionId: destination.targetPlanVersionId,
                          billingOptionId: destination.targetBillingOptionId
                      },
                      ...(ports.reader ? { reader: ports.reader } : {})
                  })
                : await readAnchoredBillingOption({
                      subscription: anchoredSubscription,
                      ...(ports.reader ? { reader: ports.reader } : {})
                  });
            if (!option) return { kind: 'NOT_COMPARABLE', reason: 'NO_ANCHOR' };

            const promoApplies = !destination || (await preservesPromo(destination));
            const promos = promoApplies
                ? await readLivePromos({
                      subscriptionId: subscription.id,
                      ...(purpose.kind === 'PERIOD' ? { at: purpose.chargeCreatedAt } : {})
                  })
                : [];
            const composed = composePromoAmount({
                listAmountMinor: option.amount,
                promos: promos.map(({ discountKind, value }) => ({ discountKind, value }))
            });
            return {
                kind: 'COMPARABLE',
                amountMinor: composed.amountMinor,
                currency: option.currency,
                source: destination ? 'SCHEDULED_CHANGE' : 'ANCHORED'
            };
        }
    };
}
