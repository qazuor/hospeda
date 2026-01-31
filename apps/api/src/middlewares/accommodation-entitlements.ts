/**
 * Accommodation Entitlement Gating Middleware
 *
 * Provides middleware for gating accommodation features based on user entitlements.
 * These middlewares check if users have specific entitlements and either:
 * - Block access (403) for feature access
 * - Strip content for data transformation
 *
 * Must be used AFTER entitlement middleware which loads user entitlements.
 *
 * @module middlewares/accommodation-entitlements
 */

import { EntitlementKey } from '@repo/billing';
import { HTTPException } from 'hono/http-exception';
import type { AppMiddleware } from '../types';
import { apiLogger } from '../utils/logger';
import { hasEntitlement } from './entitlement';

/**
 * Gates rich description feature (markdown formatting)
 *
 * Checks if user has CAN_USE_RICH_DESCRIPTION entitlement.
 * If not, strips markdown from description field in request body.
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { gateRichDescription } from '../middlewares/accommodation-entitlements';
 *
 * app.post(
 *   '/accommodations',
 *   entitlementMiddleware(),
 *   gateRichDescription(),
 *   async (c) => {
 *     // Description will be plain text if user doesn't have Pro+ plan
 *   }
 * );
 * ```
 */
export function gateRichDescription(): AppMiddleware {
    return async (c, next) => {
        try {
            // Check if user has rich description entitlement
            const canUseRichDescription = hasEntitlement(
                c,
                EntitlementKey.CAN_USE_RICH_DESCRIPTION
            );

            if (!canUseRichDescription) {
                // Get request body
                const body = await c.req.json();

                // Strip markdown from description if present
                if (body.description && typeof body.description === 'string') {
                    // Simple markdown stripping - remove common markdown syntax
                    body.description = body.description
                        .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
                        .replace(/\*(.+?)\*/g, '$1') // Italic
                        .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
                        .replace(/^#+\s+/gm, '') // Headers
                        .replace(/^[-*+]\s+/gm, '') // Lists
                        .replace(/`(.+?)`/g, '$1') // Code
                        .trim();

                    apiLogger.debug(
                        `Stripped markdown from description - user lacks ${EntitlementKey.CAN_USE_RICH_DESCRIPTION}`
                    );

                    // Replace request with modified body
                    c.req.raw.json = async () => body;
                }
            }

            await next();
        } catch (error) {
            apiLogger.error(
                `Error in rich description gate: ${error instanceof Error ? error.message : String(error)}`
            );
            await next();
        }
    };
}

/**
 * Gates video embed feature
 *
 * Checks if user has CAN_EMBED_VIDEO entitlement.
 * If not, strips video URLs from description and media fields.
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { gateVideoEmbed } from '../middlewares/accommodation-entitlements';
 *
 * app.post(
 *   '/accommodations',
 *   entitlementMiddleware(),
 *   gateVideoEmbed(),
 *   async (c) => {
 *     // Video URLs will be stripped if user doesn't have Premium plan
 *   }
 * );
 * ```
 */
export function gateVideoEmbed(): AppMiddleware {
    return async (c, next) => {
        try {
            // Check if user has video embed entitlement
            const canEmbedVideo = hasEntitlement(c, EntitlementKey.CAN_EMBED_VIDEO);

            if (!canEmbedVideo) {
                // Get request body
                const body = await c.req.json();

                // Video URL patterns (YouTube, Vimeo, etc.)
                const videoUrlPatterns = [
                    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/[\w-]+/gi,
                    /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/[\d]+/gi,
                    /(?:https?:\/\/)?(?:www\.)?dailymotion\.com\/video\/[\w-]+/gi
                ];

                // Strip video URLs from description
                if (body.description && typeof body.description === 'string') {
                    for (const pattern of videoUrlPatterns) {
                        body.description = body.description.replace(pattern, '');
                    }
                }

                // Strip video URLs from videoUrl field if present
                if (body.videoUrl) {
                    body.videoUrl = undefined;
                }

                // Strip from media array if present
                if (Array.isArray(body.media)) {
                    body.media = body.media.filter(
                        (item: { type?: string }) => item.type !== 'video'
                    );
                }

                apiLogger.debug(
                    `Stripped video content - user lacks ${EntitlementKey.CAN_EMBED_VIDEO}`
                );

                // Replace request with modified body
                c.req.raw.json = async () => body;
            }

            await next();
        } catch (error) {
            apiLogger.error(
                `Error in video embed gate: ${error instanceof Error ? error.message : String(error)}`
            );
            await next();
        }
    };
}

/**
 * Gates calendar access
 *
 * Checks if user has CAN_USE_CALENDAR entitlement.
 * Returns 403 if user tries to access calendar features without entitlement.
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { gateCalendarAccess } from '../middlewares/accommodation-entitlements';
 *
 * app.get(
 *   '/accommodations/:id/calendar',
 *   entitlementMiddleware(),
 *   gateCalendarAccess(),
 *   async (c) => {
 *     // User has Pro+ plan - show calendar
 *   }
 * );
 * ```
 */
export function gateCalendarAccess(): AppMiddleware {
    return async (c, next) => {
        const canUseCalendar = hasEntitlement(c, EntitlementKey.CAN_USE_CALENDAR);

        if (!canUseCalendar) {
            apiLogger.warn(
                `Calendar access denied - user lacks ${EntitlementKey.CAN_USE_CALENDAR}`
            );

            throw new HTTPException(403, {
                message: JSON.stringify({
                    success: false,
                    error: {
                        code: 'ENTITLEMENT_REQUIRED',
                        message:
                            'Calendar access requires Pro or Premium plan. Upgrade to access availability calendar.',
                        details: {
                            requiredEntitlement: EntitlementKey.CAN_USE_CALENDAR,
                            upgradeUrl: '/billing/plans'
                        }
                    }
                })
            });
        }

        await next();
    };
}

/**
 * Gates external calendar sync
 *
 * Checks if user has CAN_SYNC_EXTERNAL_CALENDAR entitlement.
 * Returns 403 if user tries to sync external calendars without entitlement.
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { gateExternalCalendarSync } from '../middlewares/accommodation-entitlements';
 *
 * app.post(
 *   '/accommodations/:id/calendar/sync',
 *   entitlementMiddleware(),
 *   gateExternalCalendarSync(),
 *   async (c) => {
 *     // User has Premium plan - can sync Google Calendar
 *   }
 * );
 * ```
 */
export function gateExternalCalendarSync(): AppMiddleware {
    return async (c, next) => {
        const canSyncExternalCalendar = hasEntitlement(
            c,
            EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR
        );

        if (!canSyncExternalCalendar) {
            apiLogger.warn(
                `External calendar sync denied - user lacks ${EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR}`
            );

            throw new HTTPException(403, {
                message: JSON.stringify({
                    success: false,
                    error: {
                        code: 'ENTITLEMENT_REQUIRED',
                        message:
                            'External calendar sync requires Premium plan. Upgrade to sync with Google Calendar, Airbnb, etc.',
                        details: {
                            requiredEntitlement: EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR,
                            upgradeUrl: '/billing/plans'
                        }
                    }
                })
            });
        }

        await next();
    };
}

/**
 * Gates WhatsApp display
 *
 * Checks if user has CAN_CONTACT_WHATSAPP_DISPLAY entitlement.
 * Returns 403 if user tries to add WhatsApp number without entitlement.
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { gateWhatsAppDisplay } from '../middlewares/accommodation-entitlements';
 *
 * app.patch(
 *   '/accommodations/:id',
 *   entitlementMiddleware(),
 *   gateWhatsAppDisplay(),
 *   async (c) => {
 *     // User has Pro+ plan - can display WhatsApp number
 *   }
 * );
 * ```
 */
export function gateWhatsAppDisplay(): AppMiddleware {
    return async (c, next) => {
        try {
            const canDisplayWhatsApp = hasEntitlement(
                c,
                EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY
            );

            if (!canDisplayWhatsApp) {
                // Get request body
                const body = await c.req.json();

                // Check if trying to add WhatsApp number
                if (body.whatsappNumber || body.contactWhatsApp) {
                    apiLogger.warn(
                        `WhatsApp number blocked - user lacks ${EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY}`
                    );

                    throw new HTTPException(403, {
                        message: JSON.stringify({
                            success: false,
                            error: {
                                code: 'ENTITLEMENT_REQUIRED',
                                message:
                                    'Displaying WhatsApp number requires Pro or Premium plan. Upgrade to show your WhatsApp contact.',
                                details: {
                                    requiredEntitlement:
                                        EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
                                    upgradeUrl: '/billing/plans'
                                }
                            }
                        })
                    });
                }
            }

            await next();
        } catch (error) {
            // Re-throw HTTPException
            if (error instanceof HTTPException) {
                throw error;
            }

            apiLogger.error(
                `Error in WhatsApp display gate: ${error instanceof Error ? error.message : String(error)}`
            );
            await next();
        }
    };
}

/**
 * Gates WhatsApp direct link
 *
 * Checks if user has CAN_CONTACT_WHATSAPP_DIRECT entitlement.
 * Returns 403 if user tries to enable direct WhatsApp link without entitlement.
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { gateWhatsAppDirect } from '../middlewares/accommodation-entitlements';
 *
 * app.patch(
 *   '/accommodations/:id',
 *   entitlementMiddleware(),
 *   gateWhatsAppDirect(),
 *   async (c) => {
 *     // User has Premium plan - can enable clickable WhatsApp link
 *   }
 * );
 * ```
 */
export function gateWhatsAppDirect(): AppMiddleware {
    return async (c, next) => {
        try {
            const canUseWhatsAppDirect = hasEntitlement(
                c,
                EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT
            );

            if (!canUseWhatsAppDirect) {
                // Get request body
                const body = await c.req.json();

                // Check if trying to enable direct WhatsApp link
                if (body.whatsappDirectLink === true || body.enableWhatsAppDirect === true) {
                    apiLogger.warn(
                        `WhatsApp direct link blocked - user lacks ${EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT}`
                    );

                    throw new HTTPException(403, {
                        message: JSON.stringify({
                            success: false,
                            error: {
                                code: 'ENTITLEMENT_REQUIRED',
                                message:
                                    'Clickable WhatsApp link requires Premium plan. Upgrade to enable direct WhatsApp chat.',
                                details: {
                                    requiredEntitlement: EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT,
                                    upgradeUrl: '/billing/plans'
                                }
                            }
                        })
                    });
                }
            }

            await next();
        } catch (error) {
            // Re-throw HTTPException
            if (error instanceof HTTPException) {
                throw error;
            }

            apiLogger.error(
                `Error in WhatsApp direct gate: ${error instanceof Error ? error.message : String(error)}`
            );
            await next();
        }
    };
}

/**
 * Gates review response feature
 *
 * Checks if user has RESPOND_REVIEWS entitlement.
 * Returns 403 if user tries to respond to reviews without entitlement.
 *
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * import { gateReviewResponse } from '../middlewares/accommodation-entitlements';
 *
 * app.post(
 *   '/accommodations/:id/reviews/:reviewId/response',
 *   entitlementMiddleware(),
 *   gateReviewResponse(),
 *   async (c) => {
 *     // User has Pro+ plan - can respond to reviews
 *   }
 * );
 * ```
 */
export function gateReviewResponse(): AppMiddleware {
    return async (c, next) => {
        const canRespondToReviews = hasEntitlement(c, EntitlementKey.RESPOND_REVIEWS);

        if (!canRespondToReviews) {
            apiLogger.warn(`Review response denied - user lacks ${EntitlementKey.RESPOND_REVIEWS}`);

            throw new HTTPException(403, {
                message: JSON.stringify({
                    success: false,
                    error: {
                        code: 'ENTITLEMENT_REQUIRED',
                        message:
                            'Responding to reviews requires Pro or Premium plan. Upgrade to engage with your guests.',
                        details: {
                            requiredEntitlement: EntitlementKey.RESPOND_REVIEWS,
                            upgradeUrl: '/billing/plans'
                        }
                    }
                })
            });
        }

        await next();
    };
}
