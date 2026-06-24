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
    [LimitKey.MAX_STAFF_ACCOUNTS]: 'host'
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
 * Options for {@link enforceAccommodationLimit}.
 */
export interface EnforceAccommodationLimitOptions {
    /**
     * When `true`, the limit check is skipped entirely if the actor already has
     * an active DRAFT accommodation (same predicate `createForOnboarding` uses to
     * decide a `resumed` outcome). This is opt-in for the host-onboarding `/start`
     * route: a HOST at their plan ceiling who re-enters onboarding only RESUMES
     * their existing DRAFT — no new row is inserted — so the limit must not block
     * them. Defaults to `false`, preserving the original behavior for every other
     * consumer (accommodation create / createDraft).
     */
    readonly skipWhenActiveDraftExists?: boolean;
}

/**
 * Enforces accommodation limit before creation
 *
 * Checks if user has reached their max_accommodations limit.
 * Returns 403 if limit reached.
 *
 * @param options - Optional behavior flags. See {@link EnforceAccommodationLimitOptions}.
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
export function enforceAccommodationLimit(
    options?: EnforceAccommodationLimitOptions
): AppMiddleware {
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

            // Opt-in resume bypass (host-onboarding `/start`): when the actor already
            // owns an active DRAFT, the downstream operation will RESUME it rather than
            // insert a new accommodation, so the plan limit must not block them. Mirror
            // the exact predicate `createForOnboarding` uses to detect the `resumed`
            // outcome (ownerId + DRAFT lifecycle + not soft-deleted).
            if (options?.skipWhenActiveDraftExists === true) {
                const draftCountResult = await accommodationService.count(actor, {
                    ownerId: actor.id,
                    lifecycleState: LifecycleStatusEnum.DRAFT,
                    deletedAt: null
                } as never);

                // Only bypass on a confident positive. On a count error we fall through
                // to the normal limit check rather than skipping it.
                if (!draftCountResult.error && (draftCountResult.data?.count ?? 0) > 0) {
                    await next();
                    return;
                }
            }

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
                // Continue - don't block on count failure
                await next();
                return;
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

            // Log unexpected errors but don't block
            apiLogger.error(
                `Error in accommodation limit enforcement: ${error instanceof Error ? error.message : String(error)}`
            );
            await next();
        }
    };
}

/**
 * Enforces photo limit before upload
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

            // Get current photo count for this accommodation
            const accommodationService = new AccommodationService({ logger: apiLogger });
            const accommodationResult = await accommodationService.getById(actor, accommodationId);

            if (accommodationResult.error) {
                apiLogger.error(
                    `Failed to get accommodation for photo limit check: ${accommodationResult.error.message}`
                );
                // Continue - don't block on fetch failure
                await next();
                return;
            }

            // Count photos from the accommodation's media JSONB field.
            // Media structure: { featuredImage?: Image, gallery?: Image[] }
            const accommodation = accommodationResult.data;
            let currentPhotoCount = 0;
            if (accommodation?.media && typeof accommodation.media === 'object') {
                const media = accommodation.media as {
                    featuredImage?: unknown;
                    gallery?: unknown[];
                };
                const galleryCount = Array.isArray(media.gallery) ? media.gallery.length : 0;
                const featuredCount = media.featuredImage ? 1 : 0;
                currentPhotoCount = galleryCount + featuredCount;
            }

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
                    `Failed to count promotions for limit check: ${countResult.error.message}`
                );
                // Continue - don't block on count failure
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

            // Log unexpected errors but don't block
            apiLogger.error(
                `Error in promotion limit enforcement: ${error instanceof Error ? error.message : String(error)}`
            );
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
    try {
        const bookmarkService = new UserBookmarkService({ logger: apiLogger });
        const countResult = await bookmarkService.countBookmarksForUser(actor, {
            userId: actor.id
        });

        if (countResult.data) {
            currentCount = countResult.data.count;
        } else if (countResult.error) {
            apiLogger.warn(
                `Failed to get bookmark count for user ${actor.id}: ${countResult.error.message}`
            );
        }
    } catch (countError) {
        apiLogger.warn(
            `Error fetching bookmark count for user ${actor.id}: ${countError instanceof Error ? countError.message : String(countError)}`
        );
        // Continue with 0 count - don't block user on service failure
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
