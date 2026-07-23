/**
 * @file listing-card-state.ts
 * @description Pure state-machine resolver for a single commerce listing
 * card on `/mi-cuenta/comercio/` (HOS-166 §8 point 6).
 *
 * The spec names five card states: `DRAFT — incomplete`, `DRAFT — complete,
 * not published`, `PENDING PAYMENT`, `PUBLISHED`, `SUSPENDED`. This module
 * defines the discriminated union and resolves it from whatever data is
 * ACTUALLY available today — see the per-state doc below for what is real
 * and what is a documented gap.
 *
 * @module lib/commerce/listing-card-state
 */

import type { SubscriptionStatusEnum } from '@repo/schemas';

/** Discriminated union of every card state the UI can render. */
export type CommerceListingCardState =
    | { readonly kind: 'published' }
    | { readonly kind: 'draft-incomplete'; readonly missing: readonly string[] }
    | { readonly kind: 'draft-complete' }
    | { readonly kind: 'pending-payment' }
    /**
     * Payment lapsed (dunning) and the listing was pulled from public view.
     * Reachable from {@link resolveCommerceListingCardState} via the
     * `subscriptionStatus === 'past_due'` signal (HOS-166 judgment-day W1 —
     * see that param's doc).
     */
    | { readonly kind: 'suspended' }
    /**
     * The listing's completeness could not be determined (the per-listing
     * detail fetch failed). Degrades to a safe "go check it" state rather
     * than guessing complete or incomplete.
     */
    | { readonly kind: 'unknown' };

/**
 * Resolves a listing's card state from the data the `mi-cuenta/comercio`
 * index page can actually obtain today (HOS-166 PR-C, extended judgment-day
 * W1):
 *
 * - `published` — from `CommerceOwnerListingSummary.isPublic` (reconciler-driven,
 *   real and reliable). Takes priority over every other signal: the
 *   visibility reconciler is the single source of truth for whether the
 *   ficha is actually live.
 * - `suspended` — from `CommerceOwnerListingSummary.subscriptionStatus ===
 *   'past_due'` (HOS-166 judgment-day W1). The visibility reconciler's
 *   `ACTIVE_STATUSES` set (`active` | `trialing`) does NOT include
 *   `past_due`, so a `past_due` listing is already `isPublic: false` by the
 *   time this resolves — this check exists for the (rare, reconciliation-lag)
 *   window where the subscription flipped but the reconciler has not run
 *   yet, so the owner sees "Suspendido" rather than a misleading draft state.
 * - `draft-incomplete` / `draft-complete` — from the completeness preview
 *   computed against the listing's own protected detail (see
 *   `fetchOwnerCommerceListingsWithState`), via the SAME canonical
 *   `resolveListingCompleteness` (`@repo/schemas`) the checkout route and
 *   visibility reconciler use (HOS-166 judgment-day R-5 — no separate web
 *   mirror).
 * - `pending-payment` — real only for the narrow window the owner is
 *   ACTIVELY on this page after clicking "Publicar y pagar" (the button
 *   flips its own local `isCheckoutStarting` state — see
 *   `CommerceListingActions.client.tsx`). It does NOT survive a page reload,
 *   a different tab, or a later visit — `subscriptionStatus` can be
 *   `pending_provider` in that same window, but treating that as a durable
 *   "pending" badge was judged out of scope for this fix (a real
 *   cross-visit "checkout started, webhook/poll pending" badge is a
 *   follow-up, not built here).
 *
 * @param params.isPublic - From the listing summary.
 * @param params.completeness - The completeness preview, or `null` when the
 *   listing is public (not computed) or its detail fetch failed.
 * @param params.subscriptionStatus - The listing's current commerce
 *   subscription status (`CommerceOwnerListingSummary.subscriptionStatus`),
 *   or `null`/`undefined` when it has never had one. Only `past_due` is
 *   currently distinguished (drives `suspended`); every other value is left
 *   to `isPublic`/`completeness` to describe honestly — a `paused` /
 *   `cancelled` / `expired` subscription is never `isPublic` (the
 *   reconciler's `ACTIVE_STATUSES` excludes them too), so it already renders
 *   as a draft state rather than `published`.
 * @param params.isCheckoutStarting - Whether a checkout call is in flight
 *   for THIS listing right now (client-only, optimistic local state).
 */
export function resolveCommerceListingCardState({
    isPublic,
    completeness,
    subscriptionStatus = null,
    isCheckoutStarting = false
}: {
    readonly isPublic: boolean;
    readonly completeness: {
        readonly complete: boolean;
        readonly missing: readonly string[];
    } | null;
    readonly subscriptionStatus?: SubscriptionStatusEnum | null;
    readonly isCheckoutStarting?: boolean;
}): CommerceListingCardState {
    if (isPublic) {
        return { kind: 'published' };
    }

    if (subscriptionStatus === 'past_due') {
        return { kind: 'suspended' };
    }

    if (isCheckoutStarting) {
        return { kind: 'pending-payment' };
    }

    if (completeness === null) {
        return { kind: 'unknown' };
    }

    if (!completeness.complete) {
        return { kind: 'draft-incomplete', missing: completeness.missing };
    }

    return { kind: 'draft-complete' };
}
