/**
 * robots.txt for the API domain.
 *
 * The API host (e.g. api.hospeda.com.ar) serves no indexable content, yet
 * crawlers probe it — requesting `/robots.txt` (previously 404) and guessing
 * feed-like paths such as `/api/v1/public/posts/slug/rss.xml` (400). Serving a
 * Disallow-all robots.txt tells compliant crawlers to stop requesting anything
 * from the API domain, removing that log noise at the source (HOS-109 T-011).
 *
 * The indexable content, sitemap, and blog RSS feed all live on the web app,
 * which serves its own robots.txt.
 */
import { z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { createSimpleRoute } from '../utils/route-factory';

const ROBOTS_TXT = `User-agent: *
Disallow: /
`;

/**
 * GET /robots.txt — Disallow-all robots.txt for the API domain.
 */
export const robotsRoute = createSimpleRoute({
    method: 'get',
    path: '/robots.txt',
    summary: 'robots.txt',
    description: 'Disallow-all robots.txt for the API domain (serves no indexable content).',
    tags: ['System'],
    responseSchema: z.string(),
    handler: async (ctx: Context) =>
        ctx.text(ROBOTS_TXT, 200, { 'Content-Type': 'text/plain; charset=utf-8' }),
    // Accept-header validation is bypassed for this path in validationMiddleware's
    // publicPaths list (routeOptions.skipValidation runs too late for app-mounted
    // routes — see validation.ts, HOS-109 T-011).
    options: {
        skipAuth: true,
        cacheTTL: 86_400
    }
});
