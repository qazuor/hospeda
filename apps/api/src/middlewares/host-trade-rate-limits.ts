/**
 * Write budgets for the benefit-usage and review endpoints (HOS-376 T-039).
 *
 * THE THREE NUMBERS ARE NOT THE SAME, and the spread is the point. Each write
 * path has a different abuse profile, so a single budget would have to be set
 * for the worst one and would then punish the harmless ones:
 *
 * - THE EMAIL FALLBACK IS THE SPRAY VECTOR (R-5). It is the only channel a
 *   provider can drive without the host being present, addressing anybody whose
 *   email he can guess — so it gets the tightest budget by a wide margin. Ten an
 *   hour is far above a real working day and far below a list.
 * - The selector is bounded by reality: it only lists hosts who already
 *   confirmed a usage with this provider, so a burst there is a plumber
 *   catching up on paperwork, not an attack.
 * - The QR path is the host's own declaration about himself, gated by
 *   `HOST_TRADE_VIEW`. The budget is a typo guard, not a defence.
 *
 * Values are DELIBERATELY CONSERVATIVE and meant to be revisited with real
 * traffic: too tight blocks a legitimate provider on a busy afternoon, and the
 * cost of that is worse than the cost of a spammer who has to wait an hour.
 *
 * @module middlewares/host-trade-rate-limits
 */

import type { Context, Next } from 'hono';
import { createSlidingWindowPerUserRateLimit } from './rate-limit';

/** One hour, for every budget in this file. */
export const HOST_TRADE_RATE_WINDOW_MS = 3_600_000;

/** Provider declarations addressed by email — the spray vector (R-5). */
export const HOST_TRADE_DECLARE_EMAIL_MAX = 10;

/** Provider declarations picked from the scoped selector. */
export const HOST_TRADE_DECLARE_SELECTOR_MAX = 60;

/** Host declarations through the QR. */
export const HOST_TRADE_DECLARE_HOST_MAX = 20;

/** Reviews written by one host. */
export const HOST_TRADE_REVIEW_MAX = 20;

/**
 * The provider's declaration budget, chosen per channel.
 *
 * Reading the body here is safe: Hono caches the parsed JSON on the request, so
 * the route factory's own `ctx.req.valid('json')` hits the same cache rather
 * than a consumed stream.
 *
 * A body that fails to parse is charged to the SELECTOR budget, not the email
 * one. Being generous with malformed input is deliberate — the strict budget
 * exists to slow a working spray, and a spray sends bodies that parse.
 */
export function createProviderDeclarationRateLimit(): (
    c: Context,
    next: Next
) => Promise<Response | undefined> {
    const emailLimit = createSlidingWindowPerUserRateLimit({
        windowMs: HOST_TRADE_RATE_WINDOW_MS,
        max: HOST_TRADE_DECLARE_EMAIL_MAX,
        keyPrefix: 'ht:declare:email'
    });

    const selectorLimit = createSlidingWindowPerUserRateLimit({
        windowMs: HOST_TRADE_RATE_WINDOW_MS,
        max: HOST_TRADE_DECLARE_SELECTOR_MAX,
        keyPrefix: 'ht:declare:selector'
    });

    return async (c: Context, next: Next) => {
        let usesEmailChannel = false;
        try {
            const body = (await c.req.json()) as { hostEmail?: unknown } | undefined;
            usesEmailChannel = typeof body?.hostEmail === 'string' && body.hostEmail.length > 0;
        } catch {
            usesEmailChannel = false;
        }

        return usesEmailChannel ? emailLimit(c, next) : selectorLimit(c, next);
    };
}

/** The provider declaration budget, channel-aware. */
export const providerDeclarationRateLimit = createProviderDeclarationRateLimit();

/** The host's QR declaration budget. */
export const hostDeclarationRateLimit = createSlidingWindowPerUserRateLimit({
    windowMs: HOST_TRADE_RATE_WINDOW_MS,
    max: HOST_TRADE_DECLARE_HOST_MAX,
    keyPrefix: 'ht:declare:host'
});

/**
 * The review budget.
 *
 * A host can only review a provider he has a confirmed usage with, and only
 * once, so this budget cannot be spent writing reviews — it bounds the cost of
 * somebody hammering the endpoint to find out which pairs exist.
 */
export const hostTradeReviewRateLimit = createSlidingWindowPerUserRateLimit({
    windowMs: HOST_TRADE_RATE_WINDOW_MS,
    max: HOST_TRADE_REVIEW_MAX,
    keyPrefix: 'ht:review:write'
});
