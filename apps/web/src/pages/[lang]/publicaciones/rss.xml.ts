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
 * each to an RSS <item>. When the API cannot be read the feed answers 503 with
 * `Retry-After` (HOS-1381) — NOT an empty 200. A blog that published nothing
 * and an unreachable API produce byte-identical XML, so the status is the only
 * thing that tells an aggregator which one it got; and because this route
 * bypasses middleware, no later stage can correct a wrong one.
 *
 * Cache: public, 24 h (max-age=86400) with stale-while-revalidate=86400 for a
 * feed that was actually read — a legitimately empty one included, since zero
 * published posts is content. The 503 carries `private, no-cache`.
 *
 * Route: GET /[lang]/publicaciones/rss.xml
 * Rendering: SSR (prerender = false — always reflects current published data)
 */

import type { APIRoute } from 'astro';
import { getApiUrl, getSiteUrl } from '../../../lib/env';
import {
    buildFeedUnavailableResponse,
    buildPostsFeed,
    fetchLatestPosts,
    validateLocale
} from '../../../lib/feeds';

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
        return buildFeedUnavailableResponse({ failure: 'not-configured' });
    }

    const posts = await fetchLatestPosts({ apiUrl });

    if (!posts.ok) {
        return buildFeedUnavailableResponse({ failure: posts.failure });
    }

    return buildPostsFeed({ locale, siteUrl, posts: posts.items });
};
