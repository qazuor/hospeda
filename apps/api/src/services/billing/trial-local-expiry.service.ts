/**
 * Local trial expiry (HOS-1012 T-010).
 *
 * Expires a Hospeda-owned trial — one with `mp_subscription_id = NULL` — when
 * its `trial_end` has passed. There is no provider to ask: our clock is the
 * only clock, which is the entire point of HOS-956.
 *
 * This is deliberately NOT `reconcileExpiredTrials`, and not a rename of it.
 * That function mirrors a provider's verdict, and does the opposite thing: it
 * re-reads the preapproval and converts, hands to dunning, or mirrors a
 * cancellation. Both run from the same claim in the same job, split on whether
 * the row carries a provider id — see `TrialService.reconcileExpiredTrials`.
 *
 * It is also NOT a restoration of `blockExpiredTrials`, which HOS-171 deleted.
 * That function CUT OFF access. D-3 does the opposite: the listing leaves the
 * site (T-011) and everything the owner loaded — photos, texts, prices — stays
 * intact and editable in the panel, coming back online the moment they pay.
 * Only the two constants kept the old name (`BLOCK_EXPIRED_TRIALS_LOCK_KEY`,
 * `BLOCK_EXPIRED_TRIALS_BATCH_SIZE`) and those are reused as-is.
 *
 * @module services/billing/trial-local-expiry.service
 */

import {
    and,
    billingSubscriptionEvents,
    billingSubscriptions,
    type DrizzleClient,
    eq,
    getDb
} from '@repo/db';
import { SubscriptionStatusEnum } from '@repo/schemas';
import {
    BILLING_EVENT_TYPES,
    checkSubscriptionStatusTransition,
    withServiceTransaction
} from '@repo/service-core';
import { clearEntitlementCache } from '../../middlewares/entitlement.js';
import { apiLogger } from '../../utils/logger.js';

/**
 * The subset of a `billing_subscriptions` row this expiry needs. Narrowed to
 * what is actually read, so a caller can pass a full row without this module
 * depending on the whole shape.
 */
export interface ExpirableTrial {
    readonly id: string;
    readonly customerId: string;
    readonly status: string;
    readonly trialEnd: Date | null;
    readonly mpSubscriptionId: string | null;
}

/**
 * Why an expiry attempt did not change anything.
 *
 * Every outcome is reported rather than silently skipped, because a job that
 * counts only successes cannot distinguish "nothing to do" from "everything
 * refused to run".
 */
export type LocalTrialExpiryOutcome =
    /** Status moved to `expired` and the dedup event was written. */
    | 'expired'
    /** A `TRIAL_EXPIRED` event already exists — a previous run got there first. */
    | 'already-expired'
    /** The row acquired a provider id since it was claimed; it is not ours to expire. */
    | 'has-provider-id'
    /** `trial_end` is absent or still in the future. */
    | 'not-elapsed'
    /** The status transition guard refused the write (the claimed row was stale). */
    | 'illegal-transition';

/**
 * Result of {@link expireLocalTrial}.
 */
export interface LocalTrialExpiryResult {
    readonly outcome: LocalTrialExpiryOutcome;
}

/**
 * Expire one Hospeda-owned trial whose window has elapsed.
 *
 * Re-validates everything the claim query already filtered on. That is not
 * redundancy: the claim commits before the per-row processing starts, so by the
 * time this runs the row may have been converted by a checkout, linked to a
 * preapproval, or already expired by a concurrent run. The guards here are what
 * make the job safe to re-run at any moment.
 *
 * The status write and its dedup event land in ONE transaction. A status write
 * without its event would let the next tick expire the same trial again and
 * send a second round of emails.
 *
 * @param input.subscription - The claimed row.
 * @param input.now - Clock injection for deterministic tests.
 * @param input.db - Drizzle client override for tests.
 * @returns Which outcome this row reached — see {@link LocalTrialExpiryOutcome}.
 */
export async function expireLocalTrial(input: {
    readonly subscription: ExpirableTrial;
    readonly now?: Date;
    readonly db?: DrizzleClient;
}): Promise<LocalTrialExpiryResult> {
    const { subscription } = input;
    const now = input.now ?? new Date();
    const db = input.db ?? getDb();

    // A row that carries a provider id is not ours to expire on our own clock:
    // MercadoPago decides when that one ends, and guessing here means either
    // cutting off a paying customer or granting a free one.
    if (subscription.mpSubscriptionId) {
        return { outcome: 'has-provider-id' };
    }

    if (!subscription.trialEnd || subscription.trialEnd > now) {
        return { outcome: 'not-elapsed' };
    }

    // Bound once: the narrowing above does not survive into the transaction
    // closure below.
    const trialEnd = subscription.trialEnd;

    // Dedup guard. Between the claim commit and now, a concurrent run may have
    // already expired this row.
    const existing = await db
        .select({ id: billingSubscriptionEvents.id })
        .from(billingSubscriptionEvents)
        .where(
            and(
                eq(billingSubscriptionEvents.subscriptionId, subscription.id),
                eq(billingSubscriptionEvents.eventType, BILLING_EVENT_TYPES.TRIAL_EXPIRED)
            )
        )
        .limit(1);

    if (existing.length > 0) {
        apiLogger.debug(
            { subscriptionId: subscription.id },
            'expireLocalTrial: TRIAL_EXPIRED event already exists, skipping (idempotent)'
        );
        return { outcome: 'already-expired' };
    }

    // The claimed row may be stale. `trialing -> expired` is the documented
    // "direct status expiry without a provider cancel" edge; anything else means
    // the row moved on and must not be overwritten.
    const transitionGuard = checkSubscriptionStatusTransition({
        from: subscription.status as `${SubscriptionStatusEnum}`,
        to: SubscriptionStatusEnum.EXPIRED,
        subscriptionId: subscription.id
    });

    if (!transitionGuard.valid) {
        apiLogger.warn(
            {
                subscriptionId: subscription.id,
                currentStatus: subscription.status,
                reason: transitionGuard.reason
            },
            'expireLocalTrial: illegal status transition — skipping write'
        );
        return { outcome: 'illegal-transition' };
    }

    await withServiceTransaction(async (ctx) => {
        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
        const tx = ctx.tx!;

        await tx
            .update(billingSubscriptions)
            .set({
                status: SubscriptionStatusEnum.EXPIRED,
                // `trial_converted` records HOW the trial ended. This one ended
                // without converting — that is the whole reason the win-back
                // series exists.
                trialConverted: false,
                trialConvertedAt: now
            })
            .where(eq(billingSubscriptions.id, subscription.id));

        await tx.insert(billingSubscriptionEvents).values({
            subscriptionId: subscription.id,
            eventType: BILLING_EVENT_TYPES.TRIAL_EXPIRED,
            previousStatus: subscription.status,
            newStatus: SubscriptionStatusEnum.EXPIRED,
            triggerSource: 'trial-local-expiry-cron',
            metadata: {
                trialEnd: trialEnd.toISOString(),
                expiredAt: now.toISOString()
            }
        });
    });

    // `expired` is not in ENTITLEMENT_GRANTING_STATUSES, so the owner loses the
    // plan's entitlements right here. A local expiry has no webhook behind it,
    // so nothing else would ever drop the 5-minute cache (INV-1).
    clearEntitlementCache(subscription.customerId);

    apiLogger.info(
        {
            subscriptionId: subscription.id,
            customerId: subscription.customerId,
            trialEnd: trialEnd.toISOString()
        },
        'HOS-1012: Hospeda-owned trial expired locally'
    );

    return { outcome: 'expired' };
}
