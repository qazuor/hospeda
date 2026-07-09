/**
 * Redirect the legacy/guessed RSS path to the real blog feed.
 *
 * External feed readers and crawlers probe `/api/v1/public/posts/slug/rss.xml`,
 * which the `/slug/:slug` route rejected as an invalid post slug (400). The
 * canonical blog RSS feed lives on the web app, so redirect these requests there
 * instead of erroring (HOS-109 T-011). Registered BEFORE `getBySlug` so Hono
 * matches this static path ahead of the `/slug/:slug` param route.
 */
import { z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import { env } from '../../../utils/env';
import { createSimpleRoute } from '../../../utils/route-factory';

/** Default-locale blog RSS feed on the web app. */
const buildWebRssUrl = (): string => {
    const base = (env.HOSPEDA_SITE_URL ?? 'http://localhost:4321').replace(/\/$/, '');
    return `${base}/es/publicaciones/rss.xml`;
};

/**
 * GET /api/v1/public/posts/slug/rss.xml → 301 to the web blog RSS feed.
 */
export const publicPostRssRedirectRoute = createSimpleRoute({
    method: 'get',
    path: '/slug/rss.xml',
    summary: 'Redirect to the blog RSS feed',
    description:
        'Redirects clients probing /posts/slug/rss.xml to the canonical blog RSS feed on the web app.',
    tags: ['Posts'],
    responseSchema: z.string(),
    handler: async (ctx: Context) => ctx.redirect(buildWebRssUrl(), 301),
    // Accept-header validation is bypassed for this path in validationMiddleware's
    // publicPaths list (routeOptions.skipValidation runs too late for app-mounted
    // routes — see validation.ts, HOS-109 T-011).
    options: {
        skipAuth: true,
        cacheTTL: 86_400
    }
});
