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
import { AccommodationService, OwnerPromotionService } from '@repo/service-core';
import { HTTPException } from 'hono/http-exception';
import type { AppMiddleware } from '../types';
import { getActorFromContext } from '../utils/actor';
import { calculateThreshold, calculateUsagePercent, checkLimit } from '../utils/limit-check';
import { apiLogger } from '../utils/logger';

/**
 * Enforces accommodation limit before creation
 *
 * Checks if user has reached their max_accommodations limit.
 * Returns 403 if limit reached.
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

            // Get current accommodation count for this user
            const accommodationService = new AccommodationService({ logger: apiLogger });
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

                throw new HTTPException(403, {
                    message: JSON.stringify({
                        success: false,
                        error: {
                            code: 'LIMIT_REACHED',
                            message: limitCheck.upgradeMessage,
                            details: {
                                limitKey: LimitKey.MAX_ACCOMMODATIONS,
                                currentCount: limitCheck.currentCount,
                                maxAllowed: limitCheck.maxAllowed,
                                usagePercent,
                                upgradeUrl: '/billing/plans'
                            }
                        }
                    })
                });
            }

            // Limit OK - proceed
            await next();
        } catch (error) {
            // Re-throw HTTPException
            if (error instanceof HTTPException) {
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

            // Get photo count from accommodation data
            // Note: photosCount may not exist yet in the schema, default to 0
            const accommodation = accommodationResult.data;
            const currentPhotoCount = accommodation
                ? (accommodation as { photosCount?: number }).photosCount || 0
                : 0;

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

                throw new HTTPException(403, {
                    message: JSON.stringify({
                        success: false,
                        error: {
                            code: 'LIMIT_REACHED',
                            message: limitCheck.upgradeMessage,
                            details: {
                                limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                                currentCount: limitCheck.currentCount,
                                maxAllowed: limitCheck.maxAllowed,
                                usagePercent,
                                upgradeUrl: '/billing/plans'
                            }
                        }
                    })
                });
            }

            // Limit OK - proceed
            await next();
        } catch (error) {
            // Re-throw HTTPException
            if (error instanceof HTTPException) {
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

            // Get current active promotion count for this user
            const promotionService = new OwnerPromotionService({ logger: apiLogger });

            // Count active promotions (isActive = true)
            const countResult = await promotionService.count(actor, {
                isActive: true,
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

                throw new HTTPException(403, {
                    message: JSON.stringify({
                        success: false,
                        error: {
                            code: 'LIMIT_REACHED',
                            message: limitCheck.upgradeMessage,
                            details: {
                                limitKey: LimitKey.MAX_ACTIVE_PROMOTIONS,
                                currentCount: limitCheck.currentCount,
                                maxAllowed: limitCheck.maxAllowed,
                                usagePercent,
                                upgradeUrl: '/billing/plans'
                            }
                        }
                    })
                });
            }

            // Limit OK - proceed
            await next();
        } catch (error) {
            // Re-throw HTTPException
            if (error instanceof HTTPException) {
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

            // TODO: Get current favorites count when favorites service is available
            // For now, use 0 as placeholder
            const currentCount = 0;

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

                throw new HTTPException(403, {
                    message: JSON.stringify({
                        success: false,
                        error: {
                            code: 'LIMIT_REACHED',
                            message: limitCheck.upgradeMessage,
                            details: {
                                limitKey: LimitKey.MAX_FAVORITES,
                                currentCount: limitCheck.currentCount,
                                maxAllowed: limitCheck.maxAllowed,
                                usagePercent,
                                upgradeUrl: '/billing/plans'
                            }
                        }
                    })
                });
            }

            // Limit OK - proceed
            await next();
        } catch (error) {
            // Re-throw HTTPException
            if (error instanceof HTTPException) {
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

            // TODO: Get current properties count when complex service is available
            // For now, use 0 as placeholder
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

                throw new HTTPException(403, {
                    message: JSON.stringify({
                        success: false,
                        error: {
                            code: 'LIMIT_REACHED',
                            message: limitCheck.upgradeMessage,
                            details: {
                                limitKey: LimitKey.MAX_PROPERTIES,
                                currentCount: limitCheck.currentCount,
                                maxAllowed: limitCheck.maxAllowed,
                                usagePercent,
                                upgradeUrl: '/billing/plans'
                            }
                        }
                    })
                });
            }

            // Limit OK - proceed
            await next();
        } catch (error) {
            // Re-throw HTTPException
            if (error instanceof HTTPException) {
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

            // TODO: Get current staff accounts count when staff service is available
            // For now, use 0 as placeholder
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

                throw new HTTPException(403, {
                    message: JSON.stringify({
                        success: false,
                        error: {
                            code: 'LIMIT_REACHED',
                            message: limitCheck.upgradeMessage,
                            details: {
                                limitKey: LimitKey.MAX_STAFF_ACCOUNTS,
                                currentCount: limitCheck.currentCount,
                                maxAllowed: limitCheck.maxAllowed,
                                usagePercent,
                                upgradeUrl: '/billing/plans'
                            }
                        }
                    })
                });
            }

            // Limit OK - proceed
            await next();
        } catch (error) {
            // Re-throw HTTPException
            if (error instanceof HTTPException) {
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
