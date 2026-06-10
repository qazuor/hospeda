import { z } from '@hono/zod-openapi';
import { CaptureViewBodySchema, ServiceErrorCode } from '@repo/schemas';
import { entityViewService } from '@repo/service-core';
import type { Context } from 'hono';
import { getClientIp } from '../../middlewares/rate-limit';
import { isGuestActor } from '../../utils/actor';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import { createSimpleRoute } from '../../utils/route-factory';
import { computeVisitorHash } from '../../utils/visitor-hash';

// ---------------------------------------------------------------------------
// Response schema
// ---------------------------------------------------------------------------

/**
 * Capture response schema.
 *
 * Always returns `{ accepted: true }` for the happy path AND for bot-filtered
 * requests — clients cannot distinguish a real insert from a silently-dropped
 * bot request. A failed telemetry write also returns 202 so that a DB hiccup
 * never surfaces an error on a public page.
 */
const CaptureViewResponseSchema = z.object({
    accepted: z.boolean()
});

// ---------------------------------------------------------------------------
// Bot filter
// ---------------------------------------------------------------------------

/**
 * Regex that matches User-Agent strings from known bots, crawlers, and
 * headless tooling. The pattern is intentionally broad — false-positive drops
 * (a real user with "bot" in their UA) are acceptable because the view count
 * is a soft telemetry metric, not a billing-critical number.
 *
 * Covered families (case-insensitive):
 *   - Generic crawl/spider/bot/preview substrings
 *   - Common CLI tools: curl, wget
 *   - Major SEO crawlers: Googlebot, Bingbot, Baiduspider, DuckDuckBot,
 *     YandexBot, Slurp (Yahoo), AhrefsBot, SemrushBot, MJ12bot, DotBot,
 *     PetalBot, bytespider, GPTBot, ClaudeBot, PerplexityBot
 */
export const BOT_UA_REGEX =
    /bot|crawl|spider|preview|curl|wget|googlebot|bingbot|baiduspider|duckduckbot|yandexbot|slurp|ahrefsbot|semrushbot|mj12bot|dotbot|petalbot|bytespider|gptbot|claudebot|perplexitybot/i;

/**
 * Returns `true` when the given User-Agent string matches a known bot or is
 * absent/empty. A missing UA is treated as a bot to avoid recording views
 * from headless clients that omit the header.
 *
 * @param ua - The raw `User-Agent` header value (may be undefined or empty).
 */
export function isBotUserAgent(ua: string | undefined): boolean {
    if (!ua || ua.trim().length === 0) return true;
    return BOT_UA_REGEX.test(ua);
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * POST /api/v1/public/views
 *
 * Fire-and-forget view capture endpoint for cross-entity view tracking
 * (SPEC-159 T-008).
 *
 * **Security design decisions:**
 *
 * 1. Bot filter returns 202 `{ accepted: true }` without inserting — the same
 *    response as a real capture. Bots and real visitors get identical responses
 *    so there is no oracle for discovering the filter.
 *
 * 2. `INTERNAL_ERROR` from the service also returns 202 `{ accepted: true }`.
 *    A failed telemetry write must NEVER surface a 500 on a public page — a
 *    DB outage should not break the page that triggered the view. The error is
 *    logged server-side for observability.
 *
 * 3. `VALIDATION_ERROR` returns 400 with a generic error envelope. The service
 *    error `details` object (which may contain the `visitorHash` for debugging)
 *    is NEVER echoed to the client — only a human-readable message is returned.
 *
 * 4. Opportunistic auth: if a valid session exists the actor is authenticated
 *    (not GUEST), and the userId is passed to `computeVisitorHash`, which
 *    returns `user:<uuid>` directly without hashing any IP data.
 *
 * Rate limit: 30 requests / 60 s per IP (per-route, via `customRateLimit`).
 */
export const captureViewRoute = createSimpleRoute({
    method: 'post',
    path: '/views',
    summary: 'Capture entity view',
    description:
        'Records a view event for a public entity page (accommodation, post, event). Fire-and-forget — always returns 202.',
    tags: ['Views'],
    responseSchema: CaptureViewResponseSchema,
    handler: async (ctx: Context) => {
        // ── 1. Bot filter (FIRST — before any DB or hashing work) ────────────
        // Note: the global validation middleware may reject requests without a
        // User-Agent header with 400 before this handler is reached. Within the
        // handler, any UA matched by BOT_UA_REGEX or an empty/missing UA receives
        // an indistinguishable fake-accept (202, same body as a real insert).
        const ua = ctx.req.header('user-agent');
        if (isBotUserAgent(ua)) {
            // Indistinguishable fake-accept: same body as a real insert.
            // success:true prevents the responseFormattingMiddleware from
            // double-wrapping the body into { success: true, data: {...} }.
            return ctx.json({ success: true, accepted: true }, 202);
        }

        // ── 2. Validate body ──────────────────────────────────────────────────
        let rawBody: unknown;
        try {
            rawBody = await ctx.req.json();
        } catch {
            // Malformed JSON — treat as validation error.
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

        const parsed = CaptureViewBodySchema.safeParse(rawBody);
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

        const { entityType, entityId } = parsed.data;

        // ── 3. Resolve client IP ──────────────────────────────────────────────
        // Uses the same trust-chain as the rate limiter:
        // cf-connecting-ip → x-forwarded-for[0] → x-real-ip → socket IP.
        const clientIp = getClientIp({ c: ctx });

        // ── 4. Opportunistic auth ─────────────────────────────────────────────
        // actorMiddleware always sets an actor (GUEST for unauthenticated requests).
        // When the actor is not a GUEST we pass their userId to computeVisitorHash,
        // which short-circuits to `user:<uuid>` without hashing IP data.
        const actor = ctx.get('actor');
        const isAuthenticated = !!actor && !isGuestActor(actor);
        const userId = isAuthenticated ? actor?.id : undefined;

        // ── 5. Compute visitor hash ───────────────────────────────────────────
        // For anonymous visitors: SHA-256(HMAC-daily-salt + truncatedIp + UA).
        // For authenticated visitors: `user:<uuid>` (no IP involved).
        // Raw IPs are NEVER stored, logged, or returned.
        const visitorHash = computeVisitorHash({
            ip: clientIp,
            userAgent: ua ?? '',
            secret: env.HOSPEDA_VIEWS_HASH_SECRET,
            userId
        });

        // ── 6. Call service ───────────────────────────────────────────────────
        const result = await entityViewService.capture({
            entityType,
            entityId,
            visitorHash,
            isAuthenticated
        });

        if (result.error) {
            if (result.error.code === ServiceErrorCode.VALIDATION_ERROR) {
                // Log server-side (the details may contain visitorHash — never echo).
                apiLogger.warn(
                    { entityType, entityId, errorCode: result.error.code },
                    'View capture rejected: validation error from service'
                );
                return ctx.json(
                    {
                        success: false,
                        error: {
                            code: ServiceErrorCode.VALIDATION_ERROR,
                            message: 'Invalid view capture request'
                        }
                    },
                    400
                );
            }

            // INTERNAL_ERROR: respond 202 so a DB hiccup never breaks the page.
            // Decision: telemetry failures must be invisible to public visitors.
            apiLogger.error(
                { entityType, entityId, errorCode: result.error.code },
                'View capture failed: service internal error (silenced to public)'
            );
            return ctx.json({ success: true, accepted: true }, 202);
        }

        // success:true prevents the responseFormattingMiddleware from
        // double-wrapping the body into { success: true, data: { accepted: true } }.
        return ctx.json({ success: true, accepted: true }, 202);
    },
    options: {
        skipAuth: true,
        customRateLimit: { requests: 30, windowMs: 60000 }
    }
});
