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
 * - `dunning` owns `past_due`, and for that population the provider carries NO
 *   information this job could act on. `MERCADOPAGO_SUBSCRIPTION_STATUS`
 *   (`@qazuor/qzpay-mercadopago`) has four values and maps `authorized → active`;
 *   there is no preapproval status meaning "the charge failed". While MercadoPago
 *   runs its native recycling the preapproval stays `authorized`, so MP's verdict
 *   for a row in arrears is "active" — and re-applying it would be a REVERSAL,
 *   not a repair. Concretely, HOS-348 Part B's card-replacement flow mints a new
 *   preapproval and cancels the old one only once the new one is confirmed, so a
 *   `past_due` row legitimately sits beside a live `authorized` preapproval; this
 *   sweep would read that, write ACTIVE, restore full entitlements for an unpaid
 *   customer and have `shouldSendReactivationEmail` congratulate them while their
 *   card is still failing. `past_due` is unreachable in the column today
 *   (`cron/jobs/dunning.job.ts` documents why, and `MERCADOPAGO_SUBSCRIPTION_STATUS`
 *   confirms it), but that same docblock names teaching the adapter to expose
 *   recycling as `past_due` as intended work — so this is a mine, not a
 *   hypothetical. It stays out of the allowlist rather than being guarded by a
 *   comment.
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
 * ## Fairness is a cursor, not an ORDER BY
 *
 * The batch is bounded, so something must guarantee every eligible row is eventually
 * reached. Sorting by `updated_at ASC` does NOT: an in-sync row is never written, so
 * its position never moves and the same page is re-read for ever. See
 * {@link cursorAfterId} for why the cursor rides on `id` and why it cannot ride on
 * `updated_at`, and for exactly what it survives.
 *
 * ## What this job reports, and what it refuses to call healthy
 *
 * `statusChanged: false` comes back from nine different situations in
 * `processSubscriptionUpdated` and only one of them means "they agree". A refused
 * transition, an unmappable stored status, a provider status we do not know — each is
 * a divergence that was NOT applied, and the last safety net in the system must not
 * file those as "already in sync". They are counted as `unresolved`, named with their
 * outcome, and held against `success`.
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
import { asc, gt, lt, ne, or } from 'drizzle-orm';
import { qzpayLogger } from '../../lib/qzpay-logger.js';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { isProviderReadFailure } from '../../routes/webhooks/mercadopago/provider-read-failure.js';
import {
    processSubscriptionUpdated,
    type SubscriptionUpdateOutcome
} from '../../routes/webhooks/mercadopago/subscription-logic.js';
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

/**
 * Where the next tick resumes, as the `id` of the last row the previous tick
 * SELECTED (not the last one it acted on). `null` means "start from the beginning
 * of the id space".
 *
 * ## Why a cursor exists at all
 *
 * Ordering by `updated_at ASC` and taking the oldest 50 does NOT drain a backlog,
 * because nothing advances a healthy row's position: when local and provider agree,
 * `processSubscriptionUpdated` writes nothing and `updated_at` does not move. So the
 * same 50 rows are selected every tick, for ever. With 60 eligible subscriptions the
 * 55th could diverge and never be looked at, while the tick reports
 * `0 corrected, 50 already in sync` and `success: true` — the divergence staying
 * exactly as invisible as it was before this job existed, and the job reporting
 * health while being blind. A non-convergible row (a ghost preapproval) is worse
 * still: it is a permanent resident of the batch, burning a slot and a provider call
 * every tick for ever.
 *
 * `id` rather than `updated_at`, and this is the crux: the two cannot be the same
 * column. `updated_at` is load-bearing for the LATENCY TOLERANCE — "has this row
 * been quiet long enough that a webhook must be presumed lost" — and that question
 * needs the real last-change time. Advancing a cursor by touching `updated_at` would
 * overwrite the very signal the cutoff reads, turning "15 minutes since the row
 * changed" into "15 minutes since we last looked at it" and quietly destroying the
 * guard against racing a live webhook. Two jobs, two timestamps; `id` is a third,
 * stable, totally-ordered, indexed (primary key) axis that belongs to neither.
 *
 * ## What this does and does not survive — stated, not hidden
 *
 * Module-level state, so it is per-process and resets on deploy or restart. A reset
 * costs one wrap of the id space, not correctness: every eligible row is still
 * reached within `ceil(population / BATCH_LIMIT)` ticks of any fresh start, and at
 * hourly ticks a daily deploy leaves ~23 of 24 ticks advancing. Replicas each keep
 * their own cursor, which covers different windows rather than colliding (and the
 * advisory lock means only one runs at a time anyway).
 *
 * Making fairness durable across restarts needs a persisted `last_drift_checked_at`
 * column — deliberately NOT done here: it is a schema change with migration-carril
 * and dual-write consequences, and it is flagged for the owner rather than decided
 * by this job. `cron_runs.details` was considered as a no-migration home and
 * rejected: `recordCronRun` is fire-and-forget and swallows its own errors, so a lost
 * write would silently reset the cursor — a silent failure inside the mechanism built
 * to remove one.
 */
let cursorAfterId: string | null = null;

/**
 * Statuses this sweep owns. Every exclusion is argued in the module doc.
 *
 * No stored-vocabulary alias accompanies this list, and that is not an
 * oversight. `billing_subscriptions.status` does hold two vocabularies (see
 * `services/admin-billing-view.status.ts`), but the only alias
 * `normalizeStoredSubscriptionStatus` has for any status in this job's reach was
 * `unpaid` → `past_due`, and `past_due` is no longer in the list. `incomplete`
 * normalizes to `pending_provider` (subscription-poll's), and
 * `incomplete_expired`/`canceled` are terminal. `active`, `paused` and
 * `trialing` have exactly one spelling each.
 */
const DRIFTABLE_STATUSES = [
    SubscriptionStatusEnum.ACTIVE,
    SubscriptionStatusEnum.PAUSED,
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
    readonly deletedAt: Date | null;
}

/**
 * Decides whether a row is one this sweep may re-read at MercadoPago.
 *
 * Pure and total, so the population can be pinned without a database. The SQL
 * filter in the handler is an optimisation; THIS is the specification, and every
 * condition of that filter is re-checked here — including `deleted_at`, which
 * until HOS-914's review was the one condition with no in-memory backstop, making
 * this paragraph false where it mattered most. A soft-deleted row that slipped
 * through reaches `processSubscriptionUpdated`, whose own lookup filters
 * `deletedAt` and therefore finds nothing, which sends it into
 * `linkPreapprovalToLocalSub` — a WRITE path that sets `mp_subscription_id`,
 * flips the row to `pending_provider`, and can resurrect an `abandoned` one.
 *
 * @param input - The row, the reference instant, and the latency tolerance.
 * @returns `true` when the row should be compared against the provider.
 *
 * @example
 * ```ts
 * isDriftReconcileCandidate({
 *   row: { id: 's1', customerId: 'c1', status: 'paused',
 *          mpSubscriptionId: 'preapproval-abc', trialEnd: null,
 *          cancelAtPeriodEnd: false, updatedAt: new Date('2026-08-15T10:00:00Z'),
 *          deletedAt: null },
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

    // Soft-deleted rows are not this job's business, and letting one through is
    // not merely useless: see the docblock — it ends in a write that can
    // resurrect the row.
    if (row.deletedAt !== null) {
        return false;
    }
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
 * How a failure inside one row's reconcile is reported. No value ever produces a
 * write — the classification decides what a human is told, nothing else.
 *
 * - `unknown_at_provider` — the provider READ failed and MercadoPago could not
 *   resolve the preapproval at all. This is the case that must NEVER be read as
 *   "cancel it": the row may belong to a payer whose id we hold wrongly, or to a
 *   flow that never reached the provider. It is escalated for a human.
 * - `transient` — anything else: network, 5xx, rate limit, bad token, and every
 *   failure from a LATER phase (the status write, the audit insert, a
 *   notification, a reconciler bridge). Retried next tick.
 */
export type ProviderReadFailure = 'unknown_at_provider' | 'transient';

/**
 * Classify a failure raised while reconciling one row.
 *
 * Two gates, in order, and the first one is the one the review added.
 *
 * 1. **Provenance.** `processSubscriptionUpdated` is wrapped whole, so this
 *    receives errors from every phase, not just the read. Only an error stamped
 *    by the `subscriptions.retrieve()` boundary (see
 *    `routes/webhooks/mercadopago/provider-read-failure.ts`) can be about the
 *    preapproval at all. Without this gate an
 *    `Error('Notification template not found')` matched the message heuristic
 *    below and sent a human hunting for a preapproval that was fine.
 * 2. **Shape**, and deliberately not one signal. `@qazuor/qzpay-mercadopago` maps
 *    a MercadoPago error to `QZPayErrorCode.RESOURCE_NOT_FOUND` only when the SDK
 *    surfaces a `cause` array whose first entry has `code === '404'`; a plain HTTP
 *    404 arrives with just a `status`/`message` and falls through to the generic
 *    `provider_error` branch. Reading only the mapped code would classify most
 *    real "unknown at provider" reads as transient and retry them silently
 *    forever.
 *
 * @param error - Whatever was thrown while reconciling the row.
 * @returns Which of the two failure kinds this is.
 */
export function classifyProviderReadFailure(error: unknown): ProviderReadFailure {
    if (typeof error !== 'object' || error === null) {
        return 'transient';
    }
    // Gate 1: not from the provider read → not a statement about the preapproval.
    if (!isProviderReadFailure(error)) {
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

/**
 * Outcomes that mean "the provider and the local row genuinely agree, nothing to
 * do". Everything else `processSubscriptionUpdated` can report without writing is
 * an unresolved condition, not a clean bill of health.
 *
 * `addon_routed` and `provider_pending` are benign in exactly this sense: the
 * first says another owner handled it, the second that MercadoPago has not decided
 * yet. Neither hides a divergence this job could act on.
 */
const BENIGN_NO_OP_OUTCOMES: ReadonlySet<SubscriptionUpdateOutcome> = new Set([
    'already_in_sync',
    'addon_routed',
    'provider_pending',
    // The row is inside its soft-cancel grace on purpose; finalize-cancelled-subs
    // owns the flip.
    'soft_cancel_grace',
    // Deliberately not auto-corrected by owner decision (HOS-211).
    'transition_refused_legacy_active_to_trialing'
]);

/**
 * Is this no-op a clean bill of health, or a divergence nobody applied?
 *
 * Written as "benign unless listed" — an allowlist with everything else counted as
 * UNRESOLVED — so the default direction is loud. A new `SubscriptionUpdateOutcome`
 * added upstream shows up as unresolved and fails the tick until someone decides
 * it is benign, rather than being silently filed as "already in sync", which is the
 * exact defect this replaced. `transition_refused`,
 * `stored_status_unrecognized`, `provider_status_unknown`, `local_row_not_found`
 * and a missing/unknown value all land here.
 *
 * @param outcome - What `processSubscriptionUpdated` reported, if anything.
 * @returns `true` when the no-op hides a condition a human should see.
 */
function isUnresolvedNoOp(outcome: SubscriptionUpdateOutcome | undefined): boolean {
    return outcome === undefined || !BENIGN_NO_OP_OUTCOMES.has(outcome);
}

/** Counters a tick accumulates. */
interface SweepTotals {
    corrected: number;
    inSync: number;
    /** Divergences the system refused to apply. See {@link UNRESOLVED_OUTCOMES}. */
    unresolved: number;
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
                    updatedAt: billingSubscriptions.updatedAt,
                    // Selected so the in-memory predicate can re-check it; the
                    // WHERE clause below filters it too.
                    deletedAt: billingSubscriptions.deletedAt
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
                        excludeAddonDomainCondition(),
                        // The cursor (see `cursorAfterId`). Without it the same
                        // oldest-N rows are re-read every tick for ever, because a
                        // row that is already in sync is never written and so never
                        // changes position.
                        cursorAfterId === null
                            ? undefined
                            : gt(billingSubscriptions.id, cursorAfterId)
                    )
                )
                // By id, the cursor's axis — a total order over an indexed primary
                // key. NOT by `updated_at`: that column answers the latency
                // tolerance and must keep meaning "last real change".
                .orderBy(asc(billingSubscriptions.id))
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

        // Advance the cursor from what was SELECTED, not from what was acted on: a
        // row dropped by the in-memory predicate, a ghost that 404s, and a row whose
        // transition is refused must all still move the cursor past themselves, or
        // each of them pins the window and starves everything behind it — the exact
        // starvation the cursor exists to prevent.
        //
        // A short page means the id space is exhausted, so wrap to the beginning. A
        // full page leaves the cursor at its last id. This is the only place the
        // cursor moves, and it happens BEFORE any provider call, so a crash
        // mid-batch still advances rather than replaying the same window.
        // A dry run is a rehearsal and must not move real state: advancing the cursor
        // would make the NEXT real tick skip every row the rehearsal merely counted.
        const pageWasFull = selection.rows.length === BATCH_LIMIT;
        const lastSelectedId = selection.rows.at(-1)?.id ?? null;
        const cursorBefore = cursorAfterId;
        if (!dryRun) {
            cursorAfterId = pageWasFull ? lastSelectedId : null;
        }

        if (pageWasFull) {
            // The only possible signal that the population outgrew the per-tick
            // budget. Not an error — the cursor means the remainder is examined on
            // following ticks — but the number worth seeing before a backlog gets
            // long enough that a divergence waits hours.
            logger.warn(
                'subscription-drift-reconcile: batch limit reached — population exceeds the per-tick budget, remainder continues from the cursor next tick',
                {
                    batchLimit: BATCH_LIMIT,
                    cursorFrom: cursorBefore,
                    cursorTo: cursorAfterId
                }
            );
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
                details: {
                    dryRun: true,
                    ids: candidates.map((r) => r.id),
                    batchLimitReached: pageWasFull,
                    // Unchanged by a rehearsal, and reported so that is visible.
                    cursorAfterId
                }
            };
        }

        const totals: SweepTotals = {
            corrected: 0,
            inSync: 0,
            unresolved: 0,
            unknownAtProvider: 0,
            errors: 0
        };
        const unknownIds: string[] = [];
        const unresolved: Array<{ id: string; outcome: string }> = [];
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
                } else if (isUnresolvedNoOp(result.outcome)) {
                    // The divergence exists and the system declined to apply it —
                    // a refused transition, an unmappable status, a vanished row.
                    // Filing this as "in sync" is precisely the blindness this job
                    // was built to remove, so it is named, counted apart, and held
                    // against `success`.
                    totals.unresolved += 1;
                    unresolved.push({ id: row.id, outcome: result.outcome ?? 'unknown' });
                    logger.error(
                        'subscription-drift-reconcile: divergence could NOT be applied — the row is not in sync',
                        {
                            subscriptionId: row.id,
                            customerId: row.customerId,
                            localStatus: row.status,
                            outcome: result.outcome ?? 'unknown'
                        },
                        { capture: true }
                    );
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
                        // Forwards to Sentry via the logger's capture hook. There
                        // used to be an explicit `Sentry.captureException` here
                        // too, which — together with the runner's soft-failure
                        // capture for `success: false` — meant THREE Sentry events
                        // per ghost row per tick, with no dedup or backoff. The
                        // logger's hook and the runner's capture already say it
                        // twice; a third said nothing new.
                        { capture: true }
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

        // Neither an unresolvable preapproval nor an unapplied divergence is a
        // successful tick. Reporting either as one is how a row that needs a human
        // becomes a green line in the cron log that nobody reads.
        const success =
            totals.errors === 0 && totals.unknownAtProvider === 0 && totals.unresolved === 0;

        logger.info('subscription-drift-reconcile: tick complete', {
            candidates: candidates.length,
            ...totals,
            durationMs: durationMs()
        });

        return {
            success,
            message:
                `Compared ${candidates.length} subscription(s): ${totals.corrected} corrected, ` +
                `${totals.inSync} already in sync, ${totals.unresolved} diverging but NOT ` +
                `applied, ${totals.unknownAtProvider} unknown at MercadoPago (NOT cancelled), ` +
                `${totals.errors} transient error(s)`,
            processed: candidates.length,
            errors: totals.errors + totals.unknownAtProvider + totals.unresolved,
            durationMs: durationMs(),
            details: {
                corrected: totals.corrected,
                inSync: totals.inSync,
                unresolved: totals.unresolved,
                unresolvedRows: unresolved,
                unknownAtProvider: totals.unknownAtProvider,
                unknownAtProviderIds: unknownIds,
                transientErrors: totals.errors,
                batchLimitReached: pageWasFull,
                cursorFrom: cursorBefore,
                cursorAfterId
            }
        };
    }
};
