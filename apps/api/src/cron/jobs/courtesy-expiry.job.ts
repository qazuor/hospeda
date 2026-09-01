/**
 * Courtesy Expiry Cron Job (HOS-180)
 *
 * Drives the two ends of a gifted courtesy window:
 *
 * 1. **Start** — when `courtesyStartsAt` passes, the gift the admin granted
 *    earlier actually begins. Nothing changes technically (the preapproval was
 *    paused at grant time), but the subscriber is told, because "we gave you
 *    something that starts later" and "it started" are different messages.
 * 2. **End** — when `courtesyEndsAt` passes, the MercadoPago preapproval is
 *    resumed, the window is cleared, and the subscriber returns to `active` at
 *    full price via the resulting webhook.
 *
 * ## This job is LOAD-BEARING, not a backstop
 *
 * The same warning `CLAUDE.md` carries for `trial-reconcile`. A courtesy is a
 * PAUSED preapproval: if this job stops running, nothing else resumes it. The
 * subscriber's gift silently becomes a permanent loss of service — they keep
 * their entitlements only until `deriveCourtesyStatus` stops matching the
 * elapsed window, and then they are simply paused, forever, with no signal
 * anywhere (spec R-1).
 *
 * `dryRun` is therefore honoured strictly: it reports the counts and touches
 * nothing. Data faults still surface in dry run — a row in status `courtesy`
 * with no readable window is wrong whether or not anyone is writing today.
 *
 * So it fails LOUDLY. A run that could not resume a preapproval reports
 * `success: false`, which is what puts it in `cron_runs` as a failure rather
 * than a green run that quietly did nothing — the exact pattern HOS-918
 * documents 77 instances of.
 *
 * @module cron/jobs/courtesy-expiry
 */

import { billingSubscriptionEvents, billingSubscriptions, eq, getDb } from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { BILLING_EVENT_TYPES, clearCourtesyFields, readCourtesyFields } from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { clearEntitlementCache } from '../../middlewares/entitlement.js';
import { hardCancelPreapprovalBestEffort } from '../../services/billing/preapproval-hard-cancel.js';
import {
    sendCourtesyEndedNotification,
    sendCourtesyStartedNotification
} from '../../services/courtesy-notifications.service.js';
import { apiLogger } from '../../utils/logger.js';
import type { CronJobDefinition } from '../types.js';

/** Marks in metadata that the "your gift started" notification already went out. */
const STARTED_NOTIFIED_KEY = 'courtesyStartedNotifiedAt';

/**
 * Runs one sweep over every subscription currently in a courtesy window.
 *
 * Deliberately a plain scan rather than an indexed range query: the courtesy
 * window lives in `metadata` jsonb while spec OQ-1 is open, so there is no
 * column to index. The candidate set is "subscriptions in status courtesy",
 * which is a handful at any realistic volume.
 *
 * @param args.now - Injected clock; the boundary every window is compared to.
 * @param args.dryRun - When `true`, counts what the sweep WOULD do and writes
 *   nothing at all: no resume, no hard cancel, no notification, no row update,
 *   no audit event, no cache eviction. Rehearsing any of those is not a
 *   rehearsal — a resumed preapproval starts charging, and a start
 *   notification stamped in dry run would silence the next real run.
 */
async function sweepCourtesyWindows(args: {
    readonly now: Date;
    readonly dryRun: boolean;
}): Promise<{
    started: number;
    ended: number;
    cancelled: number;
    errors: number;
    failures: string[];
}> {
    const { now, dryRun } = args;
    const db = getDb();
    const billing = getQZPayBilling();

    const rows = await db
        .select()
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.status, SubscriptionStatusEnum.COURTESY));

    let started = 0;
    let ended = 0;
    let cancelled = 0;
    let errors = 0;
    const failures: string[] = [];

    for (const row of rows) {
        const fields = readCourtesyFields(row.metadata);

        // A row in status `courtesy` with no readable window should not exist.
        // Leave it alone and shout: resuming it would end a gift that may still
        // be owed, and clearing it would erase the evidence.
        if (fields.courtesyEndsAt === null) {
            errors++;
            failures.push(`${row.id}: status is courtesy but no readable window`);
            apiLogger.error(
                { subscriptionId: row.id },
                'Courtesy expiry: subscription is in courtesy with no readable window'
            );
            continue;
        }

        // ── End of the gift ────────────────────────────────────────────────
        if (fields.courtesyEndsAt.getTime() <= now.getTime()) {
            if (!billing) {
                errors++;
                failures.push(`${row.id}: billing not configured, cannot resume`);
                continue;
            }

            // A dry run counts and stops here. Every statement below this
            // point is irreversible — a resumed or hard-cancelled preapproval
            // cannot be un-called, a mailed subscriber cannot be un-mailed, and
            // a cleared window cannot be recovered from the row.
            if (dryRun) {
                if (row.cancelAtPeriodEnd === true) {
                    cancelled++;
                }
                ended++;
                continue;
            }

            try {
                // A subscriber who cancelled mid-gift asked to stop paying. Do
                // NOT resume — that would restart billing on somebody who is
                // leaving — and settle the row as `cancelled`, which is both
                // legal (COURTESY → CANCELLED) and true: they asked to go, the
                // gift is over, and there is nothing left to come back to.
                //
                // Writing the status here is not optional bookkeeping. Clearing
                // the window while leaving the row `courtesy` would strand it:
                // `deriveCourtesyStatus` no longer matches, so the next webhook
                // would try COURTESY → PAUSED — an edge deliberately absent from
                // the transition table — and that write is discarded silently
                // with a 200. Exactly the HOS-913 failure mode.
                if (row.cancelAtPeriodEnd === true) {
                    // Cancel the preapproval for real before writing a terminal
                    // status. A local row that says `cancelled` while its
                    // MercadoPago preapproval still exists is HOS-751: nothing
                    // local explains the provider-side subscription any more, and
                    // `finalize-cancelled-subs` cannot recover it — its filter is
                    // status IN (active, past_due, trialing), which the terminal
                    // status just written excludes.
                    await hardCancelPreapprovalBestEffort({
                        subscriptionId: row.id,
                        mpSubscriptionId: row.mpSubscriptionId,
                        source: 'courtesy-expiry'
                    });

                    await db
                        .update(billingSubscriptions)
                        .set({
                            status: SubscriptionStatusEnum.CANCELLED,
                            metadata: clearCourtesyFields(row.metadata)
                        })
                        .where(eq(billingSubscriptions.id, row.id));
                    clearEntitlementCache(row.customerId);
                    cancelled++;
                    ended++;
                    continue;
                }

                await billing.subscriptions.resume(row.id);

                // Sent BEFORE the window is cleared, and before any charge can
                // land. Cleared first, the notification would read a blank
                // window and mail out an empty billing date; sent later, it
                // would arrive after the charge it exists to announce.
                await sendCourtesyEndedNotification({ subscriptionId: row.id }).catch((err) => {
                    apiLogger.warn(
                        { subscriptionId: row.id, error: String(err) },
                        'Courtesy ended notification failed'
                    );
                });

                // Clear the window in the same breath. A lingering window would
                // make the NEXT unrelated pause on this subscription derive as a
                // courtesy and hand out free entitlements.
                await db
                    .update(billingSubscriptions)
                    .set({
                        status: SubscriptionStatusEnum.ACTIVE,
                        metadata: clearCourtesyFields(row.metadata)
                    })
                    .where(eq(billingSubscriptions.id, row.id));

                await db.insert(billingSubscriptionEvents).values({
                    subscriptionId: row.id,
                    eventType: BILLING_EVENT_TYPES.COURTESY_WINDOW_ENDED,
                    newStatus: SubscriptionStatusEnum.ACTIVE,
                    triggerSource: 'courtesy-expiry-cron',
                    metadata: {
                        courtesyEndsAt: fields.courtesyEndsAt.toISOString(),
                        cyclesGranted: fields.courtesyCyclesGranted
                    }
                });

                clearEntitlementCache(row.customerId);

                ended++;
            } catch (error) {
                errors++;
                const message = error instanceof Error ? error.message : String(error);
                failures.push(`${row.id}: ${message}`);
                Sentry.captureException(error, {
                    tags: { cronJob: 'courtesy-expiry', phase: 'resume' }
                });
                apiLogger.error(
                    { subscriptionId: row.id, error: message },
                    'Courtesy expiry: failed to resume preapproval — subscriber remains paused'
                );
            }
            continue;
        }

        // ── Start of the gift ──────────────────────────────────────────────
        const alreadyNotified =
            row.metadata && typeof row.metadata === 'object'
                ? (row.metadata as Record<string, unknown>)[STARTED_NOTIFIED_KEY]
                : undefined;

        if (
            !alreadyNotified &&
            fields.courtesyStartsAt !== null &&
            fields.courtesyStartsAt.getTime() <= now.getTime()
        ) {
            if (dryRun) {
                started++;
                continue;
            }

            try {
                await sendCourtesyStartedNotification({ subscriptionId: row.id });
                // Stamped so a second sweep over the same boundary sends nothing
                // further (AC-13).
                await db
                    .update(billingSubscriptions)
                    .set({
                        metadata: {
                            ...((row.metadata as Record<string, unknown>) ?? {}),
                            [STARTED_NOTIFIED_KEY]: now.toISOString()
                        }
                    })
                    .where(eq(billingSubscriptions.id, row.id));
                started++;
            } catch (error) {
                errors++;
                const message = error instanceof Error ? error.message : String(error);
                failures.push(`${row.id}: start notification — ${message}`);
                apiLogger.warn(
                    { subscriptionId: row.id, error: message },
                    'Courtesy expiry: start notification failed'
                );
            }
        }
    }

    return { started, ended, cancelled, errors, failures };
}

/**
 * Courtesy expiry cron job.
 *
 * Runs hourly rather than daily: the cron-lag grace in `isSubscriptionLive` is
 * six hours, so a daily cadence could leave a subscriber past their window and
 * past the grace before anything resumed them.
 */
export const courtesyExpiryJob: CronJobDefinition = {
    name: 'courtesy-expiry',
    description:
        'Resume the MercadoPago preapproval of subscriptions whose gifted courtesy window has ended, and notify subscribers when a gift starts and when it ends (HOS-180).',
    schedule: '0 * * * *',
    enabled: true,
    timeoutMs: 120_000,
    handler: async ({ logger, dryRun }) => {
        const startedAt = new Date();

        logger.info('Starting courtesy expiry sweep', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        try {
            const { started, ended, cancelled, errors, failures } = await sweepCourtesyWindows({
                now: startedAt,
                dryRun
            });
            const durationMs = Date.now() - startedAt.getTime();

            // Fails loudly on purpose (R-1). A subscription that could not be
            // resumed is a subscriber stuck paused in MercadoPago with no other
            // mechanism to rescue them, so this must never report a green run.
            if (errors > 0) {
                logger.error('Courtesy expiry completed with failures', {
                    dryRun,
                    started,
                    ended,
                    errors,
                    failures
                });
                return {
                    success: false,
                    message: `Courtesy expiry${dryRun ? ' (dry run)' : ''}: ${ended} ended, ${started} started, ${errors} FAILED`,
                    processed: started + ended,
                    errors,
                    durationMs,
                    details: { dryRun, failures }
                };
            }

            if (dryRun) {
                logger.info('Courtesy expiry dry run completed', {
                    started,
                    ended,
                    cancelled,
                    durationMs
                });

                return {
                    success: true,
                    message: `Courtesy expiry (dry run): would end ${ended} window(s) (${cancelled} by cancellation), would start ${started}`,
                    processed: started + ended,
                    errors: 0,
                    durationMs,
                    details: {
                        dryRun: true,
                        wouldResume: ended - cancelled,
                        wouldHardCancel: cancelled,
                        wouldNotifyStart: started
                    }
                };
            }

            logger.info('Courtesy expiry completed', {
                started,
                ended,
                cancelled,
                durationMs
            });

            // The mirror of the dry-run report above. `success`, `processed`
            // and `errors` are identical in both modes, so `details` and the
            // message are the ONLY things that say whether this run actually
            // resumed anybody — which makes them load-bearing for `cron_runs`,
            // not decoration.
            return {
                success: true,
                message: `Courtesy expiry: ${ended} window(s) ended (${cancelled} by cancellation), ${started} started`,
                processed: started + ended,
                errors: 0,
                durationMs,
                details: {
                    dryRun: false,
                    resumed: ended - cancelled,
                    hardCancelled: cancelled,
                    notifiedStart: started
                }
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            Sentry.captureException(error, {
                tags: { cronJob: 'courtesy-expiry', phase: 'top-level' }
            });
            logger.error('Courtesy expiry job failed', { error: message });

            return {
                success: false,
                message: `Courtesy expiry failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startedAt.getTime(),
                details: { error: message }
            };
        }
    }
};
