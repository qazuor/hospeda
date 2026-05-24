/**
 * Dynamic robots.txt endpoint.
 *
 * Returns a restrictive `Disallow: /` policy when the requesting host
 * matches one of `HOSPEDA_NOINDEX_HOSTS` (CSV; default
 * `staging.hospeda.com.ar`). Everywhere else, returns the standard
 * permissive policy with the same disallow rules the previous static
 * `public/robots.txt` had.
 *
 * Lives as an endpoint instead of `public/robots.txt` because Astro
 * serves prerendered routes through `serve-static` before the global
 * middleware runs. A static file would always reflect the production
 * policy regardless of which host is being served.
 *
 * REQ-16: The Sitemap directive is derived from `getSiteUrl()` at request
 * time so it points to the correct host on staging and local environments.
 *
 * REQ-17: `Disallow` directives for non-indexable paths are derived from
 * `SITEMAP_EXCLUDED_PATHS` (shared constant with `astro.config.mjs`) so the
 * two lists stay in sync automatically.
 */

import { getNoindexHosts, getSiteUrl } from '@/lib/env';
import { parseNoindexHosts } from '@/lib/middleware-helpers';
import { SITEMAP_EXCLUDED_PATHS } from '@/lib/seo-config';
import type { APIRoute } from 'astro';

export const prerender = false;

const NOINDEX_HOSTS = parseNoindexHosts(getNoindexHosts());

/**
 * Build the permissive robots.txt body for indexable hosts.
 *
 * The Sitemap URL and the Disallow lines for excluded paths are derived from
 * shared constants so they can never drift out of sync.
 *
 * @returns The robots.txt content string
 */
function buildPermissiveBody(): string {
    const siteUrl = getSiteUrl().replace(/\/$/, '');
    const sitemapUrl = `${siteUrl}/sitemap-index.xml`;

    const sitemapDisallowLines = SITEMAP_EXCLUDED_PATHS.map((path) => `Disallow: ${path}`).join(
        '\n'
    );

    return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /*/mi-cuenta/
Disallow: /*/signin
Disallow: /*/signup
Disallow: /*/forgot-password
Disallow: /_server-islands/
${sitemapDisallowLines}

Sitemap: ${sitemapUrl}
`;
}

const NOINDEX_BODY = `User-agent: *
Disallow: /
`;

export const GET: APIRoute = ({ request }) => {
    const host = (request.headers.get('host') ?? '').toLowerCase();
    const isNoindexHost = NOINDEX_HOSTS.includes(host);
    const body = isNoindexHost ? NOINDEX_BODY : buildPermissiveBody();

    return new Response(body, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
            ...(isNoindexHost && { 'X-Robots-Tag': 'noindex, nofollow' })
        }
    });
};
