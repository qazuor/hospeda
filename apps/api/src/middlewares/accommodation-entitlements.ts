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
import {
    containsRichDescription,
    containsVideoEmbed,
    stripRichDescriptionSyntax,
    stripVideoEmbeds
} from '../lib/content-detection';
import type { AppMiddleware } from '../types';
import { apiLogger } from '../utils/logger';
import { hasEntitlement } from './entitlement';

/**
 * Gates rich description feature (markdown formatting).
 *
 * Checks if the request body's `description` contains markdown syntax and
 * the user lacks `CAN_USE_RICH_DESCRIPTION`. Plain-text descriptions pass
 * through regardless of plan — the gate only fires when the user is actually
 * exercising the gated capability.
 *
 * Design note: SPEC-143 Block 1 smoke C.9 documented two failure modes for
 * this gate — "silent strip" or "no enforcement". This gate originally chose
 * a third option: `throw` 403 ENTITLEMENT_REQUIRED for the whole request.
 *
 * **HOS-216 policy flex (relaxes the SPEC-143 decision above):** the 403
 * aborted the ENTIRE `PATCH /accommodations/:id` request, not just the
 * description field. Combined with the unordered-list pattern originally
 * matching a single bullet line, an owner-basico host writing a plain-text
 * amenities list ("- WiFi\n- Pileta" — extremely common host copy) lost
 * name/price/capacity/contact changes in the SAME request purely because of
 * a false-positive on the description. That is worse than the "silent
 * strip" the original design rejected. As of HOS-216:
 *   1. The unordered-list pattern requires 2+ consecutive bullet lines
 *      (see `content-detection.ts`), fixing the false positive at the
 *      source for legitimate single-line prose.
 *   2. When rich content IS genuinely detected and the actor still lacks
 *      the entitlement, the gate no longer throws — it neutralizes only the
 *      rich syntax in `description` (via `stripRichDescriptionSyntax`),
 *      stashes the sanitized value on `c` for the route handler to apply,
 *      and lets the rest of the PATCH proceed. Base fields always save; the
 *      rich formatting is silently downgraded to plain text, logged here
 *      for observability instead of surfaced as a hard 403.
 * This is a deliberate, scoped exception — NOT a reversal of "no silent
 * strip" as a general principle. It applies only to `description` inside
 * this compound PATCH, where a hard reject was corrupting unrelated fields.
 *
 * Body reading: the middleware uses `ctx.req.raw.clone().json()` so the
 * downstream zValidator can re-read the ORIGINAL body — this gate never
 * mutates the raw request stream. The sanitized override lives on context
 * (`accommodationDescriptionOverride`) and is applied explicitly by the
 * route handler after validation.
 *
 * Wired by SPEC-143 Block 4 follow-up on `PATCH /api/v1/protected/accommodations/:id`
 * as the reference implementation of the negative-entitlement gating pattern
 * for finding #25. `gateVideoEmbed` and `gateFavorites` followed the same
 * pattern in PR #1252 (accommodation PATCH and user-bookmark create
 * respectively). The remaining 5 gates (gateCalendarAccess,
 * gateExternalCalendarSync, gateWhatsAppDisplay, gateWhatsAppDirect,
 * gateReviewResponse) target write surfaces that do not exist today.
 * See SPEC-143 #33 and the per-gate TODOs in this file.
 *
 * **Staff bypass (INV-6):** SUPER_ADMIN, ADMIN, EDITOR, and CLIENT_MANAGER
 * pass unconditionally. {@link entitlementMiddleware} loads the unlimited
 * entitlement set for these roles before this function runs, so
 * `hasEntitlement(c, CAN_USE_RICH_DESCRIPTION)` returns `true` for staff and
 * `await next()` is called without inspecting the body or throwing a 403.
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
        if (typeof description !== 'string' || !containsRichDescription(description)) {
            await next();
            return;
        }

        apiLogger.warn(
            `gateRichDescription: neutralized rich content in description — user lacks ${EntitlementKey.CAN_USE_RICH_DESCRIPTION}`
        );

        // HOS-216: neutralize only the rich portion, let the rest of the
        // PATCH proceed. See the doc comment above for the full rationale.
        c.set('accommodationDescriptionOverride', stripRichDescriptionSyntax(description));

        await next();
    };
}

/**
 * Gates video embed feature.
 *
 * Neutralizes video embed URLs (YouTube / Vimeo / Dailymotion) in the
 * request body's `description` field when the actor lacks `CAN_EMBED_VIDEO`.
 * Plain prose passes through regardless of plan — the gate only fires when
 * the user is actually exercising the gated capability.
 *
 * Originally refactored from a "silent strip" implementation to a hard 403
 * as part of SPEC-143 #25, mirroring `gateRichDescription`. **HOS-216
 * reverted the 403 back to a scoped strip** for the same reason documented
 * on `gateRichDescription`: this gate runs on the same compound
 * `PATCH /accommodations/:id` request, and a 403 here aborted unrelated
 * field changes (name, price, capacity, contact) over a video URL in the
 * description. See the `gateRichDescription` doc comment for the full
 * rationale — this is a scoped exception to "no silent strip", not a
 * reversal of the general principle.
 *
 * Runs AFTER `gateRichDescription` in the route's middleware chain: if that
 * gate already stashed a sanitized `description` on context (because the
 * actor also lacks `CAN_USE_RICH_DESCRIPTION`), this gate reads and further
 * sanitizes THAT value instead of re-reading the raw body, so the two gates
 * compose instead of one undoing the other's neutralization.
 *
 * Same body-clone strategy as `gateRichDescription` so downstream
 * zValidator works — this gate never mutates the raw request stream.
 *
 * **Staff bypass (INV-6):** SUPER_ADMIN, ADMIN, EDITOR, and CLIENT_MANAGER
 * pass unconditionally. {@link entitlementMiddleware} loads the unlimited
 * entitlement set for these roles before this function runs, so
 * `hasEntitlement(c, CAN_EMBED_VIDEO)` returns `true` for staff and
 * `await next()` is called without inspecting the body or throwing a 403.
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

        // Compose with a prior gateRichDescription pass: prefer its
        // sanitized override (already stripped of markdown) over the raw
        // body so neither gate's neutralization undoes the other's.
        const priorOverride = c.get('accommodationDescriptionOverride');
        let description: unknown = priorOverride;

        if (description === undefined) {
            let body: { description?: unknown };
            try {
                body = (await c.req.raw.clone().json()) as { description?: unknown };
            } catch {
                await next();
                return;
            }
            description = body?.description;
        }

        if (typeof description !== 'string' || !containsVideoEmbed(description)) {
            await next();
            return;
        }

        apiLogger.warn(
            `gateVideoEmbed: neutralized video embed in description — user lacks ${EntitlementKey.CAN_EMBED_VIDEO}`
        );

        // HOS-216: neutralize only the video-URL portion, let the rest of
        // the PATCH proceed. See the doc comment above for the full rationale.
        c.set('accommodationDescriptionOverride', stripVideoEmbeds(description));

        await next();
    };
}

/**
 * Gates calendar access
 *
 * Checks if user has CAN_USE_CALENDAR entitlement.
 * Returns 403 if user tries to access calendar features without entitlement.
 *
 * TODO (SPEC-143 #33): Not wired today. No route exists at
 * `GET /accommodations/:id/calendar`. Smoke B.7 returned 404 confirming
 * the missing surface. Wire this middleware once the calendar route ships.
 *
 * **Staff bypass (INV-6):** SUPER_ADMIN, ADMIN, EDITOR, and CLIENT_MANAGER
 * pass unconditionally. {@link entitlementMiddleware} loads the unlimited
 * entitlement set for these roles before this function runs, so
 * `hasEntitlement(c, CAN_USE_CALENDAR)` always returns `true` for staff and
 * `await next()` is called without throwing a 403.
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
// PHANTOM-GATE (SPEC-145): route not built yet — see docs/billing/endpoint-gate-matrix.md
// (Reserved — Phantom Gates section). Intended for GET /accommodations/:id/calendar
// once that route ships. Do NOT delete and do NOT build the route without a spec.
export function gateCalendarAccess(): AppMiddleware {
    return async (c, next) => {
        if (hasEntitlement(c, EntitlementKey.CAN_USE_CALENDAR)) {
            await next();
            return;
        }

        apiLogger.warn(
            `gateCalendarAccess: blocked — user lacks ${EntitlementKey.CAN_USE_CALENDAR}`
        );

        throw new ServiceError(
            ServiceErrorCode.ENTITLEMENT_REQUIRED,
            'Calendar access requires Pro or Premium plan. Upgrade to access availability calendar.',
            {
                requiredEntitlement: EntitlementKey.CAN_USE_CALENDAR,
                upgradeUrl: '/billing/plans'
            }
        );
    };
}

/**
 * Gates external calendar sync
 *
 * Checks if user has CAN_SYNC_EXTERNAL_CALENDAR entitlement.
 * Returns 403 if user tries to sync external calendars without entitlement.
 *
 * TODO (SPEC-143 #33): Not wired today. No route exists at
 * `POST /accommodations/:id/calendar/sync`. Depends on the calendar feature
 * surface (same blocker as `gateCalendarAccess`). Wire once the route ships.
 *
 * **Staff bypass (INV-6):** SUPER_ADMIN, ADMIN, EDITOR, and CLIENT_MANAGER
 * pass unconditionally. {@link entitlementMiddleware} loads the unlimited
 * entitlement set for these roles before this function runs, so
 * `hasEntitlement(c, CAN_SYNC_EXTERNAL_CALENDAR)` always returns `true` for
 * staff and `await next()` is called without throwing a 403.
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
// PHANTOM-GATE (SPEC-145): route not built yet — see docs/billing/endpoint-gate-matrix.md
// (Reserved — Phantom Gates section). Intended for POST /accommodations/:id/calendar/sync
// once that route ships. Do NOT delete and do NOT build the route without a spec.
export function gateExternalCalendarSync(): AppMiddleware {
    return async (c, next) => {
        if (hasEntitlement(c, EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR)) {
            await next();
            return;
        }

        apiLogger.warn(
            `gateExternalCalendarSync: blocked — user lacks ${EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR}`
        );

        throw new ServiceError(
            ServiceErrorCode.ENTITLEMENT_REQUIRED,
            'External calendar sync requires Premium plan. Upgrade to sync with Google Calendar, Airbnb, etc.',
            {
                requiredEntitlement: EntitlementKey.CAN_SYNC_EXTERNAL_CALENDAR,
                upgradeUrl: '/billing/plans'
            }
        );
    };
}

/**
 * Gates WhatsApp display
 *
 * Checks if user has CAN_CONTACT_WHATSAPP_DISPLAY entitlement.
 * Returns 403 if user tries to add WhatsApp number without entitlement.
 *
 * TODO (SPEC-143 #33): Not wired today. The accommodation schema has no
 * `whatsappNumber` or `contactWhatsApp` fields. WhatsApp display is a UI-only
 * feature derived from `contactInfo.mobilePhone`. Wire this middleware only
 * after the schema gains explicit WhatsApp fields (product decision needed:
 * is it a separate field or just a flag on mobilePhone?).
 *
 * **Staff bypass (INV-6):** SUPER_ADMIN, ADMIN, EDITOR, and CLIENT_MANAGER
 * pass unconditionally. {@link entitlementMiddleware} loads the unlimited
 * entitlement set for these roles before this function runs, so
 * `hasEntitlement(c, CAN_CONTACT_WHATSAPP_DISPLAY)` returns `true` for staff
 * and `await next()` is called without inspecting the body or throwing a 403.
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
// PHANTOM-GATE (SPEC-145): still not wired to any route. HOS-19 shipped WhatsApp
// contact as a VIEWER-gated READ feature (the number is gated by the tourist's
// plan on GET /protected/accommodations/:id/whatsapp), NOT an owner WRITE gate —
// so this write-side gate is intentionally NOT used and remains reserved. Any
// owner may set contactInfo.whatsapp freely (BETA-151). Do NOT delete and do NOT
// wire this without a new spec. See docs/billing/endpoint-gate-matrix.md.
export function gateWhatsAppDisplay(): AppMiddleware {
    return async (c, next) => {
        const canDisplayWhatsApp = hasEntitlement(c, EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY);

        if (canDisplayWhatsApp) {
            await next();
            return;
        }

        // Read body without consuming the stream — clone so downstream
        // zValidator / handler can re-read.
        let body: { whatsappNumber?: unknown; contactWhatsApp?: unknown };
        try {
            body = (await c.req.raw.clone().json()) as {
                whatsappNumber?: unknown;
                contactWhatsApp?: unknown;
            };
        } catch {
            // Non-JSON or empty body: nothing to gate, let handler decide.
            await next();
            return;
        }

        if (!body.whatsappNumber && !body.contactWhatsApp) {
            // Not exercising the gated capability — pass through.
            await next();
            return;
        }

        apiLogger.warn(
            `gateWhatsAppDisplay: blocked — user lacks ${EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY}`
        );

        throw new ServiceError(
            ServiceErrorCode.ENTITLEMENT_REQUIRED,
            'Displaying WhatsApp number requires Pro or Premium plan. Upgrade to show your WhatsApp contact.',
            {
                requiredEntitlement: EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
                upgradeUrl: '/billing/plans'
            }
        );
    };
}

/**
 * Gates WhatsApp direct link
 *
 * Checks if user has CAN_CONTACT_WHATSAPP_DIRECT entitlement.
 * Returns 403 if user tries to enable direct WhatsApp link without entitlement.
 *
 * TODO (SPEC-143 #33): Not wired today. The accommodation schema has no
 * `whatsappDirectLink` or `enableWhatsAppDirect` fields. Same blocker as
 * `gateWhatsAppDisplay`: the WhatsApp feature surface is UI-only. Wire only
 * after the schema gains explicit fields.
 *
 * **Staff bypass (INV-6):** SUPER_ADMIN, ADMIN, EDITOR, and CLIENT_MANAGER
 * pass unconditionally. {@link entitlementMiddleware} loads the unlimited
 * entitlement set for these roles before this function runs, so
 * `hasEntitlement(c, CAN_CONTACT_WHATSAPP_DIRECT)` returns `true` for staff
 * and `await next()` is called without inspecting the body or throwing a 403.
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
// PHANTOM-GATE (SPEC-145): still not wired to any route. HOS-19 shipped WhatsApp
// "direct" as a VIEWER capability — the `wa.me` deep link is authorized by the
// tourist's CAN_CONTACT_WHATSAPP_DIRECT plan on GET /protected/accommodations/:id/whatsapp,
// NOT by an owner-stored flag. There is no `whatsappDirectLink` column and this
// write-side gate is intentionally NOT used. Do NOT delete and do NOT wire this
// without a new spec. See docs/billing/endpoint-gate-matrix.md.
export function gateWhatsAppDirect(): AppMiddleware {
    return async (c, next) => {
        const canUseWhatsAppDirect = hasEntitlement(c, EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT);

        if (canUseWhatsAppDirect) {
            await next();
            return;
        }

        // Read body without consuming the stream — clone so downstream
        // zValidator / handler can re-read.
        let body: { whatsappDirectLink?: unknown; enableWhatsAppDirect?: unknown };
        try {
            body = (await c.req.raw.clone().json()) as {
                whatsappDirectLink?: unknown;
                enableWhatsAppDirect?: unknown;
            };
        } catch {
            // Non-JSON or empty body: nothing to gate, let handler decide.
            await next();
            return;
        }

        if (body.whatsappDirectLink !== true && body.enableWhatsAppDirect !== true) {
            // Not exercising the gated capability — pass through.
            await next();
            return;
        }

        apiLogger.warn(
            `gateWhatsAppDirect: blocked — user lacks ${EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT}`
        );

        throw new ServiceError(
            ServiceErrorCode.ENTITLEMENT_REQUIRED,
            'Clickable WhatsApp link requires Premium plan. Upgrade to enable direct WhatsApp chat.',
            {
                requiredEntitlement: EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT,
                upgradeUrl: '/billing/plans'
            }
        );
    };
}

/**
 * Gates review response feature
 *
 * Checks if user has RESPOND_REVIEWS entitlement.
 * Returns 403 if user tries to respond to reviews without entitlement.
 *
 * TODO (SPEC-143 #33): Not wired today. No respond-to-review endpoint
 * exists. Smoke B.6 confirmed only `POST /reviews` (create) is implemented;
 * there is no `POST /accommodations/:id/reviews/:reviewId/response`. Wire
 * this middleware once the response endpoint ships.
 *
 * **Staff bypass (INV-6):** SUPER_ADMIN, ADMIN, EDITOR, and CLIENT_MANAGER
 * pass unconditionally. {@link entitlementMiddleware} loads the unlimited
 * entitlement set for these roles before this function runs, so
 * `hasEntitlement(c, RESPOND_REVIEWS)` always returns `true` for staff and
 * `await next()` is called without throwing a 403.
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
// PHANTOM-GATE (SPEC-145): route not built yet — see docs/billing/endpoint-gate-matrix.md
// (Reserved — Phantom Gates section). Intended for POST /accommodations/:id/reviews/:reviewId/response
// once that route ships. Do NOT delete and do NOT build the route without a spec.
export function gateReviewResponse(): AppMiddleware {
    return async (c, next) => {
        if (hasEntitlement(c, EntitlementKey.RESPOND_REVIEWS)) {
            await next();
            return;
        }

        apiLogger.warn(
            `gateReviewResponse: blocked — user lacks ${EntitlementKey.RESPOND_REVIEWS}`
        );

        throw new ServiceError(
            ServiceErrorCode.ENTITLEMENT_REQUIRED,
            'Responding to reviews requires Pro or Premium plan. Upgrade to engage with your guests.',
            {
                requiredEntitlement: EntitlementKey.RESPOND_REVIEWS,
                upgradeUrl: '/billing/plans'
            }
        );
    };
}
