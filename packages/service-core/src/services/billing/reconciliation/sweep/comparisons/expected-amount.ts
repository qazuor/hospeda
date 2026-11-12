import {
    and,
    billingOptions,
    type DrizzleClient,
    desc,
    domainEvent,
    eq,
    getDb,
    isNull,
    planMigrationSubscriptions,
    planMigrations,
    type SelectSubscription,
    subscriptionScheduledChanges
} from '@repo/db';
import { readLivePromos } from '../../../promo/live-promos.js';
import { composePromoAmount } from '../../../promo/promo-composition.js';
import {
    type AnchoredBillingOption,
    type BillingOptionReader,
    readAnchoredBillingOption
} from '../../../read-anchored-billing-option.js';

export type ExpectedAmount =
    | {
          readonly kind: 'COMPARABLE';
          readonly amountMinor: number;
          readonly currency: string;
          readonly source: 'ANCHORED' | 'SCHEDULED_CHANGE' | 'MIGRATION_DECIDED';
      }
    | { readonly kind: 'NOT_COMPARABLE'; readonly reason: 'NOT_PRINCIPAL' | 'NO_ANCHOR' };

/**
 * The destination a decided `S37` amount mutation points at, while the row is
 * still `PENDIENTE` and no version change is queued yet.
 */
interface MigrationDecidedDestination {
    readonly targetPlanVersionId: string;
    readonly reason: string;
}

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
        readonly executor?: DrizzleClient;
    }): Promise<ExpectedAmount>;
}

async function scheduledChange(subscriptionId: string, executor: DrizzleClient) {
    const [change] = await executor
        .select()
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, subscriptionId))
        .limit(1);
    return change ?? null;
}

async function preservesPromo(
    change: NonNullable<Awaited<ReturnType<typeof scheduledChange>>>,
    executor: DrizzleClient
) {
    if (!change.planMigrationSubscriptionId) return false;
    const [migration] = await executor
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

/**
 * Detects the `S37` window: a planned retirement mutation was decided for the
 * subscription's `PENDIENTE` scope row, and the version change is not queued
 * yet. Detection is keyed by the scope id the decision names, so a stale `S37`
 * decision for another row never matches.
 */
async function migrationDecidedDestination(input: {
    readonly subscriptionId: string;
    readonly executor: DrizzleClient;
}): Promise<MigrationDecidedDestination | null> {
    const [decision] = await input.executor
        .select({ changes: domainEvent.changes })
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityType, 'subscription'),
                eq(domainEvent.entityId, input.subscriptionId),
                eq(domainEvent.eventType, 'subscription.amount_mutation_decided'),
                eq(domainEvent.reason, 'S37')
            )
        )
        .orderBy(desc(domainEvent.occurredAt), desc(domainEvent.id))
        .limit(1);
    if (!decision) return null;
    const pending = await input.executor
        .select({
            scopeId: planMigrationSubscriptions.id,
            targetPlanVersionId: planMigrations.targetPlanVersionId,
            reason: planMigrations.reason
        })
        .from(planMigrationSubscriptions)
        .innerJoin(
            planMigrations,
            eq(planMigrations.id, planMigrationSubscriptions.planMigrationId)
        )
        .where(
            and(
                eq(planMigrationSubscriptions.subscriptionId, input.subscriptionId),
                eq(planMigrationSubscriptions.status, 'PENDIENTE'),
                isNull(planMigrations.cancelledAt)
            )
        );
    const named = pending.find((row) =>
        decision.changes.some(
            (change) =>
                change.field === 'plan_migration_subscription.id' && change.new === row.scopeId
        )
    );
    return named ? { targetPlanVersionId: named.targetPlanVersionId, reason: named.reason } : null;
}

/** Reads the destination version's option for the anchored cycle. */
async function readDestinationOption(input: {
    readonly targetPlanVersionId: string;
    readonly cycle: string;
    readonly executor: DrizzleClient;
}): Promise<{
    readonly id: string;
    readonly planVersionId: string;
    readonly cycle: string;
    readonly amount: number;
    readonly currency: string;
} | null> {
    const [option] = await input.executor
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
                eq(billingOptions.planVersionId, input.targetPlanVersionId),
                eq(billingOptions.cycle, input.cycle)
            )
        )
        .limit(1);
    return option ?? null;
}

/** Creates the expected-amount policy, including applicable live promo composition. */
export function createCutExpectedAmountPolicy(
    ports: { readonly reader?: BillingOptionReader; readonly executor?: DrizzleClient } = {}
): ExpectedAmountPolicy {
    return {
        async expectedAmount({ subscription, purpose, executor: callExecutor }) {
            if (subscription.class !== 'PRINCIPAL')
                return { kind: 'NOT_COMPARABLE', reason: 'NOT_PRINCIPAL' };
            if (!subscription.planVersionId || !subscription.billingOptionId)
                return { kind: 'NOT_COMPARABLE', reason: 'NO_ANCHOR' };
            // Resolve the executor after the guards: a non-comparable row never touches the database.
            const executor = callExecutor ?? ports.executor ?? getDb();
            const reader =
                callExecutor || ports.executor
                    ? ({
                          async findByVersionAndId({ planVersionId, billingOptionId }) {
                              const [option] = await executor
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
                                          eq(billingOptions.planVersionId, planVersionId),
                                          eq(billingOptions.id, billingOptionId)
                                      )
                                  )
                                  .limit(1);
                              return option ?? null;
                          }
                      } satisfies BillingOptionReader)
                    : ports.reader;
            const anchoredSubscription = {
                planVersionId: subscription.planVersionId,
                billingOptionId: subscription.billingOptionId
            };

            const change = await scheduledChange(subscription.id, executor);
            const startsAt =
                change !== null &&
                (purpose.kind === 'AUTHORIZATION' ||
                    purpose.chargeCreatedAt.getTime() >= change.effectiveAt.getTime());
            const destination = startsAt ? change : null;
            const migration =
                destination === null && purpose.kind === 'AUTHORIZATION'
                    ? await migrationDecidedDestination({
                          subscriptionId: subscription.id,
                          executor
                      })
                    : null;

            let option: AnchoredBillingOption | null;
            if (destination) {
                option = await readAnchoredBillingOption({
                    subscription: {
                        planVersionId: destination.targetPlanVersionId,
                        billingOptionId: destination.targetBillingOptionId
                    },
                    ...(reader ? { reader } : {})
                });
            } else {
                const anchored = await readAnchoredBillingOption({
                    subscription: anchoredSubscription,
                    ...(reader ? { reader } : {})
                });
                option =
                    anchored && migration
                        ? await readDestinationOption({
                              targetPlanVersionId: migration.targetPlanVersionId,
                              cycle: anchored.cycle,
                              executor
                          })
                        : anchored;
            }
            if (!option) return { kind: 'NOT_COMPARABLE', reason: 'NO_ANCHOR' };

            const promoApplies = destination
                ? await preservesPromo(destination, executor)
                : migration
                  ? migration.reason === 'PRICE_INCREASE'
                  : true;
            const promos = promoApplies
                ? await readLivePromos({
                      subscriptionId: subscription.id,
                      executor,
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
                source: destination
                    ? 'SCHEDULED_CHANGE'
                    : migration
                      ? 'MIGRATION_DECIDED'
                      : 'ANCHORED'
            };
        }
    };
}
