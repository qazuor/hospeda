/**
 * The reconciler for the three LISTING verticals (HOS-1084). NOT the only
 * reconciler — see the partner caveat below.
 *
 * Before this module there was one bridge from the billing lifecycle to the
 * rest of the platform — `reconcileCommerceListingForSubscription` — and it
 * knew only about commerce. Accommodation had no bridge at all, which is why
 * its public reads had to resolve entitlements live against QZPay on every cold
 * render.
 *
 * The owner's decision for HOS-1084 was explicit: **one table for the three
 * verticals, one reconciler**. This is that reconciler, and its scope is
 * exactly those three: accommodation, gastronomy, experience.
 *
 * ## Partners are NOT one of them (HOS-1306)
 *
 * This docblock used to open with "The ONE reconciler every billing-lifecycle
 * site calls" and close that paragraph with "Every site that moves a
 * subscription's status is meant to call it and nothing else". Both halves were
 * false, and the root `CLAUDE.md` repeated them, so an audit asking "who
 * reconciles domain X?" skipped the partner vertical entirely.
 *
 * Partners live in `partner_subscriptions`, not `entity_subscriptions`, and are
 * reconciled by `reconcilePartnerForSubscription`
 * (`services/partner-reconcile.service.ts`) — a SECOND, independent bridge this
 * module never calls and which never calls this one. A site that moves the
 * status of a subscription a partner can hold must call BOTH.
 *
 * The pair is pinned by `test/services/subscription-linked-entities-bridge.guard.test.ts`,
 * which since HOS-1306 requires every file calling this reconciler to either
 * also call the partner one or appear on an explicit, reasoned exclusion list.
 * Do not add a new call site here without settling which of the two it is.
 *
 * HOS-1280: an earlier version of this docblock enumerated "six call sites"
 * by name. That list rotted the moment a seventh one was added and nobody
 * came back to update the comment — by the time HOS-1280 measured it there
 * were 9 production call sites across 8 files, and 3 more state-changing
 * sites (admin hard-cancel, both pause/resume surfaces, and the comp-grant
 * supersede loop) had never called it at all. A hardcoded list in a comment
 * is exactly the kind of "evidence" `~/.claude/CLAUDE.md`'s guidance warns
 * against trusting: it describes an intent, not a fact anyone re-verifies.
 *
 * Do NOT re-add an enumerated list here. To find the CURRENT call sites,
 * grep the codebase:
 *
 *   rg 'reconcileSubscriptionLinkedEntities\(' apps/api/src
 *
 * and cross-check against
 * `test/services/subscription-linked-entities-bridge.guard.test.ts` (HOS-1280),
 * which pins the exact call-expression count per file and fails if a new file
 * starts calling this reconciler without updating the table, or if a pinned
 * file's count drops. That guard does NOT yet audit every possible
 * `billing_subscriptions.status` write site the way
 * `inv1-cache-invalidation.guard.test.ts` does for `clearEntitlementCache` —
 * see the guard's own header for why that fuller audit is left as a named
 * follow-up rather than a rushed one.
 *
 * Both halves are non-throwing by their own contract, and they are deliberately
 * INDEPENDENT: a commerce reconcile that fails must not skip the accommodation
 * cache refresh, and vice versa. Neither may break a webhook or a cron.
 *
 * @module services/subscription-linked-entities.service
 */

import { reconcileCommerceListingForSubscription } from './commerce-reconcile.service.js';
import { syncAccommodationSubscriptionCacheForSubscription } from './entity-subscription-cache.service.js';

/**
 * Propagate a subscription's new status to everything that depends on it.
 *
 * Two independent effects:
 *
 * 1. **Commerce** — update the listing link rows and flip each linked
 *    listing's visibility. A no-op for a subscription with no commerce links.
 *
 *    HOS-1160: this used to read "active/trialing → PUBLIC, everything else →
 *    PRIVATE", which was never what the code does.
 *    `reconcileCommerceListingForSubscription` gates on
 *    `isPublishingSubscriptionStatus`, which delegates to the canonical
 *    `isEntitlementGrantingStatus` — `active`, `trialing`, **`comp`** and
 *    **`courtesy`**. Read literally, the old sentence claims a complimentary
 *    commerce listing goes dark; it sent this issue's own measurement looking
 *    for a bug that is not there.
 * 2. **Accommodation** — refresh the `entity_subscriptions` cache rows of the
 *    subscription's owner, so the public reads see the new status without
 *    walking QZPay. A no-op for an owner with no accommodations.
 *
 * The accommodation half deliberately ignores `subscriptionStatus` and
 * re-derives the owner's current subscription from the database instead. A
 * webhook that arrives late for a subscription the owner has already replaced
 * would otherwise stamp a dead status over the live one.
 *
 * @param input.subscriptionId - The billing subscription whose status changed.
 * @param input.subscriptionStatus - The new status (e.g. `'active'`,
 *   `'cancelled'`, `'past_due'`), used by the commerce half.
 * @param input.source - Caller label for log diagnostics (e.g. `'mp-webhook'`).
 */
export async function reconcileSubscriptionLinkedEntities(input: {
    subscriptionId: string;
    subscriptionStatus: string;
    source: string;
}): Promise<void> {
    const { subscriptionId, subscriptionStatus, source } = input;

    await reconcileCommerceListingForSubscription({
        subscriptionId,
        subscriptionStatus,
        source
    });

    await syncAccommodationSubscriptionCacheForSubscription({ subscriptionId, source });
}
