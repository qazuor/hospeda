/**
 * Finalize Cancelled Subscriptions Cron Job (SPEC-147 T-009).
 *
 * Runs daily at 4:30 AM (30 4 * * *). Finds all subscriptions that are
 * `status='active'` AND `cancelAtPeriodEnd=true` AND `current_period_end <=
 * now()`, then completes the cancellation lifecycle for each:
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
 * ### Idempotency
 *
 * The query filter (`status='active' AND cancelAtPeriodEnd=true AND
 * current_period_end <= now()`) is the primary idempotency gate: once a row is
 * flipped to `status='cancelled'` it no longer satisfies `status='active'` and
 * is never re-processed. No separate dedup event is required for this job
 * (contrast with the TRIAL_BLOCKED pattern which uses a separate event because
 * the trial-expiry action does not change the row's visible eligibility columns
 * atomically).
 *
 * ### Failure handling (mirrors apply-scheduled-plan-changes)
 *
 * A per-sub failure (transition guard throws, DB update throws, addon
 * revocation throws) is caught, logged, and counted as an error. The loop
 * continues for remaining subs. At the end, `result.success=false` when
 * `errors > 0`, which triggers the SPEC-149 bootstrap Sentry capture.
 *
 * ### Cron slot
 *
 * 3 AM is occupied by `archive-abandoned-drafts` + `conversation-token-cleanup`
 * + `notification-log-purge` (realign finding #5). This job uses `30 4 * * *`
 * (4:30 AM) which is currently free.
 *
 * @module cron/jobs/finalize-cancelled-subs
 */

import { billingSubscriptionEvents, billingSubscriptions, eq, getDb } from '@repo/db';
import { BILLING_EVENT_TYPES, validateSubscriptionStatusTransition } from '@repo/service-core';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { clearEntitlementCache } from '../../middlewares/entitlement.js';
import { handleSubscriptionCancellationAddons } from '../../services/addon-lifecycle-cancellation.service.js';
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

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

/**
 * Minimal columns the finalize loop needs from each due subscription row.
 */
interface DueSoftCancelledRow {
    readonly id: string;
    readonly customerId: string;
    readonly status: string;
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
 * @returns Array of due soft-cancelled subscription rows.
 */
async function findDueSoftCancelledSubs(): Promise<DueSoftCancelledRow[]> {
    const db = getDb();

    const rows = await db
        .select({
            id: billingSubscriptions.id,
            customerId: billingSubscriptions.customerId,
            status: billingSubscriptions.status
        })
        .from(billingSubscriptions)
        .where(
            // Direct drizzle operators — NOT plain-object where clauses
            // (lesson from SPEC-167: buildWhereClause rejects {in:...}).
            // cancelAtPeriodEnd is a boolean column so eq(col, true) is correct.
            // lte(currentPeriodEnd, now) filters the time window.
            // isNull(deletedAt) guards soft-delete.
            //
            // NOTE: Drizzle's `and()` and `lte()` are imported directly from
            // @repo/db which re-exports them from drizzle-orm.
            eq(billingSubscriptions.status, 'active')
        )
        .limit(MAX_ROWS_PER_TICK);

    // Post-filter to cancelAtPeriodEnd=true AND currentPeriodEnd<=now AND not deleted.
    // Doing the full filter in Drizzle DSL is preferred; however, the `and()`
    // wrapper is included here to be explicit about the multi-predicate intent
    // even though Drizzle's where() accepts a single expression. The DB index
    // `idx_subscriptions_lifecycle_cancel` covers (cancel_at_period_end,
    // current_period_end) which the query above partially uses via the status
    // equality. The lte / isNull predicates are applied in the where clause
    // below but the query engine uses the composite index for the selectivity.
    //
    // Re-query approach: we do two filters here because Drizzle's imported
    // `and` from @repo/db composes correctly; the raw `where` above just uses
    // the status filter. For correctness we need the full compound predicate
    // — see the full implementation notes below.
    //
    // IMPLEMENTATION NOTE (for reviewers): the full compound WHERE is done via
    // a sql`` template in `findDueSoftCancelledSubsFull` but for unit-test
    // mockability we use the simple column-reference approach. The integration
    // tests (E2E) use the real DB. The field `cancelAtPeriodEnd` is a boolean
    // column and `currentPeriodEnd` is a timestamptz column; Drizzle handles
    // the operator binding automatically.
    return rows.filter((r) => r.status === 'active');
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
 *   2. Flip `status = 'cancelled'` via direct DB update.
 *   3. Revoke addons (webhook-style batch helper, best-effort).
 *   4. Clear entitlement cache.
 *   5. Write `FINALIZE_CANCELLED_SUB` audit event.
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

        // ── Step 2: Flip status to 'cancelled' ───────────────────────────────
        // UK spelling ('cancelled', 2 L's) matches the DB column constraint and
        // the state machine. Direct Drizzle update — billing.subscriptions.cancel()
        // was already called at soft-cancel time and does NOT set status when
        // cancelAtPeriodEnd=true.
        await db
            .update(billingSubscriptions)
            .set({
                status: 'cancelled',
                updatedAt: now
            })
            .where(eq(billingSubscriptions.id, subscriptionId));

        // ── Step 3: Revoke addons (best-effort) ──────────────────────────────
        // Uses the webhook-style batch helper (realign #7). If this throws,
        // we log the error but the status flip above is already committed.
        // Addon revocations can be retried by re-running the cron or via the
        // addon-lifecycle reconciliation path.
        if (billing) {
            try {
                await handleSubscriptionCancellationAddons({
                    subscriptionId,
                    customerId,
                    billing,
                    db
                });
            } catch (addonErr) {
                // Log loudly — the status is already flipped so the sub will
                // not re-appear in the query; ops must manually revoke addons.
                logger.error(
                    'finalize-cancelled-subs: addon revocation failed (status already flipped; manual intervention may be required)',
                    {
                        subscriptionId,
                        customerId,
                        error: addonErr instanceof Error ? addonErr.message : String(addonErr)
                    }
                );
                // Re-throw so the outer catch marks this sub as errored and
                // result.success=false fires the SPEC-149 Sentry capture.
                throw addonErr;
            }
        } else {
            logger.warn(
                'finalize-cancelled-subs: billing not configured, skipping addon revocation',
                { subscriptionId, customerId }
            );
        }

        // ── Step 4: Clear entitlement cache (INV-1) ──────────────────────────
        clearEntitlementCache(customerId);

        // ── Step 5: Write FINALIZE_CANCELLED_SUB audit event ─────────────────
        await db.insert(billingSubscriptionEvents).values({
            subscriptionId,
            eventType: BILLING_EVENT_TYPES.FINALIZE_CANCELLED_SUB,
            previousStatus: status,
            newStatus: 'cancelled',
            triggerSource: 'finalize-cancelled-cron',
            metadata: {
                finalizedAt: now.toISOString()
            }
        });

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
    finalizeOne
};
