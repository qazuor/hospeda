/**
 * Win-back republish (HOS-1181).
 *
 * When an accommodation trial expires, the `trial-expiry` cron unpublishes the
 * owner's ACTIVE listings and stamps `billingUnpublishedAt` on each one
 * (`trial-local-expiry.service.ts`). Until HOS-1181 that was the whole story:
 * the owner who paid DAYS later got an active subscription and a listing that
 * stayed INACTIVE forever — the down path was automatic and the up path was a
 * button in the panel nobody had told them about. Two win-back emails promise
 * the up path is automatic ("vuelve online en cuanto elijas un plan",
 * `trial-win-back-30d.tsx`; "no hace falta que avises antes ni que nos escribas
 * para reactivarla", `trial-win-back-60d.tsx`), so this module is what makes
 * the promise true rather than editing the copy to stop making it.
 *
 * Driven ONLY from `reconcileSubscriptionLinkedEntities` — the single bridge
 * every billing-lifecycle site already calls (webhook, dunning, pause/resume,
 * comp grant, admin hooks) — so a payment confirms, the next reconcile
 * republishes, and no state-changing site has to remember a new call.
 *
 * ## Which listings come back, and which never do
 *
 * The marker is the entire selection. It is set ONLY by a billing-initiated
 * unpublish (the owner's own unpublish never sets it), and cleared by ANY
 * publish in the same write that flips `lifecycleState` to ACTIVE. So:
 *
 * - `INACTIVE` + marker → billing took it down and nothing has brought it
 *   back. A republish candidate.
 * - `INACTIVE` without marker → the owner paused it on purpose. NEVER
 *   republished, no matter how many times they pay.
 * - `DRAFT` → never had a marker (`unpublish()` only accepts ACTIVE rows, and
 *   the expiry cron only selects ACTIVE), so a draft the owner was deliberately
 *   keeping back can never appear online because they paid. A draft that
 *   somehow carries a stale marker is treated as deliberately withdrawn: the
 *   marker is CLEARED, the row is not published.
 * - Any non-INACTIVE row with a marker → stale by definition (the marker's
 *   own invariant says a marker only belongs on a row billing took down and
 *   nobody has re-published). Cleared in one bulk write, never published.
 *
 * ## The gate is the RE-DERIVED subscription, not the status handed in
 *
 * Like the accommodation cache half, this module ignores the `subscriptionStatus`
 * the reconciler was called with and re-derives the owner's CURRENT
 * accommodation subscription from the database
 * (`deriveOwnerAccommodationSubscription`, the same single derivation the cache
 * write-through uses). A late webhook for a superseded subscription can no more
 * republish (or skip) than it could stamp the cache. And because the gate asks
 * "is the owner entitled NOW?", the win-back does not depend on THIS event
 * having arrived — any later lifecycle event that walks the bridge with a
 * granting subscription republishes. That surface is NARROWER than it sounds,
 * and pin it before promising more: `subscription-poll` does not call the
 * bridge, no periodic cron handles active subscriptions (the 6-hourly cache
 * reconcile covers only the commerce half), and `subscription-drift-reconcile`
 * avoids the bridge on purpose — so a DROPPED activation webhook heals only at
 * this subscription's next bridge-carrying event (the next renewal webhook),
 * an admin reconcile through the bridge, or a manual publish.
 * `publish()` re-checks eligibility on its own, so the gate is a
 * cheap outer filter, not the authority — an owner who is somehow not eligible
 * never gets a listing flipped by this path.
 *
 * Non-throwing by contract: this runs from the MP webhook and the billing crons,
 * none of which may break because a republish failed. A failed row keeps its
 * marker and is retried by the next reconcile.
 *
 * @module services/accommodation-winback-republish.service
 */

import { isEntitlementGrantingStatus } from '@repo/billing';
import { accommodations, and, eq, getDb, inArray, isNotNull, isNull } from '@repo/db';
import { LifecycleStatusEnum } from '@repo/schemas';
import { AccommodationService } from '@repo/service-core';
import { getQZPayBilling } from '../middlewares/billing.js';
import { createSystemActor } from '../utils/actor.js';
import { apiLogger } from '../utils/logger.js';
import { buildAccommodationPublishDeps } from './accommodation-publish-deps.js';
import {
    deriveOwnerAccommodationSubscription,
    resolveSubscriptionOwnerId
} from './entity-subscription-cache.service.js';

/**
 * Outcome of one win-back pass over an owner's marked listings.
 *
 * Counts, not booleans: a pass that republished three listings and failed one
 * is a different operational situation from a pass that failed all four, and
 * "pending" is what tells the on-call the owner paid but is not yet entitled
 * (or a listing is incomplete) without grepping logs.
 */
export interface WinBackRepublishResult {
    /** Rows flipped back to ACTIVE this pass. */
    readonly republished: number;
    /** Rows `publish()` refused (incomplete, eligibility, suspension). Their markers stay set for a retry. */
    readonly failed: number;
    /** Stale markers cleared from rows that are no longer INACTIVE (never republished). */
    readonly clearedStale: number;
    /** Candidates left pending: the owner's derived subscription is not entitlement-granting. */
    readonly pending: number;
}

/** The zero result — what every early-exit path reports. */
const EMPTY_RESULT: WinBackRepublishResult = {
    republished: 0,
    failed: 0,
    clearedStale: 0,
    pending: 0
} as const;

/**
 * Republish the listings billing took down, now that their owner pays again.
 *
 * Cheap in the overwhelmingly common case: an owner with no marked rows costs
 * one owner-resolution join and one indexed read. Only when markers exist does
 * the pass derive the owner's subscription (the same re-derivation the
 * accommodation cache uses) and run `publish()` per candidate.
 *
 * `publish()` — not a bare UPDATE — is the republish, on purpose: it enforces
 * publish completeness (a listing whose photos were removed while paused must
 * not come back as a broken public page), re-checks billing eligibility,
 * respects the PRIVATE→PUBLIC visibility promotion rule (never RESTRICTED),
 * and schedules the ISR revalidation that takes the page out of Cloudflare's
 * cache. A second write path to ACTIVE would drift from all four on the first
 * edit — the same reason the expiry path goes through `unpublish()`.
 *
 * @param input.subscriptionId - The billing subscription whose lifecycle event
 *   triggered the reconcile. Used only to resolve the owner; the triggering
 *   subscription's status is deliberately NOT consulted (see module docblock).
 * @param input.source - Caller label for log diagnostics (e.g. `'mp-webhook'`).
 * @returns The four counts of one pass. Never throws.
 */
export async function republishBillingUnpublishedAccommodations(input: {
    readonly subscriptionId: string;
    readonly source: string;
}): Promise<WinBackRepublishResult> {
    const { subscriptionId, source } = input;

    try {
        const ownerId = await resolveSubscriptionOwnerId(subscriptionId);
        if (!ownerId) {
            return EMPTY_RESULT;
        }

        const db = getDb();
        const markedRows = await db
            .select({ id: accommodations.id, lifecycleState: accommodations.lifecycleState })
            .from(accommodations)
            .where(
                and(
                    eq(accommodations.ownerId, ownerId),
                    isNotNull(accommodations.billingUnpublishedAt),
                    isNull(accommodations.deletedAt)
                )
            );

        if (markedRows.length === 0) {
            // The common case by far: nothing billing ever took down. Return
            // before deriving anything — this keeps the win-back cheap enough
            // to hang off EVERY reconcile, not just the payment path.
            return EMPTY_RESULT;
        }

        const candidates = markedRows.filter(
            (row) => row.lifecycleState === LifecycleStatusEnum.INACTIVE
        );
        const stale = markedRows.filter(
            (row) => row.lifecycleState !== LifecycleStatusEnum.INACTIVE
        );

        let clearedStale = 0;
        if (stale.length > 0) {
            // The marker's invariant is "billing took this row down and nothing
            // has re-published it". A marker on an ACTIVE, ARCHIVED or DRAFT row
            // can only be a leftover (a publish should have cleared it, a draft
            // was withdrawn on purpose). Clear it so the row can never be
            // republished by a later pass — publishing a deliberately
            // withdrawn listing because its owner paid is the worse bug this
            // whole mechanism exists to prevent.
            await db
                .update(accommodations)
                .set({ billingUnpublishedAt: null })
                .where(
                    inArray(
                        accommodations.id,
                        stale.map((row) => row.id)
                    )
                );
            clearedStale = stale.length;
            apiLogger.warn(
                { ownerId, rows: stale.map((row) => row.id), source },
                'HOS-1181: cleared stale billing-unpublish markers from rows no longer INACTIVE (not republished)'
            );
        }

        if (candidates.length === 0) {
            return { ...EMPTY_RESULT, clearedStale };
        }

        const derived = await deriveOwnerAccommodationSubscription(ownerId);
        if (!isEntitlementGrantingStatus(derived.status)) {
            // The owner has markers pending but no live accommodation
            // entitlement: they have not paid (yet), or the payment's webhook
            // has not landed. The markers stay; the next lifecycle reconcile
            // re-evaluates. This is the branch a commerce-only payment lands in
            // — the derivation is domain-scoped, so paying for the restaurant
            // does not republish the cabin.
            apiLogger.info(
                {
                    ownerId,
                    derivedStatus: derived.status,
                    candidates: candidates.length,
                    clearedStale,
                    source
                },
                'HOS-1181: win-back republish skipped — owner holds no entitlement-granting accommodation subscription'
            );
            return { ...EMPTY_RESULT, clearedStale, pending: candidates.length };
        }

        // `publish()` needs the billing deps (eligibility). Same lazy-getter
        // pattern as the protected publish route: at cron/webhook time the
        // billing client is already initialised, but the getter keeps module
        // load from racing it.
        const service = new AccommodationService(
            { logger: apiLogger },
            undefined,
            null,
            undefined,
            buildAccommodationPublishDeps(() => getQZPayBilling())
        );
        const actor = createSystemActor();

        let republished = 0;
        let failed = 0;
        for (const row of candidates) {
            const result = await service.publish(actor, row.id);
            if (result.error) {
                failed++;
                // Loud on purpose: this is a paying owner whose listing did not
                // come back. The marker stays so the next reconcile retries;
                // a silent skip here is the original bug wearing a cron.
                apiLogger.error(
                    {
                        accommodationId: row.id,
                        ownerId,
                        subscriptionId,
                        code: result.error.code,
                        message: result.error.message,
                        source
                    },
                    'HOS-1181: win-back republish REFUSED a billing-unpublished listing — marker kept, will retry on the next reconcile'
                );
                continue;
            }
            republished++;
        }

        if (republished > 0) {
            apiLogger.info(
                { ownerId, republished, failed, clearedStale, subscriptionId, source },
                'HOS-1181: win-back republish brought billing-unpublished listings back online'
            );
        }

        return { republished, failed, clearedStale, pending: 0 };
    } catch (error) {
        // Non-throwing by contract — see module docblock. Nothing is lost: the
        // markers are only cleared by successful publishes, so the next
        // reconcile re-runs the whole pass.
        apiLogger.error(
            {
                subscriptionId,
                source,
                error: error instanceof Error ? error.message : String(error)
            },
            'HOS-1181: win-back republish pass failed — skipping (non-blocking); markers are intact and the next reconcile retries'
        );
        return EMPTY_RESULT;
    }
}
