/**
 * Abandoned Pending Subscriptions Cron Job (SPEC-126 D6, HOS-151 Bug B)
 *
 * Reaps subscriptions that were created with `mode: 'paid'` (SPEC-124
 * wiring) but never had their provider preapproval confirmed before the
 * TTL expired. Without this reaper, abandoned rows would linger forever
 * in `incomplete` / `pending_provider` and pollute the customer's
 * subscription list.
 *
 * Behaviour:
 * - Runs every hour (minute 0).
 * - Targets `billing_subscriptions` rows where:
 *   - `status IN ('incomplete', 'pending_provider')` — covers both
 *     qzpay-vocabulary writes (mode='paid' create) and Hospeda-vocabulary
 *     writes (any future direct insert that uses `pending_provider`),
 *   - `created_at < now - 30 minutes` — matches the 30min `expiresAt`
 *     window the start-paid route returns to the front,
 *   - `deleted_at IS NULL`.
 * - For each stale row that still holds a live `mp_subscription_id`
 *   (HOS-151 Bug B), the MercadoPago preapproval is CANCELLED and then
 *   VERIFIED cancelled against the live provider (`retrieve()`) BEFORE the
 *   local row is flipped to `abandoned` — so no orphaned chargeable
 *   authorization survives. A cancel/verify failure leaves the row pending
 *   (retried next hour) and is captured to Sentry; it is NOT marked
 *   `abandoned` (D-2). Rows with no `mp_subscription_id` (nothing to cancel)
 *   are abandoned directly.
 * - Marks each reaped row canonical `abandoned` (Hospeda enum vocabulary).
 *   Legacy `incomplete_expired` rows written before this fix are handled
 *   by the `010-abandoned-status.data-migration.sql` extras migration.
 * - A process-level advisory lock (`pg_try_advisory_xact_lock(1006)`)
 *   guards the candidate SELECT so overlapping replicas do not both claim
 *   the same batch. The per-row cancel/verify + abandon write happen AFTER
 *   the lock-holding transaction commits (R-2) so no MercadoPago network
 *   call is ever made while a DB transaction is open; each abandon write is
 *   idempotent (guarded by `status IN pending`).
 *
 * @module cron/jobs/abandoned-pending-subs
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { QZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';
import { createMercadoPagoAdapter } from '@repo/billing';
import {
    billingPendingCheckoutModel,
    billingSubscriptions,
    getDb,
    sql,
    withTransaction
} from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { checkSubscriptionStatusTransition } from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { and, eq, inArray, isNull, lt } from 'drizzle-orm';
import { qzpayLogger } from '../../lib/qzpay-logger.js';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { planDisplayNameFromPlan } from '../../services/billing/plan-change-reason.js';
import { CONFIRMED_TERMINAL_STATUSES } from '../../services/billing/reactivation-supersession-complete.js';
import { sendNotification } from '../../utils/notification-helper.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Advisory lock key reserved for this job. Sibling billing crons use
 * 1003 (dunning), 1004 (trial-expiry). (1005 is free — trial-pre-end-notif
 * was retired in HOS-121.)
 */
const ADVISORY_LOCK_KEY = 1006;

/**
 * TTL applied to `pending_provider` / `incomplete` rows before the
 * reaper marks them abandoned. Matches the `expiresAt` returned by
 * `POST /api/v1/protected/billing/subscriptions/start-paid` so the
 * front-end and the cron agree on when a row is "stale".
 */
const PENDING_PROVIDER_TTL_MS = 30 * 60 * 1000;

/**
 * Subscription statuses that this cron considers "abandonable". qzpay-core
 * writes `incomplete` during its `mode: 'paid'` flow; the Hospeda enum
 * `pending_provider` is included for forward compatibility with any
 * direct-insert path that bypasses qzpay-core.
 */
const PENDING_STATUSES = ['incomplete', 'pending_provider'] as const;

/**
 * Terminal status written by the reaper. Uses the canonical Hospeda enum
 * value so DB queries for `status = 'abandoned'` find all abandoned rows.
 * Legacy rows that were written as `incomplete_expired` before this fix are
 * handled by the `010-abandoned-status.data-migration.sql` extras migration.
 */
const ABANDONED_STATUS = SubscriptionStatusEnum.ABANDONED;

/** Minimal subscription info for post-abandon notifications. */
interface AbandonedSubInfo {
    readonly id: string;
    readonly customerId: string;
    readonly planId: string;
}

/**
 * A stale pending row selected as a reap candidate. Carries the
 * `mpSubscriptionId` so the reaper can decide whether a live MercadoPago
 * preapproval must be cancelled before the local row is abandoned (Bug B).
 */
interface PendingCandidate {
    readonly id: string;
    readonly customerId: string;
    readonly planId: string;
    readonly mpSubscriptionId: string | null;
}

type CronTransactionResult =
    | { skipped: true }
    | { skipped: false; dryRunCount: number; candidates: readonly PendingCandidate[] };

/** Outcome of reaping a single candidate. */
type ReapOutcome =
    | { abandoned: true; info: AbandonedSubInfo }
    | {
          abandoned: false;
          reason: 'cancel-unverified' | 'already-reaped' | 'checkout-in-progress';
      };

/**
 * Cancel + verify a candidate's MercadoPago preapproval (if any) and, only
 * once the provider confirms a terminal state, flip the local row to
 * `abandoned`. Best-effort per row: a cancel/verify failure returns
 * `cancel-unverified` (the row stays pending for the next run) and is
 * captured to Sentry — it never throws, so the sweep continues.
 *
 * @internal Exported via {@link _internals} for unit testing.
 */
async function reapPendingCandidate(params: {
    readonly candidate: PendingCandidate;
    readonly billing: QZPayBilling;
    readonly paymentAdapter: QZPayMercadoPagoAdapter;
    readonly db: ReturnType<typeof getDb>;
    readonly logger: Parameters<CronJobDefinition['handler']>[0]['logger'];
}): Promise<ReapOutcome> {
    const { candidate, billing, paymentAdapter, db, logger } = params;
    const mpSubscriptionId = candidate.mpSubscriptionId?.trim();

    // Bug B core: a row that still holds a live preapproval must have it
    // cancelled AND verified cancelled on MercadoPago before we abandon the
    // local row — otherwise the preapproval keeps charging while the local row
    // is a terminal `abandoned` (permanent split-brain, since a late webhook's
    // `abandoned → active` write is rejected).
    if (mpSubscriptionId) {
        // Cancel attempt — swallow, the retrieve() below is the source of truth.
        try {
            await billing.subscriptions.cancel(candidate.id);
        } catch (cancelError) {
            logger.warn(
                'abandoned-pending-subs: cancel of MP preapproval failed on first attempt — verifying live provider status before deciding',
                {
                    subscriptionId: candidate.id,
                    mpSubscriptionId,
                    error: cancelError instanceof Error ? cancelError.message : String(cancelError)
                }
            );
        }

        // Re-verify against the PROVIDER, not the local row (mirrors
        // reactivation-supersession-complete Step 4). Only a confirmed-terminal
        // MP status lets us safely abandon.
        let liveStatus: string | undefined;
        try {
            const liveProviderSubscription =
                await paymentAdapter.subscriptions.retrieve(mpSubscriptionId);
            liveStatus = liveProviderSubscription?.status;
        } catch (retrieveError) {
            logger.warn(
                'abandoned-pending-subs: failed to retrieve MP preapproval — cannot confirm cancellation, leaving row pending',
                {
                    subscriptionId: candidate.id,
                    mpSubscriptionId,
                    error:
                        retrieveError instanceof Error
                            ? retrieveError.message
                            : String(retrieveError)
                }
            );
            liveStatus = undefined;
        }

        const confirmedCancelled =
            liveStatus !== undefined && CONFIRMED_TERMINAL_STATUSES.has(liveStatus);
        if (!confirmedCancelled) {
            // D-2: do NOT abandon a row whose preapproval is still live. Leave it
            // for the next hourly run and surface the failure to Sentry.
            const hardeningError = new Error(
                `abandoned-pending-subs: MP preapproval ${mpSubscriptionId} is still '${liveStatus ?? 'unresolved'}' after a cancel attempt — refusing to abandon a row with a live preapproval`
            );
            logger.error(
                'abandoned-pending-subs: preapproval cancel not confirmed — leaving row pending for retry',
                {
                    subscriptionId: candidate.id,
                    mpSubscriptionId,
                    liveStatus: liveStatus ?? null
                }
            );
            Sentry.captureException(hardeningError, {
                extra: {
                    subscriptionId: candidate.id,
                    customerId: candidate.customerId,
                    mpSubscriptionId,
                    liveStatus: liveStatus ?? null
                }
            });
            return { abandoned: false, reason: 'cancel-unverified' };
        }
    } else {
        // FIX B layer 1 (HOS-191 Path C): a `pending_provider` row with NO
        // `mp_subscription_id` is NOT automatically an abandoned checkout. In the
        // share-link flow it means "MercadoPago is collecting the card on its
        // hosted page and we have not linked the resulting preapproval yet". A
        // customer stuck on MP's 3DS/OTP step for more than the 30-minute cron
        // TTL is common; abandoning the row now would make the eventual link a
        // rejected `abandoned → active` transition and strand a real payment.
        //
        // While a still-valid `billing_pending_checkouts` correlation row exists
        // (status `pending`, resolved by `findByLocalSubscriptionId` after FIX E,
        // AND not past its own `expiresAt`), leave the row pending — the
        // back_url/webhook linker (or the reaper on a later run, once the
        // checkout's own TTL has elapsed) will resolve it. Only a missing or
        // expired correlation row is a genuine abandonment.
        const pendingCheckout = await billingPendingCheckoutModel.findByLocalSubscriptionId({
            localSubscriptionId: candidate.id
        });
        if (pendingCheckout && pendingCheckout.expiresAt.getTime() > Date.now()) {
            return { abandoned: false, reason: 'checkout-in-progress' };
        }
    }

    // Either there was no preapproval to cancel, or MP has confirmed it is
    // cancelled/terminal. Flip the local row to `abandoned`. The WHERE clause
    // re-asserts the pending precondition so a concurrent run that already
    // abandoned the row makes this a no-op (idempotent).
    //
    // FIX 2 (reaper TOCTOU): `candidate.mpSubscriptionId` is a snapshot from the
    // Phase-1 SELECT. Between that SELECT and this UPDATE, the link-preapproval
    // flow may have linked the row (setting `mp_subscription_id` while leaving
    // `status = pending_provider`, and marking the correlation row `linked` so
    // the "checkout-in-progress" guard above no longer sees it). Without an
    // `mp_subscription_id` guard the status-only WHERE would still match and
    // abandon a subscription that now holds a LIVE preapproval → split-brain.
    // Guard the write against the exact mp-id state we observed:
    //   - mp-null branch → require it is STILL null (a mid-sweep link makes this
    //     a no-op `already-reaped` rather than a wrong abandon);
    //   - cancel+verify branch → require the mp id is unchanged from the snapshot
    //     (a drift means the row was re-linked; do not abandon it).
    const mpGuard =
        mpSubscriptionId && candidate.mpSubscriptionId
            ? eq(billingSubscriptions.mpSubscriptionId, candidate.mpSubscriptionId)
            : isNull(billingSubscriptions.mpSubscriptionId);
    const [row] = await db
        .update(billingSubscriptions)
        .set({ status: ABANDONED_STATUS, updatedAt: new Date() })
        .where(
            and(
                eq(billingSubscriptions.id, candidate.id),
                inArray(billingSubscriptions.status, [...PENDING_STATUSES]),
                mpGuard,
                isNull(billingSubscriptions.deletedAt)
            )
        )
        .returning({
            id: billingSubscriptions.id,
            customerId: billingSubscriptions.customerId,
            planId: billingSubscriptions.planId
        });

    if (!row) {
        return { abandoned: false, reason: 'already-reaped' };
    }

    return { abandoned: true, info: row };
}

/**
 * Abandoned pending subscriptions cron job.
 */
export const abandonedPendingSubsJob: CronJobDefinition = {
    name: 'abandoned-pending-subs',
    description:
        'Cancels the MercadoPago preapproval (verified) of subscriptions stuck in pending_provider/incomplete past the 30-minute TTL, then marks them abandoned.',
    schedule: '0 * * * *', // Hourly at minute 0
    enabled: true,
    timeoutMs: 2 * 60 * 1000, // 2 minutes

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting abandoned-pending-subs job', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        try {
            // Guard: verify pending_provider → abandoned is a permitted transition
            // before doing any work. Static pre-condition check on the canonical
            // transition; the candidate SELECT already constrains rows to
            // PENDING_STATUSES so the `from` status is known. `pending_provider`
            // is the representative Hospeda-vocabulary source (`incomplete` is the
            // qzpay-vocabulary synonym). Only catches a future regression where the
            // transition table removes this edge.
            if (!dryRun) {
                const guardCheck = checkSubscriptionStatusTransition({
                    from: SubscriptionStatusEnum.PENDING_PROVIDER,
                    to: SubscriptionStatusEnum.ABANDONED
                });
                if (!guardCheck.valid) {
                    logger.error(
                        'abandoned-pending-subs: invalid transition guard — skipping status writes',
                        {
                            from: SubscriptionStatusEnum.PENDING_PROVIDER,
                            to: SubscriptionStatusEnum.ABANDONED,
                            reason: guardCheck.reason
                        }
                    );
                    return {
                        success: true,
                        message: 'Skipped - transition guard rejected pending_provider → abandoned',
                        processed: 0,
                        errors: 0,
                        durationMs: Date.now() - startedAt.getTime()
                    };
                }
            }

            // Phase 1: acquire the advisory lock and SELECT candidates inside a
            // short transaction. No provider calls and no status writes happen
            // here (R-2) — the transaction only claims the batch and releases the
            // lock at commit.
            const cronResult = await withTransaction<CronTransactionResult>(async (tx) => {
                const lockResult = await tx.execute(
                    sql`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}) AS acquired`
                );
                if (!lockResult.rows[0]?.acquired) {
                    return { skipped: true };
                }

                const cutoff = new Date(Date.now() - PENDING_PROVIDER_TTL_MS);

                if (dryRun) {
                    // Count without writing so operators can preview impact
                    // before flipping `dryRun` off in prod.
                    const rows = await tx
                        .select({ id: billingSubscriptions.id })
                        .from(billingSubscriptions)
                        .where(
                            and(
                                inArray(billingSubscriptions.status, [...PENDING_STATUSES]),
                                lt(billingSubscriptions.createdAt, cutoff),
                                isNull(billingSubscriptions.deletedAt)
                            )
                        );

                    return { skipped: false, dryRunCount: rows.length, candidates: [] };
                }

                const candidates = await tx
                    .select({
                        id: billingSubscriptions.id,
                        customerId: billingSubscriptions.customerId,
                        planId: billingSubscriptions.planId,
                        mpSubscriptionId: billingSubscriptions.mpSubscriptionId
                    })
                    .from(billingSubscriptions)
                    .where(
                        and(
                            inArray(billingSubscriptions.status, [...PENDING_STATUSES]),
                            lt(billingSubscriptions.createdAt, cutoff),
                            isNull(billingSubscriptions.deletedAt)
                        )
                    );

                return { skipped: false, dryRunCount: 0, candidates };
            });

            if (cronResult.skipped) {
                logger.info('Abandoned-pending-subs job skipped: another replica holds the lock');
                return {
                    success: true,
                    message: 'Skipped - another replica is running',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime()
                };
            }

            if (dryRun) {
                const durationMs = Date.now() - startedAt.getTime();
                logger.info('Abandoned-pending-subs job completed (dry run)', {
                    abandoned: cronResult.dryRunCount,
                    durationMs
                });
                return {
                    success: true,
                    message: `Dry run - would abandon ${cronResult.dryRunCount} subscription(s)`,
                    processed: cronResult.dryRunCount,
                    errors: 0,
                    durationMs,
                    details: { dryRun: true, abandoned: cronResult.dryRunCount }
                };
            }

            if (cronResult.candidates.length === 0) {
                const durationMs = Date.now() - startedAt.getTime();
                logger.info('Abandoned-pending-subs job completed', {
                    abandoned: 0,
                    durationMs,
                    dryRun
                });
                return {
                    success: true,
                    message: 'Marked 0 subscription(s) as abandoned',
                    processed: 0,
                    errors: 0,
                    durationMs,
                    details: { dryRun, abandoned: 0 }
                };
            }

            // Phase 2 (post-commit, R-2): cancel + verify + abandon per row. We
            // need the billing client AND the MP adapter to cancel/verify a live
            // preapproval. If either is unavailable we must NOT abandon rows that
            // hold a preapproval (we could not cancel them) — skip the whole run
            // and leave the rows pending for the next hour, rather than orphaning
            // a live charge.
            const billing = getQZPayBilling();
            if (!billing) {
                logger.warn(
                    'abandoned-pending-subs: billing not configured — cannot cancel preapprovals, leaving candidates pending',
                    { candidates: cronResult.candidates.length }
                );
                return {
                    success: true,
                    message: 'Skipped - billing not configured',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime(),
                    details: { dryRun, abandoned: 0, pending: cronResult.candidates.length }
                };
            }

            let paymentAdapter: QZPayMercadoPagoAdapter;
            try {
                paymentAdapter = createMercadoPagoAdapter({ logger: qzpayLogger });
            } catch (adapterError) {
                logger.warn(
                    'abandoned-pending-subs: failed to construct MercadoPago adapter — leaving candidates pending',
                    {
                        candidates: cronResult.candidates.length,
                        error:
                            adapterError instanceof Error
                                ? adapterError.message
                                : String(adapterError)
                    }
                );
                return {
                    success: true,
                    message: 'Skipped - MercadoPago adapter unavailable',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime(),
                    details: { dryRun, abandoned: 0, pending: cronResult.candidates.length }
                };
            }

            const db = getDb();
            const abandonedSubs: AbandonedSubInfo[] = [];
            let cancelUnverified = 0;
            let checkoutInProgress = 0;

            for (const candidate of cronResult.candidates) {
                const outcome = await reapPendingCandidate({
                    candidate,
                    billing,
                    paymentAdapter,
                    db,
                    logger
                });
                if (outcome.abandoned) {
                    abandonedSubs.push(outcome.info);
                } else if (outcome.reason === 'cancel-unverified') {
                    cancelUnverified++;
                } else if (outcome.reason === 'checkout-in-progress') {
                    // Healthy in-progress Path C checkout — deliberately left
                    // pending, not an error (FIX B layer 1).
                    checkoutInProgress++;
                }
            }

            // Best-effort user notifications — one failure must not abort the
            // sweep. Sent after the DB writes so the state is authoritative.
            for (const sub of abandonedSubs) {
                try {
                    const customer = await billing.customers.get(sub.customerId);
                    const plan = await billing.plans.get(sub.planId);

                    if (!customer) {
                        logger.warn(
                            'Customer not found for abandoned-sub notification — skipping',
                            { subscriptionId: sub.id, customerId: sub.customerId }
                        );
                        continue;
                    }

                    const recipientName =
                        typeof customer.metadata?.name === 'string'
                            ? customer.metadata.name
                            : customer.email.split('@')[0];

                    await sendNotification({
                        type: NotificationType.SUBSCRIPTION_CANCELLED,
                        recipientEmail: customer.email,
                        recipientName: recipientName ?? customer.email,
                        userId: null,
                        customerId: customer.id,
                        idempotencyKey: `abandoned-sub-${sub.id}`,
                        // HOS-231: display name; never leak the raw UUID/slug.
                        planName: plan ? planDisplayNameFromPlan(plan) : sub.planId
                    });

                    logger.debug('Sent abandoned-sub notification', {
                        subscriptionId: sub.id,
                        customerId: sub.customerId
                    });
                } catch (notifError) {
                    logger.warn('Failed to send abandoned-sub notification — continuing', {
                        subscriptionId: sub.id,
                        customerId: sub.customerId,
                        error: notifError instanceof Error ? notifError.message : String(notifError)
                    });
                }
            }

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('Abandoned-pending-subs job completed', {
                abandoned: abandonedSubs.length,
                cancelUnverified,
                checkoutInProgress,
                durationMs,
                dryRun
            });

            return {
                success: true,
                message: `Marked ${abandonedSubs.length} subscription(s) as abandoned${
                    cancelUnverified > 0
                        ? ` (${cancelUnverified} left pending — preapproval cancel unconfirmed)`
                        : ''
                }${
                    checkoutInProgress > 0
                        ? ` (${checkoutInProgress} left pending — Path C checkout still in progress)`
                        : ''
                }`,
                processed: abandonedSubs.length,
                // A cancel/verify that could not be confirmed is surfaced as an
                // error count (the row was intentionally NOT abandoned) so ops
                // sees a non-zero signal, even though the run itself succeeded.
                // An in-progress Path C checkout is NOT an error — it is a healthy
                // pending state — so it is reported separately, not in `errors`.
                errors: cancelUnverified,
                durationMs,
                details: {
                    dryRun,
                    abandoned: abandonedSubs.length,
                    cancelUnverified,
                    checkoutInProgress
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const durationMs = Date.now() - startedAt.getTime();

            logger.error('Abandoned-pending-subs job failed', {
                error: errorMessage,
                stack: error instanceof Error ? error.stack : undefined
            });

            return {
                success: false,
                message: `Failed: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs,
                details: { error: errorMessage }
            };
        }
    }
};

/**
 * Exported helpers for unit testing the constants, the per-candidate reaper,
 * and the job definition without spinning up a real DB.
 */
export const _internals = {
    ADVISORY_LOCK_KEY,
    PENDING_PROVIDER_TTL_MS,
    PENDING_STATUSES,
    ABANDONED_STATUS,
    reapPendingCandidate
};
