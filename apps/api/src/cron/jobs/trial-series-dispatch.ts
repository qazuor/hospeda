/**
 * Dispatch of the nine-send trial email series (HOS-1012 T-016/T-017/T-018).
 *
 * Replaces `processTrialReminders`, which sent one template at two distances
 * derived from `billingSettings.trialExpiryReminderDays`. Three things changed
 * and each of them is a requirement, not a refactor:
 *
 * 1. **Nine sends, nine templates, nine dedup rows.** The old shape —
 *    a contiguous window `[N, N-1]` plus a fixed one-day block — cannot express
 *    three independent pre-expiry offsets, let alone six post-expiry ones.
 * 2. **The offsets are constants** (`TRIAL_SERIES_SENDS`), not an admin
 *    setting. Each email's copy names its own distance, so an admin able to
 *    move the distance is an admin able to make the copy lie.
 * 3. **Live state is re-read immediately before every dispatch.** The series
 *    stops the moment the person pays, and a cohort assembled minutes earlier
 *    is already a snapshot.
 *
 * @module cron/jobs/trial-series-dispatch
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { and, billingSubscriptionEvents, eq, getDb } from '@repo/db';
import type { NotificationType } from '@repo/notifications';
import { planDisplayNameFromPlan } from '../../services/billing/plan-change-reason.js';
import {
    TRIAL_SERIES_SENDS,
    type TrialSeriesSend
} from '../../services/billing/trial-notification-offsets.js';
import {
    customerIsPaying,
    findPostExpiryCohorts,
    findPreExpiryCohorts,
    type TrialSeriesCandidate
} from '../../services/billing/trial-series-cohort.js';
import { buildTrialUpgradeUrl } from '../../services/trial.service.js';
import { lookupCustomerDetails } from '../../utils/customer-lookup.js';
import { env } from '../../utils/env.js';
import { sendNotification } from '../../utils/notification-helper.js';
import type { CronJobContext } from '../types.js';

/** `trigger_source` recorded on the durable per-send dedup rows. */
const TRIAL_SERIES_TRIGGER_SOURCE = 'cron';

/**
 * Why one candidate did not receive its email.
 *
 * Every outcome is counted rather than silently dropped: a job that reports
 * only successes cannot tell "nobody was due" from "everything was skipped".
 */
export type TrialSeriesDispatchOutcome =
    /** The email was handed to the notification pipeline and the ledger written. */
    | 'sent'
    /** A ledger row for this exact send already exists. */
    | 'deduped'
    /** The customer is paying now — the series stops for them, permanently. */
    | 'converted'
    /** Customer lookup failed, so there is no address to send to. */
    | 'no-customer';

/** Per-run counters, one line per outcome plus errors. */
export interface TrialSeriesDispatchResult {
    readonly sent: number;
    readonly deduped: number;
    readonly converted: number;
    readonly noCustomer: number;
    readonly errors: number;
    /** How many candidates each offset selected, before any skipping. */
    readonly cohortSizes: Readonly<Record<number, number>>;
}

/**
 * Has this exact send already gone out for this subscription?
 *
 * Read on the AUTOCOMMIT connection, matching `sendTrialReminderDurable`'s
 * reasoning: the ledger row must persist the instant the email is dispatched,
 * so a later rollback of an unrelated phase of the job cannot strip it and
 * cause the whole batch to be re-sent tomorrow.
 */
async function alreadySent(subscriptionId: string, eventType: string): Promise<boolean> {
    const db = getDb();
    const existing = await db
        .select({ id: billingSubscriptionEvents.id })
        .from(billingSubscriptionEvents)
        .where(
            and(
                eq(billingSubscriptionEvents.subscriptionId, subscriptionId),
                eq(billingSubscriptionEvents.eventType, eventType)
            )
        )
        .limit(1);

    return existing.length > 0;
}

/**
 * Record that this send went out.
 *
 * `onConflictDoNothing` is an atomic backstop for the check-then-act above,
 * backed by the partial UNIQUE index on `(subscription_id, event_type)` for the
 * nine series event types (extras/038). Under advisory lock 1002 there is no
 * second writer today, but the ledger stays consistent if one is ever added.
 */
async function recordSent(input: {
    readonly subscriptionId: string;
    readonly send: TrialSeriesSend;
    readonly trialEnd: Date;
}): Promise<void> {
    const { subscriptionId, send, trialEnd } = input;
    const db = getDb();

    await db
        .insert(billingSubscriptionEvents)
        .values({
            subscriptionId,
            eventType: send.eventType,
            triggerSource: TRIAL_SERIES_TRIGGER_SOURCE,
            metadata: {
                offset: send.offset,
                direction: send.direction,
                notificationType: send.notificationType,
                trialEnd: trialEnd.toISOString(),
                sentAt: new Date().toISOString()
            }
        })
        .onConflictDoNothing();
}

/**
 * Dispatch one send to one candidate, or explain why it was not dispatched.
 *
 * The ORDER of the two guards is load-bearing and is the thing T-018's mutation
 * test pins: dedup first (cheap, local), then the live paying re-check
 * (a query, but the one that must be as late as possible). Hoisting the paying
 * check out of this function and up into the cohort loop would make it a
 * snapshot again, which is exactly the defect being fixed.
 */
async function dispatchOne(input: {
    readonly send: TrialSeriesSend;
    readonly candidate: TrialSeriesCandidate;
    readonly billing: QZPayBilling;
    readonly logger: CronJobContext['logger'];
}): Promise<TrialSeriesDispatchOutcome> {
    const { send, candidate, billing, logger } = input;

    if (await alreadySent(candidate.subscriptionId, send.eventType)) {
        return 'deduped';
    }

    // Re-read live state RIGHT HERE, never earlier. Between the cohort query
    // and this line the customer may have paid, and mailing "tu publicación
    // sale del sitio" to someone who bought a plan two minutes ago is the worst
    // thing this series can do.
    if (
        await customerIsPaying({
            customerId: candidate.customerId,
            excludeSubscriptionId: candidate.subscriptionId
        })
    ) {
        logger.debug('Trial series send skipped — customer is paying', {
            subscriptionId: candidate.subscriptionId,
            offset: send.offset
        });
        return 'converted';
    }

    const customer = await lookupCustomerDetails(billing, candidate.customerId);
    if (!customer) {
        logger.warn('Trial series send skipped — customer lookup failed', {
            subscriptionId: candidate.subscriptionId,
            customerId: candidate.customerId,
            offset: send.offset
        });
        return 'no-customer';
    }

    let planName = candidate.planId;
    try {
        const plan = await billing.plans.get(candidate.planId);
        if (plan) {
            planName = planDisplayNameFromPlan(plan);
        }
    } catch (planError) {
        // A missing display name degrades the copy; it does not justify
        // withholding the email that says the listing is coming down.
        logger.warn('Trial series send could not resolve the plan display name', {
            subscriptionId: candidate.subscriptionId,
            planId: candidate.planId,
            error: planError instanceof Error ? planError.message : String(planError)
        });
    }

    const upgradeUrl = buildTrialUpgradeUrl({
        siteUrl: env.HOSPEDA_SITE_URL,
        intendedInterval: candidate.intendedInterval
    });

    // Fire-and-forget, matching every other send in this job: delivery failures
    // are the notification-retry pipeline's problem, not the cron's.
    sendNotification({
        type: send.notificationType as TrialSeriesNotificationType,
        recipientEmail: customer.email,
        recipientName: customer.name,
        userId: customer.userId,
        customerId: candidate.customerId,
        planName,
        trialEndDate: candidate.trialEnd.toISOString(),
        upgradeUrl,
        idempotencyKey: `${send.eventType}-${candidate.subscriptionId}`
    }).catch((notifError) => {
        logger.debug('Trial series notification failed (will retry)', {
            subscriptionId: candidate.subscriptionId,
            offset: send.offset,
            error: notifError instanceof Error ? notifError.message : String(notifError)
        });
    });

    await recordSent({
        subscriptionId: candidate.subscriptionId,
        send,
        trialEnd: candidate.trialEnd
    });

    return 'sent';
}

/**
 * The nine types the series dispatches, narrowed from `NotificationType` so the
 * payload passed to `sendNotification` type-checks against `TrialSeriesPayload`
 * rather than the whole union.
 */
type TrialSeriesNotificationType =
    | NotificationType.TRIAL_ENDING_10D
    | NotificationType.TRIAL_ENDING_5D
    | NotificationType.TRIAL_ENDING_1D
    | NotificationType.TRIAL_EXPIRED
    | NotificationType.TRIAL_WIN_BACK_1D
    | NotificationType.TRIAL_WIN_BACK_5D
    | NotificationType.TRIAL_WIN_BACK_10D
    | NotificationType.TRIAL_WIN_BACK_30D
    | NotificationType.TRIAL_WIN_BACK_60D;

/**
 * Run the whole series for today: select both cohorts, then walk the nine sends
 * in the order the subscriber experiences them.
 *
 * `remindersEnabled` gates the eight REMINDER sends only. The expiry mail is
 * TRANSACTIONAL and goes out regardless: a host whose listing left the site has
 * to be told it left the site, and an admin preference about reminders is not
 * consent to withhold that. (The setting it comes from was, until HOS-1012,
 * logged and never read — an admin who turned reminders off still received
 * every one of them.)
 *
 * @param input.billing - QZPay instance, for customer and plan lookups.
 * @param input.dryRun - Count the cohorts and dispatch nothing.
 * @param input.remindersEnabled - Admin toggle for the eight reminder sends.
 * @param input.now - Clock override, for tests.
 * @param input.logger - Cron logger.
 */
export async function dispatchTrialSeries(input: {
    readonly billing: QZPayBilling;
    readonly dryRun: boolean;
    readonly logger: CronJobContext['logger'];
    readonly remindersEnabled: boolean;
    readonly now?: Date;
}): Promise<TrialSeriesDispatchResult> {
    const { billing, dryRun, logger, remindersEnabled } = input;
    const now = input.now ?? new Date();

    const activeSends = TRIAL_SERIES_SENDS.filter(
        (send) => remindersEnabled || send.direction === 'expiry'
    );

    if (!remindersEnabled) {
        logger.info('Trial series reminders are disabled; only the expiry mail will be sent');
    }

    const [preCohorts, postCohorts] = await Promise.all([
        findPreExpiryCohorts({ sends: activeSends, now }),
        findPostExpiryCohorts({ sends: activeSends, now })
    ]);

    const cohortSizes: Record<number, number> = {};
    for (const send of activeSends) {
        const cohort = send.direction === 'pre' ? preCohorts : postCohorts;
        cohortSizes[send.offset] = cohort.get(send.offset)?.length ?? 0;
    }

    logger.info('Trial series cohorts selected', { cohortSizes, dryRun });

    if (dryRun) {
        const total = Object.values(cohortSizes).reduce((sum, n) => sum + n, 0);
        logger.info('Dry run mode - would dispatch trial series emails', { total });
        return { sent: 0, deduped: 0, converted: 0, noCustomer: 0, errors: 0, cohortSizes };
    }

    let sent = 0;
    let deduped = 0;
    let converted = 0;
    let noCustomer = 0;
    let errors = 0;

    for (const send of activeSends) {
        const cohort = send.direction === 'pre' ? preCohorts : postCohorts;
        for (const candidate of cohort.get(send.offset) ?? []) {
            try {
                const outcome = await dispatchOne({ send, candidate, billing, logger });
                if (outcome === 'sent') sent++;
                else if (outcome === 'deduped') deduped++;
                else if (outcome === 'converted') converted++;
                else noCustomer++;
            } catch (error) {
                errors++;
                logger.error('Failed to dispatch a trial series email', {
                    subscriptionId: candidate.subscriptionId,
                    offset: send.offset,
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
    }

    return { sent, deduped, converted, noCustomer, errors, cohortSizes };
}
