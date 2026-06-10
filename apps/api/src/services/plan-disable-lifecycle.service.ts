/**
 * Plan-disable lifecycle service (SPEC-148 T-005).
 *
 * Implements {@link disablePlanLifecycle} — the fan-out triggered AFTER
 * `planService.toggleActive(id, false)` marks a plan as inactive.
 *
 * ### What it does
 *
 * 1. Queries all subscriptions on `planId` that are still live
 *    (`status IN (active, trialing, past_due)`) and not already winding down
 *    (`cancelAtPeriodEnd=false`, `deletedAt IS NULL`).
 * 2. For each matching subscription (in an independent per-sub transaction):
 *    - Sets `cancelAtPeriodEnd=true` (status stays — the finalize-cancelled-subs
 *      cron transitions to `cancelled` after `currentPeriodEnd`).
 *    - Writes a `PLAN_DISABLED_MIGRATION` event (triggerSource='plan-disable').
 *    - Clears the entitlement cache for the customer (INV-1, after the tx).
 *    - Queues a `PLAN_BEING_RETIRED` notification (fire-and-forget).
 * 3. After the fan-out: writes ONE `PLAN_DISABLED_BY_ADMIN` audit entry via
 *    `insertPlanAuditLog` (actorId, planId, affectedSubCount).
 *
 * ### Idempotency
 *
 * Re-running on an already-disabled plan is safe: the query WHERE clause
 * excludes `cancelAtPeriodEnd=true` rows, so no rows are returned and
 * `affectedSubCount` is 0.  The audit entry is still written (with count=0)
 * to keep a complete admin trail.
 *
 * ### Soft-fail (batch tolerance)
 *
 * A per-sub failure (transaction error, DB timeout, etc.) is caught, logged,
 * and the fan-out continues with the next subscription.  Only successful
 * updates are counted in `affectedSubCount`.  This mirrors the
 * SPEC-167 batch-tolerance pattern.
 *
 * ### Transaction atomicity
 *
 * Each per-sub operation runs inside its own `withServiceTransaction` boundary
 * (independent, not nested) so a failure on sub N does not roll back sub N-1.
 * This mirrors the per-sub boundary used in the finalize-cancelled-subs cron.
 *
 * @module services/plan-disable-lifecycle
 */

import {
    and,
    billingCustomers,
    billingSubscriptionEvents,
    billingSubscriptions,
    eq,
    getDb,
    inArray,
    isNull
} from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { BILLING_EVENT_TYPES, withServiceTransaction } from '@repo/service-core';
import { clearEntitlementCache } from '../middlewares/entitlement.js';
import { apiLogger } from '../utils/logger.js';
import { sendNotification } from '../utils/notification-helper.js';
import { insertPlanAuditLog } from './plan-disable-lifecycle.deps.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Statuses that are still "live" — i.e., the subscriber is actively using the
 * plan.  Mirrors the set used by the finalize-cancelled-subs cron (SPEC-147
 * M2 fix).
 */
const LIVE_STATUSES = ['active', 'trialing', 'past_due'] as const;

/**
 * Default human-readable migration hint included in the PLAN_BEING_RETIRED
 * notification when no hint is supplied by the caller.
 */
const DEFAULT_MIGRATION_HINT =
    'Your current plan is being retired. Please re-subscribe to another plan to keep your premium features.';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Input for {@link disablePlanLifecycle}.
 */
export interface DisablePlanLifecycleInput {
    /** UUID of the plan that has just been disabled. */
    readonly planId: string;
    /** UUID of the admin user who performed the disable. */
    readonly actorId: string;
    /**
     * Human-readable plan name used in the notification body.
     * Defaults to an empty string if not provided.
     */
    readonly planName?: string | undefined;
    /**
     * Short prompt encouraging the user to resubscribe.
     * Defaults to {@link DEFAULT_MIGRATION_HINT}.
     */
    readonly migrationHint?: string | undefined;
}

/**
 * Result returned by {@link disablePlanLifecycle}.
 */
export interface DisablePlanLifecycleResult {
    /** Number of subscriptions successfully flipped to cancelAtPeriodEnd=true. */
    readonly affectedSubCount: number;
}

// ---------------------------------------------------------------------------
// Internal row type (minimal columns needed by the fan-out)
// ---------------------------------------------------------------------------

interface EligibleSubRow {
    readonly id: string;
    readonly customerId: string;
    readonly currentPeriodEnd: Date;
    /** Resolved from billingCustomers.email — null when no matching customer row. */
    readonly customerEmail: string | null;
    /** Resolved from billingCustomers.name — null if not set. */
    readonly customerName: string | null;
}

// ---------------------------------------------------------------------------
// Fan-out implementation
// ---------------------------------------------------------------------------

/**
 * Fans out the plan-disable side-effects to all active subscriptions.
 *
 * Called AFTER `planService.toggleActive(planId, false)` has committed the
 * `active=false` flag on the plan row.  Wiring into the admin toggle path
 * is done in T-007; this function is the pure service layer tested here.
 *
 * **Idempotent**: re-running on an already-disabled plan returns
 * `{ affectedSubCount: 0 }` because the query finds no eligible rows.
 *
 * @param input - Disable lifecycle input
 * @returns Result with the count of subscriptions updated
 */
export async function disablePlanLifecycle(
    input: DisablePlanLifecycleInput
): Promise<DisablePlanLifecycleResult> {
    const { planId, actorId, planName = '', migrationHint = DEFAULT_MIGRATION_HINT } = input;
    const db = getDb();

    // ── Step 1: Query eligible subs ──────────────────────────────────────────
    // Eligible = live status + NOT already winding down + not soft-deleted.
    // LEFT JOIN billingCustomers to pull the recipient email and name so the
    // PLAN_BEING_RETIRED notification reaches an actual address (fix: #F1).
    // Drizzle operators (eq, inArray, isNull, and) are imported from @repo/db
    // (re-exported from drizzle-orm per SPEC-167 lesson).
    const eligibleSubs: EligibleSubRow[] = await db
        .select({
            id: billingSubscriptions.id,
            customerId: billingSubscriptions.customerId,
            currentPeriodEnd: billingSubscriptions.currentPeriodEnd,
            customerEmail: billingCustomers.email,
            customerName: billingCustomers.name
        })
        .from(billingSubscriptions)
        .leftJoin(billingCustomers, eq(billingSubscriptions.customerId, billingCustomers.id))
        .where(
            and(
                eq(billingSubscriptions.planId, planId),
                inArray(billingSubscriptions.status, [...LIVE_STATUSES]),
                eq(billingSubscriptions.cancelAtPeriodEnd, false),
                isNull(billingSubscriptions.deletedAt)
            )
        );

    apiLogger.info(
        { planId, actorId, eligibleCount: eligibleSubs.length },
        'plan-disable-lifecycle: starting fan-out'
    );

    // ── Step 2: Per-sub fan-out ──────────────────────────────────────────────
    let affectedSubCount = 0;

    for (const sub of eligibleSubs) {
        try {
            // Each sub gets its own independent transaction (not nested).
            // A failure here does NOT roll back already-committed subs.
            await withServiceTransaction(async (ctx) => {
                // biome-ignore lint/style/noNonNullAssertion: ctx.tx is always defined inside withServiceTransaction
                const tx = ctx.tx!;

                // 2a. Flip cancelAtPeriodEnd=true — status stays unchanged.
                //     The finalize-cancelled-subs cron will advance to 'cancelled'
                //     once currentPeriodEnd elapses (SPEC-147 reuse, realign #2).
                await (tx as typeof db)
                    .update(billingSubscriptions)
                    .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
                    .where(eq(billingSubscriptions.id, sub.id));

                // 2b. Write PLAN_DISABLED_MIGRATION event for this sub's audit trail.
                await (tx as typeof db).insert(billingSubscriptionEvents).values({
                    subscriptionId: sub.id,
                    eventType: BILLING_EVENT_TYPES.PLAN_DISABLED_MIGRATION,
                    triggerSource: 'plan-disable',
                    metadata: { planId }
                });
            });

            // 2c. Clear entitlement cache (INV-1).
            //     Must run AFTER the transaction commits so re-loaded entitlements
            //     reflect the cancelAtPeriodEnd flag.  Not rollback-able.
            clearEntitlementCache(sub.customerId);

            // 2d. Queue PLAN_BEING_RETIRED notification (fire-and-forget).
            //     Recipient email is resolved from the LEFT JOIN in Step 1.
            //     If the customer row is missing (null email — theoretically impossible
            //     given FK constraints but guarded defensively), log a warn and skip
            //     the notification; the cancelAtPeriodEnd flip above still commits.
            //     Wrapped in Promise.resolve() per SPEC-167 lesson so a sync
            //     undefined from a cleared mock does not cause a TypeError.
            if (sub.customerEmail) {
                const recipientName =
                    typeof sub.customerName === 'string' && sub.customerName.length > 0
                        ? sub.customerName
                        : sub.customerEmail.split('@')[0];
                void Promise.resolve(
                    sendNotification({
                        type: NotificationType.PLAN_BEING_RETIRED,
                        recipientEmail: sub.customerEmail,
                        recipientName: recipientName ?? sub.customerEmail,
                        userId: null,
                        customerId: sub.customerId,
                        planName,
                        accessUntil: sub.currentPeriodEnd.toISOString(),
                        migrationHint
                    })
                ).catch((err: unknown) => {
                    apiLogger.warn(
                        {
                            subscriptionId: sub.id,
                            customerId: sub.customerId,
                            error: err instanceof Error ? err.message : String(err)
                        },
                        'plan-disable-lifecycle: PLAN_BEING_RETIRED notification failed (non-blocking)'
                    );
                });
            } else {
                apiLogger.warn(
                    { subscriptionId: sub.id, customerId: sub.customerId },
                    'plan-disable-lifecycle: no customer email resolved — skipping PLAN_BEING_RETIRED notification'
                );
            }

            affectedSubCount++;
        } catch (err) {
            // Per-sub soft-fail: log and continue to the next sub.
            // The count reflects only successful updates.
            apiLogger.error(
                {
                    planId,
                    subscriptionId: sub.id,
                    customerId: sub.customerId,
                    error: err instanceof Error ? err.message : String(err)
                },
                'plan-disable-lifecycle: per-sub tx failed (skipping, continuing fan-out)'
            );
        }
    }

    apiLogger.info(
        { planId, actorId, affectedSubCount },
        'plan-disable-lifecycle: fan-out complete, writing admin audit event'
    );

    // ── Step 3: Write ONE PLAN_DISABLED_BY_ADMIN admin audit entry ───────────
    // Uses billingAuditLogs (plan-level audit) rather than billingSubscriptionEvents
    // so the admin action is auditable independently of any specific subscription.
    // affectedSubCount=0 on a no-op re-run is intentional and still useful as a
    // tombstone that proves the disable was attempted.
    await insertPlanAuditLog(db, {
        action: 'plan_disabled',
        planId,
        actorId,
        changes: {
            active: false,
            affectedSubCount,
            eventType: BILLING_EVENT_TYPES.PLAN_DISABLED_BY_ADMIN
        },
        previousValues: { active: true },
        livemode: false
    });

    return { affectedSubCount };
}
