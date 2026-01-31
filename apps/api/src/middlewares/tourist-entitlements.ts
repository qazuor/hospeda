/**
 * Tourist Entitlement Gating Middleware
 *
 * Provides middleware functions to gate tourist-specific features based on
 * subscription plan entitlements and limits. These middleware functions check
 * if a tourist user has the required entitlements from their plan (Free/Plus/VIP).
 *
 * Features gated:
 * - Favorites (with limit)
 * - Price alerts (with limit)
 * - Accommodation comparator (with limit)
 * - Review photo attachments
 * - Search history
 * - Personalized recommendations
 * - Exclusive deals
 * - Early event access (24h window)
 * - Ad-free experience
 * - Direct contact information
 *
 * Must be used AFTER entitlement middleware which loads user entitlements.
 *
 * @module middlewares/tourist-entitlements
 */

import { EntitlementKey, LimitKey } from '@repo/billing';
import { HTTPException } from 'hono/http-exception';
import type { AppMiddleware } from '../types';
import { checkLimit } from '../utils/limit-check';
import { apiLogger } from '../utils/logger';
import { hasEntitlement } from './entitlement';

/**
 * Gate favorites feature
 *
 * Checks if user has SAVE_FAVORITES entitlement and hasn't exceeded
 * max_favorites limit before adding a new favorite.
 *
 * Note: This middleware expects current favorites count to be passed
 * via context at 'currentFavoritesCount' key (set by route handler).
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { gateFavorites } from '../middlewares/tourist-entitlements';
 *
 * app.post(
 *   '/favorites',
 *   entitlementMiddleware(),
 *   gateFavorites(),
 *   async (c) => {
 *     // User can add favorite - proceed
 *   }
 * );
 * ```
 */
export function gateFavorites(): AppMiddleware {
    return async (c, next) => {
        try {
            // Check entitlement
            if (!hasEntitlement(c, EntitlementKey.SAVE_FAVORITES)) {
                throw new HTTPException(403, {
                    message: JSON.stringify({
                        success: false,
                        error: {
                            code: 'ENTITLEMENT_REQUIRED',
                            message:
                                'Tu plan no incluye guardar favoritos. Actualiza tu plan para acceder a esta funcionalidad.',
                            details: {
                                entitlement: EntitlementKey.SAVE_FAVORITES,
                                upgradeUrl: '/billing/plans'
                            }
                        }
                    })
                });
            }

            // Get current favorites count from context (set by route handler)
            const currentCount = (c.get('currentFavoritesCount') as number) || 0;

            // Check limit
            const limitCheck = checkLimit({
                context: c,
                limitKey: LimitKey.MAX_FAVORITES,
                currentCount
            });

            if (!limitCheck.allowed) {
                apiLogger.warn(
                    `Favorites limit reached: ${limitCheck.currentCount}/${limitCheck.maxAllowed}`
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
                                remaining: limitCheck.remaining,
                                upgradeUrl: '/billing/plans'
                            }
                        }
                    })
                });
            }

            // Entitlement and limit OK - proceed
            await next();
        } catch (error) {
            if (error instanceof HTTPException) {
                throw error;
            }

            apiLogger.error(
                `Error in favorites gate: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    };
}

/**
 * Gate alerts feature
 *
 * Checks if user has PRICE_ALERTS entitlement and hasn't exceeded
 * max_active_alerts limit before creating a new alert.
 *
 * Note: This middleware expects current active alerts count to be passed
 * via context at 'currentActiveAlertsCount' key (set by route handler).
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { gateAlerts } from '../middlewares/tourist-entitlements';
 *
 * app.post(
 *   '/alerts',
 *   entitlementMiddleware(),
 *   gateAlerts(),
 *   async (c) => {
 *     // User can create alert - proceed
 *   }
 * );
 * ```
 */
export function gateAlerts(): AppMiddleware {
    return async (c, next) => {
        try {
            // Check entitlement
            if (!hasEntitlement(c, EntitlementKey.PRICE_ALERTS)) {
                throw new HTTPException(403, {
                    message: JSON.stringify({
                        success: false,
                        error: {
                            code: 'ENTITLEMENT_REQUIRED',
                            message:
                                'Las alertas de precio solo están disponibles en los planes Plus y VIP. Actualiza tu plan para acceder.',
                            details: {
                                entitlement: EntitlementKey.PRICE_ALERTS,
                                upgradeUrl: '/billing/plans'
                            }
                        }
                    })
                });
            }

            // Get current active alerts count from context (set by route handler)
            const currentCount = (c.get('currentActiveAlertsCount') as number) || 0;

            // Check limit (max_active_alerts)
            // Note: This limit key needs to be added to LimitKey enum in @repo/billing
            const limitKey = 'max_active_alerts' as LimitKey;
            const limitCheck = checkLimit({
                context: c,
                limitKey,
                currentCount
            });

            if (!limitCheck.allowed) {
                apiLogger.warn(
                    `Active alerts limit reached: ${limitCheck.currentCount}/${limitCheck.maxAllowed}`
                );

                throw new HTTPException(403, {
                    message: JSON.stringify({
                        success: false,
                        error: {
                            code: 'LIMIT_REACHED',
                            message: limitCheck.upgradeMessage,
                            details: {
                                limitKey,
                                currentCount: limitCheck.currentCount,
                                maxAllowed: limitCheck.maxAllowed,
                                remaining: limitCheck.remaining,
                                upgradeUrl: '/billing/plans'
                            }
                        }
                    })
                });
            }

            // Entitlement and limit OK - proceed
            await next();
        } catch (error) {
            if (error instanceof HTTPException) {
                throw error;
            }

            apiLogger.error(
                `Error in alerts gate: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    };
}

/**
 * Gate comparator feature
 *
 * Checks if user has the accommodation comparison entitlement and hasn't
 * exceeded max_compare_items limit.
 *
 * Note: This middleware expects current compare items count to be passed
 * via context at 'currentCompareItemsCount' key (set by route handler).
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { gateComparator } from '../middlewares/tourist-entitlements';
 *
 * app.post(
 *   '/compare',
 *   entitlementMiddleware(),
 *   gateComparator(),
 *   async (c) => {
 *     // User can add to comparison - proceed
 *   }
 * );
 * ```
 */
export function gateComparator(): AppMiddleware {
    return async (c, next) => {
        try {
            // Check entitlement
            // Note: This entitlement key needs to be added to EntitlementKey enum
            const comparatorEntitlement = 'can_compare_accommodations' as EntitlementKey;

            if (!hasEntitlement(c, comparatorEntitlement)) {
                throw new HTTPException(403, {
                    message: JSON.stringify({
                        success: false,
                        error: {
                            code: 'ENTITLEMENT_REQUIRED',
                            message:
                                'El comparador de alojamientos solo está disponible en los planes Plus y VIP. Actualiza tu plan para acceder.',
                            details: {
                                entitlement: comparatorEntitlement,
                                upgradeUrl: '/billing/plans'
                            }
                        }
                    })
                });
            }

            // Get current compare items count from context (set by route handler)
            const currentCount = (c.get('currentCompareItemsCount') as number) || 0;

            // Check limit
            const limitKey = 'max_compare_items' as LimitKey;
            const limitCheck = checkLimit({
                context: c,
                limitKey,
                currentCount
            });

            if (!limitCheck.allowed) {
                apiLogger.warn(
                    `Compare items limit reached: ${limitCheck.currentCount}/${limitCheck.maxAllowed}`
                );

                throw new HTTPException(403, {
                    message: JSON.stringify({
                        success: false,
                        error: {
                            code: 'LIMIT_REACHED',
                            message: limitCheck.upgradeMessage,
                            details: {
                                limitKey,
                                currentCount: limitCheck.currentCount,
                                maxAllowed: limitCheck.maxAllowed,
                                remaining: limitCheck.remaining,
                                upgradeUrl: '/billing/plans'
                            }
                        }
                    })
                });
            }

            // Entitlement and limit OK - proceed
            await next();
        } catch (error) {
            if (error instanceof HTTPException) {
                throw error;
            }

            apiLogger.error(
                `Error in comparator gate: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    };
}

/**
 * Gate review photo attachments
 *
 * Checks if user has the entitlement to attach photos to reviews.
 * VIP plan only feature.
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { gateReviewPhotos } from '../middlewares/tourist-entitlements';
 *
 * app.post(
 *   '/reviews/:id/photos',
 *   entitlementMiddleware(),
 *   gateReviewPhotos(),
 *   async (c) => {
 *     // User can attach photos - proceed
 *   }
 * );
 * ```
 */
export function gateReviewPhotos(): AppMiddleware {
    return async (c, next) => {
        try {
            // Check entitlement
            const reviewPhotosEntitlement = 'can_attach_review_photos' as EntitlementKey;

            if (!hasEntitlement(c, reviewPhotosEntitlement)) {
                throw new HTTPException(403, {
                    message: JSON.stringify({
                        success: false,
                        error: {
                            code: 'ENTITLEMENT_REQUIRED',
                            message:
                                'Adjuntar fotos a reseñas es una funcionalidad exclusiva del plan VIP. Actualiza para acceder.',
                            details: {
                                entitlement: reviewPhotosEntitlement,
                                upgradeUrl: '/billing/plans'
                            }
                        }
                    })
                });
            }

            // Entitlement OK - proceed
            await next();
        } catch (error) {
            if (error instanceof HTTPException) {
                throw error;
            }

            apiLogger.error(
                `Error in review photos gate: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    };
}

/**
 * Gate search history feature
 *
 * Checks if user has the entitlement to view their search history.
 * Plus and VIP plans only.
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { gateSearchHistory } from '../middlewares/tourist-entitlements';
 *
 * app.get(
 *   '/search-history',
 *   entitlementMiddleware(),
 *   gateSearchHistory(),
 *   async (c) => {
 *     // User can view search history - proceed
 *   }
 * );
 * ```
 */
export function gateSearchHistory(): AppMiddleware {
    return async (c, next) => {
        try {
            // Check entitlement
            const searchHistoryEntitlement = 'can_view_search_history' as EntitlementKey;

            if (!hasEntitlement(c, searchHistoryEntitlement)) {
                throw new HTTPException(403, {
                    message: JSON.stringify({
                        success: false,
                        error: {
                            code: 'ENTITLEMENT_REQUIRED',
                            message:
                                'El historial de búsqueda solo está disponible en los planes Plus y VIP. Actualiza tu plan para acceder.',
                            details: {
                                entitlement: searchHistoryEntitlement,
                                upgradeUrl: '/billing/plans'
                            }
                        }
                    })
                });
            }

            // Entitlement OK - proceed
            await next();
        } catch (error) {
            if (error instanceof HTTPException) {
                throw error;
            }

            apiLogger.error(
                `Error in search history gate: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    };
}

/**
 * Gate recommendations feature
 *
 * Checks if user has the entitlement to view personalized recommendations.
 * VIP plan only feature.
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { gateRecommendations } from '../middlewares/tourist-entitlements';
 *
 * app.get(
 *   '/recommendations',
 *   entitlementMiddleware(),
 *   gateRecommendations(),
 *   async (c) => {
 *     // User can view recommendations - proceed
 *   }
 * );
 * ```
 */
export function gateRecommendations(): AppMiddleware {
    return async (c, next) => {
        try {
            // Check entitlement
            const recommendationsEntitlement = 'can_view_recommendations' as EntitlementKey;

            if (!hasEntitlement(c, recommendationsEntitlement)) {
                throw new HTTPException(403, {
                    message: JSON.stringify({
                        success: false,
                        error: {
                            code: 'ENTITLEMENT_REQUIRED',
                            message:
                                'Las recomendaciones personalizadas son exclusivas del plan VIP. Actualiza para acceder.',
                            details: {
                                entitlement: recommendationsEntitlement,
                                upgradeUrl: '/billing/plans'
                            }
                        }
                    })
                });
            }

            // Entitlement OK - proceed
            await next();
        } catch (error) {
            if (error instanceof HTTPException) {
                throw error;
            }

            apiLogger.error(
                `Error in recommendations gate: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    };
}

/**
 * Gate exclusive deals feature
 *
 * Checks if user has the entitlement to view exclusive deals.
 * VIP plan only feature.
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { gateExclusiveDeals } from '../middlewares/tourist-entitlements';
 *
 * app.get(
 *   '/deals/exclusive',
 *   entitlementMiddleware(),
 *   gateExclusiveDeals(),
 *   async (c) => {
 *     // User can view exclusive deals - proceed
 *   }
 * );
 * ```
 */
export function gateExclusiveDeals(): AppMiddleware {
    return async (c, next) => {
        try {
            // Check entitlement
            if (!hasEntitlement(c, EntitlementKey.EXCLUSIVE_DEALS)) {
                throw new HTTPException(403, {
                    message: JSON.stringify({
                        success: false,
                        error: {
                            code: 'ENTITLEMENT_REQUIRED',
                            message:
                                'Las ofertas exclusivas son solo para miembros VIP. Actualiza tu plan para acceder.',
                            details: {
                                entitlement: EntitlementKey.EXCLUSIVE_DEALS,
                                upgradeUrl: '/billing/plans'
                            }
                        }
                    })
                });
            }

            // Entitlement OK - proceed
            await next();
        } catch (error) {
            if (error instanceof HTTPException) {
                throw error;
            }

            apiLogger.error(
                `Error in exclusive deals gate: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    };
}

/**
 * Gate early event access feature
 *
 * Checks if user has the entitlement for early event access and
 * validates if the event is within the 24-hour early access window.
 *
 * Note: This middleware expects event start date to be passed
 * via context at 'eventStartDate' key (set by route handler).
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { gateEarlyEventAccess } from '../middlewares/tourist-entitlements';
 *
 * app.post(
 *   '/events/:id/tickets',
 *   entitlementMiddleware(),
 *   gateEarlyEventAccess(),
 *   async (c) => {
 *     // User can access event early - proceed
 *   }
 * );
 * ```
 */
export function gateEarlyEventAccess(): AppMiddleware {
    return async (c, next) => {
        try {
            // Check entitlement
            if (!hasEntitlement(c, EntitlementKey.EARLY_ACCESS_EVENTS)) {
                throw new HTTPException(403, {
                    message: JSON.stringify({
                        success: false,
                        error: {
                            code: 'ENTITLEMENT_REQUIRED',
                            message:
                                'El acceso anticipado a eventos es exclusivo de los planes Plus y VIP. Actualiza para acceder.',
                            details: {
                                entitlement: EntitlementKey.EARLY_ACCESS_EVENTS,
                                upgradeUrl: '/billing/plans'
                            }
                        }
                    })
                });
            }

            // Get event start date from context (set by route handler)
            const eventStartDate = c.get('eventStartDate') as Date | undefined;

            if (eventStartDate) {
                // Check if event is within 24-hour early access window
                const now = new Date();
                const publicSaleStart = new Date(eventStartDate);
                const earlyAccessStart = new Date(publicSaleStart.getTime() - 24 * 60 * 60 * 1000);

                // If current time is before early access window, deny
                if (now < earlyAccessStart) {
                    throw new HTTPException(403, {
                        message: JSON.stringify({
                            success: false,
                            error: {
                                code: 'EARLY_ACCESS_NOT_STARTED',
                                message:
                                    'El acceso anticipado para este evento aún no ha comenzado.',
                                details: {
                                    earlyAccessStart: earlyAccessStart.toISOString(),
                                    publicSaleStart: publicSaleStart.toISOString()
                                }
                            }
                        })
                    });
                }

                // If current time is after public sale start, no need for early access
                // (anyone can access now)
                if (now >= publicSaleStart) {
                    apiLogger.debug(
                        'Event is now in public sale period, early access no longer needed'
                    );
                }
            }

            // Entitlement and timing OK - proceed
            await next();
        } catch (error) {
            if (error instanceof HTTPException) {
                throw error;
            }

            apiLogger.error(
                `Error in early event access gate: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    };
}

/**
 * Gate direct contact feature
 *
 * Checks if user has the entitlement to view direct contact information
 * (email/phone) for accommodations.
 * Plus and VIP plans only.
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { gateDirectContact } from '../middlewares/tourist-entitlements';
 *
 * app.get(
 *   '/accommodations/:id/contact',
 *   entitlementMiddleware(),
 *   gateDirectContact(),
 *   async (c) => {
 *     // User can view contact info - proceed
 *   }
 * );
 * ```
 */
export function gateDirectContact(): AppMiddleware {
    return async (c, next) => {
        try {
            // Check entitlement
            const directContactEntitlement = 'can_contact_email_direct' as EntitlementKey;

            if (!hasEntitlement(c, directContactEntitlement)) {
                throw new HTTPException(403, {
                    message: JSON.stringify({
                        success: false,
                        error: {
                            code: 'ENTITLEMENT_REQUIRED',
                            message:
                                'El contacto directo con alojamientos solo está disponible en los planes Plus y VIP. Actualiza para acceder.',
                            details: {
                                entitlement: directContactEntitlement,
                                upgradeUrl: '/billing/plans'
                            }
                        }
                    })
                });
            }

            // Entitlement OK - proceed
            await next();
        } catch (error) {
            if (error instanceof HTTPException) {
                throw error;
            }

            apiLogger.error(
                `Error in direct contact gate: ${error instanceof Error ? error.message : String(error)}`
            );
            throw error;
        }
    };
}
