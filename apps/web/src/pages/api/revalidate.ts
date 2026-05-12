/**
 * @file revalidate.ts
 * @description Cache invalidation endpoint.
 *
 * Replaces the Vercel ISR `bypassToken` flow that was previously wired
 * into the Astro adapter. Now that the web app runs on Node behind
 * Cloudflare, "revalidation" means purging the Cloudflare CDN cache so
 * the next request bypasses the edge and hits this origin.
 *
 * Authenticated via the shared secret `HOSPEDA_REVALIDATION_SECRET`
 * passed as a `?secret=...` query parameter (same contract the API uses
 * when posting to this endpoint).
 *
 * Required env vars:
 *   - HOSPEDA_REVALIDATION_SECRET — shared with the API caller
 *   - CLOUDFLARE_ZONE_ID          — Cloudflare zone for hospeda.com.ar
 *   - CLOUDFLARE_API_TOKEN        — token with `Cache Purge` permission
 *                                   scoped to the same zone
 *
 * @route POST /api/revalidate?secret=<HOSPEDA_REVALIDATION_SECRET>
 */

import type { APIRoute } from 'astro';

const CLOUDFLARE_PURGE_ENDPOINT = (zoneId: string) =>
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`;

export const POST: APIRoute = async ({ request }) => {
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    const expectedSecret = process.env.HOSPEDA_REVALIDATION_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
        return new Response('Unauthorized', { status: 401 });
    }

    const cfZoneId = process.env.CLOUDFLARE_ZONE_ID;
    const cfApiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!cfZoneId || !cfApiToken) {
        return new Response(
            JSON.stringify({
                error: 'Cloudflare credentials missing — set CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN'
            }),
            {
                status: 500,
                headers: { 'content-type': 'application/json' }
            }
        );
    }

    const purgeRes = await fetch(CLOUDFLARE_PURGE_ENDPOINT(cfZoneId), {
        method: 'POST',
        headers: {
            authorization: `Bearer ${cfApiToken}`,
            'content-type': 'application/json'
        },
        // purge_everything is the simplest contract; tune to specific
        // hosts/paths if the volume of writes ever justifies it.
        body: JSON.stringify({ purge_everything: true })
    });

    if (!purgeRes.ok) {
        const detail = await purgeRes.text().catch(() => '<no body>');
        return new Response(
            JSON.stringify({ error: 'cloudflare_purge_failed', status: purgeRes.status, detail }),
            { status: 502, headers: { 'content-type': 'application/json' } }
        );
    }

    return new Response(JSON.stringify({ ok: true, purged: 'all' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
    });
};
