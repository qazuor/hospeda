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
import { billingSubscriptionEvents, billingSubscriptions, getDb } from '@repo/db';
import { NotificationType, type TrialEventPayload } from '@repo/notifications';
import { SubscriptionStatusEnum } from '@repo/schemas';
import {
    BILLING_EVENT_TYPES,
    calculateTrialDaysRemaining,
    checkSubscriptionStatusTransition,
    DEFAULT_TRIAL_PLAN_SLUG,
    type ReactivateFromTrialInput,
    type ReactivateFromTrialResult,
    type ReactivateSubscriptionInput,
    type ReactivateSubscriptionResult,
    resolveIntendedInterval,
    resolvePlanTrialConfig,
    type StartTrialInput,
    type TrialEndingSubscription,
    type TrialStatus,
    withServiceTransaction
} from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { and, eq, sql } from 'drizzle-orm';
import { clearEntitlementCache } from '../middlewares/entitlement';
import { env } from '../utils/env.js';
import { apiLogger } from '../utils/logger';
import { createAnnualSubscription } from './billing/create-annual-subscription.js';
import { createPaidSubscription } from './billing/paid-subscription-create.js';
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
 * Builds the trial→paid conversion nudge URL sent on both trial-lifecycle
 * notifications that link to the pricing page — `TRIAL_EXPIRED` (HOS-115 §5,
 * nudge delivery path 1) and `TRIAL_ENDING_REMINDER` (the pre-expiry
 * reminder, same nudge design). Appends `?interval=<intendedInterval>` when
 * the trial recorded a valid intent, so the pricing page can pre-select the
 * same toggle the customer started from instead of defaulting to monthly.
 * Degrades gracefully — the query param is simply omitted — when
 * `intendedInterval` is missing or not one of the two known values (e.g. a
 * trial started via the accommodation-publish auto-start flow, which records
 * no interval choice at all).
 *
 * Single source of truth for this URL for the two ACTIVE notification call
 * sites: `blockExpiredTrials` below (`TRIAL_EXPIRED`) and
 * `notification-schedule.job.ts`'s `TRIAL_ENDING_REMINDER` sends. Both call
 * this same function rather than building the link inline, so the nudge
 * target/shape never drifts between the two.
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
    constructor(
        private readonly billing: QZPayBilling | null,
        private readonly sendNotification?: (payload: TrialEventPayload) => void
    ) {}

    /**
     * Start a trial for a user (HOS-110).
     *
     * Creates a trial subscription on the plan identified by
     * `input.planSlug` (defaults to {@link DEFAULT_TRIAL_PLAN_SLUG},
     * `'owner-basico'`, when omitted — preserving the original
     * accommodation-publish behavior, where the accommodation type is an
     * attribute of the accommodation entity, not the trial plan).
     *
     * The trial length is read from the RESOLVED plan's own declared trial
     * config (`billing_plans.metadata.trialDays` / `.hasTrial`), not a
     * hardcoded constant — different plans can declare different trial
     * lengths (e.g. `owner-test-daily`: 1 day vs `owner-basico`: 14 days).
     * If the resolved plan does not declare a trial (`hasTrial !== true` or
     * `trialDays <= 0`), this is a no-op that returns `null` — starting a
     * 0-day "trial" on a no-trial plan would be a bug, not a feature.
     *
     * `input.extraTrialDays` (HOS-110 W1) adds on top of the resolved base
     * length (plan `trialDays`, or `HOSPEDA_TRIAL_DAYS_OVERRIDE` when set) —
     * sourced from a `trial_extension` promo code applied by a trial-eligible
     * customer at checkout. The base-length guard above is evaluated BEFORE
     * the extension is added, so the ops kill-switch
     * (`HOSPEDA_TRIAL_DAYS_OVERRIDE=0`) still disables every trial regardless
     * of any extension promo supplied.
     *
     * `input.intendedInterval` (HOS-115) is stamped as-is into the created
     * subscription's `metadata.intendedInterval` — the trial object itself
     * carries no price/interval, so this is the sole record of which
     * checkout toggle (monthly/annual) the customer started from, read back
     * later to nudge the pricing page at conversion.
     *
     * @param input - Trial start parameters
     * @returns Trial subscription ID, or `null` if billing is disabled, the
     *   resolved plan has no trial, or the customer already has a
     *   subscription (one trial per customer, for life).
     */
    async startTrial(input: StartTrialInput): Promise<string | null> {
        if (!this.billing) {
            apiLogger.debug('Billing not enabled, skipping trial creation');
            return null;
        }

        const { customerId, accommodationId, extraTrialDays, intendedInterval } = input;
        const planSlug = input.planSlug ?? DEFAULT_TRIAL_PLAN_SLUG;

        try {
            apiLogger.info({ customerId, planSlug }, 'Starting trial for user');

            // Get plan by slug
            const plansResult = await this.billing.plans.list();

            if (!plansResult.data) {
                apiLogger.error({ planSlug }, 'Failed to fetch plans list');
                throw new Error('Failed to fetch plans list');
            }

            // QZPay plans use 'name' not 'slug'
            const plan = plansResult.data.find((p) => p.name === planSlug);

            if (!plan) {
                apiLogger.error({ planSlug }, 'Trial plan not found');
                throw new Error(`Trial plan not found: ${planSlug}`);
            }

            // Trial config lives on the plan's metadata JSONB (seeded from
            // `PlanDefinition.hasTrial` / `.trialDays`).
            const { hasTrial: planHasTrial, trialDays: planTrialDays } = resolvePlanTrialConfig(
                plan.metadata
            );

            // Testing-only override (HOSPEDA_TRIAL_DAYS_OVERRIDE): when set to a
            // positive integer, shorten the trial so QA can exercise trial expiry
            // without waiting the plan's full trial length. Deliberately NOT gated
            // by environment: NODE_ENV is 'production' on BOTH the prod and staging
            // deployments, so it cannot distinguish them, and testing must be
            // possible against production (the MP sandbox on staging is unreliable).
            // This is an explicit ops knob — it affects EVERY trial started while it
            // is set, so the operator sets it, runs the test, then UNSETS it. Unset
            // by default in every environment. The override only shortens/lengthens
            // an ALREADY-trial-eligible plan — it never forces a trial onto a plan
            // that does not declare one (the `planHasTrial` guard below still applies).
            // HOS-110 W1: a `trial_extension` promo code (SPEC-262) supplied by a
            // trial-eligible customer at checkout adds its `extraDays` on top of
            // the (possibly overridden) base length — e.g. base 14 + code's 7 = 21.
            // Applied AFTER the override so a QA override still shortens the base
            // length; the extension is additive on top of whatever base applies.
            const baseTrialDays = env.HOSPEDA_TRIAL_DAYS_OVERRIDE ?? planTrialDays;
            const trialDays = baseTrialDays + (extraTrialDays ?? 0);

            if (!planHasTrial || baseTrialDays <= 0) {
                apiLogger.warn(
                    { customerId, planSlug, planHasTrial, trialDays },
                    'Plan does not declare a trial — skipping trial creation'
                );
                return null;
            }

            // Check if user already has a subscription
            const existingSubscriptions =
                await this.billing.subscriptions.getByCustomerId(customerId);

            if (existingSubscriptions && existingSubscriptions.length > 0) {
                apiLogger.warn(
                    {
                        customerId,
                        existingSubscriptions: existingSubscriptions.length
                    },
                    'User already has subscriptions, skipping trial creation'
                );
                return null;
            }

            // Create trial subscription
            const now = new Date();
            const trialEnd = new Date(now);
            trialEnd.setDate(trialEnd.getDate() + trialDays);

            // SPEC-222 Part 2: enrich the MercadoPago creation payload AT
            // creation time (no follow-up update, no extra MP call) with:
            //  - an environment marker so MP-side records can be filtered by
            //    deployment (prod / staging / development), reusing the same
            //    convention as Sentry (HOSPEDA_SENTRY_ENVIRONMENT ?? NODE_ENV);
            //  - the accommodation that triggered the trial, clearly labelled as
            //    referential ("triggered_by") since trials are PER-OWNER and the
            //    subscription does NOT belong to a single accommodation.
            // Only env marker + internal UUIDs go to MP — no PII (no names/emails).
            const environmentMarker = env.HOSPEDA_SENTRY_ENVIRONMENT ?? env.NODE_ENV;
            const subscription = await this.billing.subscriptions.create({
                customerId,
                planId: plan.id,
                trialDays,
                metadata: {
                    autoStarted: 'true',
                    createdBy: 'trial-service',
                    environment: environmentMarker,
                    ...(accommodationId ? { triggeredByAccommodationId: accommodationId } : {}),
                    // HOS-110 W1: audit trail for a trial_extension promo code that
                    // lengthened this trial beyond the plan's base trialDays.
                    ...(extraTrialDays ? { extraTrialDaysFromPromo: String(extraTrialDays) } : {}),
                    // HOS-115 §5: the checkout entry interval the customer originally
                    // chose (monthly/annual), stamped as-is so the post-trial
                    // conversion nudge can pre-select the same toggle. Omitted for
                    // trial-start paths with no interval choice (e.g. the
                    // accommodation-publish auto-start flow).
                    ...(intendedInterval ? { intendedInterval } : {})
                }
            });

            // Clear entitlement cache to reflect the new trial subscription
            // immediately (HOS-110). Previously only the accommodation-publish
            // wrapper cleared this cache itself; other callers of `startTrial`
            // (e.g. the paid-checkout trial branch) would otherwise leak a
            // stale "no entitlements" cache entry until the TTL expired.
            clearEntitlementCache(customerId);

            apiLogger.info(
                {
                    customerId,
                    subscriptionId: subscription.id,
                    planSlug,
                    trialEnd: trialEnd.toISOString(),
                    ...(extraTrialDays ? { extraTrialDays } : {})
                },
                'Trial subscription created successfully'
            );

            return subscription.id;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    customerId,
                    error: errorMessage
                },
                'Failed to start trial'
            );

            throw error;
        }
    }

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
     * Block expired trials (batch operation)
     * Finds all expired trials and updates their status.
     * This is typically called by a cron job.
     *
     * Concurrency safety (ADR-019):
     * - Lock + fetch (claim) happen atomically inside ONE `withServiceTransaction`.
     *   `pg_try_advisory_xact_lock(1004)` is acquired, then `subscriptions.list()`
     *   is called while the transaction (and therefore the lock) is still open.
     *   When the transaction commits both the lock is released AND the claimed list
     *   is in hand. A concurrent invocation that arrives while this tx is open will
     *   get `pg_try_advisory_xact_lock = false` and skip without fetching.
     * - External calls (QZPay cancel, notifications) happen OUTSIDE the lock-holding
     *   tx, per ADR-019 ("external calls are not rollback-able; external call first,
     *   then transaction").
     * - Per-subscription idempotency: before processing each subscription a
     *   `TRIAL_BLOCKED` event is checked in `billing_subscription_events`. This
     *   re-check guard protects against the window between the claim commit and
     *   the per-sub processing (SPEC-064 T-041).
     *
     * Claim phase pagination (T-016):
     * `subscriptions.list()` is called with `limit: BLOCK_EXPIRED_TRIALS_BATCH_SIZE`
     * (currently 200). Only one batch is claimed per cron tick. The daily cron
     * cadence drains the backlog over successive runs without ever holding the
     * advisory lock while fetching an unbounded result set.
     *
     * @returns Number of trials blocked in this run
     */
    async blockExpiredTrials(): Promise<number> {
        if (!this.billing) {
            apiLogger.debug('Billing not enabled, skipping expired trial blocking');
            return 0;
        }

        // ── CLAIM PHASE (ADR-019) ──────────────────────────────────────────────────
        // Acquire the advisory lock AND fetch the candidate list inside the SAME
        // transaction. The lock is held for the full duration of the tx so that a
        // concurrent invocation that tries to acquire the lock while we are still
        // fetching will get false and skip immediately. Once this tx commits, the
        // lock auto-releases and the fetched list is in hand for processing.
        //
        // External API calls (QZPay cancel, notifications) are NOT allowed inside
        // a lock-holding transaction (ADR-019 §Negative). They run in the process
        // phase below, after the claim tx has committed.
        let claimedSubscriptions:
            | Awaited<ReturnType<typeof this.billing.subscriptions.list>>['data']
            | null = null;

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

                // Fetch candidate list while the lock is still held.
                // When the tx commits the lock is released, but we already have the list.
                // Capped at BLOCK_EXPIRED_TRIALS_BATCH_SIZE to bound lock-hold duration
                // (T-016). Remaining subs are processed on the next cron tick.
                //
                // ADR-019 exception (item 9d / SPEC-194 adversarial review):
                // Calling the external QZPay subscriptions.list() inside the lock-holding
                // tx is intentional here. The atomic claim requires reading the candidate
                // list under the advisory lock so a concurrent invocation that acquires
                // the lock next sees an empty (or different) batch — preventing duplicate
                // processing. The batch size (BLOCK_EXPIRED_TRIALS_BATCH_SIZE = 200)
                // bounds the maximum lock-hold duration per run.
                const result = await this.billing?.subscriptions.list({
                    filters: { status: 'trialing' },
                    limit: BLOCK_EXPIRED_TRIALS_BATCH_SIZE
                });

                return result?.data ?? [];
            });
        } catch (lockErr) {
            apiLogger.error(
                { error: lockErr instanceof Error ? lockErr.message : String(lockErr) },
                'blockExpiredTrials: failed to acquire advisory lock — skipping run'
            );
            return 0;
        }

        // null means another instance holds the lock — skip silently
        if (claimedSubscriptions === null) {
            apiLogger.warn(
                'blockExpiredTrials is already running (advisory lock held by another process), skipping concurrent invocation'
            );
            return 0;
        }

        if (claimedSubscriptions.length === 0) {
            apiLogger.info('No trialing subscriptions found');
            return 0;
        }

        // ── PROCESS PHASE ─────────────────────────────────────────────────────────
        // Lock has been released. Process each claimed subscription individually.
        // Per ADR-019, external API calls (QZPay, notifications) run here, outside
        // any lock-holding transaction. Each sub is re-checked for the TRIAL_BLOCKED
        // dedup event to guard against the window between claim commit and processing.

        try {
            apiLogger.info('Starting expired trial blocking batch job');

            const now = new Date();
            const db = getDb();
            let blockedCount = 0;

            // Check each trial subscription
            for (const subscription of claimedSubscriptions) {
                const trialEnd = subscription.trialEnd ? new Date(subscription.trialEnd) : null;

                // Skip if no trial end date
                if (!trialEnd) {
                    continue;
                }

                // Skip if not yet expired
                if (now <= trialEnd) {
                    continue;
                }

                try {
                    // ── Re-check guard (ADR-019 + SPEC-064 T-041) ─────────────────
                    // Between the claim commit and now, another instance or a prior run
                    // may have already processed this subscription. Re-verify by checking
                    // for a TRIAL_BLOCKED event before making any external calls.
                    const existingBlock = await db
                        .select({ id: billingSubscriptionEvents.id })
                        .from(billingSubscriptionEvents)
                        .where(
                            and(
                                eq(billingSubscriptionEvents.subscriptionId, subscription.id),
                                eq(
                                    billingSubscriptionEvents.eventType,
                                    BILLING_EVENT_TYPES.TRIAL_BLOCKED
                                )
                            )
                        )
                        .limit(1);

                    if (existingBlock.length > 0) {
                        apiLogger.debug(
                            { subscriptionId: subscription.id },
                            'blockExpiredTrials: TRIAL_BLOCKED event already exists, skipping (idempotent)'
                        );
                        continue;
                    }

                    // ── Pre-cancel status guard (item 4 / SPEC-194 adversarial review) ──
                    // The claimed subscription object may be stale (fetched inside the
                    // claim tx that has since committed). Re-validate the status transition
                    // before calling the external QZPay cancel API to avoid erroring on
                    // subscriptions that were already cancelled/expired/abandoned between
                    // the claim and the process phases.
                    const transitionGuard = checkSubscriptionStatusTransition({
                        from: subscription.status as `${SubscriptionStatusEnum}`,
                        to: SubscriptionStatusEnum.CANCELLED,
                        subscriptionId: subscription.id
                    });
                    if (!transitionGuard.valid) {
                        apiLogger.warn(
                            {
                                subscriptionId: subscription.id,
                                currentStatus: subscription.status,
                                reason: transitionGuard.reason
                            },
                            'blockExpiredTrials: claimed subscription is in a terminal state — skipping cancel call'
                        );
                        continue;
                    }

                    // Get customer details for notification
                    const customer = await this.billing.customers.get(subscription.customerId);
                    const plan = await this.billing.plans.get(subscription.planId);

                    // Capture to Sentry if customer lookup fails so we can investigate
                    if (!customer) {
                        const lookupError = new Error(
                            `Customer not found during blockExpiredTrials: ${subscription.customerId}`
                        );
                        Sentry.captureException(lookupError, {
                            extra: {
                                subscriptionId: subscription.id,
                                customerId: subscription.customerId,
                                planId: subscription.planId,
                                trialEnd: trialEnd.toISOString()
                            },
                            tags: {
                                module: 'trial-service',
                                operation: 'blockExpiredTrials'
                            }
                        });
                        apiLogger.warn(
                            {
                                subscriptionId: subscription.id,
                                customerId: subscription.customerId
                            },
                            'Customer not found during blockExpiredTrials, proceeding with cancellation'
                        );
                    }

                    // Update subscription to cancel (QZPay doesn't support 'expired' status)
                    await this.billing.subscriptions.cancel(subscription.id);

                    // ── SPEC-143 Block 3 / Finding #30: stamp trial_converted_at ─
                    // The schema carries `trial_converted` (boolean, default false)
                    // and `trial_converted_at` (timestamp, nullable) as first-class
                    // columns. For a trial that expired WITHOUT conversion, the
                    // canonical record is `trial_converted=false` (already the
                    // default) and `trial_converted_at=<expiry timestamp>` so
                    // analytics and the admin dashboard can distinguish
                    // "trial expired without converting" from a manual cancel.
                    // The qzpay-hono SDK cancel() doesn't write these columns,
                    // so we do it here directly. Trial cancel is the only path
                    // that should ever set trial_converted_at; conversion-to-paid
                    // flips trial_converted=true via a different path.
                    await db
                        .update(billingSubscriptions)
                        .set({ trialConvertedAt: new Date() })
                        .where(eq(billingSubscriptions.id, subscription.id));

                    // ── T-041: Insert TRIAL_BLOCKED dedup event after successful cancel ─
                    // This must be written after the QZPay cancel call so we only mark
                    // a subscription as processed once it has actually been cancelled.
                    // Follows the operational-event row convention: eventType is set,
                    // previousStatus/newStatus are omitted (null).
                    await db.insert(billingSubscriptionEvents).values({
                        subscriptionId: subscription.id,
                        eventType: BILLING_EVENT_TYPES.TRIAL_BLOCKED,
                        triggerSource: 'block-expired-trials-cron',
                        metadata: {
                            trialEnd: trialEnd.toISOString(),
                            blockedAt: new Date().toISOString()
                        }
                    });

                    // Clear entitlement cache to reflect trial expiry immediately
                    clearEntitlementCache(subscription.customerId);

                    blockedCount++;

                    apiLogger.info(
                        {
                            subscriptionId: subscription.id,
                            customerId: subscription.customerId,
                            trialEnd: trialEnd.toISOString()
                        },
                        'Blocked expired trial subscription'
                    );

                    // Send TRIAL_EXPIRED notification (fire-and-forget)
                    if (this.sendNotification && customer && plan) {
                        // HOS-115 §5: nudge delivery path 1 — read back the interval the
                        // customer originally chose (stamped by `startTrial` at grant
                        // time) and append it to the upgrade link so the pricing page
                        // can pre-select the same toggle instead of defaulting to monthly.
                        const intendedInterval = (
                            subscription.metadata as Record<string, string> | undefined
                        )?.intendedInterval;
                        this.sendNotification({
                            type: NotificationType.TRIAL_EXPIRED,
                            recipientEmail: customer.email,
                            recipientName: String(customer.metadata?.name || customer.email),
                            userId: String(customer.metadata?.userId || null),
                            customerId: customer.id,
                            planName: plan.name,
                            trialEndDate: trialEnd.toISOString(),
                            upgradeUrl: buildTrialUpgradeUrl({
                                siteUrl: env.HOSPEDA_SITE_URL,
                                intendedInterval
                            })
                        });

                        apiLogger.debug(
                            {
                                customerId: customer.id,
                                emailDomain: customer.email.split('@')[1]
                            },
                            'Trial expired notification queued'
                        );
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);

                    apiLogger.error(
                        {
                            subscriptionId: subscription.id,
                            error: errorMessage
                        },
                        'Failed to block expired trial subscription'
                    );
                }
            }

            apiLogger.info({ blockedCount }, 'Expired trial blocking batch job completed');

            return blockedCount;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            apiLogger.error(
                {
                    error: errorMessage
                },
                'Failed to run expired trial blocking batch job'
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
     * 3. For `billingInterval: 'monthly'` (the default), creates a real
     *    `mode: 'paid'` MercadoPago preapproval via the shared
     *    {@link createPaidSubscription} helper (also used by `/start-paid`).
     *    For `billingInterval: 'annual'`, creates a one-time hosted-checkout
     *    charge via `createAnnualSubscription` instead (HOS-123 T-006) — both
     *    paths fail-closed if the provider returns no checkout URL.
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

                const annualPrice = plan.prices.find((price) => price.id === priceId);
                const chargeAmountCentavos = annualPrice?.unitAmount ?? 0;

                const { localSubscriptionId, checkoutUrl } = await createAnnualSubscription({
                    billing: this.billing,
                    customerId,
                    plan: { id: plan.id, name: plan.name, metadata: plan.metadata },
                    priceId,
                    chargeAmountCentavos,
                    urls: {
                        successUrl: urls.successUrl,
                        cancelUrl: urls.cancelUrl,
                        notificationUrl: urls.notificationUrl
                    },
                    metadata: {
                        convertedFromTrial: 'true',
                        convertedAt: new Date().toISOString(),
                        ...(supersedesSubscriptionId ? { supersedesSubscriptionId } : {})
                    }
                });

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

                const annualPrice = plan.prices.find((price) => price.id === priceId);
                const chargeAmountCentavos = annualPrice?.unitAmount ?? 0;

                const { localSubscriptionId, checkoutUrl } = await createAnnualSubscription({
                    billing: this.billing,
                    customerId,
                    plan: { id: plan.id, name: plan.name, metadata: plan.metadata },
                    priceId,
                    chargeAmountCentavos,
                    urls: {
                        successUrl: urls.successUrl,
                        cancelUrl: urls.cancelUrl,
                        notificationUrl: urls.notificationUrl
                    },
                    metadata: {
                        reactivatedFromCanceled: 'true',
                        reactivatedAt: new Date().toISOString(),
                        ...(previousPlanId ? { previousPlanId } : {}),
                        supersedesSubscriptionId: canceledSub.id
                    }
                });

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
