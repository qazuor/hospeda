/**
 * @file indexnow.ts
 * @description Search-engine change notification endpoint (HOS-585 G-1).
 *
 * The API calls this when public content changes; this endpoint turns the
 * changed entity into its canonical public URLs and submits them to IndexNow,
 * which fans out to Bing, Yandex, Seznam, Naver and Yep.
 *
 * **Why it lives here and not in `apps/api`.** Same reason `/api/revalidate`
 * does: the web app is where third-party credentials for the public site live,
 * and — specific to this feature — it is the only place that already knows how
 * to build a public URL (`lib/seo/entity-public-urls.ts`, shared with the
 * sitemap) and that serves the key file. Because the key file and the submitted
 * URLs come from this same origin by construction, the protocol's `403 key not
 * valid` / `422 foreign URL` failure modes cannot be caused by a host mismatch.
 *
 * **Three independent conditions gate a submission**, and all three must hold:
 *
 * 1. The caller proves it is the API (shared secret).
 * 2. `HOSPEDA_INDEXNOW_KEY` is configured — an unset key is the hard kill switch.
 * 3. The serving host is not a noindex host — staging serves `Disallow: /`, so
 *    submitting its URLs would contradict its own robots policy.
 *
 * The admin on/off toggle is a FOURTH condition, enforced upstream in
 * `service-core` (which is the side with database access). This endpoint is
 * deliberately not the place for it: it would have to reach back through the API
 * to read a setting the caller already read.
 *
 * @route POST /api/indexnow/?secret=<HOSPEDA_REVALIDATION_SECRET>
 */

import type { APIRoute } from 'astro';
import { getIndexNowKey, getNoindexHosts, getRevalidationSecret, getSiteUrl } from '@/lib/env';
import { parseNoindexHosts } from '@/lib/middleware-helpers';
import {
    buildEntityLocaleUrls,
    isNotifiableEntityType,
    type NotifiableEntityType
} from '@/lib/seo/entity-public-urls';
import { submitToIndexNow, toIndexNowHost } from '@/lib/seo/indexnow';

export const prerender = false;

/**
 * Slugs that this endpoint will build a URL from.
 *
 * Restrictive on purpose: a slug carrying `/`, `?` or `#` would silently change
 * which URL is submitted, turning a notification about one page into a
 * notification about another (or into a query-string URL, which must never be
 * submitted — those are `noindex` by the site's own facet policy).
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

/** One entity the caller says has changed. */
interface ChangedEntity {
    readonly entityType: NotifiableEntityType;
    readonly slug: string;
}

/** JSON error helper, mirroring `/api/revalidate`'s response shape. */
function jsonError(body: Record<string, unknown>, status: number): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Extract the well-formed entities from an untrusted body.
 *
 * Malformed members are reported rather than dropped: a caller sending a typo'd
 * entity type should learn about it, not watch its notifications vanish while
 * the endpoint answers 200.
 *
 * @param raw - Parsed request body.
 * @returns The valid entities plus a description of anything rejected.
 */
function parseEntities(raw: unknown): {
    readonly entities: readonly ChangedEntity[];
    readonly rejected: readonly string[];
} {
    if (typeof raw !== 'object' || raw === null || !('entities' in raw)) {
        return { entities: [], rejected: ['body must be an object with an `entities` array'] };
    }

    const list = (raw as { entities: unknown }).entities;
    if (!Array.isArray(list)) {
        return { entities: [], rejected: ['`entities` must be an array'] };
    }

    const entities: ChangedEntity[] = [];
    const rejected: string[] = [];

    for (const [index, member] of list.entries()) {
        const entityType = (member as { entityType?: unknown })?.entityType;
        const slug = (member as { slug?: unknown })?.slug;

        if (!isNotifiableEntityType(entityType)) {
            rejected.push(`entities[${index}]: unknown entityType ${JSON.stringify(entityType)}`);
            continue;
        }
        if (typeof slug !== 'string' || !SLUG_PATTERN.test(slug)) {
            rejected.push(`entities[${index}]: malformed slug ${JSON.stringify(slug)}`);
            continue;
        }

        entities.push({ entityType, slug });
    }

    return { entities, rejected };
}

export const POST: APIRoute = async ({ request }) => {
    const url = new URL(request.url);
    const expectedSecret = getRevalidationSecret();

    if (!expectedSecret || url.searchParams.get('secret') !== expectedSecret) {
        return new Response('Unauthorized', { status: 401 });
    }

    const key = getIndexNowKey();
    if (!key) {
        return jsonError(
            {
                error: 'indexnow_key_missing',
                detail: 'HOSPEDA_INDEXNOW_KEY is not configured on the web app, so no submission can be signed'
            },
            503
        );
    }

    // Checked before the body is even read. Staging's robots.txt serves
    // `Disallow: /`; announcing its URLs to search engines would contradict the
    // policy this same app emits, and no payload can make that acceptable.
    const host = (request.headers.get('host') ?? '').toLowerCase();
    if (parseNoindexHosts(getNoindexHosts()).includes(host)) {
        return jsonError(
            {
                error: 'noindex_host',
                detail: `${host} is a noindex host — its URLs are never submitted to search engines`
            },
            403
        );
    }

    let rawBody: unknown;
    try {
        rawBody = await request.json();
    } catch {
        return jsonError({ error: 'invalid_json' }, 400);
    }

    const { entities, rejected } = parseEntities(rawBody);
    if (entities.length === 0) {
        return jsonError({ error: 'no_valid_entities', detail: rejected }, 400);
    }

    const siteUrl = getSiteUrl();
    const indexNowHost = toIndexNowHost({ siteUrl });
    if (!indexNowHost) {
        return jsonError(
            { error: 'site_url_invalid', detail: `HOSPEDA_SITE_URL is not a URL: ${siteUrl}` },
            500
        );
    }

    // One entity becomes one URL per locale: all three are distinct indexable
    // pages that changed together.
    const urls = entities.flatMap((entity) =>
        buildEntityLocaleUrls({
            entityType: entity.entityType,
            slug: entity.slug,
            siteUrl
        })
    );

    const result = await submitToIndexNow({
        payload: {
            host: indexNowHost,
            key,
            keyLocation: `${siteUrl.replace(/\/$/, '')}/${key}.txt`,
            urlList: urls
        }
    });

    if (!result.success) {
        return jsonError(
            {
                error: 'submission_failed',
                detail: result.error,
                ...(result.status === undefined ? {} : { status: result.status }),
                attempted: urls.length
            },
            502
        );
    }

    return new Response(
        JSON.stringify({
            submitted: result.submitted,
            entities: entities.length,
            status: result.status,
            durationMs: result.durationMs,
            ...(rejected.length === 0 ? {} : { rejected })
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
};
