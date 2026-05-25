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
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { HTTPException } from 'hono/http-exception';
import type { AppMiddleware } from '../types';
import { apiLogger } from '../utils/logger';
import { hasEntitlement } from './entitlement';

/**
 * Detect markdown syntax in a description string.
 *
 * Returns true if the string contains any of the markdown patterns we care
 * about gating (headings, bold, italic, links, list items, inline code).
 * Used by `gateRichDescription` to decide whether the request actually
 * exercises the rich-description capability or just contains plain text.
 *
 * Conservative on purpose: returns false for plain prose so a user without
 * the entitlement can still update their description with text-only content.
 */
const RICH_DESCRIPTION_PATTERNS: readonly RegExp[] = [
    /\*\*[^*]+\*\*/, // Bold (**text**)
    /(?:^|[^*])\*[^*\s][^*]*\*/, // Italic (*text*) — avoid matching bold's **
    /\[[^\]]+\]\([^)]+\)/, // Markdown links
    /^#{1,6}\s/m, // ATX headings
    /^[-*+]\s+\S/m, // Unordered list items
    /`[^`\n]+`/ // Inline code
];

function hasMarkdownSyntax(value: string): boolean {
    return RICH_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Gates rich description feature (markdown formatting).
 *
 * Checks if the request body's `description` contains markdown syntax and
 * the user lacks `CAN_USE_RICH_DESCRIPTION`. When both conditions hold,
 * returns 403 ENTITLEMENT_REQUIRED so the client can prompt the user to
 * upgrade. Plain-text descriptions pass through regardless of plan — the
 * gate only fires when the user is actually exercising the gated capability.
 *
 * Design note: SPEC-143 Block 1 smoke C.9 documented two failure modes for
 * this gate — "silent strip" or "no enforcement". Both indicate a gap.
 * This implementation chooses the third option (return 403) because:
 *   1. The smoke checklist's "correct" expectation is 403 ENTITLEMENT_REQUIRED.
 *   2. Silent-strip is user-hostile (a typed paragraph quietly loses
 *      formatting on save with no UI feedback).
 *   3. The 403 envelope (`code: ENTITLEMENT_REQUIRED, requiredEntitlement,
 *      upgradeUrl`) is the same shape the LIMIT_REACHED gate uses, so the
 *      frontend already has handling.
 *
 * Body reading: the middleware uses `ctx.req.raw.clone().json()` so the
 * downstream zValidator can re-read the body. We do NOT mutate the body
 * (no silent strip).
 *
 * Wired by SPEC-143 Block 4 follow-up on `PATCH /api/v1/protected/accommodations/:id`
 * as the reference implementation of the negative-entitlement gating pattern
 * for finding #25. Remaining 7 gate middlewares (gateVideoEmbed,
 * gateCalendarAccess, gateExternalCalendarSync, gateWhatsAppDisplay,
 * gateWhatsAppDirect, gateReviewResponse, gateFavorites) need analogous
 * wiring on their respective write paths — separate PR per gate.
 *
 * @returns Middleware handler
 */
export function gateRichDescription(): AppMiddleware {
    return async (c, next) => {
        const canUseRichDescription = hasEntitlement(c, EntitlementKey.CAN_USE_RICH_DESCRIPTION);

        if (canUseRichDescription) {
            await next();
            return;
        }

        // Read body without consuming the stream — clone so downstream
        // zValidator / handler can re-read.
        let body: { description?: unknown };
        try {
            body = (await c.req.raw.clone().json()) as { description?: unknown };
        } catch {
            // Non-JSON body or empty body: nothing to gate, let the handler
            // (or its validator) handle the shape mismatch.
            await next();
            return;
        }

        const description = body?.description;
        if (typeof description !== 'string' || !hasMarkdownSyntax(description)) {
            await next();
            return;
        }

        apiLogger.warn(
            `gateRichDescription: blocked update — user lacks ${EntitlementKey.CAN_USE_RICH_DESCRIPTION}`
        );

        throw new ServiceError(
            ServiceErrorCode.ENTITLEMENT_REQUIRED,
            'Tu plan actual no incluye el uso de Markdown en la descripción. Actualizá tu plan para acceder a esta funcionalidad.',
            {
                requiredEntitlement: EntitlementKey.CAN_USE_RICH_DESCRIPTION,
                upgradeUrl: '/billing/plans'
            }
        );
    };
}

/**
 * Detect video embed URLs in a description string.
 *
 * Pattern set covers the major embed providers (YouTube, Vimeo, Dailymotion).
 * Conservative on purpose: a plain mention of "youtube" in prose without a
 * URL does NOT trigger the gate.
 *
 * The accommodation schema does not have a dedicated `videoUrl` or
 * `media[type=video]` field today, so the only realistic gating surface
 * for `CAN_EMBED_VIDEO` is video URLs pasted into the description. If
 * those fields are added later, extend the detection to inspect them too.
 */
const VIDEO_EMBED_PATTERNS: readonly RegExp[] = [
    /\bhttps?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[\w-]+/i,
    /\bhttps?:\/\/(?:www\.)?vimeo\.com\/\d+/i,
    /\bhttps?:\/\/(?:www\.)?dailymotion\.com\/video\/[\w-]+/i
];

function hasVideoEmbed(value: string): boolean {
    return VIDEO_EMBED_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Gates video embed feature.
 *
 * Returns 403 ENTITLEMENT_REQUIRED when the request body's `description`
 * field contains a video URL (YouTube / Vimeo / Dailymotion) AND the actor
 * lacks `CAN_EMBED_VIDEO`. Plain prose passes through regardless of plan —
 * the gate only fires when the user is actually exercising the gated
 * capability.
 *
 * Refactored from the previous "silent strip" implementation as part of
 * SPEC-143 #25, mirroring the `gateRichDescription` pattern shipped in
 * PR #1250. Same body-clone strategy so downstream zValidator works,
 * same ServiceError(ENTITLEMENT_REQUIRED) envelope so the frontend has
 * consistent handling across all entitlement-gated routes.
 *
 * @returns Middleware handler
 */
export function gateVideoEmbed(): AppMiddleware {
    return async (c, next) => {
        const canEmbedVideo = hasEntitlement(c, EntitlementKey.CAN_EMBED_VIDEO);

        if (canEmbedVideo) {
            await next();
            return;
        }

        let body: { description?: unknown };
        try {
            body = (await c.req.raw.clone().json()) as { description?: unknown };
        } catch {
            await next();
            return;
        }

        const description = body?.description;
        if (typeof description !== 'string' || !hasVideoEmbed(description)) {
            await next();
            return;
        }

        apiLogger.warn(
            `gateVideoEmbed: blocked update — user lacks ${EntitlementKey.CAN_EMBED_VIDEO}`
        );

        throw new ServiceError(
            ServiceErrorCode.ENTITLEMENT_REQUIRED,
            'Tu plan actual no incluye incrustar videos en la descripción. Actualizá tu plan para acceder a esta funcionalidad.',
            {
                requiredEntitlement: EntitlementKey.CAN_EMBED_VIDEO,
                upgradeUrl: '/billing/plans'
            }
        );
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
