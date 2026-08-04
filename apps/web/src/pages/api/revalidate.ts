/**
 * @file revalidate.ts
 * @description Cache invalidation endpoint.
 *
 * Replaces the Vercel ISR `bypassToken` flow that was previously wired
 * into the Astro adapter. Now that the web app runs on Node behind
 * Cloudflare, "revalidation" means purging the Cloudflare CDN cache so
 * the next request bypasses the edge and hits this origin.
 *
 * This endpoint holds the Cloudflare credentials; the API never sees them. It
 * is the choke point where, until HOS-369 W1-1, every purge became
 * `purge_everything: true` — the caller's per-entity detail was computed,
 * shipped, and then discarded here. It now purges the tags it is given.
 *
 * Two modes, deliberately distinct in the body rather than one flag:
 *
 *   `{ "tags": ["prod:accom-x", "prod:list-accom"] }` — selective, the normal path.
 *   `{ "purgeEverything": true }`                     — whole-zone flush, the
 *                                                       deploy escape hatch
 *                                                       (spec §7.3).
 *
 * Every tag must carry THIS deployment's namespace (HOS-369 W1-2). Staging and
 * production share one Cloudflare zone, so a tag from the other environment is
 * refused with HTTP 400 rather than forwarded — see the check in
 * {@link parseInstruction}, which is the system's only runtime observation of
 * emitter/purger namespace divergence.
 *
 * `purgeEverything` is deliberately NOT namespaced: Cloudflare has no scoped
 * form of it. It flushes the shared zone, and therefore BOTH environments. That
 * is accepted for the emergency escape hatch it exists to be, and is another
 * reason it is a separate, explicit mode rather than a fallback.
 *
 * Nothing routine posts that mode any more. "Flush everything" from the API and
 * the admin panel is now a purge of the `<env>:all` catch-all tag through the
 * `tags` mode above (`RevalidationService.purgeEverything`), which stays inside
 * one environment. This mode is what `RevalidationService.purgeWholeZone` and a
 * hand-run operator `curl` use when the zone itself is what must be flushed.
 *
 * Authenticated via the shared secret `HOSPEDA_REVALIDATION_SECRET`
 * passed as a `?secret=...` query parameter (same contract the API uses
 * when posting to this endpoint).
 *
 * Required env vars:
 *   - HOSPEDA_REVALIDATION_SECRET — shared with the API caller
 *   - HOSPEDA_DEPLOY_ENV          — this deployment's identity; must match the
 *                                   value on the API that posts here
 *   - CLOUDFLARE_ZONE_ID          — Cloudflare zone for hospeda.com.ar
 *   - CLOUDFLARE_API_TOKEN        — token with `Cache Purge` permission
 *                                   scoped to the same zone
 *
 * @route POST /api/revalidate?secret=<HOSPEDA_REVALIDATION_SECRET>
 */

import type { CacheTagEnvironment } from '@repo/cache-tags';
import {
    isValidCacheTag,
    MAX_CACHE_TAGS_PER_RESPONSE,
    parseNamespacedCacheTag
} from '@repo/cache-tags';
import type { APIRoute } from 'astro';
import { getCacheTagEnvironment } from '@/lib/cache/cache-tag-environment';

const CLOUDFLARE_PURGE_ENDPOINT = (zoneId: string) =>
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`;

/**
 * Cloudflare accepts at most 100 operations per purge request on Free/Pro/
 * Business. The caller already chunks, but a malformed or hand-rolled request
 * must not silently lose the tail: anything over the limit is rejected, not
 * truncated.
 */
const MAX_TAGS_PER_REQUEST = 100;

/** JSON error response helper. */
function jsonError(body: Record<string, unknown>, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' }
    });
}

/** The purge instruction, once validated. */
type PurgeInstruction =
    | { readonly kind: 'tags'; readonly tags: readonly string[] }
    | { readonly kind: 'everything' };

/**
 * Parse and validate the request body.
 *
 * An unparseable or empty body is NOT treated as "purge everything". That
 * default would make every malformed caller flush the zone — the exact
 * behaviour this change exists to remove, reachable by accident.
 */
function parseInstruction(
    body: unknown,
    environment: CacheTagEnvironment
): PurgeInstruction | { readonly error: string } {
    if (typeof body !== 'object' || body === null) {
        return { error: 'body must be a JSON object with `tags` or `purgeEverything`' };
    }

    const record = body as Record<string, unknown>;

    // An ambiguous body is rejected, not resolved. Picking a winner would mean
    // an operator can ask for a whole-zone flush, watch the request succeed,
    // and silently get something else — on the one endpoint whose entire
    // contract is that the destructive path is only reachable deliberately.
    if ('purgeEverything' in record && 'tags' in record) {
        return { error: '`tags` and `purgeEverything` are mutually exclusive' };
    }

    if (record.purgeEverything === true) {
        return { kind: 'everything' };
    }

    const rawTags = record.tags;
    if (!Array.isArray(rawTags)) {
        return { error: 'body must carry `tags: string[]` or `purgeEverything: true`' };
    }
    if (rawTags.length === 0) {
        return { error: '`tags` must not be empty' };
    }
    if (rawTags.length > MAX_TAGS_PER_REQUEST) {
        return {
            error: `\`tags\` must hold at most ${MAX_TAGS_PER_REQUEST} entries (Cloudflare per-request limit)`
        };
    }

    const tags: string[] = [];
    for (const candidate of rawTags) {
        if (typeof candidate !== 'string' || !isValidCacheTag({ tag: candidate })) {
            return { error: `invalid cache tag: ${JSON.stringify(candidate)}` };
        }

        // THE divergence detector (HOS-369 W1-2).
        //
        // This endpoint is the only place in the system where a namespace
        // derived by the API process meets a namespace derived by the web
        // process. Everything else — the shared resolver, the startup
        // logging — reduces the CHANCE that the two disagree; this is the only
        // thing that OBSERVES it, at the exact moment the disagreement would do
        // damage, on a zone both environments share.
        //
        // A mismatch is refused rather than forwarded. Forwarding `prod:*` from
        // staging would evict production's cache and Cloudflare would report
        // success, which is the specific silent failure this whole change
        // exists to make impossible. A 400 instead lands in the API's
        // `revalidation_log` as a failed purge on every write, naming both
        // namespaces.
        const parsed = parseNamespacedCacheTag({ tag: candidate });
        if (parsed === null) {
            return {
                error: `cache tag ${JSON.stringify(candidate)} carries no deployment namespace; expected a "${environment}:" prefix`
            };
        }
        if (parsed.environment !== environment) {
            return {
                error: `cache tag ${JSON.stringify(candidate)} belongs to the "${parsed.environment}" deployment but this one is "${environment}". Refusing to purge another environment's cache from a shared Cloudflare zone — check HOSPEDA_DEPLOY_ENV on both the API and the web app.`
            };
        }

        tags.push(candidate);
    }

    // Defensive: the per-response ceiling is a different limit, but a caller
    // that ever exceeds it is confused about which one it is hitting.
    if (tags.length > MAX_CACHE_TAGS_PER_RESPONSE) {
        return { error: 'too many tags' };
    }

    return { kind: 'tags', tags };
}

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
        return jsonError(
            {
                error: 'Cloudflare credentials missing — set CLOUDFLARE_ZONE_ID and CLOUDFLARE_API_TOKEN'
            },
            500
        );
    }

    let rawBody: unknown;
    try {
        rawBody = await request.json();
    } catch {
        return jsonError({ error: 'invalid_json' }, 400);
    }

    // Resolved BEFORE the body is inspected: without a namespace of its own
    // this endpoint cannot tell a legitimate purge from a cross-environment
    // one, and "cannot tell" must never resolve to "forward it".
    const environment = getCacheTagEnvironment();
    if (environment === null) {
        return jsonError(
            {
                error: 'cache_tag_namespace_unresolved',
                detail: 'HOSPEDA_DEPLOY_ENV is not set (or not one of prod|preview|dev|test) on the web app, so incoming tags cannot be checked against this deployment'
            },
            503
        );
    }

    const instruction = parseInstruction(rawBody, environment);
    if ('error' in instruction) {
        return jsonError({ error: 'invalid_request', detail: instruction.error }, 400);
    }

    const purgeBody =
        instruction.kind === 'everything' ? { purge_everything: true } : { tags: instruction.tags };

    const purgeRes = await fetch(CLOUDFLARE_PURGE_ENDPOINT(cfZoneId), {
        method: 'POST',
        headers: {
            authorization: `Bearer ${cfApiToken}`,
            'content-type': 'application/json'
        },
        body: JSON.stringify(purgeBody)
    });

    if (!purgeRes.ok) {
        const detail = await purgeRes.text().catch(() => '<no body>');
        return jsonError(
            { error: 'cloudflare_purge_failed', status: purgeRes.status, detail },
            502
        );
    }

    // A 2xx is not proof the purge happened. Cloudflare's v4 API answers with an
    // envelope — `{ success, errors[], result }` — and uses `success: false` on
    // a 200 for several validation and entitlement failures. Trusting the status
    // line alone would report a purge that evicted nothing as a success, log it
    // as a success, and leave the content stale for its whole TTL: exactly the
    // silent failure mode this wave exists to remove (spec §5.11.3, §5.11.5).
    const envelope = (await purgeRes.json().catch(() => null)) as {
        success?: unknown;
        errors?: unknown;
    } | null;

    if (envelope === null || envelope.success !== true) {
        return jsonError(
            {
                error: 'cloudflare_purge_rejected',
                status: purgeRes.status,
                detail: envelope?.errors ?? '<unparseable response body>'
            },
            502
        );
    }

    return new Response(
        JSON.stringify(
            instruction.kind === 'everything'
                ? { ok: true, purged: 'all' }
                : { ok: true, purged: instruction.tags.length }
        ),
        {
            status: 200,
            headers: { 'content-type': 'application/json' }
        }
    );
};
