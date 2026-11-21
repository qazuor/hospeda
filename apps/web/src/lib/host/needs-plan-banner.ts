/**
 * @file needs-plan-banner.ts
 * @description Pure decision logic for the "anfitrión en preparación" banner
 * on the host property-listing page (HOS-217).
 *
 * A tourist who completes the accommodation mini-onboarding becomes a HOST
 * (role + "Área anfitrión" menu) immediately, but drafting/editing a
 * property is free — the owner plan is only required at PUBLISH time. That
 * leaves a window where a HOST can have draft properties they cannot yet
 * publish (no owner/complex-category subscription — a tourist plan, an
 * expired/no trial, or no subscription at all). This module centralises the
 * show/hide decision for the proactive banner that communicates that state,
 * so both the Astro page and unit tests share a single implementation
 * (mirrors the `usage-badge.ts` / `publish-precheck-panel-content.ts`
 * pattern already used in this directory).
 *
 * HOS-2425: the banner used to say "you need an active plan to publish" to
 * every owner without a live non-trial title, including one whose publish
 * starts the free trial (no card). It now reads the server's own publish
 * verdict (`PublishAffordance`) so it never contradicts `/publicar`.
 */

import type { PublishAffordance } from '@/lib/publish/subscribe-button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Inputs needed to decide what the "anfitrión en preparación" banner says on
 * the host property-listing page.
 */
export interface NeedsPlanBannerParams {
    /** Whether the owner has zero accommodations at all (empty state renders instead). */
    readonly isEmpty: boolean;
    /** Whether the SSR fetch for accommodations failed. */
    readonly fetchError: boolean;
    /** Whether the protected effective-set read succeeded. */
    readonly effectiveSetReadOk: boolean;
    /** Whether at least one of the owner's accommodations is a DRAFT. */
    readonly hasDraftProperty: boolean;
    /**
     * Whether the owner currently holds a real owner/complex-category
     * live non-trial title, resolved from the accommodation effective set.
     */
    readonly hasOwnerPlan: boolean;
    /**
     * What the server would do if this owner published, from
     * `subscribe-destination` (see `resolvePublishAffordance`).
     */
    readonly publishAffordance: PublishAffordance;
}

/** What the banner renders. */
export type NeedsPlanBannerView =
    | { readonly kind: 'hidden' }
    /** Publishing needs a plan: not covered and no trial would start. */
    | { readonly kind: 'needsPlan' }
    /** Publishing starts the owner's free trial (`trialDays` from the server). */
    | { readonly kind: 'trialAvailable'; readonly trialDays: number };

const HIDDEN: NeedsPlanBannerView = { kind: 'hidden' };

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

/**
 * Decides what the proactive "anfitrión en preparación" banner shows.
 *
 * - Nothing concrete to describe (empty, fetch error, unknown plan state, no
 *   DRAFT property) or a real owner plan: hidden.
 * - The server says publishing starts the trial: `trialAvailable`, with the
 *   server's own day count (never a hardcoded length).
 * - The server says checkout is required: `needsPlan`.
 * - Already covered (trial running or covered by a title), nothing to buy
 *   (`noPlans`), or an unresolved read (`unknown`, fails closed): hidden, so
 *   the banner never asserts a requirement the server did not state.
 *
 * @param params - See {@link NeedsPlanBannerParams}.
 * @returns The view to render.
 */
export function resolveNeedsPlanBannerView({
    isEmpty,
    fetchError,
    effectiveSetReadOk,
    hasDraftProperty,
    hasOwnerPlan,
    publishAffordance
}: NeedsPlanBannerParams): NeedsPlanBannerView {
    if (isEmpty || fetchError || !effectiveSetReadOk || !hasDraftProperty || hasOwnerPlan) {
        return HIDDEN;
    }
    switch (publishAffordance.kind) {
        case 'publish':
            return { kind: 'trialAvailable', trialDays: publishAffordance.trialDays };
        case 'checkout':
            return { kind: 'needsPlan' };
        default:
            return HIDDEN;
    }
}
