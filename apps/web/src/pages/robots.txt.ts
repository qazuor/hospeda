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
 */

import { getNoindexHosts } from '@/lib/env';
import { parseNoindexHosts } from '@/lib/middleware-helpers';
import type { APIRoute } from 'astro';

export const prerender = false;

const NOINDEX_HOSTS = parseNoindexHosts(getNoindexHosts());

const PERMISSIVE_BODY = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /*/mi-cuenta/
Disallow: /*/signin
Disallow: /*/signup
Disallow: /*/forgot-password
Disallow: /_server-islands/

Sitemap: https://hospeda.com.ar/sitemap-index.xml
`;

const NOINDEX_BODY = `User-agent: *
Disallow: /
`;

export const GET: APIRoute = ({ request }) => {
    const host = (request.headers.get('host') ?? '').toLowerCase();
    const isNoindexHost = NOINDEX_HOSTS.includes(host);
    const body = isNoindexHost ? NOINDEX_BODY : PERMISSIVE_BODY;

    return new Response(body, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
            ...(isNoindexHost && { 'X-Robots-Tag': 'noindex, nofollow' })
        }
    });
};
