/**
 * @fileoverview
 * RSS 2.0 feed for events, scoped to a single locale.
 *
 * One feed URL per supported locale:
 *   /es/eventos/rss.xml
 *   /en/eventos/rss.xml
 *   /pt/eventos/rss.xml
 *
 * Fetches up to 50 upcoming/recent published events from the public API and
 * maps each to an RSS <item>. When the API cannot be read the feed answers 503
 * with `Retry-After` (HOS-1381) — NOT an empty 200. A calendar with no upcoming
 * events and an unreachable API produce byte-identical XML, so the status is
 * the only thing that tells an aggregator which one it got; and because this
 * route bypasses middleware, no later stage can correct a wrong one.
 *
 * Cache: public, 24 h (max-age=86400) with stale-while-revalidate=86400 for a
 * feed that was actually read — a legitimately empty one included, since zero
 * upcoming events is content. The 503 carries `private, no-cache`.
 *
 * Route: GET /[lang]/eventos/rss.xml
 * Rendering: SSR (prerender = false — always reflects current published data)
 */

import type { APIRoute } from 'astro';
import { getApiUrl, getSiteUrl } from '../../../lib/env';
import {
    buildEventsFeed,
    buildFeedUnavailableResponse,
    fetchLatestEvents,
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

    const events = await fetchLatestEvents({ apiUrl });

    if (!events.ok) {
        return buildFeedUnavailableResponse({ failure: events.failure });
    }

    return buildEventsFeed({ locale, siteUrl, events: events.items });
};
