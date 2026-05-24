/**
 * @fileoverview
 * RSS 2.0 feed for blog posts, scoped to a single locale.
 *
 * One feed URL per supported locale:
 *   /es/publicaciones/rss.xml
 *   /en/publicaciones/rss.xml
 *   /pt/publicaciones/rss.xml
 *
 * Fetches up to 50 most-recent published posts from the public API and maps
 * each to an RSS <item>. On any API failure the feed degrades gracefully —
 * an empty but valid RSS channel is returned (HTTP 200) so feed readers never
 * see a 500 error.
 *
 * Cache: public, 24 h (max-age=86400) with stale-while-revalidate=86400.
 * This mirrors the caching strategy of sitemap-dynamic.xml.ts.
 *
 * Route: GET /[lang]/publicaciones/rss.xml
 * Rendering: SSR (prerender = false — always reflects current published data)
 */

import type { APIRoute } from 'astro';
import { getApiUrl, getSiteUrl } from '../../../lib/env';
import { buildPostsFeed, fetchLatestPosts, validateLocale } from '../../../lib/feeds';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
    const locale = validateLocale(params.lang);

    if (!locale) {
        return new Response('Not found', { status: 404 });
    }

    let apiUrl: string;
    let siteUrl: string;

    try {
        apiUrl = getApiUrl();
        siteUrl = getSiteUrl().replace(/\/$/, '');
    } catch {
        return new Response('<!-- feed unavailable: env not configured -->', {
            status: 503,
            headers: { 'Content-Type': 'application/xml' }
        });
    }

    const posts = await fetchLatestPosts({ apiUrl });

    return buildPostsFeed({ locale, siteUrl, posts });
};
