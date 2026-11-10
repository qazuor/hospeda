import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    billingOptions,
    type DrizzleClient,
    eq,
    getDb,
    planMigrationSubscriptions,
    planMigrations,
    promoRedemptions,
    providerLinks,
    subscriptionScheduledChanges,
    subscriptions,
    users
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { BillingCycleSchema, ServiceErrorCode } from '@repo/schemas';
import { getLocalDateString } from '@repo/utils';
import { z } from 'zod';
import { ServiceError } from '../../../types/index.js';
import type { PlanMigrationCohortRow } from './plan-migration-cohort.js';
import {
    PLAN_MIGRATION_UPCOMING_TEMPLATE,
    planMigrationNoticeDedupKey
} from './plan-migration-notice.js';
import { planMigrationRowPricing } from './plan-migration-pricing.js';
import {
    evaluateS37Guards,
    type PlanMigrationS37GuardVerdict
} from './plan-migration-s37-guards.js';
import { readS37NoticeState } from './plan-migration-s37-notice-gate.js';
import { applyPlanMigrationUpcomingNotice } from './plan-migration-upcoming-notice.js';

const logger = createLogger('plan-migration-s37');

const inputSchema = z.strictObject({
    planMigrationSubscriptionId: z.uuid(),
    correlationId: z.uuid()
});

/** What `S37` did with one migration row. */
export type PlanMigrationS37Result =
    | { readonly outcome: 'SKIPPED' | 'WAITING' | 'NOT_DUE'; readonly reason: string }
    | { readonly outcome: 'APPLIED_MANUAL' }
    | { readonly outcome: 'NOTICE_PENDING' }
    | { readonly outcome: 'NOT_AUTHORIZED'; readonly reason: string }
    | { readonly outcome: 'READY_TO_MUTATE'; readonly escalated: boolean };

type StopOutcome =
    | { readonly outcome: 'SKIPPED' | 'WAITING' | 'NOT_DUE'; readonly reason: string }
    | { readonly outcome: 'APPLIED_MANUAL' };

type TransactionOutcome =
    | StopOutcome
    | {
          readonly outcome: 'CARD_PENDING';
          readonly escalated: boolean;
          readonly dedupKey: string;
          readonly authorizationId: string | null;
      };

class ApplicationDateMismatch extends Error {
    constructor(
        readonly details: {
            readonly subscriptionId: string;
            readonly applicationDate: string;
            readonly nextChargeDay: string | null;
        }
    ) {
        super('S37 application date does not match the next charge day');
        this.name = 'ApplicationDateMismatch';
    }
}

/**
 * Runs `S37` for one migration participation row (TRANS:B:S37).
 *
 * The row moves through the pure guards, then the shared upcoming-notice
 * enqueuer (the same key as HOS-1613's batch), and finally one of two paths:
 *
 * - MANUAL: queue + promos to zero + `APLICADA` in the SAME transaction, with
 *   no provider call (AC:B12:5).
 * - CARD: the notice must have left (or be undeliverable per DEC-MAIL-001)
 *   and the preapproval must still read active, so this run only reports that
 *   the amount mutation may start (AC:B12:4). The mutation itself is c2's.
 *
 * @param input.planMigrationSubscriptionId - The participation row to process
 * @param input.correlationId - Correlation of this act
 * @param ports.provider - The injected payment provider port (never its adapter)
 * @param ports.clock - The injected clock
 * @returns The typed outcome of the act
 */
export async function runPlanMigrationS37ForRow(
    input: { readonly planMigrationSubscriptionId: string; readonly correlationId: string },
    ports: { readonly provider: PaymentProvider; readonly clock: Clock }
): Promise<PlanMigrationS37Result> {
    const parsed = inputSchema.parse(input);
    const now = ports.clock.now();
    let outcome: TransactionOutcome;
    try {
        outcome = await getDb().transaction(async (tx) =>
            runInsideTransaction({ tx, input: parsed, now })
        );
    } catch (error) {
        if (error instanceof ApplicationDateMismatch) {
            logger.error(
                { ...error.details, correlationId: parsed.correlationId },
                'S37 manual payer has a next charge day different from its application date'
            );
            return { outcome: 'SKIPPED', reason: 'APPLICATION_DATE_MISMATCH' };
        }
        throw error;
    }
    if (outcome.outcome !== 'CARD_PENDING') return outcome;
    return finishCard({ provider: ports.provider, clock: ports.clock, row: outcome });
}

async function runInsideTransaction(input: {
    readonly tx: DrizzleClient;
    readonly input: {
        readonly planMigrationSubscriptionId: string;
        readonly correlationId: string;
    };
    readonly now: Date;
}): Promise<TransactionOutcome> {
    const { tx, now } = input;
    const [lookup] = await tx
        .select({ planMigrationId: planMigrationSubscriptions.planMigrationId })
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.id, input.input.planMigrationSubscriptionId))
        .limit(1);
    if (!lookup) return { outcome: 'SKIPPED', reason: 'ROW_NOT_FOUND' };

    const [migration] = await tx
        .select({
            id: planMigrations.id,
            reason: planMigrations.reason,
            cancelledAt: planMigrations.cancelledAt,
            targetPlanVersionId: planMigrations.targetPlanVersionId
        })
        .from(planMigrations)
        .where(eq(planMigrations.id, lookup.planMigrationId))
        .for('update');
    if (!migration) return { outcome: 'SKIPPED', reason: 'ROW_NOT_FOUND' };

    const [row] = await tx
        .select({
            scopeId: planMigrationSubscriptions.id,
            scopeStatus: planMigrationSubscriptions.status,
            applicationDate: planMigrationSubscriptions.applicationDate,
            subscriptionId: subscriptions.id,
            userId: subscriptions.userId,
            customerName: users.displayName,
            email: users.email,
            class: subscriptions.class,
            status: subscriptions.status,
            paymentMethod: subscriptions.paymentMethod,
            nextChargeAt: subscriptions.nextChargeAt,
            succeedsId: subscriptions.succeedsId,
            succeededById: subscriptions.succeededById,
            billingOptionId: subscriptions.billingOptionId,
            cycle: billingOptions.cycle
        })
        .from(planMigrationSubscriptions)
        .innerJoin(subscriptions, eq(subscriptions.id, planMigrationSubscriptions.subscriptionId))
        .innerJoin(users, eq(users.id, subscriptions.userId))
        .innerJoin(billingOptions, eq(billingOptions.id, subscriptions.billingOptionId))
        .where(eq(planMigrationSubscriptions.id, input.input.planMigrationSubscriptionId))
        .limit(1)
        .for('update', { of: [planMigrationSubscriptions, subscriptions] });
    if (!row) return { outcome: 'SKIPPED', reason: 'ROW_NOT_FOUND' };
    if (!row.userId || !row.email || !row.billingOptionId || !row.nextChargeAt)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Migration row has an incomplete subscription anchor'
        );

    const cycle = BillingCycleSchema.parse(row.cycle);
    const [queued] = await tx
        .select({ id: subscriptionScheduledChanges.id })
        .from(subscriptionScheduledChanges)
        .where(eq(subscriptionScheduledChanges.subscriptionId, row.subscriptionId))
        .limit(1);
    const pricing = await planMigrationRowPricing({
        tx,
        row: {
            subscriptionId: row.subscriptionId,
            userId: row.userId,
            customerName: row.customerName,
            customerEmail: row.email,
            billingOptionId: row.billingOptionId,
            cycle,
            nextChargeAt: row.nextChargeAt,
            status: row.status as PlanMigrationCohortRow['status'],
            alreadyInMigration: true
        },
        targetPlanVersionId: migration.targetPlanVersionId,
        at: now
    });
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
            succeedsId: row.succeedsId,
            succeededById: row.succeededById
        },
        hasQueuedChange: queued !== undefined,
        targetOffersCycle: pricing.newAmount !== null && targetOption !== undefined,
        applicationDate: row.applicationDate,
        today: now
    });
    if (verdict.verdict !== 'PROCEED') return fromVerdict(verdict);

    const notice = await applyPlanMigrationUpcomingNotice({
        tx,
        planMigrationSubscriptionId: row.scopeId,
        now
    });
    if (notice.outcome !== 'ENQUEUED' && notice.outcome !== 'ALREADY_ENQUEUED')
        return {
            outcome: notice.outcome,
            reason: `UPCOMING_NOTICE_${notice.outcome}`
        };

    const [afterNotice] = await tx
        .select({ applicationDate: planMigrationSubscriptions.applicationDate })
        .from(planMigrationSubscriptions)
        .where(eq(planMigrationSubscriptions.id, row.scopeId))
        .limit(1);
    const applicationDate = afterNotice?.applicationDate ?? row.applicationDate;
    const applicationDay = getLocalDateString({ instant: applicationDate });
    const nextChargeDay = getLocalDateString({ instant: row.nextChargeAt });
    if (applicationDay !== nextChargeDay)
        throw new ApplicationDateMismatch({
            subscriptionId: row.subscriptionId,
            applicationDate: applicationDay,
            nextChargeDay
        });

    if (row.paymentMethod === 'MANUAL') {
        if (!targetOption)
            throw new ServiceError(
                ServiceErrorCode.CONFIGURATION_ERROR,
                'Migration destination cycle is missing'
            );
        await tx.insert(subscriptionScheduledChanges).values({
            subscriptionId: row.subscriptionId,
            targetPlanVersionId: migration.targetPlanVersionId,
            targetBillingOptionId: targetOption.id,
            effectiveAt: row.nextChargeAt,
            planMigrationSubscriptionId: row.scopeId,
            keepSelection: null
        });
        await tx
            .update(promoRedemptions)
            .set({ remainingCharges: 0 })
            .where(eq(promoRedemptions.subscriptionId, row.subscriptionId));
        await tx
            .update(planMigrationSubscriptions)
            .set({ status: 'APLICADA', appliedAt: now })
            .where(eq(planMigrationSubscriptions.id, row.scopeId));
        return { outcome: 'APPLIED_MANUAL' };
    }

    if (!notice.milestone)
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Upcoming notice was enqueued without a milestone'
        );
    const dedupKey = planMigrationNoticeDedupKey({
        recipientUserId: row.userId,
        template: PLAN_MIGRATION_UPCOMING_TEMPLATE,
        planMigrationSubscriptionId: row.scopeId,
        milestone: notice.milestone,
        targetDate: applicationDay
    });
    const [link] = await tx
        .select({ authorizationId: providerLinks.providerId })
        .from(providerLinks)
        .where(eq(providerLinks.subscriptionId, row.subscriptionId))
        .limit(1);
    return {
        outcome: 'CARD_PENDING',
        escalated: false,
        dedupKey,
        authorizationId: link?.authorizationId ?? null
    };
}

function fromVerdict(verdict: PlanMigrationS37GuardVerdict): StopOutcome {
    if (verdict.verdict === 'PROCEED')
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'A proceeding S37 guard verdict cannot stop a row'
        );
    return { outcome: verdict.verdict, reason: verdict.reason };
}

async function finishCard(input: {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly row: Extract<TransactionOutcome, { outcome: 'CARD_PENDING' }>;
}): Promise<PlanMigrationS37Result> {
    const state = await readS37NoticeState({ dedupKey: input.row.dedupKey });
    if (state === 'PENDING' || state === 'ABSENT') return { outcome: 'NOTICE_PENDING' };
    let escalated = input.row.escalated;
    if (state === 'UNDELIVERABLE') {
        escalated = true;
        logger.warn(
            { dedupKey: input.row.dedupKey },
            'S37 third notice is undeliverable; amount mutation still proceeds and is escalated'
        );
    }
    if (!input.row.authorizationId)
        return { outcome: 'NOT_AUTHORIZED', reason: 'NO_PROVIDER_LINK' };
    const act = { kind: 'decision' as const, startedAt: input.clock.now() };
    actStartInstant({ act });
    const read = await input.provider.readAuthorization({
        authorizationId: input.row.authorizationId
    });
    const fresh = assertFreshForAct({ read, act });
    if (fresh.snapshot.status !== 'active')
        return { outcome: 'NOT_AUTHORIZED', reason: 'NOT_ACTIVE' };
    return { outcome: 'READY_TO_MUTATE', escalated };
}
