/**
 * Public session recording switch (HOS-2347 §6.3).
 *
 * Mounted at `/api/v1/public/session-recording`.
 *
 * The web asks this endpoint, client-side and only for visitors who granted
 * analytics consent, whether it may load the Umami session recorder. The body is
 * exactly `{ enabled: boolean }`: no `updatedAt`, no `updatedBy`.
 *
 * Freshness: `Cache-Control: public, max-age=30, s-maxage=30`. The worst case
 * after a switch-OFF is 30 s at the edge plus 30 s in the browser, which keeps
 * the 60 s bound of the spec (G-1). The path is deliberately NOT in
 * `PUBLIC_CACHE_ENDPOINTS`: the in-process cache uses a global TTL that is not
 * bound to 60 s (a guard test enforces it).
 *
 * Errors: a DB read error propagates (500 with the standard error body). The
 * header is set only AFTER the read succeeds, so an error response never carries
 * the `public` cache header. The web fails closed on any non-200.
 */

import { PublicSessionRecordingResponseSchema } from '@repo/schemas';
import { PlatformSettingsService } from '@repo/service-core';
import type { Context } from 'hono';
import { createRouter } from '../../../utils/create-app.js';
import { apiLogger } from '../../../utils/logger.js';
import { createPublicRoute } from '../../../utils/route-factory.js';

const service = new PlatformSettingsService({ logger: apiLogger });

/** The exact `Cache-Control` value every 200 carries (AC-P3). */
export const SESSION_RECORDING_CACHE_CONTROL = 'public, max-age=30, s-maxage=30';

/**
 * GET /api/v1/public/session-recording
 *
 * Responses:
 *   200 — `{ enabled }`. `false` when the key was never written or its stored
 *         value fails the schema.
 *   500 — the platform setting could not be read.
 */
export const publicGetSessionRecordingRoute = createPublicRoute({
    method: 'get',
    path: '/',
    summary: 'Get the web session recording switch',
    description:
        'Returns whether the public web may load the Umami session recorder for visitors who granted analytics consent. No authentication required. Cached 30 seconds.',
    tags: ['Platform Settings'],
    responseSchema: PublicSessionRecordingResponseSchema,
    handler: async (ctx: Context) => {
        const enabled = await service.isSessionRecordingEnabled();
        ctx.header('Cache-Control', SESSION_RECORDING_CACHE_CONTROL);
        return { enabled };
    },
    options: {
        skipAuth: true,
        customRateLimit: { requests: 100, windowMs: 60000 } // 100 req/min, like announcements
    }
});

const router = createRouter();
router.route('/', publicGetSessionRecordingRoute);

export { router as publicSessionRecordingRoutes };
