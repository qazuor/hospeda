/**
 * Finalize Cancelled Subscriptions Cron Job (SPEC-147 T-009 + T-010).
 *
 * Runs daily at 4:30 AM (30 4 * * *). Does two passes in sequence:
 *
 * ### Pass 1 — Finalize due soft-cancellations (T-009)
 *
 * Finds all subscriptions that are `status='active'` AND
 * `cancelAtPeriodEnd=true` AND `current_period_end <= now()`, then completes
 * the cancellation lifecycle for each:
 *
 *   1. Validates the `active → cancelled` transition via the state machine.
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
 * ### Pass 2 — D3 "access ending soon" reminders (T-010)
 *
 * Scans for soft-cancelled subs whose `current_period_end` falls in the
 * [now+2d, now+4d] window. For each, fires one `SUBSCRIPTION_ACCESS_ENDING_SOON`
 * email with per-sub dedup via a `SUBSCRIPTION_ACCESS_ENDING_NOTIF` billing
 * event. Fire-and-forget (errors are logged, not counted in job result).
 *
 * The two query windows are non-overlapping:
 *  - Pass 1: `period_end <= now` (already expired)
 *  - Pass 2: `period_end in (now+2d, now+4d)` (3 days out)
 *
 * ### Idempotency
 *
 * Pass 1: the `status='active'` filter is the primary gate — flipped rows
 * never re-appear. Pass 2: the `SUBSCRIPTION_ACCESS_ENDING_NOTIF` event is
 * the dedup guard (mirrors `TRIAL_PRE_END_NOTIF_D3`).
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
    isNull,
    lte,
    withTransaction
} from '@repo/db';
import { NotificationType } from '@repo/notifications';
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
 * Finds all subscriptions that are:
 *   - `status = 'active'` (cancelAtPeriodEnd subs stay active until finalized)
 *   - `cancel_at_period_end = true`
 *   - `current_period_end <= now()` (the grace period has elapsed)
 *   - Not soft-deleted
 *
 * All four predicates are applied in the SQL WHERE clause via Drizzle's
 * `and()` operator — there is NO JS post-filter. This ensures a sub with
 * `currentPeriodEnd` in the future is never finalized early, preserving the
 * entire grace period. Mirrors the full-compound-WHERE pattern used by the
 * D3 pass (`sendAccessEndingReminders`).
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
            // All four predicates enforced in SQL — direct Drizzle operators,
            // NOT plain-object where clauses (lesson from SPEC-167).
            // cancelAtPeriodEnd is a boolean column: eq(col, true).
            // lte(currentPeriodEnd, now) enforces the grace-period gate.
            // isNull(deletedAt) guards soft-delete.
            and(
                eq(billingSubscriptions.status, 'active'),
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
                    eq(billingSubscriptions.status, 'active'),
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
        // Throws `InvalidSubscriptionTransitionError` when the edge is not
        // registered. A row with status='cancelled' would fail here (idempotency
        // safety net: the query filter is the primary guard, this is secondary).
        validateSubscriptionStatusTransition({
            from: status as 'active',
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
    findDueSoftCancelledSubs,
    finalizeOne,
    sendAccessEndingReminders
};
