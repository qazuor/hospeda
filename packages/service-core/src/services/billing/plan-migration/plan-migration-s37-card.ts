import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    billingOptions,
    type DrizzleClient,
    desc,
    domainEvent,
    eq,
    getDb,
    planMigrationSubscriptions,
    planMigrations,
    promoRedemptions,
    subscriptionScheduledChanges,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import {
    actStartInstant,
    assertFreshForAct,
    confirmAuthorizationMutation,
    type PaymentProvider,
    PaymentProviderError
} from '@repo/payments';
import { BillingCycleSchema, ServiceErrorCode } from '@repo/schemas';
import { getLocalDateString } from '@repo/utils';
import { ServiceError } from '../../../types/index.js';
import { AMOUNT_MUTATION_RETRY_WINDOW_MS } from '../reconciliation/sweep/comparisons/amount-comparison.js';
import { recordAmountMutationDecided } from '../reconciliation/sweep/comparisons/amount-mutation-decision.js';
import { createCutExpectedAmountPolicy } from '../reconciliation/sweep/comparisons/expected-amount.js';
import { evaluateS37Guards } from './plan-migration-s37-guards.js';

const logger = createLogger('plan-migration-s37-card');

/** Field the `S37` decision uses to name the participation row it decided for. */
const SCOPE_FIELD = 'plan_migration_subscription.id';

/** What the closing transaction did with the participation row. */
export type S37ClosureResult =
    | { readonly kind: 'CLOSED' }
    | { readonly kind: 'ROW_LEFT' }
    | {
          readonly kind: 'DATE_MISMATCH';
          readonly details: {
              readonly scopeId: string;
              readonly subscriptionId: string;
              readonly applicationDate: string;
              readonly nextChargeDay: string;
          };
      };

/**
 * Writes `S37`'s closing act in the caller's transaction: the version change
 * (same assembly as the manual payer), promos to zero and `APLICADA`.
 *
 * It re-locks the same order as `cancelPlanMigration` and re-reads the row and
 * the subscription, so a cancellation or an exit that won in between leaves the
 * row untouched. It also re-checks the local-day rule (D-4) that the manual
 * arm applies before writing.
 *
 * @param input.tx - The transaction that also carries the caller's locks
 * @param input.scopeId - The participation row id
 * @param input.now - The instant to stamp as `applied_at`
 * @returns `CLOSED`, `ROW_LEFT` or `DATE_MISMATCH`; never a partial write
 */
export async function applyS37ClosureInTx(input: {
    readonly tx: DrizzleClient;
    readonly scopeId: string;
    readonly now: Date;
}): Promise<S37ClosureResult> {
    const { tx } = input;
    const [scope] = await tx
        .select({ planMigrationId: planMigrationSubscriptions.planMigrationId })
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.id, input.scopeId))
        .limit(1);
    if (!scope) return { kind: 'ROW_LEFT' };
    const [migration] = await tx
        .select({
            targetPlanVersionId: planMigrations.targetPlanVersionId,
            cancelledAt: planMigrations.cancelledAt
        })
        .from(planMigrations)
        .where(eq(planMigrations.id, scope.planMigrationId))
        .for('update');
    if (!migration) return { kind: 'ROW_LEFT' };
    const [row] = await tx
        .select({
            scopeStatus: planMigrationSubscriptions.status,
            applicationDate: planMigrationSubscriptions.applicationDate,
            subscriptionId: subscriptions.id,
            nextChargeAt: subscriptions.nextChargeAt,
            billingOptionId: subscriptions.billingOptionId,
            cycle: billingOptions.cycle
        })
        .from(planMigrationSubscriptions)
        .innerJoin(subscriptions, eq(subscriptions.id, planMigrationSubscriptions.subscriptionId))
        .innerJoin(billingOptions, eq(billingOptions.id, subscriptions.billingOptionId))
        .where(eq(planMigrationSubscriptions.id, input.scopeId))
        .limit(1)
        .for('update', { of: [planMigrationSubscriptions, subscriptions] });
    if (!row || !row.nextChargeAt || !row.billingOptionId) return { kind: 'ROW_LEFT' };
    if (row.scopeStatus !== 'PENDIENTE' || migration.cancelledAt !== null)
        return { kind: 'ROW_LEFT' };

    const cycle = BillingCycleSchema.parse(row.cycle);
    const [targetOption] = await tx
        .select({ id: billingOptions.id })
        .from(billingOptions)
        .where(
            and(
                eq(billingOptions.planVersionId, migration.targetPlanVersionId),
                eq(billingOptions.cycle, cycle)
            )
        )
        .limit(1);
    if (!targetOption)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Migration destination cycle is missing'
        );
    const applicationDay = getLocalDateString({ instant: row.applicationDate });
    const nextChargeDay = getLocalDateString({ instant: row.nextChargeAt });
    if (applicationDay !== nextChargeDay)
        return {
            kind: 'DATE_MISMATCH',
            details: {
                scopeId: input.scopeId,
                subscriptionId: row.subscriptionId,
                applicationDate: applicationDay,
                nextChargeDay
            }
        };

    await tx.insert(subscriptionScheduledChanges).values({
        subscriptionId: row.subscriptionId,
        targetPlanVersionId: migration.targetPlanVersionId,
        targetBillingOptionId: targetOption.id,
        effectiveAt: row.nextChargeAt,
        planMigrationSubscriptionId: input.scopeId,
        keepSelection: null
    });
    await tx
        .update(promoRedemptions)
        .set({ remainingCharges: 0 })
        .where(eq(promoRedemptions.subscriptionId, row.subscriptionId));
    await tx
        .update(planMigrationSubscriptions)
        .set({ status: 'APLICADA', appliedAt: input.now })
        .where(eq(planMigrationSubscriptions.id, input.scopeId));
    return { kind: 'CLOSED' };
}

/** What the card branch of `S37` did with one row. */
export type PlanMigrationS37CardResult =
    | { readonly outcome: 'APPLIED_CARD'; readonly escalated: boolean }
    | { readonly outcome: 'NOT_APPLIED' }
    | { readonly outcome: 'MUTATED_BUT_ROW_LEFT' }
    | { readonly outcome: 'AWAITING_SWEEP' }
    | { readonly outcome: 'DIVERGED' }
    | {
          readonly outcome: 'SKIPPED' | 'WAITING' | 'NOT_DUE';
          readonly reason: string;
      };

type Decision =
    | { readonly kind: 'DECIDED' }
    | { readonly kind: 'RESUME'; readonly decidedAt: Date }
    | {
          readonly kind: 'STOPPED';
          readonly outcome: 'SKIPPED' | 'WAITING' | 'NOT_DUE';
          readonly reason: string;
      };

/**
 * Runs `S37`'s card branch: one decision in its own transaction, the verified
 * amount mutation after that commit, and the closing transaction only when the
 * mutation is confirmed. A row that already carries an `S37` decision resumes
 * without mutating again (the sweep owns the retry); the resume only closes
 * when the provider already reads the destination.
 *
 * @param input.scopeId - The participation row id
 * @param input.subscriptionId - The principal subscription id
 * @param input.authorizationId - The preapproval the mutation must reuse
 * @param input.escalated - Whether this run already escalated an undeliverable notice
 * @param input.correlationId - Correlation of the whole act
 * @param ports.provider - The injected payment provider port (never its adapter)
 * @param ports.clock - The injected clock
 * @returns The typed outcome of the card branch
 */
export async function runS37Card(
    input: {
        readonly scopeId: string;
        readonly subscriptionId: string;
        readonly authorizationId: string;
        readonly escalated: boolean;
        readonly correlationId: string;
    },
    ports: { readonly provider: PaymentProvider; readonly clock: Clock }
): Promise<PlanMigrationS37CardResult> {
    const now = ports.clock.now();
    const decision = await getDb().transaction(async (tx) => decide(input, { tx, now }));
    if (decision.kind === 'STOPPED') return { outcome: decision.outcome, reason: decision.reason };

    const [subscription] = await getDb()
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId))
        .limit(1);
    if (!subscription)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'S37 subscription disappeared after the decision'
        );
    const expected = await createCutExpectedAmountPolicy().expectedAmount({
        subscription,
        purpose: { kind: 'AUTHORIZATION' }
    });
    if (expected.kind === 'NOT_COMPARABLE') {
        logger.warn(
            { subscriptionId: input.subscriptionId, reason: expected.reason },
            'S37 decision recorded but the destination amount is not comparable'
        );
        return { outcome: 'NOT_APPLIED' };
    }
    const amount = { amountMinor: expected.amountMinor, currency: expected.currency };

    if (decision.kind === 'RESUME') return resume(input, decision.decidedAt, amount, ports);

    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    try {
        const acknowledgement = await ports.provider.changeAmount({
            authorizationId: input.authorizationId,
            amount
        });
        const confirmation = await confirmAuthorizationMutation({
            provider: ports.provider,
            acknowledgement,
            sent: { amount }
        });
        assertFreshForAct({ read: confirmation.read, act });
        if (confirmation.outcome !== 'applied') {
            logger.warn(
                { subscriptionId: input.subscriptionId },
                'S37 provider accepted but did not apply the amount mutation'
            );
            return { outcome: 'NOT_APPLIED' };
        }
    } catch (error) {
        if (!(error instanceof PaymentProviderError)) throw error;
        logger.warn(
            { subscriptionId: input.subscriptionId, err: error },
            'S37 provider amount mutation failed'
        );
        return { outcome: 'NOT_APPLIED' };
    }
    return close(input, ports);
}

async function decide(
    input: {
        readonly scopeId: string;
        readonly subscriptionId: string;
        readonly correlationId: string;
    },
    context: { readonly tx: DrizzleClient; readonly now: Date }
): Promise<Decision> {
    const { tx, now } = context;
    const [scope] = await tx
        .select({ planMigrationId: planMigrationSubscriptions.planMigrationId })
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.id, input.scopeId))
        .limit(1);
    if (!scope) return { kind: 'STOPPED', outcome: 'SKIPPED', reason: 'ROW_NOT_FOUND' };
    const [migration] = await tx
        .select({
            reason: planMigrations.reason,
            cancelledAt: planMigrations.cancelledAt,
            targetPlanVersionId: planMigrations.targetPlanVersionId
        })
        .from(planMigrations)
        .where(eq(planMigrations.id, scope.planMigrationId))
        .for('update');
    if (!migration) return { kind: 'STOPPED', outcome: 'SKIPPED', reason: 'ROW_NOT_FOUND' };
    const [row] = await tx
        .select({
            scopeStatus: planMigrationSubscriptions.status,
            applicationDate: planMigrationSubscriptions.applicationDate,
            class: subscriptions.class,
            status: subscriptions.status,
            succeedsId: subscriptions.succeedsId,
            succeededById: subscriptions.succeededById,
            cycle: billingOptions.cycle
        })
        .from(planMigrationSubscriptions)
        .innerJoin(subscriptions, eq(subscriptions.id, planMigrationSubscriptions.subscriptionId))
        .innerJoin(billingOptions, eq(billingOptions.id, subscriptions.billingOptionId))
        .where(eq(planMigrationSubscriptions.id, input.scopeId))
        .limit(1)
        .for('update', { of: [planMigrationSubscriptions, subscriptions] });
    if (!row) return { kind: 'STOPPED', outcome: 'SKIPPED', reason: 'ROW_NOT_FOUND' };
    const [queued] = await tx
        .select({ id: subscriptionScheduledChanges.id })
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, input.subscriptionId))
        .limit(1);
    const cycle = BillingCycleSchema.parse(row.cycle);
    const [targetOption] = await tx
        .select({ id: billingOptions.id })
        .from(billingOptions)
        .where(
            and(
                eq(billingOptions.planVersionId, migration.targetPlanVersionId),
                eq(billingOptions.cycle, cycle)
            )
        )
        .limit(1);
    const verdict = evaluateS37Guards({
        reason: migration.reason,
        migrationCancelled: migration.cancelledAt !== null,
        scopeStatus: row.scopeStatus,
        subscription: {
            class: row.class,
            status: row.status,
            successionInProgress: row.succeedsId !== null || row.succeededById !== null
        },
        hasQueuedChange: queued !== undefined,
        targetOffersCycle: targetOption !== undefined,
        applicationDate: row.applicationDate,
        today: now
    });
    if (verdict.verdict !== 'PROCEED')
        return { kind: 'STOPPED', outcome: verdict.verdict, reason: verdict.reason };

    const existing = await latestDecision({ tx, input });
    if (existing) return { kind: 'RESUME', decidedAt: existing };
    await recordAmountMutationDecided({
        subscriptionId: input.subscriptionId,
        transition: 'S37',
        decidedAt: now,
        actor: { type: 'job' },
        correlationId: input.correlationId,
        changes: [
            { field: SCOPE_FIELD, new: input.scopeId },
            {
                field: 'subscription.transaction_amount',
                new: 'migration_target_list_price'
            }
        ],
        tx
    });
    return { kind: 'DECIDED' };
}

/** Latest `S37` decision whose `changes` names this participation row, if any. */
async function latestDecision(input: {
    readonly tx: DrizzleClient;
    readonly input: { readonly scopeId: string; readonly subscriptionId: string };
}): Promise<Date | null> {
    const decisions = await input.tx
        .select({ changes: domainEvent.changes, occurredAt: domainEvent.occurredAt })
        .from(domainEvent)
        .where(
            and(
                eq(domainEvent.entityType, 'subscription'),
                eq(domainEvent.entityId, input.input.subscriptionId),
                eq(domainEvent.eventType, 'subscription.amount_mutation_decided'),
                eq(domainEvent.reason, 'S37')
            )
        )
        .orderBy(desc(domainEvent.occurredAt), desc(domainEvent.id));
    for (const decision of decisions) {
        const names = decision.changes.some(
            (change) => change.field === SCOPE_FIELD && change.new === input.input.scopeId
        );
        if (names) return decision.occurredAt;
    }
    return null;
}

async function resume(
    input: {
        readonly scopeId: string;
        readonly subscriptionId: string;
        readonly authorizationId: string;
        readonly escalated: boolean;
    },
    decidedAt: Date,
    amount: { readonly amountMinor: number; readonly currency: string },
    ports: { readonly provider: PaymentProvider; readonly clock: Clock }
): Promise<PlanMigrationS37CardResult> {
    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const read = await ports.provider.readAuthorization({
        authorizationId: input.authorizationId
    });
    const fresh = assertFreshForAct({ read, act });
    const matches =
        fresh.snapshot.amount.amountMinor === amount.amountMinor &&
        fresh.snapshot.amount.currency === amount.currency;
    if (matches) return close(input, ports);
    const retryUntil = decidedAt.getTime() + AMOUNT_MUTATION_RETRY_WINDOW_MS;
    return ports.clock.now().getTime() < retryUntil
        ? { outcome: 'AWAITING_SWEEP' }
        : { outcome: 'DIVERGED' };
}

async function close(
    input: { readonly scopeId: string; readonly escalated: boolean },
    ports: { readonly clock: Clock }
): Promise<PlanMigrationS37CardResult> {
    const now = ports.clock.now();
    const result = await getDb().transaction(async (tx) =>
        applyS37ClosureInTx({ tx, scopeId: input.scopeId, now })
    );
    if (result.kind === 'CLOSED') return { outcome: 'APPLIED_CARD', escalated: input.escalated };
    if (result.kind === 'ROW_LEFT') {
        logger.error(
            { scopeId: input.scopeId },
            'S37 mutated the amount but the participation row left its pending state'
        );
        return { outcome: 'MUTATED_BUT_ROW_LEFT' };
    }
    logger.error(
        { ...result.details },
        'S37 mutated the amount but the next charge day left the application date'
    );
    return { outcome: 'MUTATED_BUT_ROW_LEFT' };
}
