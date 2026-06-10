/**
 * AI Rate-Limit Middleware Factory (SPEC-173 T-032).
 *
 * Provides `createAiRateLimitMiddlewares`, a factory that returns the two
 * sliding-window rate-limit middlewares that every AI route MUST mount via
 * `options.middlewares`, in this order:
 *
 *   1. Per-user limiter  — primary guard, keyed on `actor.id`.
 *   2. Per-IP limiter    — defence-in-depth against multi-account abuse from a
 *                          single IP (e.g. disposable accounts sharing a VPN exit
 *                          node). All AI routes require login, so per-user is the
 *                          primary identity; per-IP is secondary.
 *
 * **Three-layer model** (outer-to-inner, cheapest first):
 *
 *   Layer 1 — Burst / rate-limit  (this file)
 *     Anti-burst guard operating in a seconds-to-minutes window.
 *     No DB access. Runs BEFORE the quota middleware.
 *
 *   Layer 2 — Monthly quota  (`middlewares/ai-quota.ts`)
 *     Counts successful AI calls per user per month against the plan limit.
 *     Requires a DB read (`ai_usage` table). Runs AFTER the rate-limit layer
 *     so cheap burst checks fire first.
 *
 *   Layer 3 — Cost ceiling  (future, USD-based hard stop)
 *     Aborts when accumulated token spend for the month would exceed a
 *     configured USD ceiling. Not yet implemented.
 *
 * **Mounting order in `options.middlewares`**:
 * ```ts
 * import { createAiRateLimitMiddlewares } from '../middlewares/ai-rate-limit';
 * import { createAiQuotaMiddleware }      from '../middlewares/ai-quota';
 *
 * const handler = createProtectedStreamingRoute({
 *   middlewares: [
 *     ...createAiRateLimitMiddlewares('text_improve'),  // Layer 1 (burst)
 *     createAiQuotaMiddleware('text_improve'),           // Layer 2 (monthly quota)
 *   ],
 *   streamHandler: async (c) => { ... },
 * });
 * ```
 *
 * @module middlewares/ai-rate-limit
 */

import type { AiFeature } from '@repo/schemas';
import type { MiddlewareHandler } from 'hono';
import type { AppBindings } from '../types';
import { getClientIp } from './rate-limit';
import { createSlidingWindowPerUserRateLimit } from './rate-limit';

// ---------------------------------------------------------------------------
// AiRateLimitOptions
// ---------------------------------------------------------------------------

/**
 * Configuration options for {@link createAiRateLimitMiddlewares}.
 *
 * All fields are optional. When omitted the anti-burst technical defaults
 * apply. These are intentionally conservative for burst protection and are
 * NOT product-visible quotas (those live in Layer 2 — `createAiQuotaMiddleware`).
 *
 * Routes that need different burst characteristics (e.g. a streaming endpoint
 * that naturally takes longer and must allow lower concurrency) may override
 * any field here.
 */
export interface AiRateLimitOptions {
    /**
     * Sliding-window width in milliseconds.
     *
     * @default 60_000 (1 minute)
     */
    readonly windowMs?: number;

    /**
     * Maximum requests allowed per authenticated user within `windowMs`.
     *
     * @default 20
     */
    readonly maxPerUser?: number;

    /**
     * Maximum requests allowed per source IP within `windowMs`, regardless of
     * how many different user accounts originate from that IP.
     *
     * The per-IP limit is intentionally higher than `maxPerUser` because a
     * single office/household legitimately shares one external IP.  Its purpose
     * is to cap extreme multi-account abuse (e.g. 100 disposable accounts behind
     * a VPN exit node), not to restrict normal shared-network usage.
     *
     * @default 60
     */
    readonly maxPerIp?: number;
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

/** Default sliding-window width: 1 minute. */
const DEFAULT_WINDOW_MS = 60_000;

/** Default per-user burst cap within the window. */
const DEFAULT_MAX_PER_USER = 20;

/** Default per-IP burst cap within the window (3× per-user to allow shared IPs). */
const DEFAULT_MAX_PER_IP = 60;

// ---------------------------------------------------------------------------
// createAiRateLimitMiddlewares
// ---------------------------------------------------------------------------

/**
 * Returns a pair of sliding-window rate-limit middlewares for an AI feature:
 *
 *   [0] Per-user limiter  — keyed on `actor.id` (Layer 1, primary).
 *   [1] Per-IP limiter    — keyed on the resolved client IP (Layer 1, secondary).
 *
 * Spread the result into `options.middlewares` BEFORE `createAiQuotaMiddleware`
 * so the cheap in-memory burst check runs before the DB-backed quota check.
 *
 * Both middlewares reuse `createSlidingWindowPerUserRateLimit` from
 * `middlewares/rate-limit.ts`, which provides:
 *   - Redis sliding-window backend (with in-memory fail-open fallback).
 *   - Standard `RateLimit-*` response headers.
 *   - HTTP 429 with `Retry-After` when the window is full.
 *
 * **Per-IP implementation choice**: `createSlidingWindowPerUserRateLimit`
 * identifies requests by `actor.id` and falls back to the client IP when no
 * actor is present.  There is no separate per-IP factory in `rate-limit.ts`.
 * Rather than duplicating the sliding-window algorithm, the per-IP limiter
 * wraps `createSlidingWindowPerUserRateLimit` with a thin Hono middleware that
 * temporarily injects a synthetic actor whose `.id` is the resolved client IP.
 * The inner factory then treats the IP as the "user identity", giving it an
 * independent counter under the `ai:ip:<feature>` key-prefix.  The synthetic
 * actor is scoped to the per-IP check only and does not propagate to subsequent
 * middleware (the `actor` context variable is restored to its original value
 * after the inner middleware resolves).
 *
 * **Key-prefix collision avoidance**: per-user keys are prefixed
 * `ai:user:<feature>` and per-IP keys `ai:ip:<feature>`, so counters for the
 * same feature never share a bucket regardless of the underlying store.
 *
 * @param feature  - The AI feature being guarded. Used as part of the store
 *   key prefix to isolate counters between features.
 * @param options  - Optional overrides for window size and per-user/per-IP caps.
 * @returns        An array of exactly 2 Hono middleware handlers.
 *
 * @example
 * ```ts
 * const handler = createProtectedStreamingRoute({
 *   middlewares: [
 *     ...createAiRateLimitMiddlewares('chat', { maxPerUser: 10, maxPerIp: 30 }),
 *     createAiQuotaMiddleware('chat'),
 *   ],
 *   streamHandler: async (c) => { ... },
 * });
 * ```
 */
export function createAiRateLimitMiddlewares(
    feature: AiFeature,
    options?: AiRateLimitOptions
): MiddlewareHandler<AppBindings>[] {
    const windowMs = options?.windowMs ?? DEFAULT_WINDOW_MS;
    const maxPerUser = options?.maxPerUser ?? DEFAULT_MAX_PER_USER;
    const maxPerIp = options?.maxPerIp ?? DEFAULT_MAX_PER_IP;

    // ── Per-user middleware ──────────────────────────────────────────────────
    // Directly delegates to the shared sliding-window factory.
    // Key format in the store: `ai:user:<feature>:<actor.id>` (or IP fallback).
    const perUserMiddleware: MiddlewareHandler<AppBindings> = createSlidingWindowPerUserRateLimit({
        windowMs,
        max: maxPerUser,
        keyPrefix: `ai:user:${feature}`
    });

    // ── Per-IP middleware ─────────────────────────────────────────────────────
    // Wraps `createSlidingWindowPerUserRateLimit` with a shim that temporarily
    // replaces the actor with a synthetic one whose `.id` is the client IP.
    // This reuses the identical sliding-window logic without duplicating it.
    // Key format in the store: `ai:ip:<feature>:<clientIp>`.
    const innerIpLimiter = createSlidingWindowPerUserRateLimit({
        windowMs,
        max: maxPerIp,
        keyPrefix: `ai:ip:${feature}`
    });

    const perIpMiddleware: MiddlewareHandler<AppBindings> = async (c, next) => {
        // Resolve the client IP using the shared utility from rate-limit.ts,
        // which handles trust-proxy config and header priority correctly.
        const clientIp = getClientIp({ c });

        // Stash the original actor so it can be restored after the IP check.
        const originalActor = c.get('actor');

        // Inject a synthetic actor whose identity IS the client IP.
        // Cast is safe: the inner limiter only reads `.id` from the actor shape.
        c.set('actor', { ...originalActor, id: clientIp } as AppBindings['Variables']['actor']);

        try {
            // Run the inner limiter. It will either call next() (under limit)
            // or return a 429 Response (over limit). We intercept the next()
            // path to restore the actor before the real handler runs.
            let calledNext = false;

            const result = await innerIpLimiter(c, async () => {
                calledNext = true;
                // Restore original actor before continuing down the chain.
                c.set('actor', originalActor);
                await next();
            });

            // If next() was NOT called, the inner limiter returned a 429 Response.
            // Restore actor defensively before returning that response.
            if (!calledNext) {
                c.set('actor', originalActor);
            }

            return result;
        } catch (err) {
            // Restore actor on unexpected errors so error handlers see the real actor.
            c.set('actor', originalActor);
            throw err;
        }
    };

    return [perUserMiddleware, perIpMiddleware];
}
