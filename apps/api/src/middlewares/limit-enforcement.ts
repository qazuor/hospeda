/**
 * Limit Enforcement Middleware
 *
 * Provides middleware factories for enforcing plan limits on resource creation.
 * These middlewares check current usage against plan limits and return 403
 * with upgrade prompts when limits are reached.
 *
 * Must be used AFTER entitlement middleware which loads user limits.
 *
 * Supported limits:
 * - MAX_ACCOMMODATIONS
 * - MAX_PHOTOS_PER_ACCOMMODATION
 * - MAX_ACTIVE_PROMOTIONS
 * - MAX_FAVORITES
 * - MAX_PROPERTIES
 * - MAX_STAFF_ACCOUNTS
 *
 * @module middlewares/limit-enforcement
 */

import { LimitKey } from '@repo/billing';
import { accommodationMediaModel } from '@repo/db';
import { LifecycleStatusEnum, ServiceErrorCode } from '@repo/schemas';
import {
    AccommodationService,
    type Actor,
    OwnerPromotionService,
    ServiceError,
    UserBookmarkService
} from '@repo/service-core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppBindings, AppMiddleware } from '../types';
import { getActorFromContext } from '../utils/actor';
import { calculateThreshold, calculateUsagePercent, checkLimit } from '../utils/limit-check';
import { apiLogger } from '../utils/logger';

/** Audience that should be directed to upgrade when a limit is reached. */
type UpgradeAudience = 'tourist' | 'host';

/**
 * What a caller is told when the cap could not be evaluated (HOS-1078).
 *
 * Shared with `commerce-limit-enforcement.ts` so the two verticals answer a
 * count failure with the same words as well as the same status — the whole
 * point of HOS-1078 part 2 being that they did not.
 *
 * It is deliberately a retry prompt and not an upgrade prompt: nothing is known
 * about the caller's usage at this point, so telling them to upgrade would be a
 * guess, and telling them nothing would be the silent grant this replaced.
 */
export const LIMIT_COUNT_UNAVAILABLE_MESSAGE =
    'No pudimos verificar tu plan en este momento. Volvé a intentarlo en unos segundos.';

/**
 * Maps a limit key to the audience that should be directed to upgrade.
 *
 * - `max_favorites` is a tourist-tier limit.
 * - All other supported limit keys are host-tier limits.
 */
const LIMIT_KEY_AUDIENCE: Record<string, UpgradeAudience> = {
    [LimitKey.MAX_FAVORITES]: 'tourist',
    [LimitKey.MAX_ACCOMMODATIONS]: 'host',
    [LimitKey.MAX_PHOTOS_PER_ACCOMMODATION]: 'host',
    [LimitKey.MAX_ACTIVE_PROMOTIONS]: 'host',
    [LimitKey.MAX_PROPERTIES]: 'host',
    [LimitKey.MAX_STAFF_ACCOUNTS]: 'host',
    // A commerce owner is a host of a different kind, but the same kind of
    // upgrade path: they are sent to a subscription/add-on surface, never to a
    // traveller plan. An absent entry falls back to 'host' anyway — these are
    // explicit so the fallback is not what is being relied on (HOS-688).
    [LimitKey.MAX_GASTRONOMIES]: 'host',
    [LimitKey.MAX_EXPERIENCES]: 'host'
};

/**
 * Builds the structured `details` object for a LIMIT_REACHED ServiceError.
 *
 * Includes `upgradeAudience` (either `'tourist'` or `'host'`) so consumers
 * can map to their own upgrade routes without relying on a hard-coded URL.
 *
 * @param limitKey - The limit that was reached.
 * @param currentCount - The current usage count.
 * @param maxAllowed - The maximum count allowed by the plan.
 * @param usagePercent - Usage as a percentage of maxAllowed.
 * @returns Structured details object for a LIMIT_REACHED error.
 */
export function buildLimitReachedDetails(input: {
    limitKey: LimitKey | string;
    currentCount: number;
    maxAllowed: number;
    usagePercent: number;
}): {
    limitKey: LimitKey | string;
    currentCount: number;
    maxAllowed: number;
    usagePercent: number;
    upgradeAudience: UpgradeAudience;
} {
    const { limitKey, currentCount, maxAllowed, usagePercent } = input;
    const upgradeAudience: UpgradeAudience =
        (LIMIT_KEY_AUDIENCE[limitKey as string] as UpgradeAudience | undefined) ?? 'host';
    return { limitKey, currentCount, maxAllowed, usagePercent, upgradeAudience };
}

/**
 * Throws the same `LIMIT_REACHED` `ServiceError` a real cap-reached check
 * throws, for a limit whose current usage could not be determined (HOS-1087).
 *
 * Fails CLOSED: an unresolved count is a limit that was never verified, so it
 * must be treated as "at the cap" rather than defaulted to 0 and silently
 * granted. That default — `currentCount = 0` on a count failure — used to
 * wave every request through on any DB hiccup, and shipped with a fully
 * green suite because nothing exercised it end-to-end (HOS-973 R-2): a
 * hand-built `checkLimit` context always answers allowed.
 *
 * Deliberately delegates to {@link checkLimit} with a sentinel "at cap"
 * `currentCount` instead of hand-rolling the decision, so a plan whose
 * `maxAllowed` is `-1` (unlimited) still short-circuits to allowed BEFORE
 * `currentCount` is ever read — `checkLimit` ignores `currentCount` entirely
 * on that branch. Only a plan with a real, finite cap is refused.
 *
 * The sentinel is a DECISION input only — it must never reach the response.
 * `LIMIT_REACHED` is one of the two error codes whose `details` are public on
 * every route, unconditionally (`PUBLIC_DETAILS_ERROR_CODES` in
 * `response-helpers.ts`), and the web app interpolates `details.currentCount`
 * straight into an upgrade toast (`billing-limit-error.ts`). Echoing
 * `Number.MAX_SAFE_INTEGER` there once read "Ya guardaste 9007199254740991 de
 * 5 favoritos" to a real user — the exact kind of thing the 403-over-503
 * choice was supposed to avoid (it was picked BECAUSE the UI already renders
 * `LIMIT_REACHED` correctly without a frontend change). So the reported
 * `currentCount` is clamped to `maxAllowed` (and `usagePercent` to 100): "you
 * saved 5 of 5" is honest — we don't know the real count, and what we're
 * telling the caller is that they cannot add more.
 *
 * No-ops (returns normally) when the plan is unlimited; throws otherwise.
 *
 * @param params.context - Hono request context carrying the loaded plan limits.
 * @param params.limitKey - The limit whose count failed to resolve.
 * @param params.fallbackMessage - Message used only if `checkLimit` did not supply one.
 */
function denyOnUnresolvedCount(params: {
    readonly context: Context<AppBindings>;
    readonly limitKey: LimitKey;
    readonly fallbackMessage: string;
}): void {
    const { context, limitKey, fallbackMessage } = params;

    // Sentinel currentCount: guaranteed >= any real finite maxAllowed, so
    // checkLimit denies for every plan except the -1 (unlimited) case, which
    // never inspects currentCount at all. This sentinel decides; it is NEVER
    // reported below — see the JSDoc above for why.
    const limitCheck = checkLimit({
        context,
        limitKey,
        currentCount: Number.MAX_SAFE_INTEGER
    });

    if (!limitCheck.allowed) {
        throw new ServiceError(
            ServiceErrorCode.LIMIT_REACHED,
            limitCheck.upgradeMessage ?? fallbackMessage,
            buildLimitReachedDetails({
                limitKey,
                // Reported as "at the cap" (maxAllowed/100%), NEVER the
                // sentinel — LIMIT_REACHED's `details` are public on every
                // route and the web app renders `currentCount` directly.
                currentCount: limitCheck.maxAllowed,
                maxAllowed: limitCheck.maxAllowed,
                usagePercent: 100
            })
        );
    }
}

/**
 * Enforces accommodation limit before creation
 *
 * Checks if user has reached their max_accommodations limit.
 * Returns 403 if limit reached, and **503 if the cap could not be evaluated
 * at all** — see {@link LIMIT_COUNT_UNAVAILABLE_MESSAGE} (HOS-1078). The two
 * are different answers on purpose: 403 means "your plan says no, upgrade",
 * 503 means "we do not know, retry".
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { enforceAccommodationLimit } from '../middlewares/limit-enforcement';
 *
 * app.post(
 *   '/accommodations',
 *   entitlementMiddleware(),
 *   enforceAccommodationLimit(),
 *   async (c) => {
 *     // User has not reached accommodation limit - proceed
 *   }
 * );
 * ```
 */
export function enforceAccommodationLimit(): AppMiddleware {
    return async (c, next) => {
        try {
            // Get actor to retrieve user info
            const actor = getActorFromContext(c);

            if (!actor || !actor.id) {
                // Not authenticated - let auth middleware handle it
                await next();
                return;
            }

            const accommodationService = new AccommodationService({ logger: apiLogger });

            // Get current accommodation count for this user.
            // Type assertion needed: BaseCrudService.count() accepts z.infer<TSearchSchema>
            // but TypeScript cannot narrow the generic at the call site without importing
            // the concrete schema type. The filter shape matches AccommodationSearchSchema.
            const countResult = await accommodationService.count(actor, {
                ownerId: actor.id
            } as never);

            if (countResult.error) {
                apiLogger.error(
                    `Failed to count accommodations for limit check: ${countResult.error.message}`
                );
                // HOS-1078: REFUSE. This used to call next() ("don't block on
                // count failure"), which handed out an uncapped accommodation
                // every time the count hiccupped — silently, since an uncapped
                // creation is indistinguishable from a working one until
                // somebody counts rows. `enforceCommerceListingLimit` already
                // answers 503 here for exactly this reason; this is the
                // accommodation side catching up.
                throw new HTTPException(503, { message: LIMIT_COUNT_UNAVAILABLE_MESSAGE });
            }

            const currentCount = countResult.data?.count || 0;

            // Check limit
            const limitCheck = checkLimit({
                context: c,
                limitKey: LimitKey.MAX_ACCOMMODATIONS,
                currentCount
            });

            // Calculate threshold and usage percentage
            const threshold = calculateThreshold(currentCount, limitCheck.maxAllowed);
            const usagePercent = calculateUsagePercent(currentCount, limitCheck.maxAllowed);

            // Add X-Usage-Warning header if at warning or critical threshold
            if (threshold === 'warning' || threshold === 'critical') {
                c.header(
                    'X-Usage-Warning',
                    `limitKey=${LimitKey.MAX_ACCOMMODATIONS};usage=${currentCount};max=${limitCheck.maxAllowed};threshold=${threshold}`
                );
            }

            if (!limitCheck.allowed) {
                apiLogger.warn(
                    `Accommodation limit reached for user ${actor.id}: ${limitCheck.currentCount}/${limitCheck.maxAllowed}`
                );

                throw new ServiceError(
                    ServiceErrorCode.LIMIT_REACHED,
                    limitCheck.upgradeMessage ?? 'Accommodation limit reached',
                    buildLimitReachedDetails({
                        limitKey: LimitKey.MAX_ACCOMMODATIONS,
                        currentCount: limitCheck.currentCount,
                        maxAllowed: limitCheck.maxAllowed,
                        usagePercent
                    })
                );
            }

            // Limit OK - proceed
            await next();
        } catch (error) {
            // Re-throw expected errors (LIMIT_REACHED ServiceError or other HTTPExceptions)
            if (error instanceof ServiceError || error instanceof HTTPException) {
                throw error;
            }

            // HOS-1078: an unexpected error here means the cap was never
            // evaluated, which is the same state as a failed count — so it gets
            // the same answer. This branch used to log and call next(), so a
            // thrown count (as opposed to a failed `Result`) created the
            // accommodation too.
            apiLogger.error(
                `Error in accommodation limit enforcement: ${error instanceof Error ? error.message : String(error)}`
            );
            throw new HTTPException(503, { message: LIMIT_COUNT_UNAVAILABLE_MESSAGE });
        }
    };
}

/**
 * Enforces photo limit before upload
 *
 * ⚠ NOT MOUNTED. This middleware is currently registered on no route — its
 * siblings in this file are wired up, this one never was. The live per-request
 * photo-limit enforcement lives inline in the route handlers:
 * `routes/accommodation/protected/addMedia.ts`,
 * `routes/accommodation/admin/addMedia.ts` and `routes/media/admin/upload.ts`.
 * It is kept (and kept correct) so that mounting it later cannot silently
 * reintroduce a counting rule the rest of the codebase has moved off; if you
 * change the counting rule, change it here too or delete this function.
 *
 * Checks if accommodation has reached its max_photos_per_accommodation limit.
 * Returns 403 if limit reached.
 *
 * Note: This middleware expects accommodationId to be available in request params.
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { enforcePhotoLimit } from '../middlewares/limit-enforcement';
 *
 * app.post(
 *   '/accommodations/:id/photos',
 *   entitlementMiddleware(),
 *   enforcePhotoLimit(),
 *   async (c) => {
 *     // Accommodation has not reached photo limit - proceed
 *   }
 * );
 * ```
 */
export function enforcePhotoLimit(): AppMiddleware {
    return async (c, next) => {
        try {
            // Get actor to retrieve user info
            const actor = getActorFromContext(c);

            if (!actor || !actor.id) {
                // Not authenticated - let auth middleware handle it
                await next();
                return;
            }

            // Get accommodation ID from params
            const accommodationId = c.req.param('id');

            if (!accommodationId) {
                // No accommodation ID - can't check limit
                apiLogger.warn('No accommodation ID in params for photo limit check');
                await next();
                return;
            }

            // SPEC-204 T-014: count accommodation_media rows directly. The
            // relational table is the read source of truth (T-013); a single count
            // query is far cheaper than getById (which loads relations and composes
            // the media object) on every upload.
            // The count is GALLERY-ONLY (`isFeatured: false`, HOS-791) so it agrees
            // with the live enforcement sites listed above.
            // A query failure is swallowed by the method-level catch (logs + next()),
            // preserving the "don't block uploads on a count failure" behavior.
            const { total: currentPhotoCount } = await accommodationMediaModel.findByAccommodation({
                accommodationId,
                state: 'visible',
                isFeatured: false
            });

            // Check limit
            const limitCheck = checkLimit({
                context: c,
                limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                currentCount: currentPhotoCount
            });

            // Calculate threshold and usage percentage
            const threshold = calculateThreshold(currentPhotoCount, limitCheck.maxAllowed);
            const usagePercent = calculateUsagePercent(currentPhotoCount, limitCheck.maxAllowed);

            // Add X-Usage-Warning header if at warning or critical threshold
            if (threshold === 'warning' || threshold === 'critical') {
                c.header(
                    'X-Usage-Warning',
                    `limitKey=${LimitKey.MAX_PHOTOS_PER_ACCOMMODATION};usage=${currentPhotoCount};max=${limitCheck.maxAllowed};threshold=${threshold}`
                );
            }

            if (!limitCheck.allowed) {
                apiLogger.warn(
                    `Photo limit reached for accommodation ${accommodationId}: ${limitCheck.currentCount}/${limitCheck.maxAllowed}`
                );

                throw new ServiceError(
                    ServiceErrorCode.LIMIT_REACHED,
                    limitCheck.upgradeMessage ?? 'Photo limit reached',
                    buildLimitReachedDetails({
                        limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                        currentCount: limitCheck.currentCount,
                        maxAllowed: limitCheck.maxAllowed,
                        usagePercent
                    })
                );
            }

            // Limit OK - proceed
            await next();
        } catch (error) {
            // Re-throw expected errors (LIMIT_REACHED ServiceError or other HTTPExceptions)
            if (error instanceof ServiceError || error instanceof HTTPException) {
                throw error;
            }

            // Log unexpected errors but don't block
            apiLogger.error(
                `Error in photo limit enforcement: ${error instanceof Error ? error.message : String(error)}`
            );
            await next();
        }
    };
}

/**
 * Enforces promotion limit before creation
 *
 * Checks if user has reached their max_active_promotions limit.
 * Returns 403 if limit reached.
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { enforcePromotionLimit } from '../middlewares/limit-enforcement';
 *
 * app.post(
 *   '/promotions',
 *   entitlementMiddleware(),
 *   enforcePromotionLimit(),
 *   async (c) => {
 *     // User has not reached promotion limit - proceed
 *   }
 * );
 * ```
 */
export function enforcePromotionLimit(): AppMiddleware {
    return async (c, next) => {
        try {
            // Get actor to retrieve user info
            const actor = getActorFromContext(c);

            if (!actor || !actor.id) {
                // Not authenticated - let auth middleware handle it
                await next();
                return;
            }

            // Get current active promotion count for this user.
            // Type assertion needed: BaseCrudService.count() accepts z.infer<TSearchSchema>
            // but TypeScript cannot narrow the generic at the call site without importing
            // the concrete schema type. The filter shape matches OwnerPromotionSearchSchema.
            const promotionService = new OwnerPromotionService({ logger: apiLogger });
            const countResult = await promotionService.count(actor, {
                lifecycleState: LifecycleStatusEnum.ACTIVE,
                ownerId: actor.id
            } as never);

            if (countResult.error) {
                apiLogger.error(
                    {
                        actorId: actor.id,
                        errorCode: countResult.error.code,
                        errorMessage: countResult.error.message
                    },
                    'HOS-1087: failed to count promotions for limit check — failing closed',
                    { capture: true }
                );
                // HOS-1087: fail CLOSED instead of continuing with an
                // assumed 0 count — see denyOnUnresolvedCount. No-ops (falls
                // through to next()) for an unlimited plan.
                denyOnUnresolvedCount({
                    context: c,
                    limitKey: LimitKey.MAX_ACTIVE_PROMOTIONS,
                    fallbackMessage: 'Promotion limit reached'
                });
                await next();
                return;
            }

            const currentCount = countResult.data?.count || 0;

            // Check limit
            const limitCheck = checkLimit({
                context: c,
                limitKey: LimitKey.MAX_ACTIVE_PROMOTIONS,
                currentCount
            });

            // Calculate threshold and usage percentage
            const threshold = calculateThreshold(currentCount, limitCheck.maxAllowed);
            const usagePercent = calculateUsagePercent(currentCount, limitCheck.maxAllowed);

            // Add X-Usage-Warning header if at warning or critical threshold
            if (threshold === 'warning' || threshold === 'critical') {
                c.header(
                    'X-Usage-Warning',
                    `limitKey=${LimitKey.MAX_ACTIVE_PROMOTIONS};usage=${currentCount};max=${limitCheck.maxAllowed};threshold=${threshold}`
                );
            }

            if (!limitCheck.allowed) {
                apiLogger.warn(
                    `Promotion limit reached for user ${actor.id}: ${limitCheck.currentCount}/${limitCheck.maxAllowed}`
                );

                throw new ServiceError(
                    ServiceErrorCode.LIMIT_REACHED,
                    limitCheck.upgradeMessage ?? 'Promotion limit reached',
                    buildLimitReachedDetails({
                        limitKey: LimitKey.MAX_ACTIVE_PROMOTIONS,
                        currentCount: limitCheck.currentCount,
                        maxAllowed: limitCheck.maxAllowed,
                        usagePercent
                    })
                );
            }

            // Limit OK - proceed
            await next();
        } catch (error) {
            // Re-throw expected errors (LIMIT_REACHED ServiceError or other HTTPExceptions)
            if (error instanceof ServiceError || error instanceof HTTPException) {
                throw error;
            }

            apiLogger.error(
                { error: error instanceof Error ? error.message : String(error) },
                'HOS-1087: unexpected error in promotion limit enforcement — failing closed',
                { capture: true }
            );

            // HOS-1087: fail CLOSED — an unexpected error here means the cap
            // was never evaluated, the same state as a failed count. No-ops
            // (falls through to next()) for an unlimited plan.
            denyOnUnresolvedCount({
                context: c,
                limitKey: LimitKey.MAX_ACTIVE_PROMOTIONS,
                fallbackMessage: 'Promotion limit reached'
            });
            await next();
        }
    };
}

/**
 * Enforces favorites limit before adding to favorites
 *
 * Checks if user has reached their max_favorites limit.
 * Returns 403 if limit reached.
 *
 * Note: This middleware expects a service that can count favorites for a user.
 * Currently returns a placeholder count until favorites feature is fully implemented.
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { enforceFavoritesLimit } from '../middlewares/limit-enforcement';
 *
 * app.post(
 *   '/favorites',
 *   entitlementMiddleware(),
 *   enforceFavoritesLimit(),
 *   async (c) => {
 *     // User has not reached favorites limit - proceed
 *   }
 * );
 * ```
 */
/**
 * Asserts the authenticated actor has not reached their MAX_FAVORITES limit,
 * throwing a 403 LIMIT_REACHED ServiceError when they have. Also emits the
 * `X-Usage-Warning` header at the warning/critical thresholds.
 *
 * Extracted from {@link enforceFavoritesLimit} so the bookmark toggle route can
 * invoke it imperatively from its CREATE branch ONLY. A toggle that REMOVES an
 * existing favorite must never be blocked by the limit — otherwise a user
 * sitting at their cap cannot even un-favorite to free up space (BETA-42).
 *
 * @param params.context - Hono request context carrying the loaded user limits.
 * @param params.actor - The authenticated actor.
 */
export async function assertFavoritesLimitOrThrow(params: {
    readonly context: Context<AppBindings>;
    readonly actor: Actor;
}): Promise<void> {
    const { context: c, actor } = params;

    // Get current favorites (bookmarks) count from UserBookmarkService
    let currentCount = 0;
    let countFailed = false;
    try {
        const bookmarkService = new UserBookmarkService({ logger: apiLogger });
        const countResult = await bookmarkService.countBookmarksForUser(actor, {
            userId: actor.id
        });

        if (countResult.data) {
            currentCount = countResult.data.count;
        } else if (countResult.error) {
            countFailed = true;
            // HOS-1087: bumped from `warn` to `error` + `capture: true` — a
            // count failure used to be logged where Sentry never sees it
            // (the capture hook only fires on ERROR with `capture: true`),
            // which is exactly how this fail-open ran silently for as long
            // as it did.
            apiLogger.error(
                {
                    actorId: actor.id,
                    errorCode: countResult.error.code,
                    errorMessage: countResult.error.message
                },
                'HOS-1087: failed to get bookmark count for favorites limit check — failing closed',
                { capture: true }
            );
        }
    } catch (countError) {
        countFailed = true;
        apiLogger.error(
            {
                actorId: actor.id,
                error: countError instanceof Error ? countError.message : String(countError)
            },
            'HOS-1087: unexpected error fetching bookmark count — failing closed',
            { capture: true }
        );
    }

    // HOS-1087: fail CLOSED on an unresolved count instead of assuming 0 and
    // silently granting the favorite — see denyOnUnresolvedCount. No-ops
    // (returns) for an unlimited plan (maxAllowed === -1).
    if (countFailed) {
        denyOnUnresolvedCount({
            context: c,
            limitKey: LimitKey.MAX_FAVORITES,
            fallbackMessage: 'Favorites limit reached'
        });
        return;
    }

    // Check limit
    const limitCheck = checkLimit({
        context: c,
        limitKey: LimitKey.MAX_FAVORITES,
        currentCount
    });

    // Calculate threshold and usage percentage
    const threshold = calculateThreshold(currentCount, limitCheck.maxAllowed);
    const usagePercent = calculateUsagePercent(currentCount, limitCheck.maxAllowed);

    // Add X-Usage-Warning header if at warning or critical threshold
    if (threshold === 'warning' || threshold === 'critical') {
        c.header(
            'X-Usage-Warning',
            `limitKey=${LimitKey.MAX_FAVORITES};usage=${currentCount};max=${limitCheck.maxAllowed};threshold=${threshold}`
        );
    }

    if (!limitCheck.allowed) {
        apiLogger.warn(
            `Favorites limit reached for user ${actor.id}: ${limitCheck.currentCount}/${limitCheck.maxAllowed}`
        );

        throw new ServiceError(
            ServiceErrorCode.LIMIT_REACHED,
            limitCheck.upgradeMessage ?? 'Favorites limit reached',
            buildLimitReachedDetails({
                limitKey: LimitKey.MAX_FAVORITES,
                currentCount: limitCheck.currentCount,
                maxAllowed: limitCheck.maxAllowed,
                usagePercent
            })
        );
    }
}

export function enforceFavoritesLimit(): AppMiddleware {
    return async (c, next) => {
        try {
            // Get actor to retrieve user info
            const actor = getActorFromContext(c);

            if (!actor || !actor.id) {
                // Not authenticated - let auth middleware handle it
                await next();
                return;
            }

            await assertFavoritesLimitOrThrow({ context: c, actor });

            // Limit OK - proceed
            await next();
        } catch (error) {
            // Re-throw expected errors (LIMIT_REACHED ServiceError or other HTTPExceptions)
            if (error instanceof ServiceError || error instanceof HTTPException) {
                throw error;
            }

            // Log unexpected errors but don't block
            apiLogger.error(
                `Error in favorites limit enforcement: ${error instanceof Error ? error.message : String(error)}`
            );
            await next();
        }
    };
}

/**
 * Enforces properties limit before adding to complex
 *
 * Checks if user has reached their max_properties limit for a complex.
 * Returns 403 if limit reached.
 *
 * Note: This middleware expects complexId to be available in request params.
 * Currently returns a placeholder count until complex feature is fully implemented.
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { enforcePropertiesLimit } from '../middlewares/limit-enforcement';
 *
 * app.post(
 *   '/complexes/:id/properties',
 *   entitlementMiddleware(),
 *   enforcePropertiesLimit(),
 *   async (c) => {
 *     // Complex has not reached properties limit - proceed
 *   }
 * );
 * ```
 */
export function enforcePropertiesLimit(): AppMiddleware {
    return async (c, next) => {
        try {
            // Get actor to retrieve user info
            const actor = getActorFromContext(c);

            if (!actor || !actor.id) {
                // Not authenticated - let auth middleware handle it
                await next();
                return;
            }

            // Get complex ID from params (if adding to complex)
            const complexId = c.req.param('id');

            if (!complexId) {
                // No complex ID - can't check limit
                apiLogger.warn('No complex ID in params for properties limit check');
                await next();
                return;
            }

            // RESERVED-LIMIT (SPEC-145): counting service not built; see docs/billing/endpoint-gate-matrix.md
            // (Reserved — Limit Stubs section). The multi-property management service
            // (AccommodationRoomService) does not exist yet. Complex accommodations (hotels/
            // hostels with multiple rooms/units) are a future feature. Until that service is
            // built and this stub is wired, the count is always 0 and the limit never fires.
            //
            // When the complex accommodation feature is implemented, replace with:
            //   const roomService = new AccommodationRoomService({ logger: apiLogger });
            //   const countResult = await roomService.countByAccommodation(actor, { accommodationId: complexId });
            //   const currentPropertyCount = countResult.data?.count || 0;
            //
            // Note: The accommodation-level limit (how many accommodations a user can have)
            // is already enforced by enforceAccommodationLimit() above.
            const currentPropertyCount = 0;

            // Check limit
            const limitCheck = checkLimit({
                context: c,
                limitKey: LimitKey.MAX_PROPERTIES,
                currentCount: currentPropertyCount
            });

            // Calculate threshold and usage percentage
            const threshold = calculateThreshold(currentPropertyCount, limitCheck.maxAllowed);
            const usagePercent = calculateUsagePercent(currentPropertyCount, limitCheck.maxAllowed);

            // Add X-Usage-Warning header if at warning or critical threshold
            if (threshold === 'warning' || threshold === 'critical') {
                c.header(
                    'X-Usage-Warning',
                    `limitKey=${LimitKey.MAX_PROPERTIES};usage=${currentPropertyCount};max=${limitCheck.maxAllowed};threshold=${threshold}`
                );
            }

            if (!limitCheck.allowed) {
                apiLogger.warn(
                    `Properties limit reached for complex ${complexId}: ${limitCheck.currentCount}/${limitCheck.maxAllowed}`
                );

                throw new ServiceError(
                    ServiceErrorCode.LIMIT_REACHED,
                    limitCheck.upgradeMessage ?? 'Properties limit reached',
                    buildLimitReachedDetails({
                        limitKey: LimitKey.MAX_PROPERTIES,
                        currentCount: limitCheck.currentCount,
                        maxAllowed: limitCheck.maxAllowed,
                        usagePercent
                    })
                );
            }

            // Limit OK - proceed
            await next();
        } catch (error) {
            // Re-throw expected errors (LIMIT_REACHED ServiceError or other HTTPExceptions)
            if (error instanceof ServiceError || error instanceof HTTPException) {
                throw error;
            }

            // Log unexpected errors but don't block
            apiLogger.error(
                `Error in properties limit enforcement: ${error instanceof Error ? error.message : String(error)}`
            );
            await next();
        }
    };
}

/**
 * Enforces staff accounts limit before creating staff account
 *
 * Checks if user has reached their max_staff_accounts limit.
 * Returns 403 if limit reached.
 *
 * Note: This middleware expects a service that can count staff accounts for a user.
 * Currently returns a placeholder count until staff management is fully implemented.
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { enforceStaffAccountsLimit } from '../middlewares/limit-enforcement';
 *
 * app.post(
 *   '/staff',
 *   entitlementMiddleware(),
 *   enforceStaffAccountsLimit(),
 *   async (c) => {
 *     // User has not reached staff accounts limit - proceed
 *   }
 * );
 * ```
 */
export function enforceStaffAccountsLimit(): AppMiddleware {
    return async (c, next) => {
        try {
            // Get actor to retrieve user info
            const actor = getActorFromContext(c);

            if (!actor || !actor.id) {
                // Not authenticated - let auth middleware handle it
                await next();
                return;
            }

            // RESERVED-LIMIT (SPEC-145): counting service not built; see docs/billing/endpoint-gate-matrix.md
            // (Reserved — Limit Stubs section). The staff accounts management service
            // (StaffService) does not exist yet. In v1, each accommodation is managed by a
            // single owner. Staff accounts (invite team members with granular permissions) are
            // a future feature. Until that service is built and this stub is wired, the count
            // is always 0 and the limit never fires.
            //
            // Implementation plan when ready:
            //   1. Create staff_invitations table (owner_user_id, email, role, status, etc.)
            //   2. Create StaffService with invite/accept/revoke flows
            //   3. Replace this stub with:
            //      const staffService = new StaffService({ logger: apiLogger });
            //      const countResult = await staffService.countAcceptedByOwner(actor, { ownerId: actor.id });
            //      const currentCount = countResult.data?.count || 0;
            const currentCount = 0;

            // Check limit
            const limitCheck = checkLimit({
                context: c,
                limitKey: LimitKey.MAX_STAFF_ACCOUNTS,
                currentCount
            });

            // Calculate threshold and usage percentage
            const threshold = calculateThreshold(currentCount, limitCheck.maxAllowed);
            const usagePercent = calculateUsagePercent(currentCount, limitCheck.maxAllowed);

            // Add X-Usage-Warning header if at warning or critical threshold
            if (threshold === 'warning' || threshold === 'critical') {
                c.header(
                    'X-Usage-Warning',
                    `limitKey=${LimitKey.MAX_STAFF_ACCOUNTS};usage=${currentCount};max=${limitCheck.maxAllowed};threshold=${threshold}`
                );
            }

            if (!limitCheck.allowed) {
                apiLogger.warn(
                    `Staff accounts limit reached for user ${actor.id}: ${limitCheck.currentCount}/${limitCheck.maxAllowed}`
                );

                throw new ServiceError(
                    ServiceErrorCode.LIMIT_REACHED,
                    limitCheck.upgradeMessage ?? 'Staff accounts limit reached',
                    buildLimitReachedDetails({
                        limitKey: LimitKey.MAX_STAFF_ACCOUNTS,
                        currentCount: limitCheck.currentCount,
                        maxAllowed: limitCheck.maxAllowed,
                        usagePercent
                    })
                );
            }

            // Limit OK - proceed
            await next();
        } catch (error) {
            // Re-throw expected errors (LIMIT_REACHED ServiceError or other HTTPExceptions)
            if (error instanceof ServiceError || error instanceof HTTPException) {
                throw error;
            }

            // Log unexpected errors but don't block
            apiLogger.error(
                `Error in staff accounts limit enforcement: ${error instanceof Error ? error.message : String(error)}`
            );
            await next();
        }
    };
}
