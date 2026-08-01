/**
 * @fileoverview
 * Sitemap of the site's curated marketing and informational pages.
 *
 * These are the pages `@astrojs/sitemap` was supposed to emit and never did:
 * that integration only sees routes rendered to static HTML at build time, and
 * this app prerenders none, so its `<urlset>` shipped empty and every page here
 * was absent from every sitemap. See `src/lib/seo/sitemap-xml.ts` for the
 * full history.
 *
 * The page set is hand-curated in `src/lib/seo/static-sitemap-pages.ts` and
 * kept honest by a drift guard; entity and facet URLs live in
 * `/sitemap-dynamic.xml` instead.
 *
 * Route: GET /sitemap-static.xml
 * Rendering: SSR. The content is static, but serving it from a page endpoint
 * keeps dev and production identical and needs no build step.
 */

import type { APIRoute } from 'astro';
import { getSiteUrl } from '../lib/env';
import {
    buildLocalizedUrlEntries,
    buildUrlsetDocument,
    SITEMAP_RESPONSE_HEADERS
} from '../lib/seo/sitemap-xml';
import { STATIC_SITEMAP_PAGES } from '../lib/seo/static-sitemap-pages';

export const prerender = false;

export const GET: APIRoute = async () => {
    let siteUrl: string;

    try {
        siteUrl = getSiteUrl().replace(/\/$/, '');
    } catch {
        return new Response('<!-- sitemap unavailable: env not configured -->', {
            status: 503,
            headers: { 'Content-Type': 'application/xml' }
        });
    }

    const entries = STATIC_SITEMAP_PAGES.flatMap(({ path, changefreq, priority }) =>
        buildLocalizedUrlEntries({ path, siteUrl, changefreq, priority })
    );

    // No `lastmod`: these pages change when someone edits a template, and this
    // endpoint has no way to know when that was. Stamping "today" on every
    // request would claim daily edits that never happened, teaching crawlers to
    // distrust the field. Omitting it is the honest signal.
    return new Response(buildUrlsetDocument(entries), {
        status: 200,
        headers: SITEMAP_RESPONSE_HEADERS
    });
};
