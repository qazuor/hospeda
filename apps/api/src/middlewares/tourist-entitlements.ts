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
 *
 * Must be used AFTER entitlement middleware which loads user entitlements.
 *
 * @module middlewares/tourist-entitlements
 */

import { EntitlementKey, type LimitKey } from '@repo/billing';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import type { AppBindings, AppMiddleware } from '../types';
import { checkLimit } from '../utils/limit-check';
import { apiLogger } from '../utils/logger';
import { hasEntitlement } from './entitlement';

/**
 * Gates the favorites/bookmarks feature on the entitlement axis.
 *
 * Returns 403 ENTITLEMENT_REQUIRED when the actor lacks SAVE_FAVORITES.
 * This is the entitlement layer ONLY — count + limit enforcement lives in
 * `enforceFavoritesLimit` (apps/api/src/middlewares/limit-enforcement.ts)
 * which counts the user's bookmarks via the service layer. Use both in
 * cascade on routes that need the full gate (entitlement check first so
 * users without the feature get a clean ENTITLEMENT_REQUIRED instead of
 * a confusing LIMIT_REACHED at 0/0).
 *
 * Plans that include `SAVE_FAVORITES` (per `plans.config.ts`):
 *   - tourist-free, tourist-plus, tourist-vip
 *   - (HOST / CLIENT_MANAGER roles do NOT include this entitlement,
 *     so bookmarking from those roles will 403 here — by design)
 *
 * Refactored as part of SPEC-143 #25, mirroring the pattern shipped on
 * gateRichDescription (PR #1250) and gateVideoEmbed: throw
 * ServiceError(ENTITLEMENT_REQUIRED, ...) so the route-level error mapper
 * (PR #1246 fix) produces the standard 403 envelope the frontend already
 * handles. No body-stream consumption, no custom HTTPException JSON
 * stringification.
 *
 * @returns Middleware handler
 */
export function gateFavorites(): AppMiddleware {
    return async (c, next) => {
        if (hasEntitlement(c, EntitlementKey.SAVE_FAVORITES)) {
            await next();
            return;
        }

        apiLogger.warn(`gateFavorites: blocked — user lacks ${EntitlementKey.SAVE_FAVORITES}`);

        throw new ServiceError(
            ServiceErrorCode.ENTITLEMENT_REQUIRED,
            'Tu plan no incluye guardar favoritos. Actualizá tu plan para acceder a esta funcionalidad.',
            {
                requiredEntitlement: EntitlementKey.SAVE_FAVORITES,
                upgradeUrl: '/billing/plans'
            }
        );
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
        // Check entitlement first — users without the feature get ENTITLEMENT_REQUIRED
        // before reaching any limit check.
        if (!hasEntitlement(c, EntitlementKey.PRICE_ALERTS)) {
            apiLogger.warn(`gateAlerts: blocked — user lacks ${EntitlementKey.PRICE_ALERTS}`);

            throw new ServiceError(
                ServiceErrorCode.ENTITLEMENT_REQUIRED,
                'Las alertas de precio solo están disponibles en los planes Plus y VIP. Actualiza tu plan para acceder.',
                {
                    requiredEntitlement: EntitlementKey.PRICE_ALERTS,
                    upgradeUrl: '/billing/plans'
                }
            );
        }

        // Get current active alerts count from context (set by route handler)
        const currentCountValue = c.get('currentActiveAlertsCount' as never);
        const currentCount = typeof currentCountValue === 'number' ? currentCountValue : 0;

        // Check limit (max_active_alerts)
        // Note: This limit key needs to be added to LimitKey enum in @repo/billing
        const limitKey = 'max_active_alerts' as LimitKey;
        const limitCheck = checkLimit({
            context: c as Context<AppBindings>,
            limitKey,
            currentCount
        });

        if (!limitCheck.allowed) {
            apiLogger.warn(
                `gateAlerts: limit reached — ${limitCheck.currentCount}/${limitCheck.maxAllowed}`
            );

            throw new ServiceError(
                ServiceErrorCode.LIMIT_REACHED,
                limitCheck.upgradeMessage ??
                    'Has alcanzado el límite de alertas activas. Actualiza tu plan para crear más.',
                {
                    limitKey,
                    currentCount: limitCheck.currentCount,
                    maxAllowed: limitCheck.maxAllowed,
                    remaining: limitCheck.remaining,
                    upgradeAudience: 'tourist'
                }
            );
        }

        // Entitlement and limit OK - proceed
        await next();
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
        // Check entitlement first — users without the feature get ENTITLEMENT_REQUIRED
        // before reaching any limit check.
        if (!hasEntitlement(c, EntitlementKey.CAN_COMPARE_ACCOMMODATIONS)) {
            apiLogger.warn(
                `gateComparator: blocked — user lacks ${EntitlementKey.CAN_COMPARE_ACCOMMODATIONS}`
            );

            throw new ServiceError(
                ServiceErrorCode.ENTITLEMENT_REQUIRED,
                'El comparador de alojamientos solo está disponible en los planes Plus y VIP. Actualiza tu plan para acceder.',
                {
                    requiredEntitlement: EntitlementKey.CAN_COMPARE_ACCOMMODATIONS,
                    upgradeUrl: '/billing/plans'
                }
            );
        }

        // Get current compare items count from context (set by route handler)
        const currentCountValue = c.get('currentCompareItemsCount' as never);
        const currentCount = typeof currentCountValue === 'number' ? currentCountValue : 0;

        // Check limit
        const limitKey = 'max_compare_items' as LimitKey;
        const limitCheck = checkLimit({
            context: c as Context<AppBindings>,
            limitKey,
            currentCount
        });

        if (!limitCheck.allowed) {
            apiLogger.warn(
                `gateComparator: limit reached — ${limitCheck.currentCount}/${limitCheck.maxAllowed}`
            );

            throw new ServiceError(
                ServiceErrorCode.LIMIT_REACHED,
                limitCheck.upgradeMessage ??
                    'Has alcanzado el límite de elementos en el comparador. Actualiza tu plan para comparar más.',
                {
                    limitKey,
                    currentCount: limitCheck.currentCount,
                    maxAllowed: limitCheck.maxAllowed,
                    remaining: limitCheck.remaining,
                    upgradeAudience: 'tourist'
                }
            );
        }

        // Entitlement and limit OK - proceed
        await next();
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
        if (hasEntitlement(c, EntitlementKey.CAN_ATTACH_REVIEW_PHOTOS)) {
            await next();
            return;
        }

        apiLogger.warn(
            `gateReviewPhotos: blocked — user lacks ${EntitlementKey.CAN_ATTACH_REVIEW_PHOTOS}`
        );

        throw new ServiceError(
            ServiceErrorCode.ENTITLEMENT_REQUIRED,
            'Adjuntar fotos a reseñas es una funcionalidad exclusiva de los planes Plus y VIP. Actualiza para acceder.',
            {
                requiredEntitlement: EntitlementKey.CAN_ATTACH_REVIEW_PHOTOS,
                upgradeUrl: '/billing/plans'
            }
        );
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
        if (hasEntitlement(c, EntitlementKey.CAN_VIEW_SEARCH_HISTORY)) {
            await next();
            return;
        }

        apiLogger.warn(
            `gateSearchHistory: blocked — user lacks ${EntitlementKey.CAN_VIEW_SEARCH_HISTORY}`
        );

        throw new ServiceError(
            ServiceErrorCode.ENTITLEMENT_REQUIRED,
            'El historial de búsqueda solo está disponible en los planes Plus y VIP. Actualiza tu plan para acceder.',
            {
                requiredEntitlement: EntitlementKey.CAN_VIEW_SEARCH_HISTORY,
                upgradeUrl: '/billing/plans'
            }
        );
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
        if (hasEntitlement(c, EntitlementKey.CAN_VIEW_RECOMMENDATIONS)) {
            await next();
            return;
        }

        apiLogger.warn(
            `gateRecommendations: blocked — user lacks ${EntitlementKey.CAN_VIEW_RECOMMENDATIONS}`
        );

        throw new ServiceError(
            ServiceErrorCode.ENTITLEMENT_REQUIRED,
            'Las recomendaciones personalizadas están disponibles en todos los planes. Inicia sesión para acceder.',
            {
                requiredEntitlement: EntitlementKey.CAN_VIEW_RECOMMENDATIONS,
                upgradeUrl: '/billing/plans'
            }
        );
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
        if (hasEntitlement(c, EntitlementKey.EXCLUSIVE_DEALS)) {
            await next();
            return;
        }

        apiLogger.warn(
            `gateExclusiveDeals: blocked — user lacks ${EntitlementKey.EXCLUSIVE_DEALS}`
        );

        throw new ServiceError(
            ServiceErrorCode.ENTITLEMENT_REQUIRED,
            'Las ofertas exclusivas son solo para miembros VIP. Actualiza tu plan para acceder.',
            {
                requiredEntitlement: EntitlementKey.EXCLUSIVE_DEALS,
                upgradeUrl: '/billing/plans'
            }
        );
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
        // Check entitlement first — users without the feature get ENTITLEMENT_REQUIRED.
        if (!hasEntitlement(c, EntitlementKey.EARLY_ACCESS_EVENTS)) {
            apiLogger.warn(
                `gateEarlyEventAccess: blocked — user lacks ${EntitlementKey.EARLY_ACCESS_EVENTS}`
            );

            throw new ServiceError(
                ServiceErrorCode.ENTITLEMENT_REQUIRED,
                'El acceso anticipado a eventos es exclusivo de los planes Plus y VIP. Actualiza para acceder.',
                {
                    requiredEntitlement: EntitlementKey.EARLY_ACCESS_EVENTS,
                    upgradeUrl: '/billing/plans'
                }
            );
        }

        // Get event start date from context (set by route handler)
        const eventStartDateValue = c.get('eventStartDate' as never) as unknown;
        const eventStartDate =
            eventStartDateValue instanceof Date ? eventStartDateValue : undefined;

        if (eventStartDate) {
            // Check if event is within 24-hour early access window
            const now = new Date();
            const publicSaleStart = new Date(eventStartDate);
            const earlyAccessStart = new Date(publicSaleStart.getTime() - 24 * 60 * 60 * 1000);

            // If current time is before early access window, deny with FORBIDDEN + timing details.
            if (now < earlyAccessStart) {
                apiLogger.warn(
                    `gateEarlyEventAccess: early access window not yet open (starts ${earlyAccessStart.toISOString()})`
                );

                throw new ServiceError(
                    ServiceErrorCode.FORBIDDEN,
                    'El acceso anticipado para este evento aún no ha comenzado.',
                    {
                        earlyAccessStart: earlyAccessStart.toISOString(),
                        publicSaleStart: publicSaleStart.toISOString()
                    }
                );
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
    };
}
