/**
 * Finalize Cancelled Subscriptions Cron Job (SPEC-147 T-009 + T-010).
 *
 * Runs daily at 4:30 AM (30 4 * * *). Does two passes in sequence:
 *
 * ### Pass 1 — Finalize due soft-cancellations (T-009)
 *
 * Finds all subscriptions that have `cancelAtPeriodEnd=true` AND
 * `current_period_end <= now()` AND `status IN ('active', 'past_due', 'trialing')`,
 * then completes the cancellation lifecycle for each:
 *
 *   1. Validates the `<status> → cancelled` transition via the state machine
 *      (all three source statuses have a registered edge to 'cancelled').
 *   2. Flips `status` to `'cancelled'` (UK spelling, 2 L's) via a direct
 *      Drizzle update. `billing.subscriptions.cancel()` is intentionally NOT
 *      called here — it was already called during the soft-cancel (T-005) and
 *      only sets `canceledAt` on a `cancelAtPeriodEnd=true` path, not the
 *      status. The provider (MercadoPago) preapproval was already paused at
 *      soft-cancel time.
 *   3. Revokes addons via `handleSubscriptionCancellationAddons` (the webhook-
 *      style batch helper — realign finding #7). Best-effort: a failure is
 *      logged and counted as an error but does NOT block the next sub.
 *   4. Clears the entitlement cache for the customer (INV-1).
 *   5. Writes a `FINALIZE_CANCELLED_SUB` audit event with
 *      `triggerSource='finalize-cancelled-cron'`.
 *
 * #### Why these three statuses? (M2 fix)
 *
 * A soft-cancelled subscription (`cancelAtPeriodEnd=true`) can legitimately be
 * in any of these three states when the grace period expires:
 *
 * - `active`: the normal case — no payment events between soft-cancel and period_end.
 * - `past_due`: a payment-failure webhook moved the sub to `past_due` while
 *   `cancelAtPeriodEnd=true` was already set. Under the previous bug this sub
 *   would be stuck forever: status='past_due' excluded it from the 'active'-only
 *   query and it was never finalized.
 * - `trialing`: the user soft-cancelled during a trial period. Same trap as
 *   `past_due` — the trial sub never re-enters 'active' before period_end.
 *
 * Excluded statuses:
 * - `cancelled`, `expired`, `abandoned`: already terminal — not in the set.
 * - `pending_provider`: checkout not confirmed; the cancelAtPeriodEnd flag would
 *   be surprising here and is not a normal user-self-service path.
 * - `paused`: admin-pause is orthogonal to user soft-cancel; a paused sub has
 *   its own lifecycle and is not expected to carry `cancelAtPeriodEnd=true` from
 *   the user self-service flow.
 *
 * ### Pass 2 — D3 "access ending soon" reminders (T-010)
 *
 * Scans for soft-cancelled subs whose `current_period_end` falls in the
 * [now+2d, now+4d] window. Uses the same `FINALIZE_ELIGIBLE_STATUSES` set as
 * Pass 1 so `past_due` and `trialing` soft-cancelled subs also receive the
 * "access ending" heads-up (they deserve it just as much as `active` subs).
 * For each, fires one `SUBSCRIPTION_ACCESS_ENDING_SOON` email with per-sub
 * dedup via a `SUBSCRIPTION_ACCESS_ENDING_NOTIF` billing event.
 * Fire-and-forget (errors are logged, not counted in job result).
 *
 * The two query windows are non-overlapping:
 *  - Pass 1: `period_end <= now` (already expired)
 *  - Pass 2: `period_end in (now+2d, now+4d)` (3 days out)
 *
 * ### Idempotency
 *
 * Pass 1: the `status IN ('active','past_due','trialing')` filter is the
 * primary gate — once flipped to 'cancelled' (a terminal state not in the
 * set), rows never re-appear. Pass 2: the `SUBSCRIPTION_ACCESS_ENDING_NOTIF`
 * event is the dedup guard (mirrors `TRIAL_PRE_END_NOTIF_D3`).
 *
 * ### Failure handling (mirrors apply-scheduled-plan-changes)
 *
 * A per-sub failure in pass 1 is caught, logged, and counted as an error.
 * Pass 2 errors are fire-and-forget (logged only).
 *
 * ### Cron slot
 *
 * 3 AM is occupied by `archive-abandoned-drafts` + `conversation-token-cleanup`
 * + `notification-log-purge` (realign finding #5). This job uses `30 4 * * *`
 * (4:30 AM) which is currently free.
 *
 * @module cron/jobs/finalize-cancelled-subs
 */

import {
    and,
    billingSubscriptionEvents,
    billingSubscriptions,
    eq,
    getDb,
    gte,
    inArray,
    isNull,
    lte,
    withTransaction
} from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { SubscriptionStatusEnum } from '@repo/schemas';
import type { SubscriptionStatusFull } from '@repo/service-core';
import { BILLING_EVENT_TYPES, validateSubscriptionStatusTransition } from '@repo/service-core';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { clearEntitlementCache } from '../../middlewares/entitlement.js';
import { handleSubscriptionCancellationAddons } from '../../services/addon-lifecycle-cancellation.service.js';
import { sendNotification } from '../../utils/notification-helper.js';
import type { CronJobDefinition, CronJobResult } from '../types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Safety cap on rows processed per run. Soft-cancel events are rare (one per
 * user per billing cycle), so the realistic batch is 0-5. The cap prevents a
 * runaway bulk from a data anomaly.
 */
const MAX_ROWS_PER_TICK = 200;

/**
 * Statuses a soft-cancelled subscription (`cancelAtPeriodEnd=true`) can
 * legitimately be in when the grace period expires and it needs finalizing.
 *
 * - `active`: normal case — no payment events before period_end.
 * - `past_due`: payment-failure webhook fired after soft-cancel was set.
 *   The previous 'active'-only query caused these to be stuck forever (M2 bug).
 * - `trialing`: user soft-cancelled a trial; same trap as past_due.
 *
 * Excluded: terminal states ('cancelled', 'expired', 'abandoned') and states
 * that are not reachable via the user self-service soft-cancel path
 * ('pending_provider', 'paused').
 */
const FINALIZE_ELIGIBLE_STATUSES = [
    SubscriptionStatusEnum.ACTIVE,
    SubscriptionStatusEnum.PAST_DUE,
    SubscriptionStatusEnum.TRIALING
] as const;

/** One day in milliseconds, used to compute the D3 window. */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * D3 window: subs whose `current_period_end` falls between now+2d and now+4d.
 *
 * The 2-day lower bound avoids double-sending if the cron runs slightly early
 * on the day before. The 4-day upper bound provides a 48-hour catching window
 * so a skipped daily run doesn't silently miss the reminder.
 */
const D3_WINDOW_START_DAYS = 2;
const D3_WINDOW_END_DAYS = 4;

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

/**
 * Minimal columns the finalize loop needs from each due subscription row.
 */
interface DueSoftCancelledRow {
    readonly id: string;
    readonly customerId: string;
    readonly status: string;
}

/**
 * Minimal columns needed by the D3 access-ending reminder scan.
 */
interface AccessEndingRow {
    readonly id: string;
    readonly customerId: string;
    readonly planId: string;
    readonly periodEnd: Date;
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/**
 * Finds all subscriptions that are due for finalization:
 *   - `status IN ('active', 'past_due', 'trialing')` — the three non-terminal
 *     statuses a soft-cancelled sub can legitimately be in (see
 *     `FINALIZE_ELIGIBLE_STATUSES` for the rationale). M2 fix: the prior
 *     'active'-only query caused soft-cancelled subs that went `past_due`
 *     (payment-failure webhook) or stayed `trialing` to be stuck forever.
 *   - `cancel_at_period_end = true`
 *   - `current_period_end <= now()` (the grace period has elapsed)
 *   - Not soft-deleted
 *
 * All predicates are applied in the SQL WHERE clause via Drizzle's `and()`
 * operator — there is NO JS post-filter. This ensures a sub with
 * `currentPeriodEnd` in the future is never finalized early. Mirrors the
 * full-compound-WHERE pattern used by the D3 pass (`sendAccessEndingReminders`).
 *
 * @returns Array of due soft-cancelled subscription rows.
 */
async function findDueSoftCancelledSubs(): Promise<DueSoftCancelledRow[]> {
    const db = getDb();
    const now = new Date();

    return db
        .select({
            id: billingSubscriptions.id,
            customerId: billingSubscriptions.customerId,
            status: billingSubscriptions.status
        })
        .from(billingSubscriptions)
        .where(
            // All predicates enforced in SQL — direct Drizzle operators,
            // NOT plain-object where clauses (lesson from SPEC-167).
            // inArray replaces the prior eq(status, 'active') to catch
            // soft-cancelled subs that are in past_due or trialing at
            // period_end (M2 regression fix).
            // cancelAtPeriodEnd is a boolean column: eq(col, true).
            // lte(currentPeriodEnd, now) enforces the grace-period gate.
            // isNull(deletedAt) guards soft-delete.
            and(
                inArray(billingSubscriptions.status, [...FINALIZE_ELIGIBLE_STATUSES]),
                eq(billingSubscriptions.cancelAtPeriodEnd, true),
                lte(billingSubscriptions.currentPeriodEnd, now),
                isNull(billingSubscriptions.deletedAt)
            )
        )
        .limit(MAX_ROWS_PER_TICK);
}

// ---------------------------------------------------------------------------
// D3 access-ending reminder (SPEC-147 T-010)
// ---------------------------------------------------------------------------

/**
 * Logger shape accepted by `sendAccessEndingReminders`.
 *
 * Mirrors the shape passed by the cron context so the function can be tested
 * standalone with a fake logger.
 */
type ReminderLogger = {
    info: (m: string, d?: Record<string, unknown>) => void;
    warn: (m: string, d?: Record<string, unknown>) => void;
    error: (m: string, d?: Record<string, unknown>) => void;
    debug?: (m: string, d?: Record<string, unknown>) => void;
};

/**
 * Scans for soft-cancelled subscriptions whose `current_period_end` falls
 * in the D3 window ([now+2d, now+4d]) and sends a
 * `SUBSCRIPTION_ACCESS_ENDING_SOON` reminder for each that has not yet
 * received one (dedup via `SUBSCRIPTION_ACCESS_ENDING_NOTIF` event).
 *
 * Fire-and-forget: errors per-sub are logged but do NOT propagate to the
 * caller. The finalize-pass result is unaffected by reminder failures.
 *
 * @param logger - Logger from the surrounding cron context.
 */
async function sendAccessEndingReminders(logger: ReminderLogger): Promise<void> {
    const db = getDb();
    const billing = getQZPayBilling();
    const now = new Date();
    const windowStart = new Date(now.getTime() + D3_WINDOW_START_DAYS * ONE_DAY_MS);
    const windowEnd = new Date(now.getTime() + D3_WINDOW_END_DAYS * ONE_DAY_MS);

    let candidateRows: AccessEndingRow[];
    try {
        candidateRows = await db
            .select({
                id: billingSubscriptions.id,
                customerId: billingSubscriptions.customerId,
                planId: billingSubscriptions.planId,
                periodEnd: billingSubscriptions.currentPeriodEnd
            })
            .from(billingSubscriptions)
            .where(
                and(
                    // M2 fix: same status set as Pass 1 — past_due and trialing
                    // soft-cancelled subs also deserve the D3 heads-up.
                    inArray(billingSubscriptions.status, [...FINALIZE_ELIGIBLE_STATUSES]),
                    eq(billingSubscriptions.cancelAtPeriodEnd, true),
                    isNull(billingSubscriptions.deletedAt),
                    gte(billingSubscriptions.currentPeriodEnd, windowStart),
                    lte(billingSubscriptions.currentPeriodEnd, windowEnd)
                )
            )
            .limit(MAX_ROWS_PER_TICK);
    } catch (err) {
        logger.error('finalize-cancelled-subs D3: window query failed', {
            error: err instanceof Error ? err.message : String(err)
        });
        return;
    }

    if (candidateRows.length === 0) {
        return;
    }

    logger.info('finalize-cancelled-subs D3: found candidates', {
        count: candidateRows.length
    });

    for (const row of candidateRows) {
        try {
            // Dedup: skip if reminder was already sent for this sub
            const existingEvent = await db
                .select({ id: billingSubscriptionEvents.id })
                .from(billingSubscriptionEvents)
                .where(
                    and(
                        eq(billingSubscriptionEvents.subscriptionId, row.id),
                        eq(
                            billingSubscriptionEvents.eventType,
                            BILLING_EVENT_TYPES.SUBSCRIPTION_ACCESS_ENDING_NOTIF
                        )
                    )
                )
                .limit(1);

            if (existingEvent.length > 0) {
                logger.info('finalize-cancelled-subs D3: dedup skip', {
                    subscriptionId: row.id
                });
                continue;
            }

            if (!billing) {
                logger.warn('finalize-cancelled-subs D3: billing not configured, skipping', {
                    subscriptionId: row.id
                });
                continue;
            }

            const [customer, plan] = await Promise.all([
                billing.customers.get(row.customerId),
                billing.plans.get(row.planId)
            ]);

            if (!customer || !plan) {
                logger.warn('finalize-cancelled-subs D3: customer or plan missing', {
                    subscriptionId: row.id,
                    customerId: row.customerId,
                    planId: row.planId,
                    customerFound: customer !== null,
                    planFound: plan !== null
                });
                continue;
            }

            const recipientName =
                typeof customer.metadata?.name === 'string'
                    ? customer.metadata.name
                    : customer.email.split('@')[0];

            const periodEnd = new Date(row.periodEnd);
            const daysRemaining = Math.max(
                1,
                Math.ceil((periodEnd.getTime() - now.getTime()) / ONE_DAY_MS)
            );

            // Fire-and-forget: send without awaiting the retry mechanism
            void Promise.resolve(
                sendNotification({
                    type: NotificationType.SUBSCRIPTION_ACCESS_ENDING_SOON,
                    recipientEmail: customer.email,
                    recipientName: recipientName ?? customer.email,
                    userId: null,
                    customerId: customer.id,
                    idempotencyKey: `sub-access-ending-d3-${row.id}`,
                    planName: plan.name,
                    accessUntil: periodEnd.toISOString(),
                    daysRemaining
                })
            ).catch((err: unknown) => {
                logger.error('finalize-cancelled-subs D3: send failed (fire-and-forget)', {
                    subscriptionId: row.id,
                    error: err instanceof Error ? err.message : String(err)
                });
            });

            // Write dedup event synchronously so a re-run on the same day skips
            await db.insert(billingSubscriptionEvents).values({
                subscriptionId: row.id,
                eventType: BILLING_EVENT_TYPES.SUBSCRIPTION_ACCESS_ENDING_NOTIF,
                triggerSource: 'finalize-cancelled-cron',
                metadata: {
                    daysRemaining,
                    periodEnd: periodEnd.toISOString(),
                    sentAt: now.toISOString()
                }
            });

            logger.info('finalize-cancelled-subs D3: reminder sent', {
                subscriptionId: row.id,
                customerId: row.customerId,
                daysRemaining
            });
        } catch (err) {
            logger.error('finalize-cancelled-subs D3: per-sub error (skipping)', {
                subscriptionId: row.id,
                error: err instanceof Error ? err.message : String(err)
            });
        }
    }
}

// ---------------------------------------------------------------------------
// Per-subscription finalization
// ---------------------------------------------------------------------------

/**
 * Outcome of attempting to finalize one soft-cancelled subscription.
 */
type FinalizeOutcome = { kind: 'finalized' } | { kind: 'error'; error: string };

/**
 * Completes the cancellation lifecycle for a single soft-cancelled subscription.
 *
 * Steps (per SPEC-147 Workstream C):
 *   1. Validate `active → cancelled` state-machine edge.
 *   2. Atomic transaction: flip `status = 'cancelled'` + revoke addons +
 *      write `FINALIZE_CANCELLED_SUB` audit event.
 *   3. Clear entitlement cache (outside tx — non-rollback-able cache side-effect).
 *
 * ### Atomicity
 *
 * Steps 2a (status flip), 2b (addon revocation), and 2c (audit event) run inside
 * a single `withTransaction` boundary. If addon revocation throws, the transaction
 * rolls back the status flip and the event insert, leaving `status='active'` so the
 * sub re-appears on the next cron run. The addon helper filters on `status='active'`
 * addons, making the retry safe (idempotent).
 *
 * `clearEntitlementCache` stays OUTSIDE the transaction — it is a cache side-effect,
 * not a DB write, and must not run if the transaction rolled back.
 *
 * @param row - The due soft-cancelled subscription row.
 * @param logger - Logger passed from the cron context.
 * @returns `{ kind: 'finalized' }` on success or `{ kind: 'error', error }` on failure.
 */
async function finalizeOne(
    row: DueSoftCancelledRow,
    logger: {
        info: (m: string, d?: Record<string, unknown>) => void;
        warn: (m: string, d?: Record<string, unknown>) => void;
        error: (m: string, d?: Record<string, unknown>) => void;
    }
): Promise<FinalizeOutcome> {
    const { id: subscriptionId, customerId, status } = row;
    const billing = getQZPayBilling();
    const db = getDb();
    const now = new Date();

    try {
        // ── Step 1: State-machine guard ──────────────────────────────────────
        // Validates the <actual-status> → 'cancelled' edge using the REAL
        // current status from the DB row (not a hardcoded 'active'). This is
        // necessary post-M2: the query now returns rows with status ∈
        // {active, past_due, trialing}, all of which have a registered edge
        // to 'cancelled' in VALID_TRANSITIONS.
        // Throws `InvalidSubscriptionTransitionError` if the edge is missing
        // (secondary idempotency safety net — the query filter is the primary).
        validateSubscriptionStatusTransition({
            from: status as SubscriptionStatusFull,
            to: 'cancelled',
            subscriptionId
        });

        // ── Step 2: Atomic transaction — status flip + addon revoke + audit ──
        // All three writes are wrapped in a single transaction so a failure in
        // addon revocation rolls back the status flip (keeping status='active')
        // and the audit event insert. The sub will re-appear on the next run.
        await withTransaction(async (tx) => {
            // ── Step 2a: Flip status to 'cancelled' ──────────────────────────
            // UK spelling ('cancelled', 2 L's) matches the DB column constraint
            // and the state machine. billing.subscriptions.cancel() was already
            // called at soft-cancel time and does NOT set status when
            // cancelAtPeriodEnd=true.
            await tx
                .update(billingSubscriptions)
                .set({
                    status: 'cancelled',
                    updatedAt: now
                })
                .where(eq(billingSubscriptions.id, subscriptionId));

            // ── Step 2b: Revoke addons ────────────────────────────────────────
            // Uses the webhook-style batch helper (realign #7). The helper
            // accepts the tx as its `db` param — it filters on status='active'
            // addons, making retries safe (idempotent). If this throws, the
            // whole transaction rolls back → status stays 'active' → sub
            // re-appears on next run.
            if (billing) {
                await handleSubscriptionCancellationAddons({
                    subscriptionId,
                    customerId,
                    billing,
                    db: tx
                });
            } else {
                logger.warn(
                    'finalize-cancelled-subs: billing not configured, skipping addon revocation',
                    { subscriptionId, customerId }
                );
            }

            // ── Step 2c: Write FINALIZE_CANCELLED_SUB audit event ────────────
            await tx.insert(billingSubscriptionEvents).values({
                subscriptionId,
                eventType: BILLING_EVENT_TYPES.FINALIZE_CANCELLED_SUB,
                previousStatus: status,
                newStatus: 'cancelled',
                triggerSource: 'finalize-cancelled-cron',
                metadata: {
                    finalizedAt: now.toISOString()
                }
            });
        }, db);

        // ── Step 3: Clear entitlement cache (INV-1) ──────────────────────────
        // Runs AFTER the transaction commits. Non-rollback-able cache side-effect —
        // must not run if the transaction above rolled back.
        clearEntitlementCache(customerId);

        logger.info('finalize-cancelled-subs: subscription finalized', {
            subscriptionId,
            customerId
        });

        return { kind: 'finalized' };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('finalize-cancelled-subs: failed to finalize subscription', {
            subscriptionId,
            customerId,
            error: message
        });
        return { kind: 'error', error: message };
    }
}

// ---------------------------------------------------------------------------
// Job definition
// ---------------------------------------------------------------------------

/**
 * Cron job definition — registered in `apps/api/src/cron/registry.ts` and
 * `apps/api/src/cron/schedules.manifest.ts`.
 */
export const finalizeCancelledSubsJob: CronJobDefinition = {
    name: 'finalize-cancelled-subs',
    description:
        'Finalizes soft-cancelled subscriptions whose current_period_end has elapsed: flips status to cancelled, revokes addons, clears entitlement cache (SPEC-147)',
    schedule: '30 4 * * *', // 4:30 AM — 3 AM is occupied by 3 sibling jobs
    enabled: true,
    timeoutMs: 10 * 60_000, // 10 minutes

    handler: async (ctx): Promise<CronJobResult> => {
        const { logger, startedAt, dryRun } = ctx;
        const startMs = startedAt.getTime();

        logger.info('finalize-cancelled-subs: starting tick', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        const billing = getQZPayBilling();
        if (!billing) {
            logger.warn('finalize-cancelled-subs: billing not configured, skipping');
            return {
                success: true,
                message: 'Skipped — billing not configured',
                processed: 0,
                errors: 0,
                durationMs: Date.now() - startMs
            };
        }

        // Load due rows
        let dueRows: DueSoftCancelledRow[];
        try {
            dueRows = await findDueSoftCancelledSubs();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('finalize-cancelled-subs: due-query failed', { error: message });
            return {
                success: false,
                message: `Due-query failed: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startMs
            };
        }

        if (dryRun) {
            logger.info('finalize-cancelled-subs: dry-run, listing only', {
                dueCount: dueRows.length
            });
            return {
                success: true,
                message: `Dry run — ${dueRows.length} subscription(s) would be finalized`,
                processed: dueRows.length,
                errors: 0,
                durationMs: Date.now() - startMs,
                details: { ids: dueRows.map((r) => r.id) }
            };
        }

        let finalized = 0;
        let errors = 0;

        for (const row of dueRows) {
            const outcome = await finalizeOne(row, logger);
            if (outcome.kind === 'finalized') {
                finalized += 1;
            } else {
                errors += 1;
            }
        }

        // Pass 2: D3 access-ending reminders — fire-and-forget, does not affect
        // the finalize result. Runs after the finalize pass so a sub that was just
        // finalized (period_end <= now) never appears in the D3 window (period_end
        // in +2d..+4d — the windows are non-overlapping).
        void sendAccessEndingReminders(logger).catch((err: unknown) => {
            logger.error('finalize-cancelled-subs: D3 reminder pass failed unexpectedly', {
                error: err instanceof Error ? err.message : String(err)
            });
        });

        return {
            success: errors === 0,
            message: `Finalized ${finalized}, errors ${errors}`,
            processed: finalized + errors,
            errors,
            durationMs: Date.now() - startMs,
            details: { finalized, errors, due: dueRows.length }
        };
    }
};

// ---------------------------------------------------------------------------
// Internals (unit-test surface)
// ---------------------------------------------------------------------------

/**
 * Internal helpers exposed for unit tests only. Production code must NOT
 * import these directly.
 */
export const _internals = {
    MAX_ROWS_PER_TICK,
    FINALIZE_ELIGIBLE_STATUSES,
    findDueSoftCancelledSubs,
    finalizeOne,
    sendAccessEndingReminders
};
