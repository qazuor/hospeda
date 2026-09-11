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
 * intact and editable in the panel, coming back online when they pay. The
 * comeback is real since HOS-1181, not aspirational: the unpublish below stamps
 * `billingUnpublishedAt`, and the win-back republish driven from the billing
 * reconciler republishes exactly those rows once the owner's subscription is
 * entitlement-granting again.
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
    inArray,
    isNull
} from '@repo/db';
import { LifecycleStatusEnum, SubscriptionStatusEnum } from '@repo/schemas';
import {
    AccommodationService,
    BILLING_EVENT_TYPES,
    checkSubscriptionStatusTransition,
    isAccommodationSubscription,
    withServiceTransaction
} from '@repo/service-core';
import { clearEntitlementCache } from '../../middlewares/entitlement.js';
import { createSystemActor } from '../../utils/actor.js';
import { apiLogger } from '../../utils/logger.js';
import { reconcileSubscriptionLinkedEntities } from '../subscription-linked-entities.service.js';
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
    /**
     * A `TRIAL_SUPERSEDED_BY_PAID` event exists — the owner PAID and the
     * activation's own transaction already ended this trial
     * (`trial-supersede-on-activation.ts`). Expiring it now would unpublish
     * the whole portfolio of a host who just converted (HOS-1335 B2), and the
     * seal would overwrite the superseded status.
     */
    | 'superseded'
    /**
     * The LIVE row's status is no longer `trialing` — some other lifecycle
     * path took the row between the cron's claim and this attempt. The claimed
     * snapshot is stale by construction; this re-read is the only status this
     * function may act on (HOS-1335 B2).
     */
    | 'row-moved-on'
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
 * in the panel and come back online when the owner pays (HOS-1181: every
 * unpublish here stamps `billingUnpublishedAt`, which the win-back republish
 * driven from `reconcileSubscriptionLinkedEntities` acts on once the owner's
 * subscription is entitlement-granting again). This is
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
    readonly subscriptionId: string;
    readonly customerId: string;
    readonly db?: DrizzleClient;
}): Promise<{ readonly unpublished: number; readonly failed: number }> {
    const db = input.db ?? getDb();

    // ── Which vertical's listings are we taking down? (HOS-1184) ────────────
    //
    // This function used to walk `accommodations` unconditionally, which was
    // correct while accommodation was the only vertical that could hold a local
    // trial. Commerce can now hold one too, and the same customer legitimately
    // owns a cabin AND a restaurant — so an unconditional walk would expire the
    // gastronomy trial by unpublishing the accommodation listings, taking down a
    // listing the owner still pays for and leaving the restaurant public.
    //
    // The domain is re-read from the subscription row rather than taken from the
    // caller, and that is deliberate rather than defensive noise:
    // `isAccommodationSubscription` fails OPEN — a row whose `productDomain` is
    // absent from the SELECT reads as accommodation. That default is right for
    // legacy rows and catastrophic for a commerce row the caller forgot to
    // project, because the failure is silent and lands on the WRONG vertical's
    // listings. Reading it here means no caller can produce that shape.
    const [subscriptionRow] = await db
        .select({ productDomain: billingSubscriptions.productDomain })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.id, input.subscriptionId))
        .limit(1);

    if (!isAccommodationSubscription(subscriptionRow)) {
        // Nothing reaching this branch owns listings THIS function can unpublish,
        // for two different reasons (HOS-1233 widened it from one):
        //
        // - Commerce verticals do have listings, but their visibility is
        //   DERIVED. `reconcileCommerceListingVisibility` gates on
        //   `isEntitlementGrantingStatus`, so once the status is `expired` the
        //   listing resolves to PRIVATE/INACTIVE on its own — through the single
        //   authorised bridge, never a second write path to the same state.
        // - A TOURIST subscription owns no listings at all. Since the tourist
        //   tiers were reclassified out of `accommodation` (F-4b) they land here
        //   rather than in the accommodation branch, where they would have
        //   walked a portfolio that is always empty. Either way this is a no-op
        //   for them; the bridge call below is harmless and keeps the branch
        //   free of a domain-by-domain special case.
        //
        // A PARTNER row would also land in this branch — the predicate is
        // `!isAccommodationSubscription`, not a commerce/tourist allowlist — and
        // the bridge below does nothing for it, since partners live in
        // `partner_subscriptions`. That is not a gap: a partner subscription can
        // never be `trialing`, so it cannot reach this function at all (all
        // three partner plans are trialDays: 0, and `createTrialSubscription`'s
        // only two call sites are accommodation and commerce). HOS-1306 measured
        // it and recorded the evidence in `BRIDGE_ONLY_SITES` in
        // `test/services/subscription-linked-entities-bridge.guard.test.ts`,
        // which fails if this file is neither wired for partners nor listed
        // there. If partner ever gains a trial, that guard entry is the thing to
        // revisit before this comment.
        //
        // The status is passed explicitly because this runs BEFORE the row is
        // flipped (D-3's ordering, preserved). The bridge is non-throwing by
        // contract, so unlike the accommodation branch there is no failure to
        // report back: `failed: 0` here means "nothing to report", not "verified
        // down". The 6-hourly `entity-subscription-cache-reconcile` cron is what
        // actually backstops a silent miss.
        await reconcileSubscriptionLinkedEntities({
            subscriptionId: input.subscriptionId,
            subscriptionStatus: SubscriptionStatusEnum.EXPIRED,
            source: 'trial-local-expiry-cron'
        });

        apiLogger.info(
            {
                subscriptionId: input.subscriptionId,
                customerId: input.customerId,
                productDomain: subscriptionRow?.productDomain
            },
            'HOS-1184: commerce trial expired — listing visibility handed to the reconciler'
        );

        return { unpublished: 0, failed: 0 };
    }

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
        // HOS-1181: `billingUnpublish: true` stamps the marker that the win-back
        // republish (driven from `reconcileSubscriptionLinkedEntities`) later
        // uses to bring BACK exactly the rows this loop took down — and only
        // those. An owner-initiated unpublish from the panel never passes it,
        // which is what keeps a deliberately-paused listing from being
        // republished just because its owner paid for another one.
        const result = await service.unpublish(actor, row.id, undefined, {
            billingUnpublish: true
        });

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
    // already expired this row — or the owner may have PAID and the activation
    // superseded it. The supersede writes `TRIAL_SUPERSEDED_BY_PAID`, not
    // `TRIAL_EXPIRED`, so a dedup that only knows the latter sails straight past
    // a superseded trial and unpublishes the portfolio of a host who just
    // converted (HOS-1335 B2) — measured shape: cron claims 02:00:00, webhook
    // supersedes 02:00:05, cron processes 02:00:20.
    const existing = await db
        .select({
            id: billingSubscriptionEvents.id,
            eventType: billingSubscriptionEvents.eventType
        })
        .from(billingSubscriptionEvents)
        .where(
            and(
                eq(billingSubscriptionEvents.subscriptionId, subscription.id),
                inArray(billingSubscriptionEvents.eventType, [
                    BILLING_EVENT_TYPES.TRIAL_EXPIRED,
                    BILLING_EVENT_TYPES.TRIAL_SUPERSEDED_BY_PAID
                ])
            )
        )
        .limit(1);

    if (existing.length > 0) {
        const alreadySuperseded =
            existing[0]?.eventType === BILLING_EVENT_TYPES.TRIAL_SUPERSEDED_BY_PAID;
        apiLogger.debug(
            { subscriptionId: subscription.id, eventType: existing[0]?.eventType },
            alreadySuperseded
                ? 'expireLocalTrial: trial was superseded by a payment — skipping (the owner converted)'
                : 'expireLocalTrial: TRIAL_EXPIRED event already exists, skipping (idempotent)'
        );
        return { outcome: alreadySuperseded ? 'superseded' : 'already-expired' };
    }

    // The LIVE status is the only status this function may act on. The claimed
    // snapshot can be up to a whole claim-process window old, and the
    // transition guard below reads `subscription.status` — stale by
    // construction. Re-reading here closes the window the event dedup cannot:
    // every non-trialing live status (a supersede, a hard-cancel, anything)
    // means another lifecycle path owns this row now, and none of them leaves
    // the listings up to THIS function to take down (HOS-1335 B2).
    const [liveRow] = await db
        .select({ status: billingSubscriptions.status })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.id, subscription.id))
        .limit(1);

    if (!liveRow || liveRow.status !== SubscriptionStatusEnum.TRIALING) {
        apiLogger.info(
            {
                subscriptionId: subscription.id,
                claimedStatus: subscription.status,
                liveStatus: liveRow?.status ?? 'row-gone'
            },
            'expireLocalTrial: the live row moved on from trialing since the claim — skipping (HOS-1335)'
        );
        return { outcome: 'row-moved-on' };
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
        subscriptionId: subscription.id,
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

    let sealed = false;
    await withServiceTransaction(async (ctx) => {
        // biome-ignore lint/style/noNonNullAssertion: tx is always defined inside withServiceTransaction
        const tx = ctx.tx!;

        // HOS-1335 B2 — the seal is a COMPARE-AND-SWAP, not a blind write. The
        // live-status check above ran before the unpublish loop, and that loop
        // can take seconds for a whole portfolio; a payment confirming in that
        // window supersedes this row inside the activation's own transaction.
        // Overwriting `superseded` with `expired` here would corrupt the row
        // the owner is now paying on, so the update only lands while the row is
        // still `trialing` — and a supersede that got there first wins the race
        // by construction.
        const sealedRows = await tx
            .update(billingSubscriptions)
            .set({
                status: SubscriptionStatusEnum.EXPIRED,
                // `trial_converted` records HOW the trial ended. This one ended
                // without converting — that is the whole reason the win-back
                // series exists.
                trialConverted: false,
                trialConvertedAt: now
            })
            .where(
                and(
                    eq(billingSubscriptions.id, subscription.id),
                    eq(billingSubscriptions.status, SubscriptionStatusEnum.TRIALING)
                )
            )
            .returning({ id: billingSubscriptions.id });

        if (sealedRows.length === 0) {
            apiLogger.warn(
                { subscriptionId: subscription.id },
                'expireLocalTrial: the row moved on between the live check and the seal — not sealing, not writing the expiry event (HOS-1335)'
            );
            return;
        }

        sealed = true;

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

    if (!sealed) {
        // The listings already came down — D-3's ordering makes that
        // irreversible. What is NOT done is the seal: the row stays owned by
        // whichever transition won the race, and the reconcile bridge on that
        // transition re-publishes for it.
        return { outcome: 'row-moved-on' };
    }

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
