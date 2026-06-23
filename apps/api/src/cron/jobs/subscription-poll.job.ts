/**
 * Subscription provider-status polling cron job (SPEC-143 Finding #17)
 *
 * Drives the polling fallback for MercadoPago `subscription_preapproval`
 * webhooks that fail to arrive in test environments (and occasionally in
 * production after MP outages). After `start-paid` enqueues a polling
 * job, this cron scans due rows once per minute and calls MP
 * `/preapproval/{id}` to determine whether the user has authorized the
 * recurring charge. When MP reports `active`, the local subscription is
 * transitioned via {@link processSubscriptionUpdated} so the cron path
 * shares the full audit-log + notification + addon-recalc flow with the
 * webhook path. The job exits cleanly when the
 * `HOSPEDA_BILLING_POLLING_ENABLED` feature flag is `false`.
 *
 * @module cron/jobs/subscription-poll
 */

import type { QZPaySubscriptionPollingJob, QZPayWebhookEvent } from '@qazuor/qzpay-core';
import type { QZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';
import { createMercadoPagoAdapter } from '@repo/billing';
import { getDb, sql, withTransaction } from '@repo/db';
import {
    calculatePromoCodeEffect,
    getPromoCodeById,
    resolveFullPlanPriceCentavos
} from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { qzpayLogger } from '../../lib/qzpay-logger.js';
import { getQZPayBilling } from '../../middlewares/billing.js';
import {
    confirmAnnualSubscription,
    processPaymentUpdated
} from '../../routes/webhooks/mercadopago/payment-logic.js';
import { processSubscriptionUpdated } from '../../routes/webhooks/mercadopago/subscription-logic.js';
import { env } from '../../utils/env.js';
import type { CronJobDefinition, CronJobResult } from '../types.js';

/**
 * Advisory lock key reserved for this cron. Sibling billing crons use
 * 1003 (dunning), 1004 (trial-expiry), 1005 (trial-pre-end-notif),
 * 1006 (abandoned-pending-subs).
 */
const ADVISORY_LOCK_KEY = 1007;

/**
 * Maximum number of due polling jobs processed per cron tick. Keeps the
 * batch bounded so a single iteration cannot starve MP's REST budget or
 * exceed the cron tick window.
 */
const POLL_BATCH_SIZE = 50;

/**
 * Default backoff before the next poll attempt when MP returns a
 * non-terminal status (e.g. `pending`). Aggressive enough that
 * fast-authorizing payers see `active` within a minute; gentle enough
 * that we don't hammer MP for slow ones.
 */
const NEXT_POLL_DELAY_MS = 30 * 1000;

/**
 * Backoff after a poll attempt fails with a provider error (network,
 * 5xx). Longer than the happy-path delay so we don't pin a flaky MP
 * with retries.
 */
const ERROR_RETRY_DELAY_MS = 60 * 1000;

interface PollOutcome {
    readonly terminal: boolean;
    readonly status: 'succeeded' | 'failed' | 'cancelled' | 'pending';
    readonly providerStatus: string | null;
    readonly error: string | null;
}

/**
 * Synthesize a webhook-shaped event so the polling path can reuse
 * `processSubscriptionUpdated`. Sharing the transition function keeps
 * the cron and the webhook path in lockstep — when MP fixes its
 * delivery we don't end up with two divergent state machines.
 */
function buildSyntheticEvent(job: QZPaySubscriptionPollingJob): QZPayWebhookEvent {
    return {
        id: `polling-${job.id}`,
        type: 'subscription_preapproval.updated',
        data: { id: job.providerResourceId },
        created: new Date()
    };
}

/**
 * Map the result of `processSubscriptionUpdated` (plus a fallback raw
 * status read for diagnostics) into a polling-job outcome. The cron
 * uses the outcome to decide between marking the job terminal or
 * scheduling the next poll attempt.
 */
function classifyOutcome(params: {
    statusChanged: boolean;
    newStatus: string | undefined;
    providerStatusRaw: string | null;
}): PollOutcome {
    const { statusChanged, newStatus, providerStatusRaw } = params;
    // The webhook handler normalizes status into Hospeda's enum; we map
    // back to a polling lifecycle status.
    if (statusChanged && newStatus === 'active') {
        return {
            terminal: true,
            status: 'succeeded',
            providerStatus: providerStatusRaw,
            error: null
        };
    }
    if (statusChanged && (newStatus === 'cancelled' || newStatus === 'expired')) {
        return {
            terminal: true,
            status: newStatus === 'cancelled' ? 'cancelled' : 'failed',
            providerStatus: providerStatusRaw,
            error: null
        };
    }
    // No status change OR transitioned to a non-terminal intermediate
    // state — keep polling. Diagnostic providerStatus captured so the
    // operator can see why.
    return {
        terminal: false,
        status: 'pending',
        providerStatus: providerStatusRaw,
        error: null
    };
}

interface ProcessJobResult {
    readonly handled: boolean;
    readonly outcome: PollOutcome | null;
    readonly error: Error | null;
}

type CronLogger = CronJobDefinition['handler'] extends (ctx: infer Ctx) => unknown
    ? Ctx extends { logger: infer L }
        ? L
        : never
    : never;

/**
 * Subscription-flavour poll: hit MP `/preapproval/{id}` via the existing
 * webhook handler so we get audit log + notifications + addon recalc for
 * free, plus an idempotent transition (the handler bails early when
 * local status already matches provider).
 *
 * Mirrors the original implementation 1:1 — extracted only to slot into
 * the resourceType branch in {@link processOneJob}.
 */
async function runSubscriptionPoll(params: {
    locked: QZPaySubscriptionPollingJob;
    billing: NonNullable<ReturnType<typeof getQZPayBilling>>;
    paymentAdapter: QZPayMercadoPagoAdapter;
    logger: CronLogger;
}): Promise<PollOutcome> {
    const { locked, billing, paymentAdapter, logger } = params;

    const handlerResult = await processSubscriptionUpdated({
        event: buildSyntheticEvent(locked),
        billing,
        paymentAdapter,
        providerEventId: `polling-${locked.id}`,
        source: 'polling'
    });

    let providerStatusRaw: string | null = null;
    try {
        const provider = await paymentAdapter.subscriptions.retrieve(locked.providerResourceId);
        providerStatusRaw = provider.status;
    } catch (lookupError) {
        logger.debug('subscription-poll: secondary status read failed', {
            jobId: locked.id,
            error: lookupError instanceof Error ? lookupError.message : String(lookupError)
        });
    }

    return classifyOutcome({
        statusChanged: handlerResult.statusChanged,
        newStatus: handlerResult.newStatus,
        providerStatusRaw
    });
}

/**
 * One-time-payment poll (SPEC-143 Finding #21 + SPEC-127 T-011): the polling
 * job's `providerResourceId` is the local checkout session id (also set as
 * MP `external_reference`), and we resolve the actual MP payment id by
 * searching the payments collection.
 *
 * Decision matrix per attempt (shared across both sub-flows):
 * - No matching payment yet (user still on checkout page) → keep polling.
 * - Found `succeeded` payment → dispatch confirmation (see below).
 *   Returns terminal `succeeded`.
 * - Found `failed`/`canceled` only → terminal failure; the abandoned-
 *   pending-subs reaper picks up the local sub via TTL.
 * - Other intermediate states → keep polling.
 *
 * Dispatch branching on succeeded payment (SPEC-127 T-011):
 * - **Addon jobs** (`locked.metadata?.type === 'addon_purchase'`): call
 *   {@link processPaymentUpdated} with a synthetic payment payload built
 *   from the search result. This reuses the webhook's full confirmation
 *   path — idempotency check (`billing_addon_purchases.paymentId`),
 *   notification, entitlement cache invalidation — for free.
 *   The synthetic `data.metadata` is assembled from the payment's own
 *   metadata first (carries camelCase `addonSlug`/`customerId` set by
 *   the qzpay checkout) then falls back to the job row's metadata for
 *   keys the payment may lack. `transaction_amount` is in MAJOR units
 *   (`succeeded.amount / 100`) because `extractPaymentInfo` reads that
 *   field as major units; `currency_id` maps to `succeeded.currency`.
 * - **Annual jobs** (no addon discriminator): call
 *   {@link confirmAnnualSubscription} as before (idempotent — webhook
 *   and polling can race for the same payment).
 *
 * Requires the configured payment adapter to expose `search()`. MP's
 * adapter implements it natively; if a future provider does not, this
 * branch logs and treats the job as non-terminal so retries continue
 * (the adapter capability is checked once up-front in the cron handler
 * so we don't hammer search-less adapters per attempt).
 */
async function runOneTimePaymentPoll(params: {
    locked: QZPaySubscriptionPollingJob;
    billing: NonNullable<ReturnType<typeof getQZPayBilling>>;
    paymentAdapter: QZPayMercadoPagoAdapter;
    logger: CronLogger;
}): Promise<PollOutcome> {
    const { locked, billing, paymentAdapter, logger } = params;

    if (!paymentAdapter.payments.search) {
        // Configured adapter doesn't support search — bail and keep
        // polling. The cron's adapter availability is checked once at
        // startup, so reaching this branch means the adapter contract
        // shape changed unexpectedly. Log loudly.
        logger.error(
            'subscription-poll: paymentAdapter has no search() — cannot resolve one_time_payment job',
            {
                jobId: locked.id,
                subscriptionId: locked.subscriptionId
            }
        );
        return {
            terminal: false,
            status: 'pending',
            providerStatus: null,
            error: 'adapter_search_unavailable'
        };
    }

    const matches = await paymentAdapter.payments.search({
        externalReference: locked.providerResourceId
    });

    // Prefer the most recent succeeded attempt — the search adapter
    // already sorts date_created DESC so the first succeeded entry is
    // the authoritative one for this checkout session.
    const succeeded = matches.find((p) => p.status === 'succeeded');
    if (succeeded) {
        // Discriminate: was this checkout job created by the addon flow?
        const isAddonJob =
            locked.metadata !== null &&
            typeof locked.metadata === 'object' &&
            (locked.metadata as Record<string, unknown>).type === 'addon_purchase';

        if (isAddonJob) {
            // ── Addon confirmation via processPaymentUpdated ────────────────
            //
            // Builds a synthetic payment payload that mirrors what the
            // live webhook handler receives so processPaymentUpdated can
            // run its full path: idempotency check on
            // billing_addon_purchases.paymentId, addonService.confirmPurchase,
            // notification dispatch, and entitlement cache invalidation.
            //
            // Field mapping:
            //   id              → succeeded.id (MP payment id, used as paymentId)
            //   status          → 'approved' (MP canonical for succeeded)
            //   transaction_amount → succeeded.amount / 100 (cents → major units;
            //                     extractPaymentInfo reads transaction_amount as
            //                     major units from the MP payload shape)
            //   currency_id     → succeeded.currency
            //   metadata        → payment metadata merged with job metadata as
            //                     fallback for any key the payment may lack
            //                     (addonSlug, customerId, userId, order_id)
            //   external_reference → locked.providerResourceId (checkout session UUID)
            const jobMeta = locked.metadata as Record<string, unknown>;
            const paymentMeta =
                succeeded.metadata !== null &&
                typeof succeeded.metadata === 'object' &&
                !Array.isArray(succeeded.metadata)
                    ? (succeeded.metadata as Record<string, unknown>)
                    : {};

            // Whitelist only the keys the addon confirm path needs.
            // Dispatch-discriminator keys (annualSubscriptionId, planChangeUpgradeId)
            // must NEVER leak into this payload — processPaymentUpdated branches on
            // their presence and would fire the annual/upgrade path instead of the
            // addon path if either key accidentally appears here.
            //
            // Keys sourced from paymentMeta first, falling back to jobMeta:
            //   addonSlug    — consumed by extractAddonMetadata in payment-logic
            //   customerId   — consumed by extractAddonMetadata in payment-logic
            //   userId       — forwarded for logging / traceability
            //   order_id     — external_reference fallback used by logging
            //   orderId      — camelCase alias forwarded for traceability
            //   type         — dispatch discriminator (must equal 'addon_purchase')
            const syntheticMetadata: Record<string, unknown> = {
                addonSlug: paymentMeta.addonSlug ?? jobMeta.addonSlug,
                customerId: paymentMeta.customerId ?? jobMeta.customerId,
                userId: paymentMeta.userId ?? jobMeta.userId,
                order_id:
                    paymentMeta.order_id ??
                    paymentMeta.orderId ??
                    jobMeta.order_id ??
                    jobMeta.orderId,
                orderId: paymentMeta.orderId ?? jobMeta.orderId,
                type: paymentMeta.type ?? jobMeta.type
            };

            const syntheticPayload: Record<string, unknown> = {
                id: succeeded.id,
                status: 'approved',
                // extractPaymentInfo reads transaction_amount as MAJOR units.
                // The adapter returns amount in cents, so divide by 100.
                transaction_amount: succeeded.amount / 100,
                currency_id: succeeded.currency,
                metadata: syntheticMetadata,
                external_reference: locked.providerResourceId
            };

            try {
                const result = await processPaymentUpdated({
                    data: syntheticPayload,
                    billing,
                    source: 'polling'
                });

                if (!result.success) {
                    logger.error('subscription-poll: processPaymentUpdated failed for addon job', {
                        jobId: locked.id,
                        paymentId: succeeded.id,
                        addonSlug: syntheticMetadata.addonSlug,
                        customerId: syntheticMetadata.customerId
                    });
                    throw new Error('processPaymentUpdated returned success=false for addon job');
                }
            } catch (err) {
                logger.error('subscription-poll: addon confirmation threw', {
                    jobId: locked.id,
                    paymentId: succeeded.id,
                    error: err instanceof Error ? err.message : String(err)
                });
                throw err;
            }

            return {
                terminal: true,
                status: 'succeeded',
                providerStatus: 'approved',
                error: null
            };
        }

        // ── Annual subscription confirmation (default branch) ───────────
        //
        // amount comes from the adapter in cents (smallest currency unit);
        // confirmAnnualSubscription expects MAJOR units (it converts back
        // to cents internally when recording the payment row). Mirror the
        // webhook handler convention.
        const amountMajor = succeeded.amount / 100;
        const annualSubscriptionId =
            typeof succeeded.metadata?.annualSubscriptionId === 'string'
                ? succeeded.metadata.annualSubscriptionId
                : locked.subscriptionId; // fallback: trust the local job
        try {
            await confirmAnnualSubscription({
                annualSubscriptionId,
                providerPaymentId: succeeded.id,
                amount: amountMajor,
                currency: succeeded.currency,
                billing,
                source: 'polling'
            });
        } catch (err) {
            // confirmAnnualSubscription swallows its own errors (logged
            // there). A throw here would mean unexpected runtime failure
            // — surface as adapter error so the job retries.
            logger.error('subscription-poll: confirmAnnualSubscription threw', {
                jobId: locked.id,
                paymentId: succeeded.id,
                error: err instanceof Error ? err.message : String(err)
            });
            throw err;
        }
        return { terminal: true, status: 'succeeded', providerStatus: 'approved', error: null };
    }

    // No succeeded — check for terminal failure (rejected / cancelled)
    // among the matches. If the latest attempt is a failure we treat
    // the job as terminal; the user can retry by starting a new checkout.
    const failure = matches.find((p) => p.status === 'failed' || p.status === 'canceled');
    if (failure) {
        return {
            terminal: true,
            status: failure.status === 'canceled' ? 'cancelled' : 'failed',
            providerStatus: failure.status,
            error: null
        };
    }

    // No matches yet OR only intermediate statuses → keep polling.
    return {
        terminal: false,
        status: 'pending',
        providerStatus: matches[0]?.status ?? null,
        error: null
    };
}

/**
 * SPEC-262 S1 — Discount-aware amount reconciler (real safety net).
 *
 * For each ACTIVE subscription that has a promo_code_id set, retrieve the live
 * MercadoPago `transaction_amount` and compare it to the EXPECTED amount:
 * - Expected = discounted price if `promo_effect_remaining_cycles > 0` or `=== null`
 *   (forever), otherwise expected = full plan price.
 * - If the live amount drifts from the expected (e.g. restore failed after 3 retries
 *   and left the preapproval at the discounted rate, or something else mutated the
 *   preapproval externally), re-issue the correct MP mutation.
 *
 * This is best-effort (never throws, errors go to Sentry + warn log). It is invoked
 * once per cron tick from the existing subscription-poll job handler, after the main
 * polling batch, so it piggy-backs on the already-running scheduled task without
 * requiring a separate cron.
 *
 * Tolerance: ±1 ARS major (0.01 peso) to absorb floating-point rounding.
 */
async function reconcileActiveDiscountAmounts(params: {
    paymentAdapter: QZPayMercadoPagoAdapter;
    logger: CronLogger;
}): Promise<void> {
    const { paymentAdapter, logger } = params;

    // Load all active subscriptions with a promo link and a live preapproval.
    const db = getDb();
    let rows: Array<{
        id: string;
        plan_id: string | null;
        mp_subscription_id: string;
        promo_code_id: string;
        promo_effect_remaining_cycles: number | null;
    }>;

    try {
        const result = await db.execute(
            sql`SELECT id, plan_id, mp_subscription_id, promo_code_id, promo_effect_remaining_cycles
                FROM billing_subscriptions
                WHERE status = 'active'
                  AND promo_code_id IS NOT NULL
                  AND mp_subscription_id IS NOT NULL
                  AND deleted_at IS NULL`
        );
        rows = (result.rows ?? []) as typeof rows;
    } catch (dbErr) {
        logger.warn('subscription-poll reconcile: failed to load discounted subscriptions', {
            error: dbErr instanceof Error ? dbErr.message : String(dbErr)
        });
        return;
    }

    for (const row of rows) {
        try {
            // Determine expected amount.
            const fullPriceCentavos = await resolveFullPlanPriceCentavos(db, row.plan_id);
            if (fullPriceCentavos === null) {
                continue; // Can't reconcile without a known price — skip silently.
            }

            const remaining = row.promo_effect_remaining_cycles;
            let expectedAmountMajor: number;

            if (remaining === null || remaining > 0) {
                // Active discount (forever or finite with cycles remaining).
                const promoResult = await getPromoCodeById(row.promo_code_id);
                if (!promoResult.success || !promoResult.data?.effect) {
                    continue;
                }
                const mutation = calculatePromoCodeEffect(
                    promoResult.data.effect,
                    fullPriceCentavos
                );
                if (mutation.type !== 'apply-discount') {
                    continue;
                }
                expectedAmountMajor = mutation.finalAmount / 100;
            } else {
                // remaining === 0: discount exhausted, expected = full price.
                expectedAmountMajor = fullPriceCentavos / 100;
            }

            // Retrieve live MP amount.
            const livePreapproval = await paymentAdapter.subscriptions.retrieve(
                row.mp_subscription_id
            );
            // The MP preapproval (subscription) object stores the recurring amount
            // under `auto_recurring.transaction_amount` (MAJOR units), NOT at the
            // top level — top-level `transaction_amount` only exists on payment
            // objects. Reading the wrong path yields undefined → -1 → a spurious
            // mutation on every tick. See spike doc §2.2.
            // TYPE-WORKAROUND: the qzpay adapter returns the raw MP preapproval as
            // its typed SDK shape; we read dynamic `auto_recurring` fields not on
            // that type, so a Record cast is required to access them safely.
            const liveRecord = livePreapproval as unknown as Record<string, unknown>;
            const autoRecurring =
                typeof liveRecord.auto_recurring === 'object' && liveRecord.auto_recurring !== null
                    ? (liveRecord.auto_recurring as Record<string, unknown>)
                    : {};
            const liveAmountMajor: number =
                typeof autoRecurring.transaction_amount === 'number'
                    ? autoRecurring.transaction_amount
                    : -1;

            // Tolerance ±1 ARS major (avoid rounding false positives).
            if (Math.abs(liveAmountMajor - expectedAmountMajor) <= 1) {
                continue; // In sync — nothing to do.
            }

            // Amount drifted: re-issue the correct mutation (best-effort).
            logger.warn('subscription-poll reconcile: MP amount drift detected, re-issuing', {
                subscriptionId: row.id,
                mpSubscriptionId: row.mp_subscription_id,
                liveAmountMajor,
                expectedAmountMajor,
                remaining
            });
            try {
                await paymentAdapter.subscriptions.update(row.mp_subscription_id, {
                    transactionAmount: expectedAmountMajor
                });
                logger.info('subscription-poll reconcile: amount drift corrected', {
                    subscriptionId: row.id,
                    mpSubscriptionId: row.mp_subscription_id,
                    correctedAmountMajor: expectedAmountMajor
                });
            } catch (mpErr) {
                const message = mpErr instanceof Error ? mpErr.message : String(mpErr);
                logger.warn('subscription-poll reconcile: MP mutation failed (best-effort)', {
                    subscriptionId: row.id,
                    error: message
                });
                Sentry.captureException(
                    new Error(`Promo reconcile MP mutation failed: ${message}`),
                    {
                        extra: {
                            subscriptionId: row.id,
                            mpSubscriptionId: row.mp_subscription_id,
                            liveAmountMajor,
                            expectedAmountMajor
                        },
                        tags: { module: 'subscription-poll', operation: 'reconcileDiscountAmount' }
                    }
                );
            }
        } catch (rowErr) {
            // Per-sub errors must not abort the whole batch.
            logger.warn('subscription-poll reconcile: unexpected error for sub', {
                subscriptionId: row.id,
                error: rowErr instanceof Error ? rowErr.message : String(rowErr)
            });
        }
    }
}

/**
 * Process a single polling job: lock it, branch on resourceType to
 * query the right MP endpoint, transition the subscription if
 * appropriate, and persist the next state on the job.
 *
 * Each job uses optimistic locking. A worker that loses the version
 * race silently exits — the winner will progress the job.
 */
async function processOneJob(
    job: QZPaySubscriptionPollingJob,
    billing: NonNullable<ReturnType<typeof getQZPayBilling>>,
    paymentAdapter: QZPayMercadoPagoAdapter,
    logger: CronLogger
): Promise<ProcessJobResult> {
    const storage = billing.getStorage().subscriptionPollingJobs;
    if (!storage) {
        // Should not happen — caller already checked. Defensive.
        return { handled: false, outcome: null, error: new Error('Storage missing') };
    }

    // 1. Optimistic-lock: mark lastPolledAt + increment attempts. The
    //    version rotation ensures any concurrent worker that read the
    //    same row before this update sees `null` and exits.
    const locked = await storage.update({
        id: job.id,
        expectedVersion: job.version,
        incrementAttemptsBy: 1,
        lastPolledAt: new Date()
    });
    if (!locked) {
        logger.debug('subscription-poll: job already picked up by another worker', {
            jobId: job.id
        });
        return { handled: false, outcome: null, error: null };
    }

    // 2. Timeout check. If attempts > max, transition the job to
    //    `timeout` and let the abandoned-pending-subs reaper handle
    //    the local subscription via its existing 30-min TTL — keeping
    //    the responsibility for the abandoned status in one place.
    if (locked.attempts > locked.maxAttempts) {
        const cleared = await storage.update({
            id: locked.id,
            expectedVersion: locked.version,
            status: 'timeout',
            completedAt: new Date(),
            lastError: `max_attempts_reached: ${locked.maxAttempts}`
        });
        logger.warn('subscription-poll: job hit max attempts and timed out', {
            jobId: locked.id,
            subscriptionId: locked.subscriptionId,
            providerResourceId: locked.providerResourceId,
            attempts: locked.attempts,
            maxAttempts: locked.maxAttempts,
            transitionedJob: cleared !== null
        });
        return {
            handled: true,
            outcome: {
                terminal: true,
                status: 'failed',
                providerStatus: locked.lastProviderStatus,
                error: 'max_attempts_reached'
            },
            error: null
        };
    }

    // 3. Branch on resourceType. Both branches return a PollOutcome;
    //    the persist-next-state step below is shared.
    //
    // SPEC-262 T-007: this job only ACTIVATES pending-provider subscriptions
    // (flips pending → active by polling MP for the first charge). It never
    // recomputes or "corrects" the recurring `transaction_amount` of an
    // already-active subscription, so it cannot clobber an intentionally-
    // discounted amount. The discount-aware amount reconciler lives in
    // `reconcileActiveDiscountAmounts` (invoked once per cron tick after this
    // batch loop, outside the advisory lock). Comp subs never create a
    // preapproval and never enqueue a polling job, so they never reach here.
    try {
        const outcome =
            locked.resourceType === 'one_time_payment'
                ? await runOneTimePaymentPoll({ locked, billing, paymentAdapter, logger })
                : await runSubscriptionPoll({ locked, billing, paymentAdapter, logger });

        // 4. Persist the job's next state. Terminal outcomes set
        //    completedAt + status; non-terminal outcomes only bump
        //    nextPollAt and the diagnostic lastProviderStatus.
        if (outcome.terminal) {
            await storage.update({
                id: locked.id,
                expectedVersion: locked.version,
                status: outcome.status,
                completedAt: new Date(),
                lastProviderStatus: outcome.providerStatus
            });
        } else {
            await storage.update({
                id: locked.id,
                expectedVersion: locked.version,
                nextPollAt: new Date(Date.now() + NEXT_POLL_DELAY_MS),
                lastProviderStatus: outcome.providerStatus
            });
        }

        return { handled: true, outcome, error: null };
    } catch (error) {
        // Provider call failed. Bump nextPollAt with the error backoff
        // so we don't hammer MP, and surface the error message in
        // lastError so an operator can spot the pattern.
        const errMessage = error instanceof Error ? error.message : String(error);
        await storage.update({
            id: locked.id,
            expectedVersion: locked.version,
            nextPollAt: new Date(Date.now() + ERROR_RETRY_DELAY_MS),
            lastError: errMessage.slice(0, 500) // cap to fit the column
        });
        logger.warn('subscription-poll: provider call failed, scheduled retry', {
            jobId: locked.id,
            providerResourceId: locked.providerResourceId,
            resourceType: locked.resourceType,
            error: errMessage
        });
        return {
            handled: true,
            outcome: null,
            error: error instanceof Error ? error : new Error(String(error))
        };
    }
}

/**
 * Subscription provider-status polling job definition.
 *
 * Schedule: every minute. The 30-second base poll cadence we want is
 * achieved by enqueueing the first poll 30s in the future from
 * start-paid; subsequent polls reschedule with the same delay. The
 * cron runs every minute so on a worst-case the next poll fires
 * one minute after the schedule time (acceptable for user-perceived
 * latency to subscription activation).
 */
export const subscriptionPollJob: CronJobDefinition = {
    name: 'subscription-poll',
    description:
        'Polls MercadoPago /preapproval/{id} for pending subscriptions to flip them to active when the webhook is delayed or lost (SPEC-143 Finding #17 fallback)',
    schedule: '* * * * *',
    enabled: true,
    timeoutMs: 50_000,

    handler: async (ctx): Promise<CronJobResult> => {
        const { logger, startedAt, dryRun } = ctx;
        const durationFor = (start: Date) => Date.now() - start.getTime();

        if (!env.HOSPEDA_BILLING_POLLING_ENABLED) {
            logger.debug('subscription-poll: feature flag disabled, skipping run');
            return {
                success: true,
                processed: 0,
                errors: 0,
                durationMs: durationFor(startedAt),
                message: 'subscription_polling_disabled_by_flag'
            };
        }

        const billing = getQZPayBilling();
        if (!billing) {
            logger.warn('subscription-poll: billing not configured, skipping run');
            return {
                success: true,
                processed: 0,
                errors: 0,
                durationMs: durationFor(startedAt),
                message: 'billing_not_configured'
            };
        }

        const storage = billing.getStorage();
        const pollingStorage = storage.subscriptionPollingJobs;
        if (!pollingStorage) {
            logger.warn(
                'subscription-poll: storage adapter does not expose subscriptionPollingJobs, skipping'
            );
            return {
                success: true,
                processed: 0,
                errors: 0,
                durationMs: durationFor(startedAt),
                message: 'polling_storage_unavailable'
            };
        }

        // The cron creates its own MP adapter (same pattern as
        // webhook-retry.job.ts). This avoids depending on `billing.getPaymentAdapter()`
        // being narrowed to the MP type — qzpay-core returns the generic
        // adapter interface, and `paymentAdapter.subscriptions.retrieve()`
        // is the only method we exercise.
        let paymentAdapter: QZPayMercadoPagoAdapter;
        try {
            paymentAdapter = createMercadoPagoAdapter({ logger: qzpayLogger });
        } catch (error) {
            logger.warn(
                'subscription-poll: failed to construct MercadoPago adapter, skipping run',
                { error: error instanceof Error ? error.message : String(error) }
            );
            return {
                success: true,
                processed: 0,
                errors: 0,
                durationMs: durationFor(startedAt),
                message: 'mp_adapter_unavailable'
            };
        }

        let processed = 0;
        let errors = 0;

        const wrapped = await withTransaction(async (tx) => {
            // Single-writer guarantee. The lock auto-releases when the
            // outer transaction commits/rolls back — no manual unlock.
            const lockResult = await tx.execute(
                sql`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}) as acquired`
            );
            const acquired = (lockResult.rows?.[0] as Record<string, unknown> | undefined)
                ?.acquired;
            if (!acquired) {
                logger.debug(
                    'subscription-poll: previous run still holding advisory lock, skipping'
                );
                return { processed: 0, errors: 0, locked: false };
            }

            const dueJobs = await pollingStorage.findDuePending(new Date(), POLL_BATCH_SIZE);

            if (dueJobs.length === 0) {
                return { processed: 0, errors: 0, locked: true };
            }

            logger.info('subscription-poll: processing due jobs', {
                count: dueJobs.length,
                dryRun
            });

            if (dryRun) {
                return { processed: dueJobs.length, errors: 0, locked: true };
            }

            let batchProcessed = 0;
            let batchErrors = 0;
            for (const job of dueJobs) {
                const result = await processOneJob(job, billing, paymentAdapter, logger);
                if (result.handled) {
                    batchProcessed += 1;
                    if (result.outcome?.terminal && result.outcome.status === 'succeeded') {
                        logger.info('subscription-poll: subscription transitioned to active', {
                            jobId: job.id,
                            subscriptionId: job.subscriptionId,
                            attempts: job.attempts + 1
                        });
                    }
                }
                if (result.error) {
                    batchErrors += 1;
                }
            }
            return { processed: batchProcessed, errors: batchErrors, locked: true };
        });

        processed = wrapped.processed;
        errors = wrapped.errors;

        // SPEC-262 S1: discount-aware amount reconciler runs after the main
        // polling batch (best-effort — never throws, errors go to Sentry).
        // This is the real safety net for the case where restoreFullPriceMutation
        // exhausted its 3 retries and left the preapproval at the discounted amount.
        // It also covers any other external drift (e.g. manual MP edits).
        // Skipped in dry-run mode (no real MP mutations in dry-run).
        if (!dryRun) {
            await reconcileActiveDiscountAmounts({ paymentAdapter, logger });
        }

        return {
            success: errors === 0,
            processed,
            errors,
            durationMs: durationFor(startedAt),
            message: wrapped.locked
                ? `processed_${processed}_with_${errors}_errors`
                : 'lock_not_acquired',
            details: {
                acquiredLock: wrapped.locked
            }
        };
    }
};
