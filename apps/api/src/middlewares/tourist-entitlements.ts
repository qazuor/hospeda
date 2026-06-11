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
 * - Ad-free experience
 *
 * Must be used AFTER entitlement middleware which loads user entitlements.
 *
 * @module middlewares/tourist-entitlements
 */

import { EntitlementKey, LimitKey } from '@repo/billing';
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
 * **Staff bypass (INV-6):** SUPER_ADMIN, ADMIN, EDITOR, and CLIENT_MANAGER
 * pass unconditionally. {@link entitlementMiddleware} loads the unlimited
 * entitlement set for these roles before this function runs, so
 * `hasEntitlement(c, SAVE_FAVORITES)` always returns `true` for staff and
 * `await next()` is called without a 403 being thrown.
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
 * **Staff bypass (INV-6):** SUPER_ADMIN, ADMIN, EDITOR, and CLIENT_MANAGER
 * pass unconditionally. {@link entitlementMiddleware} loads the unlimited
 * entitlement set for these roles before this function runs, so both the
 * entitlement check and the limit check resolve in favour of the staff actor
 * without throwing a 403.
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
// PHANTOM-GATE (SPEC-145): route not built yet — see docs/billing/endpoint-gate-matrix.md
// (Reserved — Phantom Gates section). Intended for POST /alerts once that route ships.
// Do NOT delete and do NOT build the route without a spec.
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
        const limitKey = LimitKey.MAX_ACTIVE_ALERTS;
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
 * **Staff bypass (INV-6):** SUPER_ADMIN, ADMIN, EDITOR, and CLIENT_MANAGER
 * pass unconditionally. {@link entitlementMiddleware} loads the unlimited
 * entitlement set for these roles before this function runs, so both the
 * entitlement check and the limit check resolve in favour of the staff actor
 * without throwing a 403.
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
// PHANTOM-GATE (SPEC-145): route not built yet — see docs/billing/endpoint-gate-matrix.md
// (Reserved — Phantom Gates section). Intended for POST /compare once that route ships.
// Do NOT delete and do NOT build the route without a spec.
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
        const limitKey = LimitKey.MAX_COMPARE_ITEMS;
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
 * **Staff bypass (INV-6):** SUPER_ADMIN, ADMIN, EDITOR, and CLIENT_MANAGER
 * pass unconditionally. {@link entitlementMiddleware} loads the unlimited
 * entitlement set for these roles before this function runs, so
 * `hasEntitlement(c, CAN_ATTACH_REVIEW_PHOTOS)` always returns `true` for
 * staff and `await next()` is called without throwing a 403.
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
// PHANTOM-GATE (SPEC-145): route not built yet — see docs/billing/endpoint-gate-matrix.md
// (Reserved — Phantom Gates section). Intended for POST /reviews/:id/photos once
// that route ships. Do NOT delete and do NOT build the route without a spec.
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
 * **Staff bypass (INV-6):** SUPER_ADMIN, ADMIN, EDITOR, and CLIENT_MANAGER
 * pass unconditionally. {@link entitlementMiddleware} loads the unlimited
 * entitlement set for these roles before this function runs, so
 * `hasEntitlement(c, CAN_VIEW_SEARCH_HISTORY)` always returns `true` for
 * staff and `await next()` is called without throwing a 403.
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
// PHANTOM-GATE (SPEC-145): route not built yet — see docs/billing/endpoint-gate-matrix.md
// (Reserved — Phantom Gates section). Intended for GET /search-history once that
// route ships. Do NOT delete and do NOT build the route without a spec.
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
 * **Staff bypass (INV-6):** SUPER_ADMIN, ADMIN, EDITOR, and CLIENT_MANAGER
 * pass unconditionally. {@link entitlementMiddleware} loads the unlimited
 * entitlement set for these roles before this function runs, so
 * `hasEntitlement(c, CAN_VIEW_RECOMMENDATIONS)` always returns `true` for
 * staff and `await next()` is called without throwing a 403.
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
// PHANTOM-GATE (SPEC-145): route not built yet — see docs/billing/endpoint-gate-matrix.md
// (Reserved — Phantom Gates section). Intended for GET /recommendations once that
// route ships. Do NOT delete and do NOT build the route without a spec.
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
 * **Staff bypass (INV-6):** SUPER_ADMIN, ADMIN, EDITOR, and CLIENT_MANAGER
 * pass unconditionally. {@link entitlementMiddleware} loads the unlimited
 * entitlement set for these roles before this function runs, so
 * `hasEntitlement(c, EXCLUSIVE_DEALS)` always returns `true` for staff and
 * `await next()` is called without throwing a 403.
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
// PHANTOM-GATE (SPEC-145): route not built yet — see docs/billing/endpoint-gate-matrix.md
// (Reserved — Phantom Gates section). Intended for GET /deals/exclusive once that
// route ships. Do NOT delete and do NOT build the route without a spec.
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
