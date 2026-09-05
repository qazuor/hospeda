/**
 * Public capture endpoint for partner logo clicks (HOS-1063 A-3).
 *
 * ```
 * POST /api/v1/public/partner-logo-clicks
 * ```
 *
 * The deliberate sibling of `POST /api/v1/public/views`: same `skipAuth`, same
 * bot filter, same rate limit, same always-202 contract, same
 * `computeVisitorHash`. Everything that differs is written down below; anything
 * not mentioned is identical on purpose, because the two numbers this feature
 * shows sit side by side in one panel and a difference in how they are collected
 * would be a difference nobody could see.
 *
 * **Why not a row in `entity_views`** — see `partner_logo_click.dbschema.ts`. In
 * one line: a click and a view of the same partner would become
 * indistinguishable and the views card would over-report.
 *
 * **`isBotUserAgent` is imported, not re-implemented.** A second copy of that
 * regex is a second thing to update, and the failure mode of the copies drifting
 * is that one of the two numbers quietly starts counting crawlers.
 *
 * @module routes/partner-logo-clicks/capture
 */

import { PartnerLogoClickCaptureBodySchema, ServiceErrorCode } from '@repo/schemas';
import { PartnerStatsService } from '@repo/service-core';
import type { Context } from 'hono';
import { getClientIp } from '../../middlewares/rate-limit';
import { isGuestActor } from '../../utils/actor';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import { createSimpleRoute } from '../../utils/route-factory';
import { computeVisitorHash } from '../../utils/visitor-hash';
import { z } from '../../utils/zod';
import { isBotUserAgent } from '../views/capture';

const statsService = new PartnerStatsService({ logger: apiLogger });

/**
 * Capture response schema.
 *
 * Always `{ accepted: true }`. A bot-drop, a successful insert, a click on a
 * partner id that does not exist and a DB outage are indistinguishable to the
 * caller — the last one especially, because this fires from the home page and a
 * telemetry failure must never surface an error there.
 *
 * A corollary for anyone writing a test: asserting the HTTP status proves
 * nothing about whether the click was recorded. Assert the row.
 */
const CaptureLogoClickResponseSchema = z.object({
    accepted: z.boolean()
});

/**
 * POST /api/v1/public/partner-logo-clicks
 *
 * Records one click on a partner's logo in the home carousel.
 *
 * Rate limit: 30 requests / 60 s per IP, matching the view beacon. Both
 * destinations count toward the partner-facing total; the `destination` field is
 * stored so a future distinction (HOS-1159) does not need a backfill nobody can
 * write.
 */
export const captureLogoClickRoute = createSimpleRoute({
    method: 'post',
    path: '/partner-logo-clicks',
    summary: 'Capture partner logo click',
    description:
        "Records a click on a partner's logo in the home carousel. Fire-and-forget — always returns 202.",
    tags: ['Partners'],
    responseSchema: CaptureLogoClickResponseSchema,
    handler: async (ctx: Context) => {
        // ── 1. Bot filter (FIRST — before any DB or hashing work) ────────────
        const ua = ctx.req.header('user-agent');
        if (isBotUserAgent(ua)) {
            // Indistinguishable fake-accept. `success: true` prevents the
            // response formatting middleware from double-wrapping the body.
            return ctx.json({ success: true, accepted: true }, 202);
        }

        // ── 2. Validate body ──────────────────────────────────────────────────
        let rawBody: unknown;
        try {
            rawBody = await ctx.req.json();
        } catch {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: ServiceErrorCode.VALIDATION_ERROR,
                        message: 'Invalid JSON in request body'
                    }
                },
                400
            );
        }

        const parsed = PartnerLogoClickCaptureBodySchema.safeParse(rawBody);
        if (!parsed.success) {
            return ctx.json(
                {
                    success: false,
                    error: {
                        code: ServiceErrorCode.VALIDATION_ERROR,
                        message: 'Invalid request body'
                    }
                },
                400
            );
        }

        const { partnerId, destination } = parsed.data;

        // ── 3. Resolve client IP ──────────────────────────────────────────────
        const clientIp = getClientIp({ c: ctx });

        // ── 4. Opportunistic auth ─────────────────────────────────────────────
        // Same treatment as the view beacon: an authenticated visitor hashes to
        // `user:<uuid>` with no IP involved, so their click and their page view
        // carry the SAME visitor hash and dedupe consistently.
        const actor = ctx.get('actor');
        const isAuthenticated = !!actor && !isGuestActor(actor);
        const userId = isAuthenticated ? actor?.id : undefined;

        // ── 5. Compute visitor hash (server-side, never from the client) ──────
        const visitorHash = computeVisitorHash({
            ip: clientIp,
            userAgent: ua ?? '',
            secret: env.HOSPEDA_VIEWS_HASH_SECRET,
            userId
        });

        // ── 6. Call service ───────────────────────────────────────────────────
        const result = await statsService.captureLogoClick({
            partnerId,
            visitorHash,
            destination
        });

        if (result.error) {
            // Includes the FK violation for a partnerId that does not exist.
            // Logged, never surfaced: telling a caller which partner ids are
            // real is an enumeration oracle, and this endpoint takes no auth.
            apiLogger.warn(
                { partnerId, destination, errorCode: result.error.code },
                'Partner logo click capture failed (silenced to public)'
            );
        }

        return ctx.json({ success: true, accepted: true }, 202);
    },
    options: {
        skipAuth: true,
        customRateLimit: { requests: 30, windowMs: 60000 }
    }
});
