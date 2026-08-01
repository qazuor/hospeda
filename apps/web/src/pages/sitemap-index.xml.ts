/**
 * @fileoverview
 * The sitemap index robots.txt points at — the single entry point crawlers use
 * to discover every other sitemap.
 *
 * It lists the two url-set sitemaps as `<sitemap>` children, which is the part
 * `@astrojs/sitemap` could not express. Its `customPages` option appended
 * `/sitemap-dynamic.xml` to a `<urlset>` instead, advertising the dynamic
 * sitemap as an ordinary crawlable page; a crawler reading that entry fetches
 * an XML document as content and never treats its ~924 URLs as submitted. The
 * generated index itself only ever referenced that empty url-set, so in
 * practice the site submitted zero pages.
 *
 * Route: GET /sitemap-index.xml
 * Rendering: SSR — replaces the build-time file the integration used to emit,
 * so the URL also resolves in `astro dev` (it used to 404 there).
 */

import type { APIRoute } from 'astro';
import { getSiteUrl } from '../lib/env';
import { buildSitemapIndexDocument, SITEMAP_RESPONSE_HEADERS } from '../lib/seo/sitemap-xml';

export const prerender = false;

/** Child sitemaps, in the order crawlers should discover them. */
const CHILD_SITEMAP_PATHS = ['/sitemap-static.xml', '/sitemap-dynamic.xml'] as const;

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

    // Both children are regenerated on every request, so "now" is exactly when
    // their contents were last produced.
    const lastmod = new Date().toISOString().slice(0, 10);

    return new Response(
        buildSitemapIndexDocument({
            locations: CHILD_SITEMAP_PATHS.map((path) => `${siteUrl}${path}`),
            lastmod
        }),
        { status: 200, headers: SITEMAP_RESPONSE_HEADERS }
    );
};
