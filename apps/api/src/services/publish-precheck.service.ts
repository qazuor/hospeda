/**
 * The publish precheck, for any vertical (HOS-1156 T-009, D-7).
 *
 * Composes the three inputs the decision matrix needs — how many listings the
 * owner holds, whether their plan still has room, and how many drafts they left
 * behind — and hands them to `deriveOnboardingDecision`, which is already pure
 * and already vertical-agnostic (it takes `draftCount` and `hasQuota` and knows
 * nothing else). That function is NOT rewritten here.
 *
 * ---
 * ONE ROUTE, THREE VERTICALS — AND THE CAP THAT ALMOST BROKE IT
 *
 * The obvious way to read a commerce cap is to mount
 * `commerceVerticalEntitlementMiddleware(vertical)`, which is what puts the
 * vertical's key into `userLimits`. That middleware takes its vertical at
 * CONSTRUCTION time, so it cannot serve a route whose vertical arrives as a path
 * param — and mounting the wrong one, or none, is silent: `getRemainingLimit`
 * answers `-1` for an absent key, `checkLimit` reads `-1` as unlimited, and the
 * precheck would report "you have room" to every owner at their cap, forever,
 * with nothing raised.
 *
 * So the cap is resolved by CALLING `resolveCommerceVerticalCap` — the same
 * function that middleware calls, exported for exactly this reason (its own doc:
 * "Two independent readings of 'the cap' would let the two disagree, and the
 * disagreement would look like a working checkout"). The resolved value is then
 * published into `userLimits` so the final comparison goes through `checkLimit`,
 * one semantics for `-1`/`0`/N across all three verticals rather than a second
 * copy of those rules written here.
 * ---
 *
 * ## This module fails OPEN, on purpose
 *
 * Any unresolved input yields `create_direct` — show the form. The real cap is
 * enforced by `enforceGastronomyLimit`/`enforceExperienceLimit`/
 * `enforceAccommodationLimit` on the create path, which fail CLOSED. A transient
 * failure here therefore costs an owner a friendlier dialog, never the limit.
 *
 * @module services/publish-precheck.service
 */

import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import type { AppBindings } from '../types';
import { apiLogger } from '../utils/logger';
import { deriveOnboardingDecision, type OnboardingPrecheckDecision } from './onboarding-precheck';
import {
    countOwnListings,
    listOwnDraftListings,
    type PublishDraft,
    type PublishVertical
} from './publish-listing-reads';

/** What the precheck answers, for any vertical. */
export interface PublishPrecheckResult {
    readonly currentCount: number;
    readonly maxAllowed: number;
    readonly hasQuota: boolean;
    readonly draftCount: number;
    readonly drafts: readonly PublishDraft[];
    readonly decision: OnboardingPrecheckDecision;
}

/**
 * The answer used whenever an input could not be resolved.
 *
 * `create_direct` with a zero cap is deliberately NOT "unlimited": the numbers
 * are what the panel would have rendered, and the panel is not rendered for this
 * decision. What matters is that the form shows and the server-side gate still
 * runs.
 */
const FAIL_OPEN: PublishPrecheckResult = {
    currentCount: 0,
    maxAllowed: 0,
    hasQuota: true,
    draftCount: 0,
    drafts: [],
    decision: 'create_direct'
};

/**
 * Resolves the publish precheck for one vertical.
 *
 * @param input.ctx - The request context, carrying the caller's limits.
 * @param input.actor - The authenticated actor, who is also the owner.
 * @param input.vertical - The vertical being prechecked.
 * @returns The counts, the quota verdict, the drafts and the derived decision.
 *   Never throws: an unresolved input yields the fail-open result.
 */
export async function resolvePublishPrecheck(input: {
    ctx: Context<AppBindings>;
    actor: Actor;
    vertical: PublishVertical;
}): Promise<PublishPrecheckResult> {
    const { ctx: _ctx, actor, vertical } = input;

    try {
        // Both reads are independent, so they go out together. Neither throws;
        // each answers `null` when it could not resolve.
        const [currentCount, drafts] = await Promise.all([
            countOwnListings({ vertical, actor }),
            listOwnDraftListings({ vertical, actor })
        ]);

        if (currentCount === null || drafts === null) {
            apiLogger.warn(
                { vertical, ownerId: actor.id },
                'publish precheck could not resolve its inputs — failing open to create_direct'
            );
            return FAIL_OPEN;
        }

        // The per-plan listing cap was removed with the legacy billing system
        // (HOS-1416); without a cap the precheck always has quota.
        const decision = deriveOnboardingDecision({
            draftCount: drafts.length,
            hasQuota: true
        });

        return {
            currentCount,
            maxAllowed: 0,
            hasQuota: true,
            draftCount: drafts.length,
            drafts,
            decision
        };
    } catch (error) {
        apiLogger.warn(
            {
                vertical,
                ownerId: actor.id,
                error: error instanceof Error ? error.message : String(error)
            },
            'publish precheck threw — failing open to create_direct'
        );
        return FAIL_OPEN;
    }
}
