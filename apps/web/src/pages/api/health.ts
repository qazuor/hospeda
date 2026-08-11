/**
 * @file health.ts
 * @description Container liveness probe for Coolify's rolling deploy.
 *
 * Coolify deploys this app with a rolling update: it starts the new container,
 * then removes the old one. With no healthcheck configured it makes that second
 * move as soon as the new container has *started* — not once it can actually
 * serve — so the old container can be torn down while the Node server is still
 * binding its port. This endpoint is what lets Coolify wait for "can serve"
 * instead of "process launched".
 *
 * WHY THIS HAS NO DEPENDENCIES, AND MUST KEEP NONE. It answers exactly one
 * question: is this Node process listening and routing? It deliberately does
 * not reach the API, the database, Cloudflare, or even the validated env
 * accessor. A failing healthcheck makes Coolify abort the deploy, so anything
 * consulted here converts that dependency's outage into "web deploys silently
 * stop applying" — an API blip would pin the site to an old build. A probe that
 * goes red when a downstream is down is a readiness check wearing a liveness
 * check's clothes; this is the liveness one.
 *
 * `cache-control: no-store` is load-bearing twice over: the answer describes ONE
 * container, so an edge-cached copy could report healthy for a container that no
 * longer exists, and it keeps this route honestly outside the shared-cache
 * choke point in `lib/cache/response-cache.ts` (see the catch-all static guard).
 *
 * PROBE URL IS `/api/health/`, WITH THE TRAILING SLASH. Astro runs
 * `trailingSlash: 'always'`, so `/api/health` answers 301 — and Coolify's
 * `health_check_return_code` is 200, which a 301 does not satisfy. Pointing the
 * dashboard at the slashless form makes every deploy fail its healthcheck.
 *
 * @route GET /api/health/
 */

import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = () =>
    new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: {
            'content-type': 'application/json',
            'cache-control': 'no-store'
        }
    });
