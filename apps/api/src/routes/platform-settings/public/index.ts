/**
 * Public platform settings routes (SPEC-156, PR-1, T-010).
 *
 * Mounted at `/api/v1/public/platform-settings`.
 *
 * Currently exposes a single endpoint:
 *   GET /announcements — active global announcements (cross-device read for
 *   web app per tech-analysis D2; admin writes via PATCH on the admin tier).
 *
 * The endpoint is read-only and cacheable (5 min TTL). Filtering of active
 * announcements (start/end date window) happens server-side so cached
 * responses never include expired or scheduled-future items beyond the TTL.
 */

import { AnnouncementItemSchema } from '@repo/schemas';
import { PlatformSettingsService } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { createRouter } from '../../../utils/create-app.js';
import { apiLogger } from '../../../utils/logger.js';
import { createPublicRoute } from '../../../utils/route-factory.js';

const service = new PlatformSettingsService({ logger: apiLogger });

/**
 * GET /api/v1/public/announcements
 *
 * Returns the currently-active global announcements (filtered server-side by
 * the `startsAt`/`endsAt` window of each item). Returns `[]` when:
 *   - the `announcements.global` key has never been written, or
 *   - no announcement's window intersects the current time.
 *
 * Cached for 5 minutes; the platform-settings admin endpoint does NOT
 * invalidate this cache automatically (SPEC-156 V1 accepts up-to-5-min lag
 * before a new announcement appears — acceptable for the use case).
 *
 * Dismissal state is client-side (cookie) — this endpoint always returns
 * every active item; the consumer hides dismissed ones.
 */
export const publicGetAnnouncementsRoute = createPublicRoute({
    method: 'get',
    path: '/',
    summary: 'Get active global announcements',
    description:
        'Returns the currently-active global announcements (server-side filtered by start/end date window). No authentication required. Cached 5 minutes — accept up to 5 min lag for newly-published items.',
    tags: ['Platform Settings'],
    responseSchema: z.array(AnnouncementItemSchema),
    handler: async (_ctx: Context) => {
        const items = await service.findActiveAnnouncements();
        return items;
    },
    options: {
        skipAuth: true,
        cacheTTL: 300, // 5 minutes
        customRateLimit: { requests: 100, windowMs: 60000 } // 100 req/min
    }
});

const router = createRouter();
router.route('/', publicGetAnnouncementsRoute);

export { router as publicPlatformSettingsRoutes };
