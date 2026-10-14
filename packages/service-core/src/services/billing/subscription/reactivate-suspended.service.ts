import type { Clock } from '@repo/billing-verticals-contract';
import {
    and,
    coveredPeriods,
    eq,
    getDb,
    isNull,
    payments,
    providerLinks,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { ServiceErrorCode, VerticalEnumSchema } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports';
import type { ReconciliationMarkPayments } from '../reconciliation/reconciliation-mark-payments.port';
import { billingPeriodEnd } from './billing-period-end';
import {
    type CancelInheritedTouristVipSummary,
    cancelInheritedTouristVips,
    type TouristVipInheritancePort
} from './cancel-inherited-tourist-vip.service';
import {
    checkLatePaymentConditions,
    type LatePaymentFailedCondition
} from './late-payment-conditions';
import { openLatePaymentRejectedMark } from './late-payment-rejected-mark';
import type { BeforeCancelNotice } from './start-subscription.service';
import { releaseRetainedPayment, retainPaymentForSuccession } from './succession-retained-payment';

const logger = createLogger('reactivate-suspended');
const inputSchema = z.strictObject({ paymentId: z.uuid(), unpaidSince: z.date().optional() });
const S7_ADMITTED_STATUSES = ['SUSPENDED'] as const;

/** Where S7 leaves the row: `ACTIVE`, or `CANCEL_SCHEDULED` when the authorization is already cancelled. */
export type ReactivateSuspendedDestination = 'ACTIVE' | 'CANCEL_SCHEDULED';

/** Why S7 did not run on the payment; nothing was written. */
export type ReactivateSuspendedNotApplicableReason =
    | 'PAYMENT_NOT_CREDITED'
    | 'NO_SUBSCRIPTION'
    | 'NOT_SUSPENDED'
    | 'NOT_CARD_PRINCIPAL'
    /** H4: no anchor of the unpaid period; reason 7 was opened with the payment hung. */
    | 'NO_UNPAID_ANCHOR'
    /** H3: the authorization reread is neither `authorized` nor `cancelled`. */
    | 'UNDECIDABLE_AUTHORIZATION'
    | 'LOST_RACE';

/** Outcomes of applying S7 to a credited payment. */
export type ReactivateSuspendedResult =
    | {
          readonly outcome: 'REACTIVATED';
          readonly subscriptionId: string;
          readonly destination: ReactivateSuspendedDestination;
          /** The end of the paid period on `CANCEL_SCHEDULED`; `null` on `ACTIVE`. */
          readonly serviceEndsAt: Date | null;
          /**
           * The Tourist VIP clause's outcome (AC:B7:31), run after the commit; absent when
           * the clause was not wired or threw (the window-expiry sweep retries it).
           */
          readonly touristVip?: CancelInheritedTouristVipSummary;
      }
    | { readonly outcome: 'RETAINED_FOR_S19'; readonly subscriptionId: string }
    | {
          readonly outcome: 'CONDITION_FAILED';
          readonly subscriptionId: string;
          readonly failedCondition: LatePaymentFailedCondition;
      }
    | {
          readonly outcome: 'NOT_APPLICABLE';
          readonly reason: ReactivateSuspendedNotApplicableReason;
          readonly subscriptionId?: string;
      };

/** Input of S7: the credited payment and, for S19's re-evaluation, the unpaid-period anchor. */
export interface ReactivateSuspendedInput {
    readonly paymentId: string;
    /** When the unpaid period was observed; defaults to the row's `grace_started_at` (H1). */
    readonly unpaidSince?: Date;
}

/** Ports of S7; `actorType` names who brought the payment (notice or sweep). */
export interface ReactivateSuspendedPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly markPayments?: ReconciliationMarkPayments;
    readonly actorType?: 'provider' | 'job';
    readonly coverageNotices?: CoverageNotices;
    /** Our email before the paid Tourist VIP is cancelled (AC:B7:31, H10); unwired skips the clause. */
    readonly beforeCancelNotice?: BeforeCancelNotice;
    /** Whether the user's plan grants Tourist VIP again (AC:B7:31, H10); unwired skips the clause. */
    readonly touristVipInheritance?: TouristVipInheritancePort;
}

/** The verdict reached inside the row's transaction. */
type InTransactionVerdict =
    | {
          readonly kind: 'WRITTEN';
          readonly destination: ReactivateSuspendedDestination;
          readonly serviceEndsAt: Date | null;
          readonly userId: string | null;
          readonly vertical: string | null;
      }
    | {
          readonly kind: 'RETAINED';
          readonly unpaidSince: Date;
          readonly anchorMissing: boolean;
          readonly alreadyRetained: boolean;
      }
    | { readonly kind: 'FAILED'; readonly failedCondition: LatePaymentFailedCondition }
    | { readonly kind: 'NO_ANCHOR' }
    | { readonly kind: 'LOST_RACE' };

/**
 * Emits `ADDED` once the row's transaction committed (AC:B4:2, G5 `via: "notice"`):
 * the row emits a source again. A notice failure is logged and undoes nothing.
 */
async function emitAddedAfterCommit(input: {
    readonly subscriptionId: string;
    readonly userId: string | null;
    readonly vertical: string | null;
    readonly coverageNotices: CoverageNotices;
}): Promise<void> {
    const vertical = VerticalEnumSchema.safeParse(input.vertical);
    if (!input.userId || !vertical.success) {
        logger.error(
            { subscriptionId: input.subscriptionId, vertical: input.vertical },
            'Reactivated subscription has no coverage subject to notify'
        );
        return;
    }
    try {
        await input.coverageNotices.emitCoverageChanged({
            userId: input.userId,
            vertical: vertical.data,
            sourceType: 'SUBSCRIPTION',
            change: 'ADDED'
        });
    } catch (error) {
        logger.error(
            { subscriptionId: input.subscriptionId, error },
            'Coverage changed notice failed after reactivation commit'
        );
    }
}

/**
 * The mirror of S2's clause (AC:B7:31): once S7 committed, a plan that grants
 * Tourist VIP again cancels the user's paid Tourist VIP, our email first and no
 * refund. The clause rereads inheritance, the VIP rows and their authorizations
 * itself; nothing decided before S7's transaction is passed in. An unwired port
 * or a failure is logged and undoes nothing: `sweepInheritedTouristVips` retries.
 */
async function cancelInheritedTouristVipAfterCommit(input: {
    readonly subscriptionId: string;
    readonly userId: string | null;
    readonly ports: ReactivateSuspendedPorts;
}): Promise<CancelInheritedTouristVipSummary | undefined> {
    const { ports } = input;
    if (!input.userId || !ports.beforeCancelNotice || !ports.touristVipInheritance) {
        logger.warn(
            { subscriptionId: input.subscriptionId, userId: input.userId },
            'Tourist VIP clause not wired; the window-expiry sweep retries'
        );
        return undefined;
    }
    try {
        return await cancelInheritedTouristVips(
            { userId: input.userId },
            {
                provider: ports.provider,
                clock: ports.clock,
                beforeCancelNotice: ports.beforeCancelNotice,
                touristVipInheritance: ports.touristVipInheritance,
                coverageNotices: ports.coverageNotices
            }
        );
    } catch (error) {
        logger.error(
            { subscriptionId: input.subscriptionId, error },
            'Inherited Tourist VIP cancellation will be retried'
        );
        return undefined;
    }
}

/**
 * S7 (AC:B7:13): a credited payment returns a `SUSPENDED` card principal to
 * `ACTIVE` when the four conditions of `05` §3 hold — or to `CANCEL_SCHEDULED`,
 * with the service ending at the end of the paid period, when the authorization
 * reread by id is already `cancelled` (S6 cancelled it: the charge was in flight).
 * The grace clock (kept by S6 as the anchor of the unpaid period, H1) is emptied.
 *
 * The payment must already be credited by P1 (separate transactions, P1 first).
 * The provider is reread outside any transaction; the row is then reread and
 * row-locked inside the transaction that writes, and its status, the succession
 * (D-4 → `RETAINED_FOR_S19`, no mark) and condition 3 are decided there. On
 * `RETAINED_FOR_S19` S19 records the payment as pending in that same transaction
 * (`succession_retained_payment`, HOS-1561 H4): no mark, no notice, no refund.
 * When S7 instead decides the payment's destination (`WRITTEN`, a failed
 * condition 2, 3 or 4, or no anchor) it closes that payment's open retention with
 * `REEVALUATED` in the same transaction (branch 2, S3's re-evaluation, HOS-1561
 * H9); `RETAINED` and a lost race leave it open.
 * Conditions 2 and 3 open reason 7; condition 4 (a duplicate or a replay of an
 * already paid period) opens nothing (D-3). No anchor opens reason 7 (H4); an
 * authorization neither `authorized` nor `cancelled` writes nothing (H3).
 * `ADDED` goes to the coverage listener after the commit; then, outside any
 * transaction, the Tourist VIP clause runs on the reactivated row's user (AC:B7:31).
 *
 * @param input.paymentId - The credited payment
 * @param input.unpaidSince - The unpaid-period anchor (S19's re-evaluation); defaults to `grace_started_at`
 * @param ports - Provider, clock, mark payment port, actor type, coverage listener and the Tourist VIP clause's ports
 * @returns The S7 outcome
 */
export async function reactivateSuspendedOnCreditedPayment(
    input: ReactivateSuspendedInput,
    ports: ReactivateSuspendedPorts
): Promise<ReactivateSuspendedResult> {
    const value = inputSchema.parse(input);
    const [payment] = await getDb()
        .select()
        .from(payments)
        .where(eq(payments.id, value.paymentId))
        .limit(1);
    if (payment?.status !== 'SUCCEEDED')
        return { outcome: 'NOT_APPLICABLE', reason: 'PAYMENT_NOT_CREDITED' };
    if (!payment.subscriptionId) return { outcome: 'NOT_APPLICABLE', reason: 'NO_SUBSCRIPTION' };

    const [row] = await getDb()
        .select({ subscription: subscriptions, providerLink: providerLinks })
        .from(subscriptions)
        .innerJoin(providerLinks, eq(providerLinks.subscriptionId, subscriptions.id))
        .where(eq(subscriptions.id, payment.subscriptionId))
        .limit(1);
    if (!row) return { outcome: 'NOT_APPLICABLE', reason: 'NO_SUBSCRIPTION' };
    const { subscription, providerLink } = row;
    const subscriptionId = subscription.id;
    if (subscription.status !== 'SUSPENDED')
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_SUSPENDED', subscriptionId };
    if (subscription.class !== 'PRINCIPAL' || subscription.paymentMethod !== 'CARD')
        return { outcome: 'NOT_APPLICABLE', reason: 'NOT_CARD_PRINCIPAL', subscriptionId };

    // The network read goes first, outside the row's transaction.
    const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
    actStartInstant({ act });
    const authorizationRead = await ports.provider.readAuthorization({
        authorizationId: providerLink.providerId
    });
    const { snapshot: authorization } = assertFreshForAct({ read: authorizationRead, act });
    // The provider's `active` is the domain's `authorized`; `pending`/`paused` are undecidable (H3).
    let destination: ReactivateSuspendedDestination;
    switch (authorization.status) {
        case 'active':
            destination = 'ACTIVE';
            break;
        case 'cancelled':
            destination = 'CANCEL_SCHEDULED';
            break;
        case 'pending':
        case 'paused':
            logger.error(
                {
                    subscriptionId,
                    paymentId: payment.id,
                    authorizationStatus: authorization.status
                },
                'S7 cannot decide on the authorization status it reread; nothing written'
            );
            return {
                outcome: 'NOT_APPLICABLE',
                reason: 'UNDECIDABLE_AUTHORIZATION',
                subscriptionId
            };
        default: {
            const exhaustive: never = authorization.status;
            return exhaustive;
        }
    }

    const verdict = await getDb().transaction(async (tx): Promise<InTransactionVerdict> => {
        const [locked] = await tx
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, subscriptionId))
            .limit(1)
            .for('update');
        if (locked?.status !== 'SUSPENDED') return { kind: 'LOST_RACE' };
        const unpaidSince = value.unpaidSince ?? locked.graceStartedAt;
        const conditions = await checkLatePaymentConditions({
            subscription: locked,
            payment: {
                id: payment.id,
                amount: { amountMinor: payment.amount, currency: payment.currency }
            },
            authorizationRead,
            act,
            admittedStatuses: S7_ADMITTED_STATUSES,
            unpaidSince,
            tx
        });
        if ('retainedForS19' in conditions) {
            // S19 (AC:B7:16, HOS-1561 H4): the payment is recorded and left pending, with the
            // row still locked. Without an anchor the act's instant is the only honest one.
            const now = ports.clock.now();
            const anchor = unpaidSince ?? now;
            const retention = await retainPaymentForSuccession({
                subscriptionId,
                payment: { source: 'PAYMENT', id: payment.id },
                unpaidSince: anchor,
                now,
                tx
            });
            return {
                kind: 'RETAINED',
                unpaidSince: anchor,
                anchorMissing: unpaidSince === null,
                alreadyRetained: retention.outcome === 'ALREADY_RETAINED'
            };
        }
        // Branch 2 (HOS-1561 H9): the act that decides this payment's destination turns
        // its S19 flag off in this same transaction. A payment without an open
        // retention (the usual case) is not touched.
        const releaseRetention = async (): Promise<void> => {
            await releaseRetainedPayment({
                paymentId: payment.id,
                reason: 'REEVALUATED',
                now: ports.clock.now(),
                tx
            });
        };
        if (!conditions.ok) {
            await releaseRetention();
            // Without an anchor condition 4 fails closed; that is H4, not a duplicate (D-3).
            if (conditions.failedCondition === 4 && unpaidSince === null)
                return { kind: 'NO_ANCHOR' };
            return { kind: 'FAILED', failedCondition: conditions.failedCondition };
        }

        let serviceEndsAt: Date | null = null;
        if (destination === 'CANCEL_SCHEDULED') {
            const [covered] = await tx
                .select({ periodStart: coveredPeriods.periodStart })
                .from(coveredPeriods)
                .where(
                    and(eq(coveredPeriods.paymentId, payment.id), isNull(coveredPeriods.releasedAt))
                )
                .limit(1);
            if (!covered)
                throw new ServiceError(
                    ServiceErrorCode.INTERNAL_ERROR,
                    'Credited late payment has no open covered period',
                    undefined,
                    'S7_COVERED_PERIOD_MISSING'
                );
            serviceEndsAt = billingPeriodEnd({
                periodStart: covered.periodStart,
                everyMonths: authorization.cadence.everyMonths
            }).periodEnd;
        }
        const [updated] = await tx
            .update(subscriptions)
            .set({
                status: destination,
                ...(serviceEndsAt ? { serviceEndsAt } : {}),
                graceStartedAt: null,
                graceEndsAt: null,
                updatedAt: ports.clock.now()
            })
            .where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.status, 'SUSPENDED')))
            .returning({ userId: subscriptions.userId, vertical: subscriptions.vertical });
        if (!updated) return { kind: 'LOST_RACE' };
        await releaseRetention();
        return {
            kind: 'WRITTEN',
            destination,
            serviceEndsAt,
            userId: updated.userId,
            vertical: updated.vertical
        };
    });

    switch (verdict.kind) {
        case 'LOST_RACE':
            return { outcome: 'NOT_APPLICABLE', reason: 'LOST_RACE', subscriptionId };
        case 'RETAINED':
            if (verdict.anchorMissing)
                logger.warn(
                    { subscriptionId, paymentId: payment.id },
                    'S19 retained a payment on a SUSPENDED row without an unpaid-period anchor; the act instant is the anchor'
                );
            logger.info(
                {
                    subscriptionId,
                    paymentId: payment.id,
                    unpaidSince: verdict.unpaidSince,
                    alreadyRetained: verdict.alreadyRetained
                },
                'S19 retained the unpaid-period payment of a succession predecessor'
            );
            return { outcome: 'RETAINED_FOR_S19', subscriptionId };
        case 'NO_ANCHOR':
            logger.error(
                { subscriptionId, paymentId: payment.id },
                'SUSPENDED row has no unpaid-period anchor; S7 does not run (reason 7)'
            );
            await openLatePaymentRejectedMark({ subscriptionId, paymentId: payment.id, ports });
            return { outcome: 'NOT_APPLICABLE', reason: 'NO_UNPAID_ANCHOR', subscriptionId };
        case 'FAILED': {
            const { failedCondition } = verdict;
            logger.warn(
                { subscriptionId, paymentId: payment.id, failedCondition },
                'Late payment cannot reactivate the suspended subscription'
            );
            // Condition 4 (a duplicate or an already paid period) is not reason 7 (D-3).
            if (failedCondition === 2 || failedCondition === 3)
                await openLatePaymentRejectedMark({ subscriptionId, paymentId: payment.id, ports });
            return { outcome: 'CONDITION_FAILED', subscriptionId, failedCondition };
        }
        case 'WRITTEN': {
            logger.info(
                {
                    subscriptionId,
                    paymentId: payment.id,
                    destination: verdict.destination,
                    serviceEndsAt: verdict.serviceEndsAt?.toISOString() ?? null
                },
                'Suspended subscription reactivated after a credited payment'
            );
            await emitAddedAfterCommit({
                subscriptionId,
                userId: verdict.userId,
                vertical: verdict.vertical,
                coverageNotices: ports.coverageNotices ?? unwiredCoverageNotices
            });
            const touristVip = await cancelInheritedTouristVipAfterCommit({
                subscriptionId,
                userId: verdict.userId,
                ports
            });
            return {
                outcome: 'REACTIVATED',
                subscriptionId,
                destination: verdict.destination,
                serviceEndsAt: verdict.serviceEndsAt,
                ...(touristVip ? { touristVip } : {})
            };
        }
        default: {
            const exhaustive: never = verdict;
            return exhaustive;
        }
    }
}
