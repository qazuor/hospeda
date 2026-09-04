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

import { LIMIT_KEY_BY_PUBLISH_VERTICAL, type LimitKey, type PublishVertical } from '@repo/billing';
import type { Actor } from '@repo/service-core';
import type { Context } from 'hono';
import { resolveCommerceVerticalCap } from '../middlewares/commerce-entitlement';
import type { AppBindings } from '../types';
import { checkLimit } from '../utils/limit-check';
import { apiLogger } from '../utils/logger';
import { deriveOnboardingDecision, type OnboardingPrecheckDecision } from './onboarding-precheck';
import {
    countOwnListings,
    isCommercePublishVertical,
    listOwnDraftListings,
    type PublishDraft
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
 * Publishes the vertical's cap into `userLimits` so the comparison below runs
 * through the shared {@link checkLimit}.
 *
 * Accommodation needs nothing: the global `entitlementMiddleware` has already
 * loaded that domain's keys, and `max_accommodations` is one of them. A commerce
 * vertical's key is never in that set by construction (SPEC-239 isolates the
 * domains), so it is resolved and written here — mirroring, for one request, what
 * `commerceVerticalEntitlementMiddleware` does for a statically-known vertical.
 *
 * Only `userLimits` is touched. `userEntitlements` is deliberately left alone:
 * this route gates on nothing, and replacing the accommodation entitlement set
 * on a read-only path could only cause a later gate to read the wrong domain.
 *
 * @param input.ctx - The request context.
 * @param input.vertical - The vertical being prechecked.
 */
async function ensureVerticalLimitLoaded(input: {
    ctx: Context<AppBindings>;
    vertical: PublishVertical;
}): Promise<void> {
    const { ctx, vertical } = input;

    if (!isCommercePublishVertical(vertical)) {
        return;
    }

    const limitKey: LimitKey = LIMIT_KEY_BY_PUBLISH_VERTICAL[vertical];
    const cap = await resolveCommerceVerticalCap({
        customerId: ctx.get('billingCustomerId'),
        vertical
    });

    const limits = new Map<LimitKey, number>(ctx.get('userLimits') ?? []);
    limits.set(limitKey, cap);
    ctx.set('userLimits', limits);
}

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
    const { ctx, actor, vertical } = input;

    try {
        await ensureVerticalLimitLoaded({ ctx, vertical });

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

        const limitCheck = checkLimit({
            context: ctx,
            limitKey: LIMIT_KEY_BY_PUBLISH_VERTICAL[vertical],
            currentCount
        });

        const decision = deriveOnboardingDecision({
            draftCount: drafts.length,
            hasQuota: limitCheck.allowed
        });

        return {
            currentCount,
            maxAllowed: limitCheck.maxAllowed,
            hasQuota: limitCheck.allowed,
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
