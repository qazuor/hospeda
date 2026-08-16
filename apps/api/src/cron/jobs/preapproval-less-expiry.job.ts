/**
 * Preapproval-less Subscription Expiry Cron Job (H-21)
 *
 * Every Hospeda subscription is a MercadoPago preapproval (HOS-171) — that is
 * what `mp_subscription_id` holds, and it is the handle every reconciliation
 * mechanism uses. `subscription-poll` calls `/preapproval/{id}`; dunning works
 * off charge failures reported against it. A row with no preapproval id is
 * therefore invisible to ALL of them: nothing polls it, nothing retries it,
 * nothing cancels it. Its `current_period_end` can pass and no code path
 * anywhere reacts, because an elapsed period by itself triggers nothing — the
 * provider event is what triggers things, and there is no provider.
 *
 * The result is a subscription that stays `active` forever while nobody is
 * being charged for it. This job is the missing reconciler for exactly that
 * population.
 *
 * ## Why this is not any of the three grace mechanisms
 *
 * See `docs/billing/grace-period-source-of-truth.md`. Conflating them is easy
 * and expensive, so the boundaries are spelled out:
 *
 * - **Cron-lag grace** (6 h, status stays `active`) exists because an elapsed
 *   `current_period_end` on a NORMAL subscription means MercadoPago's renewal
 *   webhook is late, not that the user stopped paying. That reading depends
 *   entirely on a webhook being able to arrive. With no preapproval none ever
 *   can, so the premise of that grace does not hold here. The window is still
 *   honoured as a safety margin — a row that legitimately gained its
 *   preapproval seconds ago must not be reaped by a tick that raced it — and
 *   the SAME constant is reused rather than inventing a fourth duration.
 * - **Soft-cancel grace** (until `currentPeriodEnd`) is owned by
 *   `finalize-cancelled-subs`. Rows with `cancelAtPeriodEnd = true` are
 *   excluded here so the two jobs can never both act on one row.
 * - **Past-due dunning grace** (7 days) applies to `past_due`, which this job
 *   never selects.
 *
 * ## Scope
 *
 * `active` and `trialing` only. `comp` is a deliberate, permanently
 * complimentary grant that legitimately has no preapproval (SPEC-262) and must
 * never be reaped — it is excluded by the status filter, not by an
 * afterthought. Terminal states are already terminal.
 *
 * The target is `expired`, not `cancelled`: the period ended and nobody
 * cancelled anything. Both `active → expired` and `trialing → expired` are
 * registered edges in the state machine.
 *
 * ## Commerce listings
 *
 * A commerce listing's public visibility is driven by a DENORMALIZED copy of
 * the status on `commerce_listing_subscriptions`, not by `billing_subscriptions`
 * itself. `reconcileCommerceListingForSubscription` is the bridge that keeps
 * the two in step, and every other status-changing path (MP webhook, dunning,
 * finalize-cancelled-subs) calls it. This job does too: expiring the
 * subscription while leaving its listing publicly visible against a mirror
 * that still reads `active` would be an expiry done half way — a worse state
 * than the bug being fixed. The call is a no-op for the non-commerce majority.
 *
 * @module cron/jobs/preapproval-less-expiry
 */

import { BILLING_CRON_LAG_GRACE_HOURS } from '@repo/billing';
import {
    and,
    billingSubscriptionEvents,
    billingSubscriptions,
    eq,
    getDb,
    inArray,
    isNull
} from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import { checkSubscriptionStatusTransition, withServiceTransaction } from '@repo/service-core';
import { lt } from 'drizzle-orm';
import { clearEntitlementCache } from '../../middlewares/entitlement.js';
import { reconcileCommerceListingForSubscription } from '../../services/commerce-reconcile.service.js';
import { apiLogger } from '../../utils/logger.js';
import type { CronJobDefinition, CronJobResult } from '../types.js';

/** Statuses this job considers. `comp` is deliberately absent — see the module doc. */
const REAPABLE_STATUSES = [SubscriptionStatusEnum.ACTIVE, SubscriptionStatusEnum.TRIALING] as const;

/** Batch ceiling per tick, mirroring the other billing reconcilers. */
const BATCH_LIMIT = 100;

/** One hour in milliseconds. */
const HOUR_MS = 60 * 60 * 1000;

/** The shape this job needs off a subscription row. */
export interface ReapableSubscriptionRow {
    readonly id: string;
    readonly customerId: string | null;
    readonly status: string;
    readonly mpSubscriptionId: string | null;
    readonly currentPeriodEnd: Date | null;
    readonly cancelAtPeriodEnd: boolean | null;
}

/**
 * Decides whether a subscription row is an orphaned, elapsed subscription that
 * this job should expire.
 *
 * Pure and total — every rejection reason is explicit rather than relying on
 * the SQL filter alone, so the rule can be tested without a database and a
 * loosened query cannot silently widen what gets reaped.
 *
 * @param input - The row, the reference instant, and the grace window in hours.
 * @returns `true` when the row should transition to `expired`.
 *
 * @example
 * ```ts
 * isOrphanedElapsedSubscription({
 *   row: { id: 's1', customerId: 'c1', status: 'active', mpSubscriptionId: null,
 *          currentPeriodEnd: new Date('2026-08-07'), cancelAtPeriodEnd: false },
 *   now: new Date('2026-08-15'),
 *   graceHours: 6,
 * }); // => true
 * ```
 */
export function isOrphanedElapsedSubscription(input: {
    readonly row: ReapableSubscriptionRow;
    readonly now: Date;
    readonly graceHours: number;
}): boolean {
    const { row, now, graceHours } = input;

    // A preapproval means the normal reconcilers own this row. Anything
    // non-null counts, including a blank string: an empty id is a data problem,
    // not a licence to expire someone's subscription. This mirrors the SQL
    // filter, which uses IS NULL and likewise never matches an empty string.
    if (row.mpSubscriptionId !== null) {
        return false;
    }
    // Only the two live statuses. `comp` never qualifies.
    if (!(REAPABLE_STATUSES as readonly string[]).includes(row.status)) {
        return false;
    }
    // A pending soft-cancel belongs to `finalize-cancelled-subs`.
    if (row.cancelAtPeriodEnd === true) {
        return false;
    }
    // No period end means nothing has elapsed to act on.
    if (row.currentPeriodEnd === null) {
        return false;
    }
    return row.currentPeriodEnd.getTime() + graceHours * HOUR_MS < now.getTime();
}

export const preapprovalLessExpiryJob: CronJobDefinition = {
    name: 'preapproval-less-expiry',
    description:
        'Expire active/trialing subscriptions that have no MercadoPago preapproval and whose period has elapsed (H-21). They are invisible to poll and dunning, so nothing else would ever move them.',
    schedule: '30 5 * * *',
    enabled: true,
    timeoutMs: 120_000,

    handler: async (ctx): Promise<CronJobResult> => {
        const { logger, startedAt, dryRun } = ctx;
        const startMs = startedAt.getTime();

        logger.info('preapproval-less-expiry: starting tick', {
            dryRun,
            graceHours: BILLING_CRON_LAG_GRACE_HOURS,
            startedAt: startedAt.toISOString()
        });

        try {
            const db = getDb();
            const cutoff = new Date(startedAt.getTime() - BILLING_CRON_LAG_GRACE_HOURS * HOUR_MS);

            const candidates = await db
                .select({
                    id: billingSubscriptions.id,
                    customerId: billingSubscriptions.customerId,
                    status: billingSubscriptions.status,
                    mpSubscriptionId: billingSubscriptions.mpSubscriptionId,
                    currentPeriodEnd: billingSubscriptions.currentPeriodEnd,
                    cancelAtPeriodEnd: billingSubscriptions.cancelAtPeriodEnd
                })
                .from(billingSubscriptions)
                .where(
                    and(
                        inArray(billingSubscriptions.status, [...REAPABLE_STATUSES]),
                        isNull(billingSubscriptions.mpSubscriptionId),
                        isNull(billingSubscriptions.deletedAt),
                        eq(billingSubscriptions.cancelAtPeriodEnd, false),
                        lt(billingSubscriptions.currentPeriodEnd, cutoff)
                    )
                )
                .limit(BATCH_LIMIT);

            // Re-apply the rule in code. The SQL filter is an optimisation; the
            // predicate is the specification, and it is what the tests pin.
            const reapable = candidates.filter((row) =>
                isOrphanedElapsedSubscription({
                    row,
                    now: startedAt,
                    graceHours: BILLING_CRON_LAG_GRACE_HOURS
                })
            );

            if (dryRun) {
                logger.info('preapproval-less-expiry: dry run', {
                    wouldExpire: reapable.length,
                    ids: reapable.map((r) => r.id)
                });
                return {
                    success: true,
                    message: `Dry run — would expire ${reapable.length} preapproval-less subscription(s)`,
                    processed: reapable.length,
                    errors: 0,
                    durationMs: Date.now() - startMs,
                    details: { ids: reapable.map((r) => r.id) }
                };
            }

            let expired = 0;
            let errors = 0;

            for (const row of reapable) {
                const guard = checkSubscriptionStatusTransition({
                    from: row.status as `${SubscriptionStatusEnum}`,
                    to: SubscriptionStatusEnum.EXPIRED,
                    subscriptionId: row.id
                });
                if (!guard.valid) {
                    // Not an error: the state machine is the authority, and a
                    // row it refuses is a row this job has no business moving.
                    apiLogger.warn(
                        { subscriptionId: row.id, from: row.status, reason: guard.reason },
                        'preapproval-less-expiry: state machine rejected the transition — skipping'
                    );
                    continue;
                }

                try {
                    await withServiceTransaction(async (txCtx) => {
                        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
                        const tx = txCtx.tx!;

                        await tx
                            .update(billingSubscriptions)
                            .set({
                                status: SubscriptionStatusEnum.EXPIRED,
                                updatedAt: new Date()
                            })
                            .where(eq(billingSubscriptions.id, row.id));

                        await tx.insert(billingSubscriptionEvents).values({
                            subscriptionId: row.id,
                            previousStatus: row.status,
                            newStatus: SubscriptionStatusEnum.EXPIRED,
                            triggerSource: 'preapproval-less-expiry',
                            metadata: {
                                action: 'subscription.expired_without_preapproval',
                                currentPeriodEnd: row.currentPeriodEnd?.toISOString() ?? null,
                                graceHours: BILLING_CRON_LAG_GRACE_HOURS
                            }
                        });
                    });

                    // INV-1: every status change that moves entitlements must
                    // drop the cached set, or the user keeps the old plan's
                    // gates until the 5-minute TTL lapses.
                    if (row.customerId) {
                        clearEntitlementCache(row.customerId);
                    }

                    // Commerce listings do not read `billing_subscriptions`.
                    // They read a denormalized copy of the status on
                    // `commerce_listing_subscriptions`, and this bridge is what
                    // keeps the two in step — the MP webhook, dunning and
                    // finalize-cancelled-subs all call it for the same reason.
                    // Skipping it here would expire the subscription while
                    // leaving its listing publicly visible on a mirror that
                    // still claims `active`: an expiry done half way, which is
                    // a worse state than the bug this job fixes. Non-throwing
                    // by contract, and a no-op for the non-commerce majority.
                    await reconcileCommerceListingForSubscription({
                        subscriptionId: row.id,
                        subscriptionStatus: SubscriptionStatusEnum.EXPIRED,
                        source: 'preapproval-less-expiry'
                    });

                    expired++;
                } catch (err) {
                    errors++;
                    apiLogger.error(
                        {
                            subscriptionId: row.id,
                            error: err instanceof Error ? err.message : String(err)
                        },
                        'preapproval-less-expiry: failed to expire — continuing with the rest'
                    );
                }
            }

            logger.info('preapproval-less-expiry: tick complete', {
                candidates: candidates.length,
                expired,
                errors,
                durationMs: Date.now() - startMs
            });

            return {
                success: errors === 0,
                message: `Expired ${expired} preapproval-less subscription(s)${
                    errors > 0 ? `, ${errors} error(s)` : ''
                }`,
                processed: expired,
                errors,
                durationMs: Date.now() - startMs
            };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger.error('preapproval-less-expiry: fatal error', { error: message });
            return {
                success: false,
                message: `Fatal error: ${message}`,
                processed: 0,
                errors: 1,
                durationMs: Date.now() - startMs
            };
        }
    }
};
