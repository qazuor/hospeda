/**
 * Recurring add-on subscription reconciler (HOS-847 PR 7c).
 *
 * One job, two populations of `billing_addon_purchases` that no other sweep
 * looks at. Neither is a duplicate of `addon-expiry`: that job owns rows whose
 * benefit must END, this one owns rows whose CHECKOUT never finished, plus a
 * second pair of eyes on the one query that has no second pair.
 *
 * ## Population A — abandoned `'pending'` purchases (the reap)
 *
 * A recurring add-on checkout inserts a `'pending'` `billing_addon_purchases`
 * row plus its own `billing_subscriptions` row (`product_domain = 'addon'`) and
 * a live MercadoPago preapproval, then waits for the buyer to authorize. A buyer
 * who closes the tab leaves all three behind, and NOTHING sweeps them:
 *
 * - every add-on cron filters `status = 'active'`;
 * - the subscription sweeps (`abandoned-pending-subs`, `subscription-poll`,
 *   `preapproval-less-expiry`, `finalize-cancelled-subs`, `trial.service`) all
 *   call `excludeAddonDomainCondition()` and skip the add-on's row on purpose;
 * - no user or admin route accepts `'pending'` as an input state.
 *
 * `resolveRecurringAddonCheckoutIdempotency` closes such a row, but only when
 * the SAME buyer comes back for the SAME add-on. Its own JSDoc names this cron
 * as the owner of everyone who does not come back: *"PR 7's reconciler MUST
 * cover `'pending'`, not just `'active'`."*
 *
 * The reap is fail-closed at the provider, mirroring `abandoned-pending-subs`
 * (HOS-151 Bug B): MercadoPago is cancelled AND the cancellation VERIFIED via
 * `retrieve()` before the local row is closed. A local terminal state over a
 * live, chargeable preapproval is the HOS-751 failure mode this whole chain
 * exists to prevent — so an unverified cancel leaves the row `'pending'` for the
 * next run rather than closing it.
 *
 * Nobody is emailed. Nothing was ever charged, and the add-on domain is excluded
 * from `abandoned-pending-subs` precisely so an add-on abandonment does not send
 * the customer a "your subscription was cancelled" notice.
 *
 * ## Population B — stale soft-cancelled `'active'` rows (the alarm)
 *
 * `findExpiredAddons` already revokes an `active` row whose
 * `cancel_at_period_end` is set and whose `current_period_end` has elapsed
 * (HOS-847 PR 6), and `addon-expiry` runs it daily. This job does NOT revoke
 * those rows again — a second revoker would race the first one and rob the
 * customer of the `ADDON_EXPIRED` notice that job sends.
 *
 * What it does is watch. `findExpiredAddons`'s own `@remarks` state the problem:
 * *"this query is the ONLY thing that looks at that pair. If the cron stops
 * running, nothing else notices."* A row still `active` more than
 * {@link STALE_REVOCATION_GRACE_MS} past its paid period is a benefit nobody is
 * paying for AND evidence that the daily sweep is not working — two missed runs,
 * a permanently failing batch, or starvation behind `BATCH_SIZE`. That is
 * reported to Sentry, loudly, by a job that is not the one that failed.
 *
 * ## One Sentry event per fact
 *
 * Every alarm here reports through an explicit `Sentry.captureException` and
 * its `logger.error` carries NO `{ capture: true }`. The two are not additive:
 * `cron/bootstrap.ts` forwards a capturing `logger.error` to Sentry as well, so
 * doing both files two issues, with two fingerprints, for one occurrence. The
 * explicit call is the survivor because it carries tags and extra AND because
 * the admin manual-trigger context (`routes/cron-admin`) drops the options
 * argument entirely — a `{ capture: true }` reports nothing on that path.
 *
 * @module cron/jobs/addon-subscription-reconcile
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { QZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';
import { createMercadoPagoAdapter } from '@repo/billing';
import {
    and,
    billingAddonPurchases,
    billingSubscriptions,
    eq,
    getDb,
    isNull,
    lt,
    sql,
    withTransaction
} from '@repo/db';
import { ProductDomainEnum } from '@repo/schemas';
import * as Sentry from '@sentry/node';
import { qzpayLogger } from '../../lib/qzpay-logger.js';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { CONFIRMED_TERMINAL_STATUSES } from '../../services/billing/reactivation-supersession-complete.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Advisory lock key reserved for this job.
 *
 * Sibling billing crons hold 1001 (webhook-retry), 1002 (notification-schedule),
 * 1003 (dunning), 1004 (trial), 1006 (abandoned-pending-subs), 1007
 * (subscription-poll), 1008 (exchange-rate-fetch) and 43001 (addon-expiry).
 * 1005 is free but RETIRED (trial-pre-end-notif, HOS-121) and is deliberately
 * not reused.
 */
const ADVISORY_LOCK_KEY = 1009;

/**
 * How long a `'pending'` recurring add-on purchase is left alone before the
 * reaper closes it.
 *
 * MUST equal `RECURRING_ADDON_REUSE_WINDOW_MS` in
 * `services/addon.checkout.recurring-idempotency.ts`: that is the window
 * `decideRecurringAddonReuse` uses to decide a checkout is still the buyer's to
 * finish, and reaping any earlier would cancel a preapproval the reuse path
 * would still legitimately hand back — the buyer returning at minute 45 after a
 * 3DS detour would find their authorization dead. Deliberately NOT the
 * 30-minute `RECURRING_ADDON_CHECKOUT_TTL_MS` the checkout advertises, which
 * describes when the link should FEEL stale, not when we stop believing in it.
 *
 * Re-declared rather than imported, for the reason
 * `addon.checkout.recurring-resolve.ts` gives for re-declaring
 * `PENDING_PROVIDER_TTL_MS`: that module builds a `PlanService` at module scope,
 * so importing one integer from it (or from the idempotency module, which
 * imports it) would construct a service on every import of the cron registry.
 * The drift this trades for is closed by a test that imports the real constant
 * and asserts equality.
 */
const ABANDONED_PENDING_TTL_MS = 3 * 60 * 60 * 1000;

/**
 * Status a recurring add-on purchase waits in until its preapproval is
 * authorized. Mirrors `RECURRING_ADDON_PENDING_STATUS`; see
 * {@link ABANDONED_PENDING_TTL_MS} for why it is mirrored and not imported.
 */
const PENDING_STATUS = 'pending';

/**
 * Terminal status an abandoned checkout is closed into. Mirrors
 * `RECURRING_ADDON_CANCELED_STATUS`. `pending -> canceled` is a declared edge
 * of the add-on state machine (`addon-status-transitions.ts`).
 */
const CANCELED_STATUS = 'canceled';

/**
 * Status of a purchase whose benefit is live — the population the alarm half
 * watches, never writes.
 */
const ACTIVE_STATUS = 'active';

/**
 * How far past its paid period a soft-cancelled `'active'` row must be before
 * this job calls it drift rather than latency.
 *
 * `addon-expiry` runs once a day, so a row that just became due legitimately
 * waits up to 24h for its revocation. 48h is two missed daily runs: past that,
 * the delay is no longer the schedule.
 */
const STALE_REVOCATION_GRACE_MS = 48 * 60 * 60 * 1000;

/** A `'pending'` purchase row selected for reaping. */
export interface AbandonedPendingPurchase {
    readonly id: string;
    readonly customerId: string;
    readonly addonSlug: string;
    /** The add-on's OWN preapproval, never the customer's plan subscription. */
    readonly mpSubscriptionId: string | null;
}

/** A soft-cancelled `active` row that `addon-expiry` should already have ended. */
export interface StaleRevocation {
    readonly id: string;
    readonly customerId: string;
    readonly addonSlug: string;
    readonly currentPeriodEnd: Date | null;
}

/** Outcome of reaping a single abandoned `'pending'` purchase. */
export type ReapOutcome =
    | { readonly reaped: true }
    | {
          readonly reaped: false;
          readonly reason:
              | 'cancel-unverified'
              | 'orphan-preapproval'
              | 'already-closed'
              | 'closed-after-provider-cancel';
      };

type CronTransactionResult =
    | { readonly skipped: true }
    | {
          readonly skipped: false;
          readonly candidates: readonly AbandonedPendingPurchase[];
          readonly staleRevocations: readonly StaleRevocation[];
      };

/**
 * Cancel + verify one abandoned checkout's MercadoPago preapproval and, only
 * once the provider confirms a terminal state, close the local `'pending'` row.
 *
 * Best-effort per row: never throws, so one stuck buyer cannot abort the sweep.
 *
 * @param params.candidate - The row to reap.
 * @param params.billing - Resolved qzpay billing instance (cancels by LOCAL id).
 * @param params.paymentAdapter - MercadoPago adapter, used only to re-read the
 *   preapproval and confirm the cancel actually landed.
 * @param params.db - Drizzle client for the closing write.
 * @param params.logger - Cron logger.
 * @returns Whether the row was closed, and why not when it was not.
 *
 * @internal Exported via {@link _internals} for unit testing.
 */
async function reapAbandonedPendingPurchase(params: {
    readonly candidate: AbandonedPendingPurchase;
    readonly billing: QZPayBilling;
    readonly paymentAdapter: QZPayMercadoPagoAdapter;
    readonly db: ReturnType<typeof getDb>;
    readonly logger: Parameters<CronJobDefinition['handler']>[0]['logger'];
}): Promise<ReapOutcome> {
    const { candidate, billing, paymentAdapter, db, logger } = params;
    const mpSubscriptionId = candidate.mpSubscriptionId?.trim();
    /**
     * Set only once MercadoPago has CONFIRMED the preapproval is terminal, i.e.
     * once this run has actually killed the buyer's authorization. It changes
     * what a failed local close means — see the `!closed` branch below.
     */
    let providerCancelConfirmed = false;

    if (mpSubscriptionId) {
        // The add-on's own `billing_subscriptions` row is reachable only through
        // `mp_subscription_id`: `billing_addon_purchases.subscription_id` holds
        // the customer's PLAN subscription (four readers depend on that meaning
        // — see `insertPendingRecurringPurchase`).
        //
        // The `product_domain = 'addon'` filter is what makes the sentence
        // above true instead of merely intended. A purchase row that carries
        // the customer's PLAN preapproval in `mp_subscription_id` — a bug, or a
        // manual repair that copied the neighbouring `subscription_id` — would
        // otherwise resolve to the plan subscription the customer is paying
        // for, and this cron would cancel it. Matching the domain exactly is
        // fail-CLOSED (`subscriptionMatchesDomain`'s rule for every domain but
        // accommodation): anything else falls into `orphan-preapproval`, which
        // pages a human and writes nothing.
        const [ownSubscription] = await db
            .select({ id: billingSubscriptions.id })
            .from(billingSubscriptions)
            .where(
                and(
                    eq(billingSubscriptions.mpSubscriptionId, mpSubscriptionId),
                    eq(billingSubscriptions.productDomain, ProductDomainEnum.ADDON),
                    isNull(billingSubscriptions.deletedAt)
                )
            )
            .limit(1);

        if (!ownSubscription) {
            // A preapproval id with no local subscription row behind it: qzpay
            // cancels BY LOCAL ID, so there is no safe way to close this from
            // here. Closing the purchase row anyway would leave a chargeable
            // preapproval with nothing local pointing at it — HOS-751 exactly.
            // Leave it and page a human.
            const orphanError = new Error(
                `addon-subscription-reconcile: purchase ${candidate.id} names preapproval ${mpSubscriptionId} but no billing_subscriptions row holds it — cannot cancel, refusing to close the purchase over a possibly-live preapproval`
            );
            logger.error(
                'addon-subscription-reconcile: orphan preapproval on a pending add-on purchase — needs manual reconciliation',
                {
                    purchaseId: candidate.id,
                    customerId: candidate.customerId,
                    addonSlug: candidate.addonSlug,
                    mpSubscriptionId
                }
            );
            // One event per fact: the `Sentry.captureException` below is the
            // only reporter. `logger.error(..., { capture: true })` would ALSO
            // reach Sentry through `cron/bootstrap.ts`'s capture forwarding,
            // filing a second issue with a different fingerprint for the same
            // occurrence — and the admin manual-trigger path
            // (`routes/cron-admin`) drops the options argument, so the explicit
            // call is the one that reports on BOTH paths. See the module note.
            Sentry.captureException(orphanError, {
                tags: { cronJob: 'addon-subscription-reconcile', phase: 'reap' },
                extra: {
                    purchaseId: candidate.id,
                    customerId: candidate.customerId,
                    addonSlug: candidate.addonSlug,
                    mpSubscriptionId
                }
            });
            return { reaped: false, reason: 'orphan-preapproval' };
        }

        // Cancel attempt — swallowed; the retrieve() below is the source of
        // truth, exactly as in `abandoned-pending-subs`.
        try {
            await billing.subscriptions.cancel(ownSubscription.id);
        } catch (cancelError) {
            logger.warn(
                'addon-subscription-reconcile: cancel of the add-on preapproval failed — verifying live provider status before deciding',
                {
                    purchaseId: candidate.id,
                    mpSubscriptionId,
                    error: cancelError instanceof Error ? cancelError.message : String(cancelError)
                }
            );
        }

        let liveStatus: string | undefined;
        try {
            const liveProviderSubscription =
                await paymentAdapter.subscriptions.retrieve(mpSubscriptionId);
            liveStatus = liveProviderSubscription?.status;
        } catch (retrieveError) {
            logger.warn(
                'addon-subscription-reconcile: failed to retrieve the add-on preapproval — cannot confirm cancellation, leaving the purchase pending',
                {
                    purchaseId: candidate.id,
                    mpSubscriptionId,
                    error:
                        retrieveError instanceof Error
                            ? retrieveError.message
                            : String(retrieveError)
                }
            );
            liveStatus = undefined;
        }

        if (liveStatus === undefined || !CONFIRMED_TERMINAL_STATUSES.has(liveStatus)) {
            const hardeningError = new Error(
                `addon-subscription-reconcile: add-on preapproval ${mpSubscriptionId} is still '${liveStatus ?? 'unresolved'}' after a cancel attempt — refusing to close a purchase whose preapproval may still charge`
            );
            logger.error(
                'addon-subscription-reconcile: preapproval cancel not confirmed — leaving the purchase pending for retry',
                {
                    purchaseId: candidate.id,
                    customerId: candidate.customerId,
                    mpSubscriptionId,
                    liveStatus: liveStatus ?? null
                }
            );
            Sentry.captureException(hardeningError, {
                tags: { cronJob: 'addon-subscription-reconcile', phase: 'reap' },
                extra: {
                    purchaseId: candidate.id,
                    customerId: candidate.customerId,
                    addonSlug: candidate.addonSlug,
                    mpSubscriptionId,
                    liveStatus: liveStatus ?? null
                }
            });
            return { reaped: false, reason: 'cancel-unverified' };
        }

        providerCancelConfirmed = true;
    }

    // Either there was never a preapproval (nothing live at MercadoPago, but the
    // row still shadows every later attempt) or MercadoPago has confirmed it is
    // terminal. Close the row. The WHERE re-asserts `pending` so a concurrent
    // supersede from a returning buyer makes this an idempotent no-op.
    const [closed] = await db
        .update(billingAddonPurchases)
        .set({
            status: CANCELED_STATUS,
            canceledAt: new Date(),
            updatedAt: new Date()
        })
        .where(
            and(
                eq(billingAddonPurchases.id, candidate.id),
                eq(billingAddonPurchases.status, PENDING_STATUS),
                isNull(billingAddonPurchases.deletedAt)
            )
        )
        .returning({ id: billingAddonPurchases.id });

    if (!closed) {
        if (!providerCancelConfirmed) {
            // Nothing was cancelled at the provider, so the row left `'pending'`
            // between phase 1 and here on its own: `supersedePendingPurchase`
            // ran for a buyer who came back. Benign, and the whole reason the
            // WHERE re-asserts `'pending'`.
            return { reaped: false, reason: 'already-closed' };
        }

        // This run KILLED the preapproval and then found the row no longer
        // `'pending'` — the buyer authorized in MercadoPago between phase 1's
        // SELECT and the cancel above, and the activation webhook (whose only
        // idempotency is that same `status = 'pending'` WHERE) won the race.
        // The purchase is now `'active'` over a DEAD preapproval: it will never
        // be charged, and no sweep reaches it — `findExpiredAddons` needs
        // either an `expires_at` (null on recurring add-ons) or
        // `cancel_at_period_end` (false here). A free benefit, forever, unless
        // a human is told.
        const raceError = new Error(
            `addon-subscription-reconcile: purchase ${candidate.id} left 'pending' AFTER its preapproval ${mpSubscriptionId} was cancelled — the buyer authorized mid-sweep and now holds a live add-on over a dead preapproval`
        );
        logger.error(
            'addon-subscription-reconcile: cancelled the preapproval of a purchase that was activated mid-sweep — needs manual reconciliation',
            {
                purchaseId: candidate.id,
                customerId: candidate.customerId,
                addonSlug: candidate.addonSlug,
                mpSubscriptionId: mpSubscriptionId ?? null
            }
        );
        Sentry.captureException(raceError, {
            tags: { cronJob: 'addon-subscription-reconcile', phase: 'reap' },
            extra: {
                purchaseId: candidate.id,
                customerId: candidate.customerId,
                addonSlug: candidate.addonSlug,
                mpSubscriptionId: mpSubscriptionId ?? null
            }
        });
        return { reaped: false, reason: 'closed-after-provider-cancel' };
    }

    logger.info('addon-subscription-reconcile: closed an abandoned recurring add-on checkout', {
        purchaseId: candidate.id,
        customerId: candidate.customerId,
        addonSlug: candidate.addonSlug,
        mpSubscriptionId: mpSubscriptionId ?? null
    });

    return { reaped: true };
}

/**
 * Report soft-cancelled rows that `addon-expiry` should already have ended.
 *
 * Reports only — see the module docblock for why this job must not revoke them
 * itself.
 *
 * @internal Exported via {@link _internals} for unit testing.
 */
function reportStaleRevocations(params: {
    readonly staleRevocations: readonly StaleRevocation[];
    readonly logger: Parameters<CronJobDefinition['handler']>[0]['logger'];
}): void {
    const { staleRevocations, logger } = params;
    if (staleRevocations.length === 0) {
        return;
    }

    const driftError = new Error(
        `addon-subscription-reconcile: ${staleRevocations.length} soft-cancelled add-on purchase(s) are still 'active' more than ${STALE_REVOCATION_GRACE_MS / (60 * 60 * 1000)}h past current_period_end — findExpiredAddons (addon-expiry, daily) is the only thing that ends them and it has not`
    );
    logger.error(
        'addon-subscription-reconcile: soft-cancelled add-ons past their paid period were not revoked by addon-expiry',
        {
            count: staleRevocations.length,
            purchaseIds: staleRevocations.map((row) => row.id)
        }
    );
    Sentry.captureException(driftError, {
        tags: { cronJob: 'addon-subscription-reconcile', phase: 'stale-revocation-detection' },
        extra: {
            count: staleRevocations.length,
            purchases: staleRevocations.map((row) => ({
                purchaseId: row.id,
                customerId: row.customerId,
                addonSlug: row.addonSlug,
                currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null
            }))
        }
    });
}

/**
 * Recurring add-on subscription reconciler cron job.
 */
export const addonSubscriptionReconcileJob: CronJobDefinition = {
    name: 'addon-subscription-reconcile',
    description:
        "Reaps abandoned 'pending' recurring add-on checkouts (cancelling and verifying their MercadoPago preapproval first) and reports soft-cancelled add-ons that addon-expiry left active past their paid period.",
    schedule: '45 */6 * * *',
    enabled: true,
    timeoutMs: 2 * 60 * 1000,

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting addon-subscription-reconcile job', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        try {
            // Phase 1: claim the batch under the advisory lock. SELECTs only —
            // every MercadoPago call happens after this transaction commits
            // (ADR-019), so no provider latency is served while holding a lock.
            const cronResult = await withTransaction<CronTransactionResult>(async (tx) => {
                const lockResult = await tx.execute(
                    sql`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}) AS acquired`
                );
                if (!lockResult.rows[0]?.acquired) {
                    return { skipped: true };
                }

                const now = Date.now();

                const candidates = await tx
                    .select({
                        id: billingAddonPurchases.id,
                        customerId: billingAddonPurchases.customerId,
                        addonSlug: billingAddonPurchases.addonSlug,
                        mpSubscriptionId: billingAddonPurchases.mpSubscriptionId
                    })
                    .from(billingAddonPurchases)
                    .where(
                        and(
                            eq(billingAddonPurchases.status, PENDING_STATUS),
                            lt(
                                billingAddonPurchases.createdAt,
                                new Date(now - ABANDONED_PENDING_TTL_MS)
                            ),
                            isNull(billingAddonPurchases.deletedAt)
                        )
                    );

                const staleRevocations = await tx
                    .select({
                        id: billingAddonPurchases.id,
                        customerId: billingAddonPurchases.customerId,
                        addonSlug: billingAddonPurchases.addonSlug,
                        currentPeriodEnd: billingAddonPurchases.currentPeriodEnd
                    })
                    .from(billingAddonPurchases)
                    .where(
                        and(
                            eq(billingAddonPurchases.status, ACTIVE_STATUS),
                            eq(billingAddonPurchases.cancelAtPeriodEnd, true),
                            lt(
                                billingAddonPurchases.currentPeriodEnd,
                                new Date(now - STALE_REVOCATION_GRACE_MS)
                            ),
                            isNull(billingAddonPurchases.deletedAt)
                        )
                    );

                return { skipped: false, candidates, staleRevocations };
            });

            if (cronResult.skipped) {
                logger.info('addon-subscription-reconcile skipped: another replica holds the lock');
                return {
                    success: true,
                    message: 'Skipped - another replica is running',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime()
                };
            }

            // The alarm half never writes, so it runs in dry-run too: a dry run
            // that stayed silent about real drift would be a dry run that lied.
            reportStaleRevocations({ staleRevocations: cronResult.staleRevocations, logger });

            const staleRevocationsDetected = cronResult.staleRevocations.length;

            if (dryRun) {
                const durationMs = Date.now() - startedAt.getTime();
                logger.info('addon-subscription-reconcile completed (dry run)', {
                    wouldReap: cronResult.candidates.length,
                    staleRevocationsDetected,
                    durationMs
                });
                return {
                    success: true,
                    message: `Dry run - would close ${cronResult.candidates.length} abandoned add-on checkout(s)`,
                    processed: cronResult.candidates.length,
                    errors: 0,
                    durationMs,
                    details: {
                        dryRun: true,
                        reaped: cronResult.candidates.length,
                        staleRevocationsDetected
                    }
                };
            }

            if (cronResult.candidates.length === 0) {
                const durationMs = Date.now() - startedAt.getTime();
                logger.info('addon-subscription-reconcile completed', {
                    reaped: 0,
                    staleRevocationsDetected,
                    durationMs
                });
                return {
                    success: true,
                    message: 'Closed 0 abandoned add-on checkout(s)',
                    processed: 0,
                    errors: 0,
                    durationMs,
                    details: { dryRun, reaped: 0, staleRevocationsDetected }
                };
            }

            // Phase 2 (post-commit): cancel + verify + close, per row. Without
            // BOTH the billing client and the MP adapter a preapproval cannot be
            // cancelled, so nothing may be closed — leave the rows for next run
            // rather than orphaning a live charge.
            const billing = getQZPayBilling();
            if (!billing) {
                logger.warn(
                    'addon-subscription-reconcile: billing not configured — cannot cancel preapprovals, leaving candidates pending',
                    { candidates: cronResult.candidates.length }
                );
                return {
                    success: true,
                    message: 'Skipped - billing not configured',
                    processed: 0,
                    errors: 0,
                    durationMs: Date.now() - startedAt.getTime(),
                    details: {
                        dryRun,
                        reaped: 0,
                        pending: cronResult.candidates.length,
                        staleRevocationsDetected
                    }
                };
            }

            let paymentAdapter: QZPayMercadoPagoAdapter;
            try {
                paymentAdapter = createMercadoPagoAdapter({ logger: qzpayLogger });
            } catch (adapterError) {
                logger.warn(
                    'addon-subscription-reconcile: failed to construct MercadoPago adapter — leaving candidates pending',
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
                    details: {
                        dryRun,
                        reaped: 0,
                        pending: cronResult.candidates.length,
                        staleRevocationsDetected
                    }
                };
            }

            const db = getDb();
            let reaped = 0;
            let cancelUnverified = 0;
            let orphanPreapproval = 0;
            let alreadyClosed = 0;
            let closedAfterProviderCancel = 0;

            for (const candidate of cronResult.candidates) {
                const outcome = await reapAbandonedPendingPurchase({
                    candidate,
                    billing,
                    paymentAdapter,
                    db,
                    logger
                });
                if (outcome.reaped) {
                    reaped++;
                } else if (outcome.reason === 'cancel-unverified') {
                    cancelUnverified++;
                } else if (outcome.reason === 'orphan-preapproval') {
                    orphanPreapproval++;
                } else if (outcome.reason === 'closed-after-provider-cancel') {
                    closedAfterProviderCancel++;
                } else {
                    alreadyClosed++;
                }
            }

            const durationMs = Date.now() - startedAt.getTime();

            logger.info('addon-subscription-reconcile completed', {
                reaped,
                cancelUnverified,
                orphanPreapproval,
                alreadyClosed,
                closedAfterProviderCancel,
                staleRevocationsDetected,
                durationMs,
                dryRun
            });

            return {
                success: true,
                message: `Closed ${reaped} abandoned add-on checkout(s)${
                    cancelUnverified > 0
                        ? ` (${cancelUnverified} left pending — preapproval cancel unconfirmed)`
                        : ''
                }${
                    orphanPreapproval > 0
                        ? ` (${orphanPreapproval} left pending — orphan preapproval, needs manual reconciliation)`
                        : ''
                }${
                    closedAfterProviderCancel > 0
                        ? ` (${closedAfterProviderCancel} activated mid-sweep over a now-dead preapproval, needs manual reconciliation)`
                        : ''
                }${
                    staleRevocationsDetected > 0
                        ? ` (${staleRevocationsDetected} soft-cancelled add-on(s) overdue for revocation by addon-expiry)`
                        : ''
                }`,
                processed: reaped,
                // A transient, self-healing failure counts as an error.
                // `orphan-preapproval` does NOT: that row is re-selected on
                // every run until a human resolves it, so folding it in would
                // pin the count non-zero forever and drown the transient signal
                // — the same split `abandoned-pending-subs` makes for
                // `reconcile_assisted`. It gets its own counter and its own
                // Sentry issue instead, as does `closed-after-provider-cancel`:
                // neither is retried by the next run, so neither is transient.
                errors: cancelUnverified,
                durationMs,
                details: {
                    dryRun,
                    reaped,
                    cancelUnverified,
                    orphanPreapproval,
                    alreadyClosed,
                    closedAfterProviderCancel,
                    staleRevocationsDetected
                }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const durationMs = Date.now() - startedAt.getTime();

            logger.error(
                'addon-subscription-reconcile job failed',
                {
                    error: errorMessage,
                    stack: error instanceof Error ? error.stack : undefined
                },
                { capture: true }
            );

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
 * Exported helpers for unit testing the constants and the per-row primitives
 * without spinning up a real DB.
 */
export const _internals = {
    ADVISORY_LOCK_KEY,
    ABANDONED_PENDING_TTL_MS,
    STALE_REVOCATION_GRACE_MS,
    PENDING_STATUS,
    CANCELED_STATUS,
    ACTIVE_STATUS,
    reapAbandonedPendingPurchase,
    reportStaleRevocations
};
