import {
    and,
    eq,
    getDb,
    gt,
    isNull,
    lte,
    or,
    planMigrationSubscriptions,
    planMigrations,
    promoRedemptions,
    type SelectSubscription,
    subscriptionScheduledChanges
} from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '../../../../../types/index.js';
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
 * B9b.1 (HOS-1588) replaces this policy to compose live promos and round once
 * down, without changing callers (BL, context §14).
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

/** Cut implementation: list price only; promo composition is deliberately fail-visible. */
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
            if (promoApplies) {
                const rows = await getDb()
                    .select({ id: promoRedemptions.id })
                    .from(promoRedemptions)
                    .where(eq(promoRedemptions.subscriptionId, subscription.id));
                const live =
                    rows.length > 0 &&
                    (purpose.kind === 'AUTHORIZATION'
                        ? await hasAuthorizationPromo(subscription.id)
                        : await hasPeriodPromo(subscription.id, purpose.chargeCreatedAt));
                if (live)
                    throw new ServiceError(
                        ServiceErrorCode.INTERNAL_ERROR,
                        'Expected amount needs the promo composition of B9b',
                        undefined,
                        'EXPECTED_AMOUNT_PROMO_POLICY_NOT_REGISTERED'
                    );
            }
            return {
                kind: 'COMPARABLE',
                amountMinor: option.amount,
                currency: option.currency,
                source: destination ? 'SCHEDULED_CHANGE' : 'ANCHORED'
            };
        }
    };
}

async function hasAuthorizationPromo(subscriptionId: string) {
    const [live] = await getDb()
        .select({ id: promoRedemptions.id })
        .from(promoRedemptions)
        .where(
            and(
                eq(promoRedemptions.subscriptionId, subscriptionId),
                or(
                    isNull(promoRedemptions.remainingCharges),
                    gt(promoRedemptions.remainingCharges, 0)
                )
            )
        )
        .limit(1);
    return live !== undefined;
}

async function hasPeriodPromo(subscriptionId: string, chargeCreatedAt: Date) {
    const rows = await getDb()
        .select({ id: promoRedemptions.id, redeemedAt: promoRedemptions.redeemedAt })
        .from(promoRedemptions)
        .where(
            and(
                eq(promoRedemptions.subscriptionId, subscriptionId),
                lte(promoRedemptions.redeemedAt, chargeCreatedAt)
            )
        )
        .limit(1);
    return rows.length > 0;
}
