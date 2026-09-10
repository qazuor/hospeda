/**
 * Subscription drift reconciler (HOS-914).
 *
 * The backstop for a webhook that never arrived. Every other billing sweep is
 * keyed on a LOCAL trigger — an enqueued polling job, an elapsed `trial_end`, a
 * `cancel_at_period_end` flag, a missing preapproval id — so a subscription that
 * simply diverges from MercadoPago, with none of those markers set, is invisible
 * to all of them and stays divergent forever.
 *
 * Measured, not assumed (HOS-913): subscription
 * `10a6dcb5-2426-47a6-ac27-252c96bff3b4` sat `paused` locally against
 * `authorized` at MercadoPago for more than three hours while `subscription-poll`
 * logged `[cron] completed` every single minute. It never touched the row,
 * because it only ever reads rows `start-paid` explicitly enqueued.
 *
 * ## What this job does NOT duplicate
 *
 * The population is carved so that exactly one sweep owns each row:
 *
 * - `subscription-poll` owns `pending_provider`/`incomplete` rows that hold an
 *   enqueued polling job (checkout → activation). Excluded here by status.
 * - `abandoned-pending-subs` owns the same statuses past their 30-minute TTL.
 *   Excluded here by status.
 * - `trial-reconcile` owns trials whose window has ELAPSED. Excluded here by
 *   requiring `trial_end` to still be in the future, so a live trial (which
 *   that cron never selects) is covered and an elapsed one is not touched twice.
 * - `finalize-cancelled-subs` owns `cancel_at_period_end = true` rows for the
 *   whole soft-cancel grace. Excluded here by that flag.
 * - `preapproval-less-expiry` owns rows with NO preapproval. This job is its
 *   exact complement: it requires one.
 * - `courtesy-expiry` owns `courtesy`. Excluded here, and NOT merely to avoid
 *   overlap: a courtesy is backed by a deliberately PAUSED preapproval, so once
 *   its window elapses MercadoPago still reports `paused` and
 *   `deriveCourtesyStatus` stops rewriting it — this sweep would flip the row to
 *   `paused` and cut a gifted subscriber's entitlements hours before
 *   `courtesy-expiry` resumes the preapproval. Excluding it is the correctness
 *   requirement, not the tidiness one.
 * - `comp` never has a preapproval (SPEC-262), so it cannot match the
 *   `mp_subscription_id IS NOT NULL` filter. It is also absent from the status
 *   allowlist, so the exclusion does not depend on that filter holding.
 * - `addon` product-domain rows are owned by `addon-subscription-reconcile`
 *   (`excludeAddonDomainCondition()`).
 *
 * ## Absence is never a verdict
 *
 * "MercadoPago says this subscription is dead" and "MercadoPago has never heard
 * of this subscription" are different facts and this job treats them as such.
 * The only code that writes a status here is
 * {@link processSubscriptionUpdated}, and it is reached ONLY after
 * `preapprovalApi.get()` returned a preapproval. A read that fails — 404,
 * outage, rate limit, expired token — throws before any write, is classified by
 * {@link classifyProviderReadFailure}, and is REPORTED, never acted on. A row
 * MercadoPago cannot resolve is surfaced for a human (it fails the tick and
 * names the ids) instead of being cancelled.
 *
 * That distinction is load-bearing and about to become more so: a partner who
 * paid in CASH has no MercadoPago counterpart at all (HOS-1062 is building that
 * population). Such rows carry `mp_subscription_id = NULL` and are therefore not
 * even candidates — the guarantee rests on the SQL filter first and on the
 * never-write-on-a-failed-read rule second, so both would have to break at once.
 *
 * ## All five verticals, and the dual-owner case
 *
 * The candidate query filters on product domain only to EXCLUDE `addon`. An
 * accommodation, gastronomy, experience, tourist or partner subscription is
 * selected on identical terms, and rows are selected BY ROW, never resolved from
 * a customer — so an account that is both a host and a partner has both of its
 * subscriptions reconciled independently, with no `.find()` picking one of them.
 *
 * ## Why this file calls neither reconciler bridge
 *
 * It moves subscription statuses but contains no
 * `reconcileSubscriptionLinkedEntities` / `reconcilePartnerForSubscription`
 * call, which would normally be the HOS-1280/HOS-1306 defect. It delegates every
 * write to `processSubscriptionUpdated`, which is itself a pinned call site for
 * BOTH bridges (see `test/services/subscription-linked-entities-bridge.guard.test.ts`).
 * Calling them again here would double-fire them for every corrected row.
 *
 * @module cron/jobs/subscription-drift-reconcile
 */

import type { QZPayWebhookEvent } from '@qazuor/qzpay-core';
import type { QZPayMercadoPagoAdapter } from '@qazuor/qzpay-mercadopago';
import { createMercadoPagoAdapter } from '@repo/billing';
import {
    and,
    billingSubscriptions,
    eq,
    inArray,
    isNotNull,
    isNull,
    sql,
    withTransaction
} from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { excludeAddonDomainCondition } from '@repo/service-core';
import * as Sentry from '@sentry/node';
import { asc, gt, lt, ne, or } from 'drizzle-orm';
import { qzpayLogger } from '../../lib/qzpay-logger.js';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { processSubscriptionUpdated } from '../../routes/webhooks/mercadopago/subscription-logic.js';
import { MP_CALL_SPACING_MS } from '../../services/billing/preapproval-recovery.service.js';
import type { CronJobDefinition, CronJobResult } from '../types.js';

/**
 * Advisory lock key. Siblings: 1003 dunning, 1004 trial-reconcile, 1006
 * abandoned-pending-subs, 1007 subscription-poll, 1008 exchange-rate-fetch,
 * 1009 addon-subscription-reconcile. (1005 is free — trial-pre-end-notif was
 * retired in HOS-121.)
 */
const ADVISORY_LOCK_KEY = 1010;

/**
 * How long a row must have sat untouched before this sweep will re-read it at
 * MercadoPago.
 *
 * This is a LATENCY tolerance, not a grace period — deliberately a local
 * constant rather than a reuse of `BILLING_CRON_LAG_GRACE_HOURS`. The repo has
 * exactly three grace mechanisms (see
 * `docs/billing/grace-period-source-of-truth.md`) and each answers "how long do
 * we let a customer keep access". This answers a different question: "how long
 * before a webhook that has not arrived is presumed lost". Reusing the 6-hour
 * constant would create a fourth meaning for it and would leave a real
 * divergence uncorrected for a whole working day.
 *
 * Fifteen minutes is far beyond MercadoPago's observed webhook latency (seconds)
 * and far beyond a deploy window, so a correction fired at this age is a
 * correction of a genuinely lost event rather than a race with a live one.
 */
export const DRIFT_TOLERANCE_MINUTES = 15;

/** Candidates examined per tick; bounds the MercadoPago call budget. */
const BATCH_LIMIT = 50;

/** Statuses this sweep owns. Every exclusion is argued in the module doc. */
const DRIFTABLE_STATUSES = [
    SubscriptionStatusEnum.ACTIVE,
    SubscriptionStatusEnum.PAUSED,
    SubscriptionStatusEnum.PAST_DUE,
    SubscriptionStatusEnum.TRIALING
] as const;

const MINUTE_MS = 60 * 1000;

/** The shape this job needs off a subscription row. */
export interface DriftCandidateRow {
    readonly id: string;
    readonly customerId: string | null;
    readonly status: string;
    readonly mpSubscriptionId: string | null;
    readonly trialEnd: Date | null;
    readonly cancelAtPeriodEnd: boolean | null;
    readonly updatedAt: Date | null;
}

/**
 * Decides whether a row is one this sweep may re-read at MercadoPago.
 *
 * Pure and total, so the population can be pinned without a database. The SQL
 * filter in the handler is an optimisation; THIS is the specification, and a
 * loosened query cannot silently widen what gets touched.
 *
 * @param input - The row, the reference instant, and the latency tolerance.
 * @returns `true` when the row should be compared against the provider.
 *
 * @example
 * ```ts
 * isDriftReconcileCandidate({
 *   row: { id: 's1', customerId: 'c1', status: 'paused',
 *          mpSubscriptionId: 'preapproval-abc', trialEnd: null,
 *          cancelAtPeriodEnd: false, updatedAt: new Date('2026-08-15T10:00:00Z') },
 *   now: new Date('2026-08-15T12:00:00Z'),
 *   toleranceMinutes: 15,
 * }); // => true
 * ```
 */
export function isDriftReconcileCandidate(input: {
    readonly row: DriftCandidateRow;
    readonly now: Date;
    readonly toleranceMinutes: number;
}): boolean {
    const { row, now, toleranceMinutes } = input;

    // No preapproval means there is nothing to compare against, and — the part
    // that matters — a cash-paid partner (HOS-1062) looks exactly like this. A
    // blank string counts as absent here rather than as a usable id: asking
    // MercadoPago about `''` yields an error, and an error must never be able to
    // reach a row that was never a candidate.
    if (row.mpSubscriptionId === null || row.mpSubscriptionId.trim() === '') {
        return false;
    }
    if (!(DRIFTABLE_STATUSES as readonly string[]).includes(row.status)) {
        return false;
    }
    // A pending soft-cancel is owned by finalize-cancelled-subs for its whole
    // grace window.
    if (row.cancelAtPeriodEnd === true) {
        return false;
    }
    // An ELAPSED trial belongs to trial-reconcile, which converts it against the
    // provider and writes its own TRIAL_RECONCILED audit row. A trialing row
    // with no `trial_end` at all is a legacy shape that neither cron converts by
    // design (HOS-211) — it is excluded here rather than silently healed.
    if (row.status === SubscriptionStatusEnum.TRIALING) {
        if (row.trialEnd === null || row.trialEnd.getTime() <= now.getTime()) {
            return false;
        }
    }
    // Never fight a webhook that may still be in flight.
    if (row.updatedAt === null) {
        return false;
    }
    return row.updatedAt.getTime() + toleranceMinutes * MINUTE_MS < now.getTime();
}

/**
 * How a failed provider read is reported. Neither value ever produces a write.
 *
 * - `unknown_at_provider` — MercadoPago could not resolve the preapproval at
 *   all. This is the case that must NEVER be read as "cancel it": the row may
 *   belong to a payer whose id we hold wrongly, or to a flow that never reached
 *   the provider. It is escalated for a human.
 * - `transient` — network, 5xx, rate limit, bad token. Retried next tick.
 */
export type ProviderReadFailure = 'unknown_at_provider' | 'transient';

/**
 * Classify why a provider read failed.
 *
 * Deliberately defensive rather than trusting one signal. `@qazuor/qzpay-mercadopago`
 * maps a MercadoPago error to `QZPayErrorCode.RESOURCE_NOT_FOUND` only when the
 * SDK surfaces a `cause` array whose first entry has `code === '404'`; a plain
 * HTTP 404 arrives with just a `status`/`message` and falls through to the
 * generic `provider_error` branch. Reading only the mapped code would therefore
 * classify most real "unknown at provider" reads as transient and retry them
 * silently forever. All three signals are checked.
 *
 * @param error - Whatever the adapter threw.
 * @returns Which of the two failure kinds this is.
 */
export function classifyProviderReadFailure(error: unknown): ProviderReadFailure {
    if (typeof error !== 'object' || error === null) {
        return 'transient';
    }
    const candidate = error as {
        code?: unknown;
        status?: unknown;
        message?: unknown;
        originalError?: { status?: unknown };
    };

    if (candidate.code === 'resource_not_found') {
        return 'unknown_at_provider';
    }
    if (candidate.status === 404 || candidate.originalError?.status === 404) {
        return 'unknown_at_provider';
    }
    if (typeof candidate.message === 'string' && /not found/i.test(candidate.message)) {
        return 'unknown_at_provider';
    }
    return 'transient';
}

/** Counters a tick accumulates. */
interface SweepTotals {
    corrected: number;
    inSync: number;
    unknownAtProvider: number;
    errors: number;
}

/** Build the webhook-shaped event `processSubscriptionUpdated` consumes. */
function buildSyntheticEvent(row: DriftCandidateRow): QZPayWebhookEvent {
    return {
        id: `drift-${row.id}`,
        type: 'subscription_preapproval.updated',
        // Non-null by construction: `isDriftReconcileCandidate` rejects a null
        // or blank id before a row can reach here.
        data: { id: row.mpSubscriptionId as string },
        created: new Date()
    };
}

/** Sleep helper used to space consecutive MercadoPago reads. */
function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export const subscriptionDriftReconcileJob: CronJobDefinition = {
    name: 'subscription-drift-reconcile',
    description:
        'Re-reads every non-terminal subscription that holds a MercadoPago preapproval and re-applies the provider verdict through the webhook transition (HOS-914). A preapproval MercadoPago cannot resolve is reported, never cancelled.',
    schedule: '17 * * * *',
    enabled: true,
    timeoutMs: 120_000,

    handler: async (ctx): Promise<CronJobResult> => {
        const { logger, startedAt, dryRun } = ctx;
        const startMs = startedAt.getTime();
        const durationMs = () => Date.now() - startMs;

        const billing = getQZPayBilling();
        if (!billing) {
            logger.warn('subscription-drift-reconcile: billing not configured, skipping run');
            return {
                success: true,
                message: 'billing_not_configured',
                processed: 0,
                errors: 0,
                durationMs: durationMs()
            };
        }

        let paymentAdapter: QZPayMercadoPagoAdapter;
        try {
            paymentAdapter = createMercadoPagoAdapter({ logger: qzpayLogger });
        } catch (error) {
            logger.warn('subscription-drift-reconcile: MercadoPago adapter unavailable, skipping', {
                error: error instanceof Error ? error.message : String(error)
            });
            return {
                success: true,
                message: 'mp_adapter_unavailable',
                processed: 0,
                errors: 0,
                durationMs: durationMs()
            };
        }

        const cutoff = new Date(startMs - DRIFT_TOLERANCE_MINUTES * MINUTE_MS);

        // The advisory lock guards candidate selection only. The provider reads
        // below happen AFTER this transaction commits, so no MercadoPago call is
        // ever made with a DB transaction open (the R-2 rule
        // `abandoned-pending-subs` established). Double processing by a second
        // replica is harmless: `processSubscriptionUpdated` re-reads the row
        // under `SELECT … FOR UPDATE` and short-circuits when the status already
        // matches.
        const selection = await withTransaction(async (tx) => {
            const lockResult = await tx.execute(
                sql`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}) AS acquired`
            );
            const acquired = (lockResult.rows?.[0] as Record<string, unknown> | undefined)
                ?.acquired;
            if (!acquired) {
                return { locked: false, rows: [] as DriftCandidateRow[] };
            }

            const rows = await tx
                .select({
                    id: billingSubscriptions.id,
                    customerId: billingSubscriptions.customerId,
                    status: billingSubscriptions.status,
                    mpSubscriptionId: billingSubscriptions.mpSubscriptionId,
                    trialEnd: billingSubscriptions.trialEnd,
                    cancelAtPeriodEnd: billingSubscriptions.cancelAtPeriodEnd,
                    updatedAt: billingSubscriptions.updatedAt
                })
                .from(billingSubscriptions)
                .where(
                    and(
                        inArray(billingSubscriptions.status, [...DRIFTABLE_STATUSES]),
                        isNotNull(billingSubscriptions.mpSubscriptionId),
                        isNull(billingSubscriptions.deletedAt),
                        eq(billingSubscriptions.cancelAtPeriodEnd, false),
                        lt(billingSubscriptions.updatedAt, cutoff),
                        // An elapsed trial is trial-reconcile's; a NULL trial_end
                        // makes `gt` NULL, which excludes the legacy shape too.
                        or(
                            ne(billingSubscriptions.status, SubscriptionStatusEnum.TRIALING),
                            gt(billingSubscriptions.trialEnd, startedAt)
                        ),
                        excludeAddonDomainCondition()
                    )
                )
                // Oldest first, so a backlog drains fairly instead of the same
                // head of the table being re-read every tick.
                .orderBy(asc(billingSubscriptions.updatedAt))
                .limit(BATCH_LIMIT);

            return { locked: true, rows: rows as DriftCandidateRow[] };
        });

        if (!selection.locked) {
            logger.debug('subscription-drift-reconcile: previous run still holding the lock');
            return {
                success: true,
                message: 'lock_not_acquired',
                processed: 0,
                errors: 0,
                durationMs: durationMs(),
                details: { acquiredLock: false }
            };
        }

        // Re-apply the rule in code: the SQL is the optimisation, the predicate
        // is the specification.
        const candidates = selection.rows.filter((row) =>
            isDriftReconcileCandidate({
                row,
                now: startedAt,
                toleranceMinutes: DRIFT_TOLERANCE_MINUTES
            })
        );

        if (dryRun) {
            logger.info('subscription-drift-reconcile: dry run', {
                wouldExamine: candidates.length,
                ids: candidates.map((r) => r.id)
            });
            return {
                success: true,
                message: `Dry run — would compare ${candidates.length} subscription(s) against MercadoPago`,
                processed: candidates.length,
                errors: 0,
                durationMs: durationMs(),
                details: { dryRun: true, ids: candidates.map((r) => r.id) }
            };
        }

        const totals: SweepTotals = {
            corrected: 0,
            inSync: 0,
            unknownAtProvider: 0,
            errors: 0
        };
        const unknownIds: string[] = [];
        let first = true;

        for (const row of candidates) {
            // Measured spacing (HOS-937 R-5): an unspaced sweep of ~60
            // consecutive GETs drew a 429; 0.35s between calls drew none.
            if (!first) {
                await delay(MP_CALL_SPACING_MS);
            }
            first = false;

            try {
                const result = await processSubscriptionUpdated({
                    event: buildSyntheticEvent(row),
                    billing,
                    paymentAdapter,
                    providerEventId: `drift-${row.id}`,
                    source: 'drift-reconcile'
                });

                if (result.statusChanged) {
                    totals.corrected += 1;
                    logger.info('subscription-drift-reconcile: corrected a divergent row', {
                        subscriptionId: row.id,
                        customerId: row.customerId,
                        localStatus: row.status,
                        newStatus: result.newStatus
                    });
                } else {
                    totals.inSync += 1;
                }
            } catch (error) {
                const kind = classifyProviderReadFailure(error);
                const message = error instanceof Error ? error.message : String(error);

                if (kind === 'unknown_at_provider') {
                    totals.unknownAtProvider += 1;
                    unknownIds.push(row.id);
                    // Never a cancellation. A preapproval MercadoPago cannot
                    // resolve is an ANOMALY needing a human, not a verdict about
                    // the customer — treating it as one would cut service to
                    // someone who is paying.
                    logger.error(
                        'subscription-drift-reconcile: MercadoPago does not know this preapproval — NOT changing the subscription, escalating',
                        {
                            subscriptionId: row.id,
                            customerId: row.customerId,
                            localStatus: row.status,
                            error: message
                        },
                        { capture: true }
                    );
                    Sentry.captureException(
                        new Error(`Drift reconcile: preapproval unknown at provider: ${message}`),
                        {
                            extra: { subscriptionId: row.id, localStatus: row.status },
                            tags: {
                                module: 'subscription-drift-reconcile',
                                operation: 'unknownAtProvider'
                            }
                        }
                    );
                } else {
                    totals.errors += 1;
                    logger.warn(
                        'subscription-drift-reconcile: provider read failed, retrying next tick',
                        { subscriptionId: row.id, error: message }
                    );
                }
            }
        }

        // An unresolvable preapproval is NOT a successful tick. Reporting it as
        // one is how a divergence that needs a human becomes a green line in the
        // cron log that nobody reads.
        const success = totals.errors === 0 && totals.unknownAtProvider === 0;

        logger.info('subscription-drift-reconcile: tick complete', {
            candidates: candidates.length,
            ...totals,
            durationMs: durationMs()
        });

        return {
            success,
            message:
                `Compared ${candidates.length} subscription(s): ${totals.corrected} corrected, ` +
                `${totals.inSync} already in sync, ${totals.unknownAtProvider} unknown at ` +
                `MercadoPago (NOT cancelled), ${totals.errors} transient error(s)`,
            processed: candidates.length,
            errors: totals.errors + totals.unknownAtProvider,
            durationMs: durationMs(),
            details: {
                corrected: totals.corrected,
                inSync: totals.inSync,
                unknownAtProvider: totals.unknownAtProvider,
                unknownAtProviderIds: unknownIds,
                transientErrors: totals.errors
            }
        };
    }
};
