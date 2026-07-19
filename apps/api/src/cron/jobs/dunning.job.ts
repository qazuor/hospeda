/**
 * Dunning Cron Job
 *
 * Processes payment retries and grace period expirations for past-due subscriptions.
 * Runs daily at 6:00 AM UTC (3:00 AM Argentina time) to manage the full dunning
 * lifecycle: retries on failed payments and cancellations after grace period ends.
 *
 * Features:
 * - Uses QZPay's SubscriptionLifecycleService to process payment retries
 * - Cancels subscriptions that have exceeded the grace period with no remaining retries
 * - Retry schedule: [1, 3, 5, 7] days between attempts (4 max attempts).
 *   NOTE: The original spec (SPEC-021 BILL-04) proposed [1, 3, 7] (3 attempts).
 *   The implemented schedule adds a Day 5 attempt to maximize payment recovery
 *   before cancellation. This was a deliberate product decision to be more aggressive
 *   on retries given Argentine payment ecosystem transient failures.
 * - Grace period: 7 days from first payment failure before cancellation
 * - Supports dry-run mode to preview actions without making changes
 * - Emits lifecycle events: retry_scheduled, retry_succeeded, retry_failed, canceled_nonpayment
 *
 * ## HOS-191 F5 — mutations disabled, MercadoPago native recycling is authoritative
 *
 * MercadoPago has its OWN native dunning ("recycling"): it retries a failed
 * recurring charge internally for up to ~10 days and auto-CANCELS the
 * preapproval after 3 failed cycles (never pauses it), notifying the customer
 * by email. Hospeda's own retry/cancel loop below (`processRetries` +
 * `processCancellations`, both from `@qazuor/qzpay-core`'s
 * `SubscriptionLifecycleService`) duplicated that mechanism and could produce
 * contradictory local state. The owner decided (2026-07-18) to defer entirely
 * to MP: this job no longer calls either mutation method — see
 * {@link DUNNING_MUTATIONS_ENABLED}. The only path a subscription actually
 * leaves `active` for non-payment now is MP's own `subscription_preapproval`
 * webhook reporting `cancelled`, handled in
 * `routes/webhooks/mercadopago/subscription-logic.ts`.
 *
 * **Discovered gap while implementing this (read before re-enabling
 * mutations):** `PAST_DUE` is, as of this writing, unreachable in the local
 * `billing_subscriptions.status` column. `processRetries`/`processCancellations`
 * only ever READ subscriptions already in `past_due`
 * (`qzpayIsSubscriptionPastDue` in qzpay-core is a pure `status === 'past_due'`
 * check) — the only qzpay-core code that ever WRITES `past_due` is
 * `SubscriptionLifecycleServiceImpl.enterGracePeriod`, called exclusively from
 * `processRenewals()`, which nothing in this codebase invokes. The webhook
 * path (`QZPAY_TO_HOSPEDA_STATUS['past_due']` in
 * `subscription-status-provider.ts`) is equally unreachable in practice:
 * `@qazuor/qzpay-mercadopago`'s `MERCADOPAGO_SUBSCRIPTION_STATUS` map only
 * translates MP's real preapproval statuses (`pending`, `authorized`,
 * `paused`, `cancelled`) — there is no MP preapproval status that becomes
 * `past_due`. In other words: disabling this cron's mutations did not turn
 * off live behavior, because the retry/cancel loop was already a structural
 * no-op (its input set — locally `past_due` subscriptions — was already
 * always empty). `docs/billing/grace-period-source-of-truth.md` and the
 * `pastDueGraceMiddleware` describe a `past_due` state that is currently
 * unreachable end-to-end; that is a pre-existing gap this change surfaces
 * but does not fix (fixing it — e.g. teaching the MP adapter to surface
 * `recycling` as `past_due` — is a separate, larger decision, since MP's
 * `subscription_authorized_payment` webhook with a `rejected` status is the
 * only local signal of an in-flight retry today).
 *
 * @module cron/jobs/dunning
 */

import type { LifecycleEvent, QZPayCurrency } from '@qazuor/qzpay-core';
import { createSubscriptionLifecycle } from '@qazuor/qzpay-core';
import { DUNNING_RETRY_INTERVALS } from '@repo/billing';
import { billingDunningAttempts, getDb, sql, withTransaction } from '@repo/db';
import {
    loadSubscriptionDiscountState,
    resolveOwnerPlanGrantsFeatured,
    syncFeaturedByEntitlementForOwner
} from '@repo/service-core';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { clearEntitlementCache } from '../../middlewares/entitlement.js';
import { sendSubscriptionCancelledNotification } from '../../routes/webhooks/mercadopago/notifications.js';
import { reconcileCommerceListingForSubscription } from '../../services/commerce-reconcile.service.js';
import { reconcilePartnerForSubscription } from '../../services/partner-reconcile.service.js';
import { resolveOwnerUserId } from '../../services/subscription-pause.service.js';
import { loadBillingSettings } from '../../utils/billing-settings.js';
import { apiLogger } from '../../utils/logger.js';
import type { CronJobDefinition } from '../types.js';

/**
 * SPEC-262 T-007 dunning guard.
 *
 * Determine whether a subscription must be EXCLUDED from dunning because it is
 * either complimentary (`status = 'comp'`, never charged — Model β) or in an
 * intentionally-discounted multi-cycle window (`promo_effect_remaining_cycles`
 * is non-null and > 0, OR the subscription has a forever discount). In both cases
 * the subscription is below full price by design, so a failed full-price charge
 * must NOT be treated as delinquency.
 *
 * Reads via {@link loadSubscriptionDiscountState} (typed Drizzle, HOS-75
 * T-019 — `status`, `promoCodeId` and `promoEffectRemainingCycles` are typed
 * columns as of `@qazuor/qzpay-drizzle` 1.11.0, HOS-73). Fail-open on a read
 * error (returns null) so a transient DB hiccup never silently disables
 * legitimate dunning.
 *
 * @param subscriptionId - The local subscription ID being processed.
 * @returns A short reason string when the sub must be skipped, otherwise null.
 */
async function isCompOrActivelyDiscounted(
    subscriptionId: string | undefined
): Promise<string | null> {
    if (!subscriptionId) {
        return null;
    }
    try {
        const row = await loadSubscriptionDiscountState({ subscriptionId });

        if (!row) {
            return null;
        }
        if (row.status === 'comp') {
            return 'comp';
        }
        // Active multi-cycle discount: remaining cycles still pending (finite),
        // OR a forever discount (promoEffectRemainingCycles IS NULL but a
        // promoCodeId is set — S2 fix: the previous guard incorrectly required
        // remaining_cycles !== null, missing the forever-discount case).
        if (row.promoCodeId !== null) {
            if (row.promoEffectRemainingCycles === null || row.promoEffectRemainingCycles > 0) {
                return 'active-discount';
            }
        }
        return null;
    } catch (err) {
        apiLogger.warn(
            {
                subscriptionId,
                error: err instanceof Error ? err.message : String(err)
            },
            'Dunning: comp/discount guard read failed — proceeding with normal dunning (fail-open)'
        );
        return null;
    }
}

/**
 * Record a dunning attempt in the billing_dunning_attempts table for auditing.
 * Best-effort: logs errors but does not throw to avoid disrupting the dunning flow.
 */
async function recordDunningAttempt(event: LifecycleEvent): Promise<void> {
    const isRetryEvent =
        event.type === 'subscription.retry_succeeded' || event.type === 'subscription.retry_failed';

    if (!isRetryEvent) {
        return;
    }

    try {
        const db = getDb();
        const data = event.data as Record<string, unknown>;

        const result = event.type === 'subscription.retry_succeeded' ? 'success' : 'failed';

        await db.insert(billingDunningAttempts).values({
            subscriptionId: event.subscriptionId,
            customerId: event.customerId,
            attemptNumber: (data.attemptNumber as number) ?? 0,
            result,
            amount: (data.amount as number) ?? undefined,
            currency: (data.currency as string) ?? undefined,
            paymentId: (data.paymentId as string) ?? undefined,
            failureCode: (data.failureCode as string) ?? undefined,
            errorMessage: (data.error as string) ?? undefined,
            provider: (data.provider as string) ?? 'mercadopago',
            metadata: {
                eventType: event.type,
                ...(typeof data === 'object' ? data : {})
            },
            attemptedAt: event.timestamp
        });
    } catch (error) {
        apiLogger.error(
            {
                subscriptionId: event.subscriptionId,
                eventType: event.type,
                error: error instanceof Error ? error.message : String(error)
            },
            'Failed to record dunning attempt (non-blocking)'
        );
    }
}

/**
 * Number of days after payment failure when retry attempts are made.
 * Schedule: Day 1, Day 3, Day 5, Day 7 (4 attempts total).
 *
 * Intentionally more aggressive than the SPEC-021 proposal of [1, 3, 7]
 * to maximize recovery rate in the Argentine payment ecosystem where
 * transient bank/card failures are common.
 */
/** Local alias for dunning retry intervals from @repo/billing */
const RETRY_INTERVALS: readonly number[] = DUNNING_RETRY_INTERVALS;

/**
 * HOS-191 F5 kill switch for Hospeda's own dunning mutations.
 *
 * `false` (the default since HOS-191 F5): the cron NEVER calls
 * `lifecycle.processRetries()` or `lifecycle.processCancellations()`. It
 * still builds the `SubscriptionLifecycleService` (so `processPayment`,
 * `getDefaultPaymentMethod`, and `onEvent` stay wired and testable — see the
 * module doc), it just never invokes the two mutating methods. Instead it
 * runs an observe-only pass that reports how many subscriptions are
 * currently `past_due`, purely for visibility.
 *
 * `true`: restores the pre-HOS-191-F5 behavior exactly (both methods called,
 * unchanged). Flip this back only if MercadoPago's native recycling is
 * confirmed broken/disabled for this account — do not flip it back "just in
 * case" without first re-checking the `past_due` reachability gap documented
 * in the module JSDoc above, since re-enabling this alone will not make the
 * loop do anything (no subscription is ever written to `past_due` today).
 */
export const DUNNING_MUTATIONS_ENABLED = false;

/**
 * Discriminated union returned by the withTransaction callback in the cron handler.
 * Allows the outer handler to distinguish lock-skip from real execution results.
 */
type CronTransactionResult =
    | { readonly skipped: true }
    | {
          readonly skipped: false;
          readonly success: boolean;
          readonly message: string;
          readonly processed: number;
          readonly errors: number;
          readonly durationMs: number;
          readonly details?: Record<string, unknown>;
      };

/**
 * Dunning cron job definition.
 *
 * Schedule: Daily at 6:00 AM UTC (0 6 * * *)
 * Purpose: Retry failed subscription payments and cancel subscriptions
 *          that have exhausted all retry attempts and exceeded the grace period.
 */
export const dunningJob: CronJobDefinition = {
    name: 'dunning',
    description:
        'Retry failed subscription payments and cancel past-due subscriptions after grace period',
    schedule: '0 6 * * *', // Daily at 6:00 AM UTC
    enabled: true,
    timeoutMs: 300000, // 5 minutes timeout

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        // Load settings from DB, falling back to compile-time constants
        const billingSettings = await loadBillingSettings();
        const effectiveGracePeriod = billingSettings.gracePeriodDays;
        const effectiveMaxRetries = billingSettings.maxPaymentRetries;

        try {
            // Prevent overlapping cron executions via PostgreSQL advisory lock (GAP-035).
            // Lock key 1003 is reserved for this job. Uses pg_try_advisory_xact_lock
            // (transaction-level) instead of pg_try_advisory_lock (session-level) so the
            // lock survives correctly under transaction-mode connection poolers
            // (PgBouncer, Coolify's pooled clients, etc.). Transaction-level locks
            // auto-release on commit/rollback — no manual unlock needed.
            const cronResult = await withTransaction<CronTransactionResult>(async (_tx) => {
                const lockResult = await _tx.execute(
                    sql`SELECT pg_try_advisory_xact_lock(1003) AS acquired`
                );
                if (!lockResult.rows[0]?.acquired) {
                    return { skipped: true };
                }

                logger.info('Starting dunning job', {
                    dryRun,
                    startedAt: startedAt.toISOString(),
                    retryIntervals: RETRY_INTERVALS,
                    maxRetryAttempts: effectiveMaxRetries,
                    gracePeriodDays: effectiveGracePeriod,
                    settingsSource: 'database-with-fallback'
                });

                // Resolve the QZPay billing instance
                const billing = getQZPayBilling();

                if (!billing) {
                    logger.warn('Billing not configured, skipping dunning job');
                    return {
                        skipped: false,
                        success: true,
                        message: 'Skipped - Billing not configured',
                        processed: 0,
                        errors: 0,
                        durationMs: Date.now() - startedAt.getTime()
                    };
                }

                // Get the storage adapter from the billing instance
                const storage = billing.getStorage();

                // Build the subscription lifecycle service with Hospeda's dunning config
                // Uses DB settings for grace period; retry intervals still use compile-time schedule
                const lifecycle = createSubscriptionLifecycle(billing, storage, {
                    gracePeriodDays: effectiveGracePeriod,
                    retryIntervals: [...RETRY_INTERVALS],
                    trialConversionDays: 0,

                    /**
                     * Process a payment by delegating to QZPay billing's payment layer.
                     * The billing instance already has the MercadoPago adapter wired in,
                     * so we use billing.payments.process() which routes through the adapter.
                     */
                    processPayment: async (input) => {
                        // SPEC-262 T-007: do NOT dun a complimentary or actively
                        // multi-cycle-discounted subscription. A `comp` sub is
                        // never charged (Model β); a sub with a live discount
                        // (`promo_effect_remaining_cycles` > 0 OR forever-null
                        // with a discount link) is intentionally below full price,
                        // so a "failed full charge" must not be treated as
                        // delinquency. Returning success short-circuits the retry
                        // without touching MercadoPago.
                        const guard = await isCompOrActivelyDiscounted(
                            input.metadata.subscriptionId
                        );
                        if (guard) {
                            apiLogger.info(
                                {
                                    subscriptionId: input.metadata.subscriptionId,
                                    customerId: input.customerId,
                                    reason: guard
                                },
                                'Dunning: skipping retry for comp/actively-discounted subscription'
                            );
                            return { success: true };
                        }

                        try {
                            const payment = await billing.payments.process({
                                customerId: input.customerId,
                                amount: input.amount,
                                currency: input.currency as QZPayCurrency,
                                paymentMethodId: input.paymentMethodId,
                                subscriptionId: input.metadata.subscriptionId,
                                metadata: {
                                    type: input.metadata.type
                                }
                            });

                            return {
                                success: payment.status === 'succeeded',
                                paymentId: payment.id,
                                error:
                                    payment.status === 'succeeded'
                                        ? undefined
                                        : `Payment ${payment.status}`
                            };
                        } catch (error) {
                            const errorMessage =
                                error instanceof Error ? error.message : String(error);
                            apiLogger.error(
                                { customerId: input.customerId, error: errorMessage },
                                'Dunning payment attempt failed'
                            );
                            return { success: false, error: errorMessage };
                        }
                    },

                    /**
                     * Retrieve the customer's default saved payment method from storage.
                     * Returns null if no default method is configured, which causes the
                     * lifecycle service to skip the retry for that subscription.
                     */
                    getDefaultPaymentMethod: async (customerId) => {
                        const paymentMethod =
                            await storage.paymentMethods.findDefaultByCustomerId(customerId);

                        if (!paymentMethod) {
                            return null;
                        }

                        // Use the first available provider payment method ID
                        const providerPaymentMethodId = Object.values(
                            paymentMethod.providerPaymentMethodIds
                        )[0];

                        if (!providerPaymentMethodId) {
                            return null;
                        }

                        return {
                            id: paymentMethod.id,
                            providerPaymentMethodId
                        };
                    },

                    /**
                     * Lifecycle event handler for observability, debugging, and audit logging.
                     * Logs each event at the appropriate level and records retry attempts
                     * in the billing_dunning_attempts table for auditing.
                     */
                    onEvent: async (event) => {
                        const logData = {
                            subscriptionId: event.subscriptionId,
                            customerId: event.customerId,
                            eventType: event.type,
                            ...event.data
                        };

                        switch (event.type) {
                            case 'subscription.retry_succeeded':
                                apiLogger.info(logData, 'Dunning: payment retry succeeded');

                                // SPEC-239 T-050: a recovered payment re-activates the
                                // subscription, so re-show any linked commerce listing
                                // (active → PUBLIC). No-op for accommodation subs;
                                // non-blocking.
                                await reconcileCommerceListingForSubscription({
                                    subscriptionId: event.subscriptionId,
                                    subscriptionStatus: 'active',
                                    source: 'dunning-cron'
                                });
                                await reconcilePartnerForSubscription({
                                    subscriptionId: event.subscriptionId,
                                    subscriptionStatus: 'active',
                                    source: 'dunning-cron'
                                });
                                break;
                            case 'subscription.canceled_nonpayment':
                                apiLogger.warn(
                                    logData,
                                    'Dunning: subscription canceled due to non-payment'
                                );

                                // Send cancellation notification to the customer (best-effort)
                                try {
                                    const customer = await billing.customers.get(event.customerId);
                                    if (customer) {
                                        const customerName = String(
                                            customer.metadata?.name || customer.email
                                        );
                                        const userId = customer.metadata?.userId
                                            ? String(customer.metadata.userId)
                                            : null;

                                        await sendSubscriptionCancelledNotification({
                                            customerId: event.customerId,
                                            customerEmail: customer.email ?? '',
                                            customerName,
                                            userId,
                                            planName:
                                                ((event.data as Record<string, unknown>)
                                                    .planName as string) ?? 'Unknown',
                                            mpSubscriptionId: event.subscriptionId,
                                            previousStatus: 'past_due'
                                        }).catch((err) => {
                                            apiLogger.debug(
                                                {
                                                    error:
                                                        err instanceof Error
                                                            ? err.message
                                                            : String(err),
                                                    subscriptionId: event.subscriptionId
                                                },
                                                'Dunning cancellation notification failed (non-blocking)'
                                            );
                                        });
                                    }
                                } catch (notifErr) {
                                    apiLogger.debug(
                                        {
                                            error:
                                                notifErr instanceof Error
                                                    ? notifErr.message
                                                    : String(notifErr),
                                            subscriptionId: event.subscriptionId
                                        },
                                        'Failed to send dunning cancellation notification (non-blocking)'
                                    );
                                }

                                // INV-1: invalidate entitlement cache so the cancelled
                                // customer stops seeing paid-plan entitlements immediately,
                                // rather than waiting for the 5-minute TTL to expire.
                                clearEntitlementCache(event.customerId);

                                // SPEC-239 T-050: hide any commerce listing linked to this
                                // subscription (cancelled → PRIVATE). No-op for accommodation
                                // subs; non-blocking (never breaks the cron).
                                await reconcileCommerceListingForSubscription({
                                    subscriptionId: event.subscriptionId,
                                    subscriptionStatus: 'cancelled',
                                    source: 'dunning-cron'
                                });
                                await reconcilePartnerForSubscription({
                                    subscriptionId: event.subscriptionId,
                                    subscriptionStatus: 'cancelled',
                                    source: 'dunning-cron'
                                });

                                // SPEC-309 T-012: revoke featuredByEntitlement when
                                // non-payment cancellation hits a FEATURED_LISTING plan.
                                // Same pattern as T-011 (finalize-cancelled-subs): the
                                // subscription is already committed cancelled by this
                                // point, so resolveOwnerPlanGrantsFeatured (T-004)
                                // naturally resolves to `false` here — sourced from the
                                // shared resolver instead of a local getPlanBySlug lookup,
                                // for a single source of truth across all call-sites.
                                // Non-blocking. The reconcile cron is the backstop.
                                try {
                                    const ownerId = await resolveOwnerUserId({
                                        customerId: event.customerId
                                    });
                                    if (ownerId) {
                                        const planStillGrantsFeatured =
                                            await resolveOwnerPlanGrantsFeatured({ ownerId });
                                        await syncFeaturedByEntitlementForOwner({
                                            ownerId,
                                            active: planStillGrantsFeatured
                                        });
                                        apiLogger.info(
                                            {
                                                subscriptionId: event.subscriptionId,
                                                customerId: event.customerId
                                            },
                                            'Dunning: syncFeaturedByEntitlementForOwner revoked on canceled_nonpayment'
                                        );
                                    }
                                } catch (featuredSyncErr) {
                                    apiLogger.warn(
                                        {
                                            subscriptionId: event.subscriptionId,
                                            customerId: event.customerId,
                                            error:
                                                featuredSyncErr instanceof Error
                                                    ? featuredSyncErr.message
                                                    : String(featuredSyncErr)
                                        },
                                        'Dunning: syncFeaturedByEntitlementForOwner failed on canceled_nonpayment (non-blocking — T-006 will reconcile)'
                                    );
                                }
                                break;
                            case 'subscription.retry_failed':
                                apiLogger.warn(logData, 'Dunning: payment retry failed');
                                break;
                            case 'subscription.retry_scheduled':
                                apiLogger.info(logData, 'Dunning: next retry scheduled');
                                break;
                            default:
                                apiLogger.debug(logData, `Dunning lifecycle event: ${event.type}`);
                        }

                        // Record retry attempts in the audit table (best-effort)
                        await recordDunningAttempt(event);
                    }
                });

                if (dryRun) {
                    // Dry-run: load all past-due subscriptions to report counts without mutating
                    logger.info('Running in dry-run mode - loading past-due subscriptions');

                    const allSubscriptions = await billing.subscriptions.list();
                    const pastDue = (allSubscriptions?.data ?? []).filter(
                        (sub) => sub.status === 'past_due'
                    );

                    logger.info('Dry run complete - would process past-due subscriptions', {
                        pastDueCount: pastDue.length,
                        maxRetryAttempts: effectiveMaxRetries,
                        gracePeriodDays: effectiveGracePeriod
                    });

                    return {
                        skipped: false,
                        success: true,
                        message: `Dry run - Would process ${pastDue.length} past-due subscriptions`,
                        processed: pastDue.length,
                        errors: 0,
                        durationMs: Date.now() - startedAt.getTime(),
                        details: {
                            dryRun: true,
                            pastDueCount: pastDue.length,
                            retryIntervals: RETRY_INTERVALS,
                            gracePeriodDays: effectiveGracePeriod
                        }
                    };
                }

                // HOS-191 F5: mutations disabled by default — MercadoPago's native
                // recycling is now the sole retry/cancellation mechanism. See
                // DUNNING_MUTATIONS_ENABLED and the module JSDoc for the full
                // rationale and the past_due-reachability gap this surfaced.
                if (!DUNNING_MUTATIONS_ENABLED) {
                    logger.info(
                        'Running in production mode - HOS-191 F5: dunning mutations disabled, observe-only pass (MercadoPago native recycling is authoritative)'
                    );

                    const allSubscriptions = await billing.subscriptions.list();
                    const pastDueCount = (allSubscriptions?.data ?? []).filter(
                        (sub) => sub.status === 'past_due'
                    ).length;
                    const durationMs = Date.now() - startedAt.getTime();

                    logger.info('Dunning job completed (observe-only, HOS-191 F5)', {
                        pastDueCount,
                        dunningMutationsEnabled: false,
                        durationMs
                    });

                    return {
                        skipped: false,
                        success: true,
                        message: `Observe-only (HOS-191 F5, MercadoPago native recycling is authoritative): ${pastDueCount} subscription(s) currently past_due — no local retries or cancellations attempted`,
                        processed: 0,
                        errors: 0,
                        durationMs,
                        details: {
                            dunningMutationsEnabled: false,
                            pastDueCount
                        }
                    };
                }

                // Production mode (legacy path, currently unreachable behind the
                // DUNNING_MUTATIONS_ENABLED kill switch above): run payment retries
                // and grace period cancellations via qzpay-core's lifecycle service.
                logger.info(
                    'Running in production mode - processing payment retries and cancellations'
                );

                // Run retries BEFORE cancellations to avoid a race where a subscription
                // could be picked up by both processes simultaneously.
                const retriesResult = await lifecycle.processRetries();
                const cancellationsResult = await lifecycle.processCancellations();

                const totalProcessed = retriesResult.processed + cancellationsResult.processed;
                const cancellationsFailed =
                    'failed' in cancellationsResult ? (cancellationsResult.failed as number) : 0;
                const totalErrors = retriesResult.failed + cancellationsFailed;
                const durationMs = Date.now() - startedAt.getTime();

                logger.info('Dunning job completed', {
                    retries: {
                        processed: retriesResult.processed,
                        succeeded: retriesResult.succeeded,
                        failed: retriesResult.failed
                    },
                    cancellations: {
                        processed: cancellationsResult.processed
                    },
                    durationMs
                });

                return {
                    skipped: false,
                    success: true,
                    message: [
                        `Retries: ${retriesResult.succeeded}/${retriesResult.processed} succeeded`,
                        `Cancellations: ${cancellationsResult.processed} processed`
                    ].join('. '),
                    processed: totalProcessed,
                    errors: totalErrors,
                    durationMs,
                    details: {
                        retries: {
                            processed: retriesResult.processed,
                            succeeded: retriesResult.succeeded,
                            failed: retriesResult.failed,
                            details: retriesResult.details
                        },
                        cancellations: {
                            processed: cancellationsResult.processed,
                            details: cancellationsResult.details
                        }
                    }
                };
                // End of withTransaction callback — lock auto-releases on commit
            });

            // Handle lock-not-acquired case from inside the transaction
            if (cronResult.skipped) {
                logger.warn('dunning cron: skipping — previous run still holds advisory lock');
                return {
                    success: true,
                    message: 'Skipped — another instance is already running',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime()
                };
            }

            return {
                success: cronResult.success,
                message: cronResult.message,
                processed: cronResult.processed,
                errors: cronResult.errors,
                durationMs: cronResult.durationMs,
                ...(cronResult.details ? { details: cronResult.details } : {})
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            // SPEC-180: unexpected dunning failure is actionable — forward to Sentry.
            // Note: the bootstrap also calls Sentry.captureException on thrown errors;
            // this path is for non-thrown failures inside the handler body.
            logger.error(
                'Dunning job failed with unexpected error',
                { error: errorMessage, stack: errorStack },
                { capture: true }
            );

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: false,
                message: `Dunning job failed: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs,
                details: {
                    error: errorMessage
                }
            };
        }
        // Note: no finally block needed — pg_try_advisory_xact_lock auto-releases on
        // transaction commit/rollback. The lock was scoped to the withTransaction call above.
    }
};
