import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import {
    eq,
    findCreditedPendingAuthorizations,
    getDb,
    subscriptionModel,
    subscriptions
} from '@repo/db';
import { createLogger } from '@repo/logger';
import { actStartInstant, assertFreshForAct, type PaymentProvider } from '@repo/payments';
import { VerticalEnumSchema } from '@repo/schemas';
import { type CoverageNotices, unwiredCoverageNotices } from '../payment/payment-ports';
import { recordProviderCancellationDecided } from '../reconciliation/provider-cancellation-decision';
import { activatePendingWithSignupNotice } from './activate-pending-with-signup-notice.js';
import {
    cancelInheritedTouristVips,
    type TouristVipInheritancePort
} from './cancel-inherited-tourist-vip.service';
import type { ComplementPolicyPorts } from './complement-ports.js';
import { exitGraceOnCreditedPayment } from './exit-grace.service';
import { reactivateSuspendedOnCreditedPayment } from './reactivate-suspended.service';
import { enqueueSignupIncompleteNotice } from './signup-incomplete-notice.ts';
import type { BeforeCancelNotice } from './start-subscription.service';
import type { ScheduledChangeApplier, SuccessionCloser } from './subscription-billing-ports';
import { findOpenRetentionsBySubscription } from './succession-retained-payment';

const logger = createLogger('subscription-window-expiry');

export interface ExpireAuthorizationWindowsPorts {
    readonly provider: PaymentProvider;
    readonly clock: Clock;
    readonly beforeCancelNotice: BeforeCancelNotice;
    readonly touristVipInheritance: TouristVipInheritancePort;
    /** Receives the post-commit S2 notice (B4.2); defaults to the unwired logger. */
    readonly coverageNotices?: CoverageNotices;
    /**
     * S18's interface (B8b), handed to S2 for branch 1 (AC:B7:25): when the
     * activated successor's predecessor holds an S19 retention. Defaults to
     * `unimplementedSuccessionCloser`, which throws.
     */
    readonly successionCloser?: SuccessionCloser;
    /** S38's interface, handed to S7 on branch 2 (AC:B7:28); unwired uses S7's failing default. */
    readonly scheduledChangeApplier?: ScheduledChangeApplier;
    readonly complements?: ComplementPolicyPorts;
}

export interface ExpireAuthorizationWindowsSummary {
    readonly abandoned: number;
    readonly activated: number;
    readonly cancelCalls: number;
    readonly noticePending: number;
    readonly skipped: number;
    readonly touristVipCancelled: number;
    /** Retained S19 payments of an abandoned successor's predecessor handed to S5/S7 (branch 2). */
    readonly retainedReevaluated: number;
    readonly failed: number;
}

export interface ActivateCreditedPendingSummary {
    readonly candidates: number;
    readonly activated: number;
    readonly notActive: number;
    readonly skipped: number;
    readonly failed: number;
    readonly touristVipCancelled: number;
}

async function activatePendingRow(
    subscription: (typeof subscriptions)['$inferSelect'],
    ports: ExpireAuthorizationWindowsPorts
): Promise<{
    readonly activated: boolean;
    readonly skipped: boolean;
    readonly touristVipCancelled: number;
}> {
    const wrote = await activatePendingWithSignupNotice(
        { subscriptionId: subscription.id, now: ports.clock.now() },
        { successionCloser: ports.successionCloser }
    );
    if (!wrote) return { activated: false, skipped: true, touristVipCancelled: 0 };
    const vertical = VerticalEnumSchema.safeParse(subscription.vertical);
    if (subscription.userId && vertical.success) {
        try {
            await (ports.coverageNotices ?? unwiredCoverageNotices).emitCoverageChanged({
                userId: subscription.userId,
                vertical: vertical.data,
                sourceType: 'SUBSCRIPTION',
                change: subscription.succeedsId ? 'CHANGED' : 'ADDED'
            });
        } catch (error) {
            logger.error(
                { subscriptionId: subscription.id, error },
                'Coverage changed notice failed after activation commit'
            );
        }
    } else {
        logger.error(
            { subscriptionId: subscription.id, vertical: subscription.vertical },
            'Activated subscription has no coverage subject to notify'
        );
    }
    let touristVipCancelled = 0;
    if (subscription.userId) {
        try {
            touristVipCancelled = (
                await cancelInheritedTouristVips({ userId: subscription.userId }, ports)
            ).cancelled;
        } catch (error) {
            logger.error(
                { subscriptionId: subscription.id, error },
                'Inherited Tourist VIP cancellation will be retried'
            );
        }
    }
    return { activated: true, skipped: false, touristVipCancelled };
}

/**
 * HOS-1740 owner decision: recover paid pending signups before their 72-hour
 * window expires because a preapproval webhook can fail or never redeliver after
 * the person has paid. Rows without a locally SUCCEEDED payment are not read
 * from the provider, avoiding unnecessary provider calls for unpaid signups.
 */
export async function activateCreditedPendingAuthorizations(
    limit: number,
    ports: ExpireAuthorizationWindowsPorts
): Promise<ActivateCreditedPendingSummary> {
    const rows = await findCreditedPendingAuthorizations({ now: ports.clock.now(), limit });
    let activated = 0,
        notActive = 0,
        skipped = 0,
        failed = 0,
        touristVipCancelled = 0;
    for (const row of rows) {
        try {
            if (!row.providerLink) {
                skipped++;
                continue;
            }
            const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
            actStartInstant({ act });
            const read = await ports.provider.readAuthorization({
                authorizationId: row.providerLink.providerId
            });
            const { snapshot } = assertFreshForAct({ read, act });
            if (snapshot.status !== 'active') {
                notActive++;
                continue;
            }
            const result = await activatePendingRow(row.subscription, ports);
            if (result.activated) activated++;
            if (result.skipped) skipped++;
            touristVipCancelled += result.touristVipCancelled;
        } catch (error) {
            failed++;
            logger.error(
                error,
                `Credited pending authorization recovery failed (subscription: ${row.subscription.id})`,
                { capture: true }
            );
        }
    }
    return { candidates: rows.length, activated, notActive, skipped, failed, touristVipCancelled };
}

/**
 * Branch 2 of `12` §5.3 (B7.md AC:B7:16; HOS-1561 H9): the successor's window
 * expired and S3 abandoned it, so the succession is over and every payment S19
 * retained on the predecessor is re-evaluated in the act — by S5 when the
 * predecessor is in `GRACE_PERIOD`, by S7 (with the retention's unpaid-period
 * anchor) when it is `SUSPENDED`. Any other state is left to the sweep. S5/S7
 * close each retention with `REEVALUATED` when they decide its destination.
 *
 * Runs after the abandonment committed; an error is logged per payment and never
 * undoes the abandonment (the retention stays open for the sweep).
 *
 * @param input.predecessorId - The `succeeds_id` of the abandoned successor
 * @param ports - S3's ports
 * @returns How many retained payments were handed to S5/S7
 */
async function reevaluateRetainedPayments(
    input: { readonly predecessorId: string },
    ports: ExpireAuthorizationWindowsPorts
): Promise<number> {
    const { predecessorId } = input;
    let retentions: Awaited<ReturnType<typeof findOpenRetentionsBySubscription>>;
    let status: string | undefined;
    try {
        retentions = await findOpenRetentionsBySubscription({ subscriptionId: predecessorId });
        if (retentions.length === 0) return 0;
        const [predecessor] = await getDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, predecessorId))
            .limit(1);
        status = predecessor?.status;
    } catch (error) {
        logger.error(
            { subscriptionId: predecessorId, error },
            'Retained payments of the abandoned succession could not be read; the sweep picks them up'
        );
        return 0;
    }
    let reevaluated = 0;
    for (const retention of retentions) {
        const paymentId = retention.paymentId;
        if (!paymentId) {
            // The manual door (MP1/MP4) is Phase 4 (H3): no writer retains a manual payment yet.
            logger.warn(
                { subscriptionId: predecessorId, retentionId: retention.id },
                'Retained manual payment is not re-evaluated by S3; the sweep picks it up'
            );
            continue;
        }
        try {
            switch (status) {
                case 'GRACE_PERIOD':
                    await exitGraceOnCreditedPayment(
                        { paymentId },
                        { provider: ports.provider, clock: ports.clock, actorType: 'job' }
                    );
                    reevaluated++;
                    break;
                case 'SUSPENDED':
                    await reactivateSuspendedOnCreditedPayment(
                        { paymentId, unpaidSince: retention.unpaidSince },
                        {
                            provider: ports.provider,
                            clock: ports.clock,
                            actorType: 'job',
                            ...(ports.coverageNotices
                                ? { coverageNotices: ports.coverageNotices }
                                : {}),
                            ...(ports.scheduledChangeApplier
                                ? { scheduledChangeApplier: ports.scheduledChangeApplier }
                                : {}),
                            ...(ports.complements ? { complements: ports.complements } : {})
                        }
                    );
                    reevaluated++;
                    break;
                default:
                    logger.info(
                        { subscriptionId: predecessorId, paymentId, status },
                        'Predecessor is neither in grace nor suspended; the sweep resolves its retained payment'
                    );
            }
        } catch (error) {
            logger.error(
                { subscriptionId: predecessorId, paymentId, error },
                'Re-evaluation of a retained payment failed; the abandonment stands'
            );
        }
    }
    return reevaluated;
}

/** S3: stored row deadlines determine eligibility; provider state is re-read by id. */
export async function expireAuthorizationWindows(
    limit: number,
    ports: ExpireAuthorizationWindowsPorts
): Promise<ExpireAuthorizationWindowsSummary> {
    const rows = await subscriptionModel.findExpiredAuthorizationWindows({
        now: ports.clock.now(),
        limit
    });
    let abandoned = 0;
    let activated = 0;
    let cancelCalls = 0;
    let noticePending = 0;
    let skipped = 0;
    let touristVipCancelled = 0;
    let retainedReevaluated = 0;
    let failed = 0;

    for (const row of rows) {
        try {
            const { subscription, providerLink } = row;
            if (subscription.paymentMethod !== 'MANUAL' && providerLink) {
                const act = { kind: 'decision' as const, startedAt: ports.clock.now() };
                actStartInstant({ act });
                const read = await ports.provider.readAuthorization({
                    authorizationId: providerLink.providerId
                });
                const { snapshot } = assertFreshForAct({ read, act });

                if (snapshot.status === 'active') {
                    const result = await activatePendingRow(subscription, ports);
                    if (result.activated) activated++;
                    if (result.skipped) skipped++;
                    touristVipCancelled += result.touristVipCancelled;
                    continue;
                }

                if (snapshot.status !== 'cancelled') {
                    const notice = await ports.beforeCancelNotice.beforeCancel({
                        subscriptionId: subscription.id,
                        userId: subscription.userId!,
                        kind: 'AUTHORIZATION_EXPIRED'
                    });
                    if (notice === 'NOT_YET_SENT') {
                        noticePending++;
                    } else {
                        if (notice === 'NO_RECIPIENT' || notice === 'DELIVERY_EXHAUSTED') {
                            logger.warn(
                                { subscriptionId: subscription.id, notice },
                                'Before-cancel notice is not deliverable'
                            );
                        }
                        cancelCalls++;
                        try {
                            await ports.provider.cancel({
                                authorizationId: providerLink.providerId
                            });
                        } catch (error) {
                            logger.error(
                                { subscriptionId: subscription.id, error },
                                'Expired authorization could not be cancelled'
                            );
                        }
                    }
                }
            }

            const abandonedAt = ports.clock.now();
            const result = await getDb().transaction(async (tx) => {
                const wrote = await subscriptionModel.abandonPendingAuthorization({
                    subscriptionId: subscription.id,
                    now: abandonedAt,
                    tx
                });
                if (wrote.wrote) {
                    await enqueueSignupIncompleteNotice({
                        tx,
                        subscription,
                        closedCourtesyMonths: wrote.closedCourtesyMonths
                    });
                    // S3 decided the cancellation even when the notice deferred the call: the sweep
                    // finishes it (AC:B11:6). A manual payer had no call, so it records nothing.
                    if (subscription.paymentMethod !== 'MANUAL' && providerLink) {
                        await recordProviderCancellationDecided({
                            subscriptionId: subscription.id,
                            transition: 'S3',
                            decidedAt: abandonedAt,
                            actor: { type: 'job' },
                            correlationId: randomUUID(),
                            changes: [
                                { field: 'status', old: 'PENDING_AUTHORIZATION', new: 'ABANDONED' }
                            ],
                            tx
                        });
                    }
                }
                return wrote;
            });
            if (result.wrote) abandoned++;
            else skipped++;
            // Branch 2 (HOS-1561 H9): only after the abandonment committed.
            if (result.wrote && subscription.succeedsId)
                retainedReevaluated += await reevaluateRetainedPayments(
                    { predecessorId: subscription.succeedsId },
                    ports
                );
        } catch (error) {
            failed++;
            logger.error(
                error,
                `Authorization window expiry failed (subscription: ${row.subscription.id})`,
                { capture: true }
            );
        }
    }

    return {
        abandoned,
        activated,
        cancelCalls,
        noticePending,
        skipped,
        touristVipCancelled,
        retainedReevaluated,
        failed
    };
}
