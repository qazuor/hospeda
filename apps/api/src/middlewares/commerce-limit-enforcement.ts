/**
 * Commerce per-vertical listing-limit enforcement (HOS-688 §6.8).
 *
 * The commerce twin of `enforceAccommodationLimit`, with two deliberate
 * divergences from it. Both are stated here because a faithful copy of the
 * accommodation middleware would silently inherit the very holes §6.8 was
 * written to close.
 *
 * ## 1. There is no entitlement gate ahead of this one
 *
 * Accommodation's create route stacks
 * `requireEntitlement(PUBLISH_ACCOMMODATIONS)` and *then* the limit check, in
 * that order and for a stated reason (SPEC-145 T-004). §6.8 records that
 * **neither commerce vertical grants any entitlement today** — visibility is
 * driven by the subscription status through `commerce_listing_subscriptions`
 * and the reconciler, not by the entitlement engine — so there is nothing to
 * put in the first half of that pattern. Copying the shape anyway would leave a
 * hole where its first gate was.
 *
 * ## 2. A count failure REFUSES, it does not wave the request through
 *
 * `enforceAccommodationLimit` logs and calls `next()` when the count fails
 * ("don't block on count failure"). For commerce that would be handing out the
 * product: the cap is the entire commercial substance of the plan, this
 * middleware is the ONLY gate on the create path, and an uncapped creation is
 * indistinguishable from a working one until somebody counts rows. So a count
 * failure answers 503 — loud, honest, and retryable — rather than silently
 * allowing the listing.
 *
 * The 403 body carries the same `LIMIT_REACHED` shape every other limit uses,
 * so `buildLimitReachedPayload` on the web side resolves the vertical's
 * at-limit copy and links its add-on without special-casing commerce.
 *
 * @module middlewares/commerce-limit-enforcement
 */

import {
    type CommerceVertical,
    LIMIT_KEY_BY_COMMERCE_VERTICAL,
    type LimitKey
} from '@repo/billing';
import { ServiceErrorCode } from '@repo/schemas';
import { type Actor, ExperienceService, GastronomyService, ServiceError } from '@repo/service-core';
import { HTTPException } from 'hono/http-exception';
import type { AppMiddleware } from '../types';
import { getActorFromContext } from '../utils/actor';
import { calculateThreshold, calculateUsagePercent, checkLimit } from '../utils/limit-check';
import { apiLogger } from '../utils/logger';
import { buildLimitReachedDetails } from './limit-enforcement';

const gastronomyService = new GastronomyService({ logger: apiLogger });
const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * Counts the listings one owner holds in one vertical.
 *
 * `ownerId` is a declared filter on both `GastronomySearchSchema` and
 * `ExperienceSearchSchema` — checked rather than assumed, because a search
 * schema that silently drops an undeclared filter would count every listing on
 * the platform and cap the first owner who tried to create one.
 *
 * @param input.vertical - Which vertical to count.
 * @param input.actor - The authenticated actor (also the owner).
 * @returns The count, or `null` when the count could not be resolved.
 */
async function countOwnListings(input: {
    vertical: CommerceVertical;
    actor: Actor;
}): Promise<number | null> {
    const { vertical, actor } = input;
    const service = vertical === 'gastronomy' ? gastronomyService : experienceService;

    // Type assertion mirrors `enforceAccommodationLimit`: BaseCrudService.count()
    // takes z.infer<TSearchSchema> and TypeScript cannot narrow the generic at
    // the call site without importing the concrete schema type.
    const result = await service.count(actor, { ownerId: actor.id } as never);

    if (result.error) {
        apiLogger.error(
            { vertical, ownerId: actor.id, error: result.error.message },
            'failed to count commerce listings for the limit check'
        );
        return null;
    }

    return result.data?.count ?? 0;
}

/**
 * Builds the limit-enforcement middleware for one commerce vertical.
 *
 * Resolving the vertical's cap through {@link LIMIT_KEY_BY_COMMERCE_VERTICAL}
 * is one code path reading a different value, not a behavioural branch by
 * domain — the distinction §6.8 G-2 draws and AC-7 explicitly permits.
 *
 * Must run AFTER `commerceVerticalEntitlementMiddleware(vertical)`, which is
 * what puts this vertical's cap into `userLimits`. Without it the key is absent
 * and `getRemainingLimit` answers `-1`, i.e. unlimited, with nothing raised.
 *
 * @param vertical - The commerce vertical to enforce.
 * @returns A Hono middleware.
 */
function enforceCommerceListingLimit(vertical: CommerceVertical): AppMiddleware {
    const limitKey: LimitKey = LIMIT_KEY_BY_COMMERCE_VERTICAL[vertical];

    return async (c, next) => {
        const actor = getActorFromContext(c);

        if (!actor || !actor.id) {
            // Not authenticated — the auth middleware owns this answer.
            await next();
            return;
        }

        const currentCount = await countOwnListings({ vertical, actor });

        if (currentCount === null) {
            // See the module docblock: refusing beats silently granting an
            // uncapped listing.
            throw new HTTPException(503, {
                message:
                    'No pudimos verificar tu plan en este momento. Volvé a intentarlo en unos segundos.'
            });
        }

        const limitCheck = checkLimit({ context: c, limitKey, currentCount });

        const threshold = calculateThreshold(currentCount, limitCheck.maxAllowed);
        const usagePercent = calculateUsagePercent(currentCount, limitCheck.maxAllowed);

        if (threshold === 'warning' || threshold === 'critical') {
            c.header(
                'X-Usage-Warning',
                `limitKey=${limitKey};usage=${currentCount};max=${limitCheck.maxAllowed};threshold=${threshold}`
            );
        }

        if (!limitCheck.allowed) {
            apiLogger.warn(
                {
                    vertical,
                    ownerId: actor.id,
                    currentCount: limitCheck.currentCount,
                    maxAllowed: limitCheck.maxAllowed
                },
                'commerce listing limit reached'
            );

            throw new ServiceError(
                ServiceErrorCode.LIMIT_REACHED,
                limitCheck.upgradeMessage ?? 'Commerce listing limit reached',
                buildLimitReachedDetails({
                    limitKey,
                    currentCount: limitCheck.currentCount,
                    maxAllowed: limitCheck.maxAllowed,
                    usagePercent
                })
            );
        }

        await next();
    };
}

/**
 * Refuses a gastronomy listing once the owner is at their `max_gastronomies`
 * cap, and says nothing about their experiences — the two caps count
 * independently rather than sharing a pool (AC-13).
 *
 * @returns A Hono middleware.
 *
 * @example
 * ```ts
 * options: {
 *   middlewares: [
 *     commerceVerticalEntitlementMiddleware('gastronomy'),
 *     enforceGastronomyLimit()
 *   ]
 * }
 * ```
 */
export function enforceGastronomyLimit(): AppMiddleware {
    return enforceCommerceListingLimit('gastronomy');
}

/**
 * Experience-side twin of {@link enforceGastronomyLimit}.
 *
 * @returns A Hono middleware.
 */
export function enforceExperienceLimit(): AppMiddleware {
    return enforceCommerceListingLimit('experience');
}
