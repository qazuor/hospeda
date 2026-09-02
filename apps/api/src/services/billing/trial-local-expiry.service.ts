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
    accommodations,
    and,
    billingSubscriptionEvents,
    billingSubscriptions,
    type DrizzleClient,
    eq,
    getDb,
    isNull
} from '@repo/db';
import { LifecycleStatusEnum, SubscriptionStatusEnum } from '@repo/schemas';
import {
    AccommodationService,
    BILLING_EVENT_TYPES,
    checkSubscriptionStatusTransition,
    withServiceTransaction
} from '@repo/service-core';
import { clearEntitlementCache } from '../../middlewares/entitlement.js';
import { createSystemActor } from '../../utils/actor.js';
import { apiLogger } from '../../utils/logger.js';
import { resolveOwnerUserId } from '../subscription-pause.service.js';

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
    | 'illegal-transition'
    /**
     * A listing refused to come down, so the expiry was NOT sealed. Nothing is
     * written: the next tick retries rather than leaving a live listing behind
     * a dedup event that stops anyone from ever looking again.
     */
    | 'unpublish-failed';

/**
 * Result of {@link expireLocalTrial}.
 */
export interface LocalTrialExpiryResult {
    readonly outcome: LocalTrialExpiryOutcome;
}

/**
 * Unpublish every ACTIVE accommodation owned by the customer whose trial just
 * expired (HOS-1012 D-3, T-011).
 *
 * The listing leaves the site; the data stays. Photos, texts and prices remain
 * in the panel and come back online the moment the owner pays. This is
 * deliberately NOT `applyOwnerServiceSuspension` (`subscription-pause.service`),
 * which flips `owner_suspended` and takes the edit-lock with it — that is the
 * degraded mode D-3 explicitly rules out.
 *
 * Goes through `AccommodationService.unpublish` rather than a bulk UPDATE, for
 * one reason that matters more than brevity: that method already schedules ISR
 * revalidation for the page it just took down. A second write path to the same
 * state would drift from it, and the first thing to drift would be the
 * revalidation — leaving Cloudflare serving a listing that no longer exists
 * (T-3). It also filters to ACTIVE, so re-running after a partial failure skips
 * what already came down instead of erroring on it.
 *
 * The system actor is required, not incidental: `checkCanUpdate` refuses an
 * edit on a suspended owner unless the actor holds `ACCOMMODATION_UPDATE_ANY`,
 * so a lesser actor would be blocked by a billing guard from performing a
 * billing action.
 *
 * @param input.customerId - The billing customer whose trial expired.
 * @param input.db - Drizzle client override for tests.
 * @returns How many listings came down, and how many refused to.
 */
export async function unpublishListingsForExpiredTrial(input: {
    readonly customerId: string;
    readonly db?: DrizzleClient;
}): Promise<{ readonly unpublished: number; readonly failed: number }> {
    const db = input.db ?? getDb();

    const ownerId = await resolveOwnerUserId({ customerId: input.customerId, db });
    if (!ownerId) {
        apiLogger.warn(
            { customerId: input.customerId },
            'unpublishListingsForExpiredTrial: customer has no external id — cannot resolve owner'
        );
        return { unpublished: 0, failed: 0 };
    }

    const rows = await db
        .select({ id: accommodations.id })
        .from(accommodations)
        .where(
            and(
                eq(accommodations.ownerId, ownerId),
                eq(accommodations.lifecycleState, LifecycleStatusEnum.ACTIVE),
                isNull(accommodations.deletedAt)
            )
        );

    if (rows.length === 0) {
        return { unpublished: 0, failed: 0 };
    }

    const service = new AccommodationService({ logger: apiLogger });
    const actor = createSystemActor();

    let unpublished = 0;
    let failed = 0;

    for (const row of rows) {
        const result = await service.unpublish(actor, row.id);

        if (result.error) {
            failed++;
            apiLogger.error(
                {
                    accommodationId: row.id,
                    ownerId,
                    customerId: input.customerId,
                    error: result.error.message
                },
                'HOS-1012: failed to unpublish a listing on trial expiry'
            );
            continue;
        }

        unpublished++;
    }

    apiLogger.info(
        { customerId: input.customerId, ownerId, unpublished, failed },
        'HOS-1012: unpublished listings for an expired trial'
    );

    return { unpublished, failed };
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

    // D-3: the listing comes down BEFORE the dedup event is written. Ordering it
    // the other way would seal the expiry first, so a listing that failed to
    // unpublish would stay live forever — the next tick would find the event and
    // skip the row without ever looking at the listing again. This way a partial
    // failure simply gets retried, and `unpublish` is filtered to ACTIVE rows so
    // the retry skips whatever already came down.
    const { unpublished, failed } = await unpublishListingsForExpiredTrial({
        customerId: subscription.customerId,
        db
    });

    if (failed > 0) {
        apiLogger.warn(
            { subscriptionId: subscription.id, unpublished, failed },
            'expireLocalTrial: a listing refused to unpublish — not sealing the expiry, will retry'
        );
        return { outcome: 'unpublish-failed' };
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
                expiredAt: now.toISOString(),
                listingsUnpublished: unpublished
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
