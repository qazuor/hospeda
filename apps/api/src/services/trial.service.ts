/**
 * Trial Service
 *
 * Manages 14-day trial lifecycle for all HOST users.
 * Handles trial creation, status checks, expiry detection, and reactivation.
 *
 * Features:
 * - Auto-start trial on HOST registration
 * - 14-day countdown tracking
 * - Auto-block on expiry (dashboard blocked, listings hidden, data preserved)
 * - Trial to paid subscription conversion
 * - Batch expiry checking
 * - Trial expiry and reminder notifications
 *
 * @module services/trial
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { QZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';
import { billingSubscriptionEvents, billingSubscriptions, getDb } from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import {
    BILLING_EVENT_TYPES,
    calculateTrialDaysRemaining,
    checkSubscriptionStatusTransition,
    DEFAULT_TRIAL_PLAN_SLUG,
    QZPAY_TO_HOSPEDA_STATUS,
    type ReactivateFromTrialInput,
    type ReactivateFromTrialResult,
    type ReactivateSubscriptionInput,
    type ReactivateSubscriptionResult,
    resolveIntendedInterval,
    type StartTrialInput,
    type TrialEndingSubscription,
    type TrialStatus,
    withServiceTransaction
} from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { and, eq, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { clearEntitlementCache } from '../middlewares/entitlement';
import { apiLogger } from '../utils/logger';
import { createPaidSubscription } from './billing/paid-subscription-create.js';
import { planDisplayNameFromPlan } from './billing/plan-change-reason.js';
import { resolveReactivationPlan } from './billing/reactivation-plan-guard.js';
import { SubscriptionCheckoutError } from './billing/subscription-checkout-error.js';

export type {
    ReactivateFromTrialInput,
    ReactivateFromTrialResult,
    ReactivateSubscriptionInput,
    ReactivateSubscriptionResult,
    StartTrialInput,
    TrialEndingSubscription,
    TrialStatus
};

/**
 * Advisory lock key for `blockExpiredTrials` batch job.
 *
 * pg_try_advisory_xact_lock is a session-level, non-blocking advisory lock.
 * Only one DB connection can hold this lock at a time, preventing concurrent
 * blockExpiredTrials runs across multiple API replicas.
 *
 * The value 1004 was chosen as a project-wide unique lock constant for this
 * specific job (SPEC-064 T-040). Document any new lock keys here to avoid
 * collisions.
 */
const BLOCK_EXPIRED_TRIALS_LOCK_KEY = 1004;

/**
 * Maximum number of trialing subscriptions claimed per `blockExpiredTrials` run.
 *
 * The cron fires daily, so unprocessed subs are claimed on the next tick.
 * Keeping this bound prevents a single run from holding the advisory lock
 * for an unbounded duration while fetching a huge result set from QZPay.
 *
 * `subscriptions.list()` supports `limit` + `offset`
 * (QZPayListOptions / QZPayPaginatedResult). We pass `limit` here and rely
 * on the cron cadence to drain the full backlog over successive runs.
 */
const BLOCK_EXPIRED_TRIALS_BATCH_SIZE = 200;

/**
 * Web path (with locale) to the owner pricing page that renders
 * `PricingCardsGrid.astro` — the ONLY page with the monthly/annual billing
 * toggle (HOS-115 §5). `/mi-cuenta/suscripcion` (the account subscription
 * page previously used here) renders `SubscriptionDashboard` instead, which
 * has no toggle — a `?interval=` query param appended to that URL would be
 * silently ignored. Every trial-eligible plan today is an owner plan (see
 * {@link DEFAULT_TRIAL_PLAN_SLUG}), so the owner pricing page is the correct,
 * single nudge target for every trial regardless of which plan it started on.
 */
const TRIAL_UPGRADE_PATH = '/es/suscriptores/planes/';

/**
 * Builds the trial→paid conversion nudge URL sent on the `TRIAL_ENDING_REMINDER`
 * notification (HOS-115 §5). Appends `?interval=<intendedInterval>` when the
 * trial recorded a valid intent, so the pricing page can pre-select the same
 * toggle the customer started from instead of defaulting to monthly. Degrades
 * gracefully — the query param is simply omitted — when `intendedInterval` is
 * missing or not one of the two known values.
 *
 * Single source of truth for this URL, with one live sender left:
 * `notification-schedule.job.ts`'s `TRIAL_ENDING_REMINDER`. It used to be shared
 * with `blockExpiredTrials`'s `TRIAL_EXPIRED` email, which HOS-171 deleted along
 * with the cancel-at-expiry cron — an elapsed card-first trial is a customer
 * MercadoPago is about to charge, not one to nudge into paying.
 *
 * A third sender once existed — `trial-pre-end-notif.job.ts` (SPEC-126 D5)
 * also sent `TRIAL_ENDING_REMINDER`, duplicating `notification-schedule`'s
 * send and building its own divergent `/cuenta/planes` link inline instead
 * of calling this function. It was disabled under HOS-115 as a duplicate-cron
 * fix and then DELETED under HOS-121, once its two robustness advantages
 * (skip-tolerant D-3 window + durable `billing_subscription_events` dedup)
 * were ported into `notification-schedule.job.ts`. Its divergent link is gone;
 * this function is again literally the only trial-nudge URL pattern in play.
 *
 * @param input.siteUrl - `HOSPEDA_SITE_URL` (no trailing slash expected).
 * @param input.intendedInterval - Raw value read off the trial
 *   subscription's `metadata.intendedInterval` (unknown/untyped at the
 *   source — the QZPay SDK does not narrow subscription metadata).
 * @returns The absolute upgrade URL, with `?interval=` appended only when a
 *   valid interval was recorded.
 */
export function buildTrialUpgradeUrl(input: {
    readonly siteUrl: string;
    readonly intendedInterval?: unknown;
}): string {
    const { siteUrl, intendedInterval } = input;
    const base = `${siteUrl}${TRIAL_UPGRADE_PATH}`;
    const resolved = resolveIntendedInterval(intendedInterval);
    return resolved ? `${base}?interval=${resolved}` : base;
}

/**
 * Result of a reconciliation run for a single customer.
 */
export interface ReconcileResult {
    /** Number of duplicate subscriptions that were cancelled */
    cancelledCount: number;
    /** IDs of the subscriptions that were cancelled */
    cancelledIds: readonly string[];
    /** ID of the subscription that was kept as the primary active one */
    keptId: string | null;
}

/**
 * Service for managing trial lifecycle
 */
export class TrialService {
    /**
     * @param billing - QZPay billing instance, or `null` when billing is disabled.
     *
     * @remarks
     * This service used to take a `sendNotification` sender, whose only consumer
     * was the `TRIAL_EXPIRED` email the cancel-at-expiry cron sent. Card-first
     * reconciliation sends nothing (HOS-171): a converting customer was already
     * warned by `TRIAL_ENDING_REMINDER` before the charge, and a failed charge is
     * the dunning cron's story. `TRIAL_ENDING_REMINDER` is dispatched by
     * `notification-schedule.job.ts`, not from here, so the sender is gone rather
     * than left dangling for callers to dutifully wire into nothing.
     */
    constructor(private readonly billing: QZPayBilling | null) {}

    /**
     * Get trial status for a customer
     * Returns information about current trial state
     *
     * @param customerId - Billing customer ID
     * @returns Trial status information
     */
    async getTrialStatus(input: { customerId: string }): Promise<TrialStatus> {
        if (!this.billing) {
            return {
                isOnTrial: false,
                isExpired: false,
                startedAt: null,
                expiresAt: null,
                daysRemaining: 0,
                planSlug: null,
                intendedInterval: null
            };
        }

        const { customerId } = input;

        try {
            // Get customer's subscriptions
            const subscriptions = await this.billing.subscriptions.getByCustomerId(customerId);

            if (!subscriptions || subscriptions.length === 0) {
                return {
                    isOnTrial: false,
                    isExpired: false,
                    startedAt: null,
                    expiresAt: null,
                    daysRemaining: 0,
                    planSlug: null,
                    intendedInterval: null
                };
            }

            // Find active or trial subscription
            const activeSubscription = subscriptions.find(
                (sub) => sub.status === 'trialing' || sub.status === 'active'
            );

            if (!activeSubscription) {
                // No active/trialing subscription — check whether there is a historical
                // canceled/ended subscription with a trial_end set. If found, surface the
                // trial as expired rather than returning the "never had a trial" defaults.
                // Note: a trial that converted to a paid plan (trialing → canceled + new active)
                // won't reach this branch because the new active sub was found above.
                const historicalTrialSub = subscriptions
                    .filter((sub) => sub.status === 'canceled' && sub.trialEnd != null)
                    .sort((a, b) => {
                        // Most-recent first: use trialEnd as the ordering key.
                        const aTime = a.trialEnd ? new Date(a.trialEnd).getTime() : 0;
                        const bTime = b.trialEnd ? new Date(b.trialEnd).getTime() : 0;
                        return bTime - aTime;
                    })[0];

                if (!historicalTrialSub) {
                    // Never had a trial.
                    return {
                        isOnTrial: false,
                        isExpired: false,
                        startedAt: null,
                        expiresAt: null,
                        daysRemaining: 0,
                        planSlug: null,
                        intendedInterval: null
                    };
                }

                // Historical canceled/ended sub with a trial — fetch plan for its slug.
                const historicalPlan = await this.billing.plans.get(historicalTrialSub.planId);
                // HOS-115 §5 nudge delivery path 2: read back the interval this
                // (most-recent, per the sort above) trial recorded so a user who
                // navigates directly to the pricing page — no `?interval=` query
                // param — still gets the toggle pre-selected to their original intent.
                const historicalIntendedInterval = resolveIntendedInterval(
                    (historicalTrialSub.metadata as Record<string, unknown> | undefined)
                        ?.intendedInterval
                );
                return {
                    isOnTrial: false,
                    isExpired: true,
                    startedAt: historicalTrialSub.trialStart
                        ? new Date(historicalTrialSub.trialStart).toISOString()
                        : null,
                    expiresAt: historicalTrialSub.trialEnd
                        ? new Date(historicalTrialSub.trialEnd).toISOString()
                        : null,
                    daysRemaining: 0,
                    planSlug: historicalPlan?.name || null,
                    intendedInterval: historicalIntendedInterval
                };
            }

            // Get plan information
            const plan = await this.billing.plans.get(activeSubscription.planId);

            const isOnTrial = activeSubscription.status === 'trialing';
            const now = new Date();
            const trialEnd = activeSubscription.trialEnd
                ? new Date(activeSubscription.trialEnd)
                : null;
            // Must be status-aware (HOS-171): under the card-first design a single
            // row carries `trialEnd` AND becomes `active` once MercadoPago charges
            // at day N. Keying expiry off `trialEnd` alone would report a paying
            // customer as expired forever, and `middlewares/trial.ts` would answer
            // every write with HTTP 402. Only a subscription that is still
            // `trialing` can have an expired trial.
            const isExpired = isOnTrial && trialEnd ? now > trialEnd : false;

            // Calculate days remaining
            const daysRemaining =
                trialEnd && !isExpired ? calculateTrialDaysRemaining({ trialEnd, now }) : 0;

            // HOS-115 §5 nudge delivery path 2 (see comment above the historical
            // branch). Read regardless of status — harmless when the sub already
            // converted to `active`, since the value simply mirrors the trial the
            // customer started from.
            const intendedInterval = resolveIntendedInterval(
                (activeSubscription.metadata as Record<string, unknown> | undefined)
                    ?.intendedInterval
            );

            return {
                isOnTrial,
                isExpired,
                startedAt: activeSubscription.trialStart
                    ? new Date(activeSubscription.trialStart).toISOString()
                    : null,
                expiresAt: trialEnd ? trialEnd.toISOString() : null,
                daysRemaining,
                planSlug: plan?.name || null,
                intendedInterval
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    customerId,
                    error: errorMessage
                },
                'Failed to get trial status'
            );

            // Return safe default on error
            return {
                isOnTrial: false,
                isExpired: false,
                startedAt: null,
                expiresAt: null,
                daysRemaining: 0,
                planSlug: null,
                intendedInterval: null
            };
        }
    }

    /**
     * Check if a trial has expired
     * Returns expiry status without throwing errors
     *
     * @param customerId - Billing customer ID
     * @returns Whether trial is expired
     */
    async checkTrialExpiry(input: { customerId: string }): Promise<boolean> {
        const status = await this.getTrialStatus(input);
        return status.isExpired;
    }

    /**
     * Reconcile elapsed trials against the payment provider (batch operation).
     * Typically called by a cron job.
     *
     * ## ⚠️ This job CONVERTS. It does not cancel. (HOS-171)
     *
     * It replaces `blockExpiredTrials`, which cancelled every trial whose window
     * had elapsed. That was correct while trials were no-card: an elapsed trial
     * had no payment method behind it, so cancelling was the only option.
     *
     * Under card-first trials the customer authorized a card on day 1 and
     * MercadoPago charges automatically at day N. An elapsed trial is therefore
     * a customer the provider is about to charge, or already has. Cancelling
     * them here would terminate every converting customer at the exact moment
     * they start paying — silently, and while every existing test still passed.
     * If you are tempted to restore the cancel call, read AC-6 first.
     *
     * The provider, not the clock, decides the outcome:
     * - provider reports `active` → the charge landed → `trialing → active`
     * - provider reports `past_due` → the first charge failed → `past_due`, and
     *   the existing dunning cron owns the retries from there
     * - provider reports `cancelled`/`paused`/`finished` → mirror it locally
     * - provider reports `pending` → undecided; leave it for the next tick
     *
     * ## This is the BACKSTOP, not the primary path
     *
     * The primary conversion happens the instant the day-N charge settles, in
     * `subscription-payment-handler.ts` — the `subscription_authorized_payment`
     * webhook is the only event MercadoPago fires for that charge (the
     * preapproval status stays `authorized`, so `subscription_preapproval.updated`
     * may never arrive). Converting there keeps the window between "MP charged"
     * and "we know it" at seconds.
     *
     * This cron exists because that webhook can be lost — and has been: HOS-159
     * saw MP webhooks silently fail to arrive in production for an entire
     * period, with activation falling back to polling alone. Without a backstop,
     * a converted subscription would then stay locally `trialing` forever, which
     * makes the status meaningless, keeps the trial middleware answering writes
     * with HTTP 402, and silently suppresses `RENEWAL_REMINDER` (it filters on
     * `status: 'active'`).
     *
     * `subscription-poll.job.ts` does not cover this: it only drains enqueued
     * polling jobs, which complete once the sub leaves the pending state.
     *
     * A subscription the webhook already converted is skipped twice over: it is
     * no longer `trialing` (so the claim query never sees it) and it already has
     * a `TRIAL_RECONCILED` event (so the dedup guard would catch it anyway).
     *
     * ## Concurrency safety (ADR-019) — unchanged from the job this replaces
     * - Lock + fetch (claim) happen atomically inside ONE `withServiceTransaction`.
     *   `pg_try_advisory_xact_lock(1004)` is acquired, then `subscriptions.list()`
     *   is called while the transaction (and therefore the lock) is still open.
     *   When the transaction commits both the lock is released AND the claimed list
     *   is in hand. A concurrent invocation that arrives while this tx is open will
     *   get `pg_try_advisory_xact_lock = false` and skip without fetching.
     * - External calls (the provider `retrieve()`) happen OUTSIDE the lock-holding
     *   tx, per ADR-019 ("external calls are not rollback-able; external call first,
     *   then transaction").
     * - Per-subscription idempotency: before processing each subscription a
     *   `TRIAL_RECONCILED` event is checked in `billing_subscription_events`. This
     *   re-check guard protects against the window between the claim commit and
     *   the per-sub processing (SPEC-064 T-041).
     *
     * Claim phase pagination (T-016):
     * `subscriptions.list()` is called with `limit: BLOCK_EXPIRED_TRIALS_BATCH_SIZE`
     * (currently 200). Only one batch is claimed per cron tick. The daily cron
     * cadence drains the backlog over successive runs without ever holding the
     * advisory lock while fetching an unbounded result set.
     *
     * @param input.paymentAdapter - MercadoPago adapter used to re-read each
     *   preapproval. Supplied by the caller (the cron builds its own, mirroring
     *   `subscription-poll.job.ts`) rather than injected into the constructor,
     *   so the many call sites that only need the read paths stay unchanged.
     * @returns Number of trials whose local status this run reconciled.
     */
    async reconcileExpiredTrials(input: {
        readonly paymentAdapter: QZPayMercadoPagoAdapter;
    }): Promise<number> {
        const { paymentAdapter } = input;

        if (!this.billing) {
            apiLogger.debug('Billing not enabled, skipping trial reconciliation');
            return 0;
        }

        // ── CLAIM PHASE (ADR-019) ──────────────────────────────────────────────────
        // Acquire the advisory lock AND fetch the candidate list inside the SAME
        // transaction. The lock is held for the full duration of the tx so that a
        // concurrent invocation that tries to acquire the lock while we are still
        // fetching will get false and skip immediately. Once this tx commits, the
        // lock auto-releases and the fetched list is in hand for processing.
        //
        // External API calls (the provider retrieve()) are NOT allowed inside
        // a lock-holding transaction (ADR-019 §Negative). They run in the process
        // phase below, after the claim tx has committed.
        let claimedSubscriptions: (typeof billingSubscriptions.$inferSelect)[] | null = null;

        try {
            claimedSubscriptions = await withServiceTransaction(async (ctx) => {
                // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                const lockResult = await ctx.tx!.execute<{ pg_try_advisory_xact_lock: boolean }>(
                    sql`SELECT pg_try_advisory_xact_lock(${BLOCK_EXPIRED_TRIALS_LOCK_KEY})`
                );
                const lockAcquired = lockResult.rows[0]?.pg_try_advisory_xact_lock === true;

                if (!lockAcquired) {
                    // Return null to signal "lock not acquired — skip this run"
                    return null;
                }

                // Fetch the candidate list while the lock is still held. When the tx
                // commits the lock is released, but we already have the list.
                //
                // Read straight from the local table rather than through
                // `billing.subscriptions.list()` (which the cancel-at-expiry job this
                // replaced used). Three reasons, in order of weight:
                //  1. `mp_subscription_id` is the whole input to reconciliation and the
                //     qzpay SDK's `QZPaySubscription` does not expose it.
                //  2. Both filters (`trialing` AND elapsed window) run in SQL, so a
                //     batch of 200 is 200 rows worth reconciling — not 200 rows of
                //     which most get skipped in JS, starving the real backlog.
                //  3. It removes this claim's standing ADR-019 exception: there is no
                //     longer an external call inside the lock-holding transaction.
                //
                // Capped at BLOCK_EXPIRED_TRIALS_BATCH_SIZE to bound lock-hold duration
                // (T-016). Remaining subs are processed on the next cron tick.
                // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                const tx = ctx.tx!;

                return await tx
                    .select()
                    .from(billingSubscriptions)
                    .where(
                        and(
                            eq(billingSubscriptions.status, SubscriptionStatusEnum.TRIALING),
                            isNotNull(billingSubscriptions.trialEnd),
                            lt(billingSubscriptions.trialEnd, new Date()),
                            isNull(billingSubscriptions.deletedAt)
                        )
                    )
                    .limit(BLOCK_EXPIRED_TRIALS_BATCH_SIZE);
            });
        } catch (lockErr) {
            apiLogger.error(
                { error: lockErr instanceof Error ? lockErr.message : String(lockErr) },
                'reconcileExpiredTrials: failed to acquire advisory lock — skipping run'
            );
            return 0;
        }

        // null means another instance holds the lock — skip silently
        if (claimedSubscriptions === null) {
            apiLogger.warn(
                'reconcileExpiredTrials is already running (advisory lock held by another process), skipping concurrent invocation'
            );
            return 0;
        }

        if (claimedSubscriptions.length === 0) {
            apiLogger.info('No elapsed trials to reconcile');
            return 0;
        }

        // ── PROCESS PHASE ─────────────────────────────────────────────────────────
        // Lock has been released. Process each claimed subscription individually.
        // Per ADR-019, external API calls (the provider retrieve()) run here, outside
        // any lock-holding transaction. Each sub is re-checked for the TRIAL_RECONCILED
        // dedup event to guard against the window between claim commit and processing.

        try {
            apiLogger.info('Starting trial reconciliation batch job');

            const db = getDb();
            let reconciledCount = 0;

            for (const subscription of claimedSubscriptions) {
                // The claim query already filtered to a non-null, elapsed trialEnd;
                // this only narrows the nullable column type.
                const trialEnd = subscription.trialEnd;
                if (!trialEnd) {
                    continue;
                }

                try {
                    // ── Re-check guard (ADR-019 + SPEC-064 T-041) ─────────────────
                    // Between the claim commit and now, another instance or a prior run
                    // may have already processed this subscription. Re-verify by checking
                    // for a TRIAL_RECONCILED event before making any external calls.
                    const existingReconcile = await db
                        .select({ id: billingSubscriptionEvents.id })
                        .from(billingSubscriptionEvents)
                        .where(
                            and(
                                eq(billingSubscriptionEvents.subscriptionId, subscription.id),
                                eq(
                                    billingSubscriptionEvents.eventType,
                                    BILLING_EVENT_TYPES.TRIAL_RECONCILED
                                )
                            )
                        )
                        .limit(1);

                    if (existingReconcile.length > 0) {
                        apiLogger.debug(
                            { subscriptionId: subscription.id },
                            'reconcileExpiredTrials: TRIAL_RECONCILED event already exists, skipping (idempotent)'
                        );
                        continue;
                    }

                    // A trialing subscription with no preapproval cannot be
                    // reconciled — there is no provider record to ask. Under
                    // card-first this should not exist (every trial is created as a
                    // preapproval), so surface it instead of guessing an outcome.
                    // Guessing here means either cancelling a paying customer or
                    // granting a free one; both are worse than an alert.
                    if (!subscription.mpSubscriptionId) {
                        Sentry.captureException(
                            new Error(
                                `Trialing subscription has no provider id: ${subscription.id}`
                            ),
                            {
                                extra: {
                                    subscriptionId: subscription.id,
                                    customerId: subscription.customerId,
                                    trialEnd: trialEnd.toISOString()
                                },
                                tags: {
                                    module: 'trial-service',
                                    operation: 'reconcileExpiredTrials'
                                }
                            }
                        );
                        apiLogger.warn(
                            { subscriptionId: subscription.id },
                            'reconcileExpiredTrials: trialing subscription has no mpSubscriptionId — cannot reconcile, skipping'
                        );
                        continue;
                    }

                    // ── Ask the provider what actually happened ───────────────────
                    // This is the whole point of the job: the provider, not our
                    // clock, decides whether an elapsed trial converted. A failure
                    // here must leave the row untouched for the next tick — never
                    // fall back to a local assumption.
                    const providerSubscription = await paymentAdapter.subscriptions.retrieve(
                        subscription.mpSubscriptionId
                    );

                    const targetStatus = QZPAY_TO_HOSPEDA_STATUS[providerSubscription.status];

                    if (targetStatus === null) {
                        // `pending` — the provider has not settled it yet. Leave the
                        // row trialing and re-check on the next tick.
                        apiLogger.info(
                            {
                                subscriptionId: subscription.id,
                                providerStatus: providerSubscription.status
                            },
                            'reconcileExpiredTrials: provider status still pending — deferring to next run'
                        );
                        continue;
                    }

                    if (targetStatus === undefined) {
                        apiLogger.warn(
                            {
                                subscriptionId: subscription.id,
                                providerStatus: providerSubscription.status
                            },
                            `reconcileExpiredTrials: unknown provider subscription status: ${providerSubscription.status}`
                        );
                        Sentry.captureException(
                            new Error(
                                `Unknown provider subscription status during trial reconciliation: ${providerSubscription.status}`
                            ),
                            {
                                extra: {
                                    subscriptionId: subscription.id,
                                    providerStatus: providerSubscription.status
                                },
                                tags: {
                                    module: 'trial-service',
                                    operation: 'reconcileExpiredTrials'
                                }
                            }
                        );
                        continue;
                    }

                    // ── Status transition guard ───────────────────────────────────
                    // The claimed subscription object may be stale (fetched inside the
                    // claim tx that has since committed). Re-validate before writing.
                    const transitionGuard = checkSubscriptionStatusTransition({
                        from: subscription.status as `${SubscriptionStatusEnum}`,
                        to: targetStatus,
                        subscriptionId: subscription.id
                    });
                    if (!transitionGuard.valid) {
                        apiLogger.warn(
                            {
                                subscriptionId: subscription.id,
                                currentStatus: subscription.status,
                                targetStatus,
                                reason: transitionGuard.reason
                            },
                            'reconcileExpiredTrials: illegal status transition — skipping write'
                        );
                        continue;
                    }

                    const converted = targetStatus === SubscriptionStatusEnum.ACTIVE;

                    // ── Local writes, atomically ──────────────────────────────────
                    // Status + conversion stamp + dedup event must land together: a
                    // status write without its dedup event would let the next tick
                    // reprocess the subscription.
                    await withServiceTransaction(async (ctx) => {
                        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                        const tx = ctx.tx!;

                        await tx
                            .update(billingSubscriptions)
                            .set({
                                status: targetStatus,
                                // `trial_converted` / `trial_converted_at` record how
                                // the trial ENDED. Under card-first the provider's
                                // verdict decides that, so this is now the only
                                // place either column is written.
                                trialConverted: converted,
                                trialConvertedAt: new Date()
                            })
                            .where(eq(billingSubscriptions.id, subscription.id));

                        await tx.insert(billingSubscriptionEvents).values({
                            subscriptionId: subscription.id,
                            eventType: BILLING_EVENT_TYPES.TRIAL_RECONCILED,
                            previousStatus: subscription.status,
                            newStatus: targetStatus,
                            triggerSource: 'trial-reconcile-cron',
                            metadata: {
                                trialEnd: trialEnd.toISOString(),
                                providerStatus: providerSubscription.status,
                                converted,
                                reconciledAt: new Date().toISOString()
                            }
                        });
                    });

                    // The entitlement set changes on every one of these outcomes
                    // (converted → keeps access, cancelled/past_due → loses it), so
                    // the 5-minute cache must be dropped regardless (INV-1).
                    clearEntitlementCache(subscription.customerId);

                    reconciledCount++;

                    apiLogger.info(
                        {
                            subscriptionId: subscription.id,
                            customerId: subscription.customerId,
                            previousStatus: subscription.status,
                            newStatus: targetStatus,
                            converted,
                            trialEnd: trialEnd.toISOString()
                        },
                        converted
                            ? 'Trial converted to paid subscription'
                            : 'Reconciled elapsed trial to provider status'
                    );
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);

                    apiLogger.error(
                        {
                            subscriptionId: subscription.id,
                            error: errorMessage
                        },
                        'Failed to reconcile expired trial subscription'
                    );
                }
            }

            apiLogger.info({ reconciledCount }, 'Trial reconciliation batch job completed');

            return reconciledCount;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    error: errorMessage
                },
                'Failed to run trial reconciliation batch job'
            );

            return 0;
        }
    }

    /**
     * Extend an active trial by additional days
     * Only works for subscriptions with status 'trialing'
     *
     * @param input - Extension parameters
     * @returns New trial end date
     */
    async extendTrial(input: {
        subscriptionId: string;
        additionalDays: number;
    }): Promise<{ previousTrialEnd: string; newTrialEnd: string }> {
        if (!this.billing) {
            throw new Error('Billing not enabled');
        }

        const { subscriptionId, additionalDays } = input;

        try {
            apiLogger.info({ subscriptionId, additionalDays }, 'Extending trial period');

            // Get the subscription
            const subscription = await this.billing.subscriptions.get(subscriptionId);

            if (!subscription) {
                throw new Error(`Subscription not found: ${subscriptionId}`);
            }

            if (subscription.status !== 'trialing') {
                throw new Error(
                    `Cannot extend trial: subscription status is '${subscription.status}', expected 'trialing'`
                );
            }

            // Calculate new trial end date
            const currentTrialEnd = subscription.trialEnd
                ? new Date(subscription.trialEnd)
                : new Date();
            const newTrialEnd = new Date(currentTrialEnd);
            newTrialEnd.setDate(newTrialEnd.getDate() + additionalDays);

            // Update both the actual trialEnd field and metadata for audit trail
            await this.billing.subscriptions.update(subscriptionId, {
                trialEnd: newTrialEnd,
                metadata: {
                    ...((subscription.metadata as Record<string, string>) || {}),
                    trialExtendedAt: new Date().toISOString(),
                    trialExtendedBy: `${additionalDays} days`,
                    originalTrialEnd: currentTrialEnd.toISOString(),
                    newTrialEnd: newTrialEnd.toISOString()
                }
            });

            // Clear entitlement cache to reflect trial extension immediately
            clearEntitlementCache(subscription.customerId);

            apiLogger.info(
                {
                    subscriptionId,
                    previousTrialEnd: currentTrialEnd.toISOString(),
                    newTrialEnd: newTrialEnd.toISOString(),
                    additionalDays
                },
                'Trial period extended successfully'
            );

            return {
                previousTrialEnd: currentTrialEnd.toISOString(),
                newTrialEnd: newTrialEnd.toISOString()
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    subscriptionId,
                    additionalDays,
                    error: errorMessage
                },
                'Failed to extend trial'
            );

            throw error;
        }
    }

    /**
     * Reactivate from trial to a real, card-collecting paid subscription
     * (HOS-114). Supports both the monthly and annual billing intervals
     * (HOS-123 T-006) via `input.billingInterval`.
     *
     * Unlike the pre-HOS-114 behavior, this method does NOT create a
     * locally-`active` subscription with no MercadoPago preapproval behind
     * it (the "phantom-active" bug — see HOS-114 spec §2). It instead:
     *
     * 1. Resolves + validates `input.planId` (and `input.billingInterval`)
     *    against the live plan catalog, fail-closed on an unknown plan, a
     *    free plan, or a plan with no active price for the requested
     *    interval ({@link resolveReactivationPlan}).
     * 2. Ensures the billing customer exists.
     * 3. Creates a real `mode: 'paid'` MercadoPago preapproval via the shared
     *    {@link createPaidSubscription} helper (also used by `/start-paid`),
     *    for BOTH intervals — annual simply passes `billingInterval: 'annual'`,
     *    which qzpay maps to a 12-month cadence (HOS-171 §7.2). Annual used to
     *    take a one-time hosted-checkout charge here instead; it no longer
     *    exists. Fails closed if the provider returns no checkout URL.
     * 4. Returns a `checkoutUrl` the caller MUST redirect the user to. The
     *    created subscription is `incomplete`/`pending_provider`, not
     *    `active`, until the corresponding webhook confirms it.
     *
     * The old trial subscription is deliberately NOT cancelled here — see
     * the inline comment below (spec §6.4/§6.5, HOS-114 T-007).
     *
     * @param input - Reactivation parameters, including the resolved MP
     *   checkout return/notification URLs.
     * @returns The new (not-yet-confirmed) subscription id, its checkout URL,
     *   and its `incomplete`/`pending_provider` status.
     * @throws SubscriptionCheckoutError With code `PLAN_NOT_FOUND`,
     *   `INVALID_REACTIVATION_PLAN`, `ANNUAL_REACTIVATION_UNSUPPORTED`,
     *   `NO_ANNUAL_PRICE`, `CUSTOMER_NOT_FOUND`, or `MISSING_INIT_POINT`.
     */
    async reactivateFromTrial(input: ReactivateFromTrialInput): Promise<ReactivateFromTrialResult> {
        if (!this.billing) {
            throw new Error('Billing not enabled');
        }

        const { customerId, planId, urls, billingInterval = 'monthly' } = input;

        try {
            apiLogger.info(
                { customerId, planId, billingInterval },
                'Reactivating customer from trial'
            );

            // HOS-114 §6.1/AC-6: resolve + validate the target plan FIRST,
            // fail-closed on unknown/free/annual plans before touching the
            // customer or any existing subscription. HOS-123: threads
            // `billingInterval` so the guard resolves the annual price
            // (and its own `NO_ANNUAL_PRICE`/`INVALID_REACTIVATION_PLAN`
            // validation) instead of always defaulting to monthly.
            const { plan, priceId, interval } = await resolveReactivationPlan({
                billing: this.billing,
                planId,
                billingInterval
            });

            // Ensure the billing customer actually exists before creating a
            // paid preapproval against it (mirrors the identical guard in
            // `initiatePaidMonthlySubscription`'s trial/comp branches).
            const customer = await this.billing.customers.get(customerId);
            if (!customer) {
                throw new SubscriptionCheckoutError(
                    'CUSTOMER_NOT_FOUND',
                    `Customer '${customerId}' not found`
                );
            }

            // Identify the trialing subscription(s) this reactivation
            // supersedes so the webhook can complete the swap once the new
            // preapproval is confirmed (spec §6.4). A single trialing sub is
            // the expected case; a comma-joined list defensively covers the
            // (unexpected) multi-sub case without losing any id.
            const existingSubscriptions =
                await this.billing.subscriptions.getByCustomerId(customerId);
            const supersedesSubscriptionId = (existingSubscriptions ?? [])
                .filter((sub) => sub.status === 'trialing')
                .map((sub) => sub.id)
                .join(',');

            if (interval === 'annual') {
                // HOS-123: annual reactivation routes through the one-time
                // hosted-checkout charge instead of a recurring preapproval.
                // The guard already resolved an annual price for this plan,
                // so `urls` MUST carry the annual (successUrl/cancelUrl) shape
                // — the caller (the reactivate route) is responsible for
                // resolving the correct union member from `billingInterval`.
                if (!('successUrl' in urls)) {
                    throw new Error(
                        'Annual reactivation requires successUrl/cancelUrl/notificationUrl checkout URLs'
                    );
                }

                // HOS-171 §7.2: annual reactivation is now a recurring
                // preapproval, exactly like monthly — same helper, same
                // card-collecting checkout. `urls.successUrl` is MP's single
                // `back_url`; a preapproval has no cancel redirect, so
                // `urls.cancelUrl` is unused here.
                const { subscription, checkoutUrl } = await createPaidSubscription({
                    billing: this.billing,
                    customerId,
                    planId: plan.id,
                    priceId,
                    billingInterval: 'annual',
                    paymentMethodReturnUrl: urls.successUrl,
                    notificationUrl: urls.notificationUrl,
                    metadata: {
                        convertedFromTrial: 'true',
                        convertedAt: new Date().toISOString(),
                        ...(supersedesSubscriptionId ? { supersedesSubscriptionId } : {})
                    }
                });
                const localSubscriptionId = subscription.id;

                // Deferred to webhook (HOS-114 T-007, mirrored for the annual
                // `payment.updated` confirmation path): cancel superseded sub +
                // audit + clearEntitlementCache on PENDING_PROVIDER->ACTIVE. The
                // old trialing subscription stays live and keeps granting
                // entitlements until the provider confirms this new checkout.
                apiLogger.info(
                    {
                        customerId,
                        newSubscriptionId: localSubscriptionId,
                        planId: plan.id,
                        checkoutUrl
                    },
                    'Initiated annual paid reactivation from trial — awaiting MercadoPago confirmation'
                );

                return {
                    success: true,
                    subscriptionId: localSubscriptionId,
                    checkoutUrl,
                    status: 'pending_provider',
                    message: 'Redirect to MercadoPago to complete reactivation'
                };
            }

            // HOS-123: `urls` is now a discriminated union (monthly preapproval
            // shape vs annual hosted-checkout shape). `interval === 'monthly'`
            // here (the guard's default and the only other possible value), so
            // `urls` MUST carry the monthly shape — narrow explicitly so this
            // stays type-safe.
            if (!('paymentMethodReturnUrl' in urls)) {
                throw new Error(
                    'Monthly reactivation requires paymentMethodReturnUrl/notificationUrl checkout URLs'
                );
            }

            // Real MP preapproval via the shared `mode: 'paid'` helper (also
            // used by `/start-paid`) — fail-closed (`MISSING_INIT_POINT`) if
            // the provider returns no checkout URL.
            const { subscription: newSubscription, checkoutUrl } = await createPaidSubscription({
                billing: this.billing,
                customerId,
                planId: plan.id,
                priceId,
                paymentMethodReturnUrl: urls.paymentMethodReturnUrl,
                notificationUrl: urls.notificationUrl,
                metadata: {
                    convertedFromTrial: 'true',
                    convertedAt: new Date().toISOString(),
                    ...(supersedesSubscriptionId ? { supersedesSubscriptionId } : {})
                }
            });

            // Deferred to webhook (HOS-114 T-007): cancel superseded sub +
            // audit + clearEntitlementCache on PENDING_PROVIDER->ACTIVE.
            // The old trialing subscription (captured above as
            // `supersedesSubscriptionId`) stays live and keeps granting
            // entitlements until the `subscription_preapproval.created`
            // webhook confirms THIS new preapproval `active` (spec §6.4/§6.5)
            // — cancelling it synchronously here would strip the customer's
            // entitlements during the MP checkout window, or leave them with
            // no subscription at all if they abandon checkout.

            apiLogger.info(
                {
                    customerId,
                    newSubscriptionId: newSubscription.id,
                    planId: plan.id,
                    checkoutUrl
                },
                'Initiated paid reactivation from trial — awaiting MercadoPago confirmation'
            );

            return {
                success: true,
                subscriptionId: newSubscription.id,
                checkoutUrl,
                status: 'incomplete',
                message: 'Redirect to MercadoPago to complete reactivation'
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    customerId,
                    planId,
                    error: errorMessage
                },
                'Failed to reactivate customer from trial'
            );

            throw error;
        }
    }

    /**
     * Reactivate a canceled subscription by creating a real, card-collecting
     * paid subscription (HOS-114). Supports both the monthly and annual
     * billing intervals (HOS-123 T-006) via `input.billingInterval`.
     *
     * Rejects if:
     * - Any subscription is active or trialing (use plan-change instead)
     * - No canceled subscription exists (nothing to reactivate)
     *
     * Like {@link reactivateFromTrial}, this method no longer creates a
     * locally-`active` subscription with no MercadoPago preapproval behind
     * it. It resolves + validates the target plan and interval, creates a
     * real `mode: 'paid'` preapproval (monthly) or a one-time
     * hosted-checkout charge (annual, HOS-123 T-006) via the shared
     * helpers, and returns a `checkoutUrl` the caller MUST redirect the
     * user to. See the inline comment near the end of this method for why
     * the old canceled subscription is not touched synchronously here
     * (spec §6.4, HOS-114 T-007).
     *
     * @param input - Reactivation parameters, including the resolved MP
     *   checkout return/notification URLs.
     * @returns The new (not-yet-confirmed) subscription id, the previous
     *   plan id, the checkout URL, and the `incomplete`/`pending_provider`
     *   status.
     * @throws SubscriptionCheckoutError With code `PLAN_NOT_FOUND`,
     *   `INVALID_REACTIVATION_PLAN`, `ANNUAL_REACTIVATION_UNSUPPORTED`,
     *   `NO_ANNUAL_PRICE`, `CUSTOMER_NOT_FOUND`, `ACTIVE_SUBSCRIPTION_EXISTS`
     *   (HOS-114 T-015b — HTTP 409), `NO_CANCELED_SUBSCRIPTION` (HOS-114
     *   T-015b — HTTP 404), or `MISSING_INIT_POINT`.
     */
    async reactivateSubscription(
        input: ReactivateSubscriptionInput
    ): Promise<ReactivateSubscriptionResult> {
        if (!this.billing) {
            throw new Error('Billing not enabled');
        }

        const { customerId, planId, urls, billingInterval = 'monthly' } = input;

        try {
            apiLogger.info(
                { customerId, planId, billingInterval },
                'Reactivating canceled subscription'
            );

            // HOS-114 §6.1/AC-6: resolve + validate the target plan FIRST,
            // fail-closed on unknown/free/annual plans before touching the
            // customer or any existing subscription. HOS-123: threads
            // `billingInterval` so the guard resolves the annual price
            // (and its own `NO_ANNUAL_PRICE`/`INVALID_REACTIVATION_PLAN`
            // validation) instead of always defaulting to monthly.
            const { plan, priceId, interval } = await resolveReactivationPlan({
                billing: this.billing,
                planId,
                billingInterval
            });

            const subscriptions = await this.billing.subscriptions.getByCustomerId(customerId);

            if (!subscriptions || subscriptions.length === 0) {
                // HOS-114 T-015b: was a plain `Error` (HTTP 500) — now a
                // typed business error mapped to HTTP 404 by
                // `mapSubscriptionCheckoutErrorToHttp`.
                throw new SubscriptionCheckoutError(
                    'NO_CANCELED_SUBSCRIPTION',
                    'No canceled subscription found to reactivate'
                );
            }

            // Reject if any subscription is active or trialing
            const activeOrTrialing = subscriptions.find(
                (sub) => sub.status === 'active' || sub.status === 'trialing'
            );

            if (activeOrTrialing) {
                const statusLabel = activeOrTrialing.status === 'active' ? 'active' : 'trialing';
                // HOS-114 T-015b: was a plain `Error` (HTTP 500) — now a
                // typed business error mapped to HTTP 409 by
                // `mapSubscriptionCheckoutErrorToHttp`.
                throw new SubscriptionCheckoutError(
                    'ACTIVE_SUBSCRIPTION_EXISTS',
                    `Cannot reactivate: ${statusLabel} subscription exists. Use plan-change instead.`
                );
            }

            // Find a canceled subscription to reactivate from
            const canceledSub = subscriptions.find((sub) => sub.status === 'canceled');

            if (!canceledSub) {
                // HOS-114 T-015b: was a plain `Error` (HTTP 500) — now a
                // typed business error mapped to HTTP 404 by
                // `mapSubscriptionCheckoutErrorToHttp`.
                throw new SubscriptionCheckoutError(
                    'NO_CANCELED_SUBSCRIPTION',
                    'No canceled subscription found to reactivate'
                );
            }

            const previousPlanId = canceledSub.planId ?? null;

            // Ensure the billing customer actually exists before creating a
            // paid preapproval against it (mirrors reactivateFromTrial).
            const customer = await this.billing.customers.get(customerId);
            if (!customer) {
                throw new SubscriptionCheckoutError(
                    'CUSTOMER_NOT_FOUND',
                    `Customer '${customerId}' not found`
                );
            }

            if (interval === 'annual') {
                // HOS-123: annual reactivation routes through the one-time
                // hosted-checkout charge instead of a recurring preapproval.
                // The guard already resolved an annual price for this plan,
                // so `urls` MUST carry the annual (successUrl/cancelUrl) shape
                // — the caller (the reactivate route) is responsible for
                // resolving the correct union member from `billingInterval`.
                if (!('successUrl' in urls)) {
                    throw new Error(
                        'Annual reactivation requires successUrl/cancelUrl/notificationUrl checkout URLs'
                    );
                }

                // HOS-171 §7.2: annual reactivation is now a recurring
                // preapproval, exactly like monthly — same helper, same
                // card-collecting checkout. `urls.successUrl` is MP's single
                // `back_url`; a preapproval has no cancel redirect, so
                // `urls.cancelUrl` is unused here.
                const { subscription, checkoutUrl } = await createPaidSubscription({
                    billing: this.billing,
                    customerId,
                    planId: plan.id,
                    priceId,
                    billingInterval: 'annual',
                    paymentMethodReturnUrl: urls.successUrl,
                    notificationUrl: urls.notificationUrl,
                    metadata: {
                        reactivatedFromCanceled: 'true',
                        reactivatedAt: new Date().toISOString(),
                        ...(previousPlanId ? { previousPlanId } : {}),
                        supersedesSubscriptionId: canceledSub.id
                    }
                });
                const localSubscriptionId = subscription.id;

                // Deferred to webhook (HOS-114 T-007, mirrored for the annual
                // `payment.updated` confirmation path): `canceledSub` is already
                // terminal (grants no entitlements), but the swap/audit stays
                // deferred to the webhook confirmation so there is exactly ONE
                // place (spec §6.4) that finalizes a reactivation.
                apiLogger.info(
                    {
                        customerId,
                        newSubscriptionId: localSubscriptionId,
                        planId: plan.id,
                        previousPlanId,
                        checkoutUrl
                    },
                    'Initiated annual paid reactivation of canceled subscription — awaiting MercadoPago confirmation'
                );

                return {
                    success: true,
                    subscriptionId: localSubscriptionId,
                    previousPlanId,
                    checkoutUrl,
                    status: 'pending_provider',
                    message: 'Redirect to MercadoPago to complete reactivation'
                };
            }

            // HOS-123: `urls` is now a discriminated union (monthly preapproval
            // shape vs annual hosted-checkout shape). `interval === 'monthly'`
            // here (the guard's default and the only other possible value), so
            // `urls` MUST carry the monthly shape — narrow explicitly so this
            // stays type-safe.
            if (!('paymentMethodReturnUrl' in urls)) {
                throw new Error(
                    'Monthly reactivation requires paymentMethodReturnUrl/notificationUrl checkout URLs'
                );
            }

            // Real MP preapproval via the shared `mode: 'paid'` helper (also
            // used by `/start-paid`) — fail-closed (`MISSING_INIT_POINT`) if
            // the provider returns no checkout URL.
            const { subscription: newSubscription, checkoutUrl } = await createPaidSubscription({
                billing: this.billing,
                customerId,
                planId: plan.id,
                priceId,
                paymentMethodReturnUrl: urls.paymentMethodReturnUrl,
                notificationUrl: urls.notificationUrl,
                metadata: {
                    reactivatedFromCanceled: 'true',
                    reactivatedAt: new Date().toISOString(),
                    ...(previousPlanId ? { previousPlanId } : {}),
                    supersedesSubscriptionId: canceledSub.id
                }
            });

            // Deferred to webhook (HOS-114 T-007): cancel superseded sub +
            // audit + clearEntitlementCache on PENDING_PROVIDER->ACTIVE.
            // `canceledSub` is already terminal (grants no entitlements), but
            // the swap/audit stays deferred to the webhook confirmation so
            // there is exactly ONE place (spec §6.4) that finalizes a
            // reactivation — mirrors `reactivateFromTrial` exactly instead of
            // special-casing "already-canceled, so it's safe to touch now".

            apiLogger.info(
                {
                    customerId,
                    newSubscriptionId: newSubscription.id,
                    planId: plan.id,
                    previousPlanId,
                    checkoutUrl
                },
                'Initiated paid reactivation of canceled subscription — awaiting MercadoPago confirmation'
            );

            return {
                success: true,
                subscriptionId: newSubscription.id,
                previousPlanId,
                checkoutUrl,
                status: 'incomplete',
                message: 'Redirect to MercadoPago to complete reactivation'
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                { customerId, planId, error: errorMessage },
                'Failed to reactivate canceled subscription'
            );

            throw error;
        }
    }

    /**
     * Find trials ending soon
     * Returns trials that will expire within N days
     * Used by notification cron jobs to send reminders
     *
     * @param input - Days ahead to check
     * @returns List of trials ending soon with user details
     */
    async findTrialsEndingSoon(input: { daysAhead: number }): Promise<TrialEndingSubscription[]> {
        if (!this.billing) {
            apiLogger.debug('Billing not enabled, skipping trial ending soon query');
            return [];
        }

        const { daysAhead } = input;

        try {
            apiLogger.info({ daysAhead }, 'Finding trials ending soon');

            // Get all active trialing subscriptions
            const allSubscriptionsResult = await this.billing.subscriptions.list({
                filters: { status: 'trialing' }
            });

            if (!allSubscriptionsResult || allSubscriptionsResult.data.length === 0) {
                apiLogger.info('No trialing subscriptions found');
                return [];
            }

            const now = new Date();
            const targetDate = new Date(now);
            targetDate.setDate(targetDate.getDate() + daysAhead);

            const endingSoon: TrialEndingSubscription[] = [];

            // Check each subscription for expiry within timeframe
            for (const subscription of allSubscriptionsResult.data) {
                const trialEnd = subscription.trialEnd ? new Date(subscription.trialEnd) : null;

                if (!trialEnd) {
                    continue;
                }

                // Calculate days remaining
                const daysRemaining = calculateTrialDaysRemaining({ trialEnd, now });

                // Check if trial ends exactly on the specified day window.
                // Using exact match (===) instead of range (<=) to prevent duplicate
                // reminders when the cron runs with different daysAhead values
                // (e.g. a 3-day query should not also pick up 1-day trials).
                const isEndingSoon = daysRemaining === daysAhead;

                if (isEndingSoon) {
                    try {
                        // Get customer details
                        const customer = await this.billing.customers.get(subscription.customerId);

                        if (!customer) {
                            apiLogger.warn(
                                { customerId: subscription.customerId },
                                'Customer not found for trial subscription'
                            );
                            continue;
                        }

                        // Get plan details
                        const plan = await this.billing.plans.get(subscription.planId);

                        if (!plan) {
                            apiLogger.warn(
                                { planId: subscription.planId },
                                'Plan not found for trial subscription'
                            );
                            continue;
                        }

                        // HOS-115 §5: read back the interval the customer originally
                        // chose (stamped by `startTrial` at grant time) so the
                        // pre-expiry reminder nudge can carry the same
                        // `?interval=` hint as the TRIAL_EXPIRED notification.
                        // See `buildTrialUpgradeUrl` for how this degrades
                        // gracefully when the trial recorded no interval choice.
                        const intendedInterval = (
                            subscription.metadata as Record<string, string> | undefined
                        )?.intendedInterval;

                        endingSoon.push({
                            id: subscription.id,
                            customerId: customer.id,
                            userEmail: customer.email,
                            userName: String(customer.metadata?.name || customer.email),
                            userId: String(customer.metadata?.userId || ''),
                            planSlug: plan.name,
                            planDisplayName: planDisplayNameFromPlan(plan),
                            trialEnd,
                            daysRemaining,
                            ...(intendedInterval ? { intendedInterval } : {})
                        });

                        apiLogger.debug(
                            {
                                subscriptionId: subscription.id,
                                customerId: customer.id,
                                daysRemaining
                            },
                            'Found trial ending soon'
                        );
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);

                        apiLogger.error(
                            {
                                subscriptionId: subscription.id,
                                error: errorMessage
                            },
                            'Failed to fetch customer/plan for trial subscription'
                        );
                    }
                }
            }

            apiLogger.info(
                { daysAhead, count: endingSoon.length },
                'Trials ending soon query completed'
            );

            return endingSoon;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    daysAhead,
                    error: errorMessage
                },
                'Failed to find trials ending soon'
            );

            return [];
        }
    }

    /**
     * Detect and resolve duplicate active subscriptions for a customer.
     *
     * When a trial upgrade partially fails (new subscription created but the old
     * trial cancel call throws), the customer ends up with two subscriptions whose
     * combined statuses are `active` + `trialing` — or two `active` entries.  This
     * method queries QZPay for all active/trialing subscriptions belonging to the
     * customer and, when more than one is found, cancels every subscription except
     * the most recently created one (determined by `createdAt` descending, falling
     * back to insertion order).
     *
     * The method is intentionally idempotent: calling it when there is only one
     * active subscription is a no-op.
     *
     * @param input - Parameters for the reconciliation
     * @param input.customerId - Billing customer whose subscriptions to reconcile
     * @returns Reconciliation result describing what was cancelled and what was kept
     *
     * @example
     * ```ts
     * const result = await trialService.reconcileDuplicateSubscriptions({ customerId });
     * if (result.cancelledCount > 0) {
     *   logger.warn({ result }, 'Duplicate subscriptions resolved');
     * }
     * ```
     */
    async reconcileDuplicateSubscriptions(input: { customerId: string }): Promise<ReconcileResult> {
        if (!this.billing) {
            return { cancelledCount: 0, cancelledIds: [], keptId: null };
        }

        const { customerId } = input;

        try {
            const allSubscriptions = await this.billing.subscriptions.getByCustomerId(customerId);

            if (!allSubscriptions || allSubscriptions.length === 0) {
                return { cancelledCount: 0, cancelledIds: [], keptId: null };
            }

            // Collect only subscriptions that are in a "live" state
            const liveSubscriptions = allSubscriptions.filter(
                (sub) => sub.status === 'active' || sub.status === 'trialing'
            );

            if (liveSubscriptions.length <= 1) {
                const keptId = liveSubscriptions[0]?.id ?? null;
                return { cancelledCount: 0, cancelledIds: [], keptId };
            }

            // Keep the newest subscription (highest createdAt, or last in array as fallback)
            const sorted = [...liveSubscriptions].sort((a, b) => {
                const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                // Descending: newest first
                return bTime - aTime;
            });

            const [primary, ...duplicates] = sorted;
            // sorted is guaranteed non-empty (liveSubscriptions.length > 1) but
            // TypeScript's noUncheckedIndexedAccess requires a guard.
            if (!primary) {
                return { cancelledCount: 0, cancelledIds: [], keptId: null };
            }

            const cancelledIds: string[] = [];

            for (const dup of duplicates) {
                try {
                    await this.billing.subscriptions.cancel(dup.id);
                    cancelledIds.push(dup.id);

                    apiLogger.warn(
                        {
                            customerId,
                            cancelledSubscriptionId: dup.id,
                            keptSubscriptionId: primary.id,
                            dupStatus: dup.status
                        },
                        'Cancelled duplicate active subscription during reconciliation'
                    );
                } catch (cancelError) {
                    const msg =
                        cancelError instanceof Error ? cancelError.message : String(cancelError);

                    apiLogger.error(
                        { customerId, subscriptionId: dup.id, error: msg },
                        'Failed to cancel duplicate subscription during reconciliation'
                    );
                }
            }

            if (cancelledIds.length > 0) {
                clearEntitlementCache(customerId);
            }

            return {
                cancelledCount: cancelledIds.length,
                cancelledIds,
                keptId: primary.id
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                { customerId, error: errorMessage },
                'Failed to reconcile duplicate subscriptions'
            );

            return { cancelledCount: 0, cancelledIds: [], keptId: null };
        }
    }
}
