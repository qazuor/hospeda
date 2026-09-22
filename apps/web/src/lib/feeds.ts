/**
 * @fileoverview
 * RSS feed generation helpers for blog posts and events.
 *
 * Provides fetch + build functions used by the per-locale RSS endpoints:
 *   - GET /[lang]/publicaciones/rss.xml
 *   - GET /[lang]/eventos/rss.xml
 *
 * The fetch functions report FAILURE rather than degrading to an empty list
 * (HOS-1381). An empty RSS channel is a statement — "nothing was published" —
 * and an aggregator has no way to tell it apart from "the API was down", so it
 * may not ask again until its own cache expires. Because these routes bypass
 * middleware (see {@link applyFeedCacheHeaders}), no later stage can correct
 * that: the decision is made here, and a failed fetch answers 503.
 */

import rss from '@astrojs/rss';
import { CACHE_TAG_COLLECTIONS } from '@repo/cache-tags';
import { LISTING_PRIVATE_CONTROL } from './cache/listing-cache';
import { buildStaticCacheHeaders } from './cache/response-cache';
import type { SupportedLocale } from './i18n';
import { SUPPORTED_LOCALES } from './i18n';
import { buildUrl } from './urls';

/** Maximum number of items included in a single RSS feed. */
export const RSS_FEED_SIZE = 50;

/** Post item shape expected from the public posts API list response. */
export interface PostFeedItem {
    readonly slug: string;
    readonly title?: string;
    readonly summary?: string;
    readonly publishedAt?: string;
    readonly createdAt?: string;
}

/** Event item shape expected from the public events API list response. */
export interface EventFeedItem {
    readonly slug: string;
    readonly name?: string;
    readonly title?: string;
    readonly summary?: string;
    readonly description?: string;
    readonly date?: { readonly start?: string };
    readonly startDate?: string;
    readonly createdAt?: string;
}

/**
 * The public list envelope's `data` object.
 *
 * HOS-560: the key is `items`, not `data`. Every public list route returns
 * `{ success, data: { items, pagination } }` (see `createPublicListRoute`), but
 * this interface declared `data`, so `Array.isArray(json.data.data)` was always
 * false and every feed silently degraded to zero items — with a 200. Because the
 * type asserted the wrong shape, TypeScript could not catch it.
 */
interface ListApiData<T> {
    readonly items: readonly T[];
}

interface ListApiResponse<T> {
    readonly ok?: boolean;
    readonly success?: boolean;
    readonly data?: ListApiData<T>;
}

/**
 * Why a feed fetch could not produce a trustworthy item list (HOS-1381).
 *
 * Carried only so the 503 can say which of the three it was; the route treats
 * all three identically, because from an aggregator's side they are the same
 * event: this feed's contents are unknown right now.
 */
export type FeedFetchFailure =
    /** The request never completed — DNS, connection refused, or the 15s timeout. */
    | 'unreachable'
    /** The API answered, with a status outside 2xx. */
    | 'http-error'
    /** A 2xx whose envelope reported failure or carried no readable item list. */
    | 'bad-payload'
    /** The deployment's API/site URLs could not be resolved, so nothing was asked. */
    | 'not-configured';

/**
 * The outcome of a feed fetch.
 *
 * Deliberately NOT `readonly T[]`, which is the shape this file used to return.
 * An array cannot distinguish a published-nothing collection from an outage, so
 * every caller that received one had already lost the only fact it needed.
 * `items: []` on the success branch is a real, cacheable answer; the failure
 * branch is not.
 */
export type FeedFetchResult<TItem> =
    | { readonly ok: true; readonly items: readonly TItem[] }
    | { readonly ok: false; readonly failure: FeedFetchFailure };

/**
 * How long an aggregator is asked to wait before retrying a failed feed.
 *
 * Well under the 24h TTL a healthy feed carries: the point of answering 503 is
 * that the reader comes back soon, while the API outage is likely still being
 * fixed, instead of treating the gap as editorial silence.
 */
const FEED_RETRY_AFTER_SECONDS = 300;

/**
 * The response a feed route returns when it could not obtain its items.
 *
 * 503 + `Retry-After` is the pair that separates "we could not tell you" from
 * "there is nothing to tell": an RSS reader retries a 503 and keeps the entries
 * it already has, whereas a 200 with an empty `<channel>` invites it to
 * conclude the publication stopped — and, at `public, max-age=86400`, to be
 * served that conclusion from the edge for a day after the API recovered.
 *
 * `private, no-cache` is the same demotion value `buildStaticCacheHeaders` uses
 * when it must fail closed, reused rather than re-spelled so there is one
 * string in the app meaning "not for the shared cache". No `Cache-Tag` is
 * emitted: nothing is being stored, so there would be nothing to purge.
 *
 * @param params.failure - Which failure mode produced this response.
 * @returns A 503 XML response that no shared cache may store.
 */
export function buildFeedUnavailableResponse({
    failure
}: {
    readonly failure: FeedFetchFailure;
}): Response {
    return new Response(`<!-- feed temporarily unavailable: ${failure} -->`, {
        status: 503,
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': LISTING_PRIVATE_CONTROL,
            'Retry-After': String(FEED_RETRY_AFTER_SECONDS)
        }
    });
}

/**
 * Read a public list endpoint and report either its items or why they are
 * unknown.
 *
 * Shared by both feeds because the envelope, the timeout and the three failure
 * modes are identical; only the path and the query differ.
 *
 * @param params.url - Fully-built request URL, query string included.
 * @returns The item list, or the failure that prevented reading one.
 */
async function fetchFeedItems<TItem>({
    url
}: {
    readonly url: string;
}): Promise<FeedFetchResult<TItem>> {
    let response: Response;

    try {
        response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    } catch {
        return { ok: false, failure: 'unreachable' };
    }

    if (!response.ok) return { ok: false, failure: 'http-error' };

    try {
        const json = (await response.json()) as ListApiResponse<TItem>;
        if (!json.ok && !json.success) return { ok: false, failure: 'bad-payload' };

        const data = json.data;
        if (!data || !Array.isArray(data.items)) return { ok: false, failure: 'bad-payload' };

        return { ok: true, items: data.items };
    } catch {
        // A body that is not JSON is the API misbehaving, not an empty feed.
        return { ok: false, failure: 'bad-payload' };
    }
}

/**
 * Apply the shared feed caching policy to an `@astrojs/rss` response.
 *
 * Feeds bypass middleware (the `.xml` extension short-circuits
 * `isStaticAssetRoute`), so both the `Cache-Control` and the `Cache-Tag` are
 * set here rather than by the Step 11 collector, which never sees these
 * responses (HOS-369 W1-1). The tag is namespaced by deployment environment,
 * and the response is demoted to `private` when that namespace cannot be
 * resolved (HOS-369 W1-2) — a cacheable feed with no purge tag would go stale
 * for a full day with nothing able to evict it.
 *
 * @param params.response - The response returned by `rss()`.
 * @param params.collectionTag - The bare collection tag this feed enumerates.
 */
function applyFeedCacheHeaders({
    response,
    collectionTag
}: {
    readonly response: Response;
    readonly collectionTag: string;
}): void {
    const headers = buildStaticCacheHeaders({
        cacheControl: 'public, max-age=86400, stale-while-revalidate=86400',
        tags: [collectionTag]
    });

    for (const [name, value] of Object.entries(headers)) {
        response.headers.set(name, value);
    }
}

/**
 * Validate that a locale string is one of the supported locales.
 *
 * @param lang - Raw value from the URL `[lang]` param.
 * @returns The validated locale, or `null` when the value is unsupported.
 */
export function validateLocale(lang: string | undefined): SupportedLocale | null {
    if (!lang || !(SUPPORTED_LOCALES as readonly string[]).includes(lang)) {
        return null;
    }
    return lang as SupportedLocale;
}

/**
 * Fetch the most recent published posts from the public API.
 *
 * Reports failure instead of returning an empty array (HOS-1381) — see
 * {@link FeedFetchResult}.
 *
 * @param apiUrl - API base URL without trailing slash.
 * @returns At most RSS_FEED_SIZE post items, or the failure that hid them.
 */
export async function fetchLatestPosts({
    apiUrl
}: {
    readonly apiUrl: string;
}): Promise<FeedFetchResult<PostFeedItem>> {
    // HOS-560: no `status` param. `PostSearchHttpSchema` does not declare it and
    // `createPublicListRoute` rejects unknown query params, so sending it made
    // the API answer 400 and this function return `[]`. The endpoint is the
    // PUBLIC list — it already scopes to what an anonymous actor may read, which
    // is the same set the HTML listing renders.
    const searchParams = new URLSearchParams({
        page: '1',
        pageSize: String(RSS_FEED_SIZE),
        sortBy: 'publishedAt',
        sortOrder: 'desc'
    });

    return fetchFeedItems<PostFeedItem>({
        url: `${apiUrl}/api/v1/public/posts?${searchParams.toString()}`
    });
}

/**
 * Fetch the most recent published events from the public API.
 *
 * Reports failure instead of returning an empty array (HOS-1381) — see
 * {@link FeedFetchResult}.
 *
 * @param apiUrl - API base URL without trailing slash.
 * @returns At most RSS_FEED_SIZE event items, or the failure that hid them.
 */
export async function fetchLatestEvents({
    apiUrl
}: {
    readonly apiUrl: string;
}): Promise<FeedFetchResult<EventFeedItem>> {
    // HOS-560: same two defects as the posts feed — the events feed was empty in
    // production too, which the original report had not measured. `status` makes
    // the endpoint answer 400 (`INVALID_PAGINATION_PARAMS`) and the payload key
    // is `items`.
    const searchParams = new URLSearchParams({
        page: '1',
        pageSize: String(RSS_FEED_SIZE),
        sortBy: 'startDate',
        sortOrder: 'asc'
    });

    return fetchFeedItems<EventFeedItem>({
        url: `${apiUrl}/api/v1/public/events?${searchParams.toString()}`
    });
}

/**
 * Build the RSS feed Response for blog posts.
 *
 * Uses `rss()` from `@astrojs/rss` internally and sets the Cache-Control
 * header to match the sitemap strategy (public, 24h SWR).
 *
 * @param locale - Validated locale for link construction.
 * @param siteUrl - Site base URL without trailing slash.
 * @param posts - Post items fetched from the API.
 * @returns RSS Response with correct Content-Type and Cache-Control headers.
 */
export async function buildPostsFeed({
    locale,
    siteUrl,
    posts
}: {
    readonly locale: SupportedLocale;
    readonly siteUrl: string;
    readonly posts: readonly PostFeedItem[];
}): Promise<Response> {
    const feedTitle =
        locale === 'en'
            ? 'Hospeda - Blog'
            : locale === 'pt'
              ? 'Hospeda - Blog'
              : 'Hospeda - Publicaciones';

    const feedDescription =
        locale === 'en'
            ? 'Latest blog posts about tourism in the Argentine Litoral'
            : locale === 'pt'
              ? 'Últimas publicações sobre turismo no Litoral Argentino'
              : 'Últimas publicaciones sobre turismo en el Litoral Entrerriano';

    const feedResponse = await rss({
        title: feedTitle,
        description: feedDescription,
        site: siteUrl,
        items: posts.map((post) => {
            const slug = String(post.slug);
            const title = String(post.title ?? slug);
            const description = String(post.summary ?? '');
            const rawDate = post.publishedAt ?? post.createdAt;
            const pubDate = rawDate ? new Date(rawDate) : new Date();
            const link = `${siteUrl}${buildUrl({ locale, path: `publicaciones/${slug}` })}`;

            return { title, link, pubDate, description };
        })
    });

    applyFeedCacheHeaders({ response: feedResponse, collectionTag: CACHE_TAG_COLLECTIONS.post });

    return feedResponse;
}

/**
 * Build the RSS feed Response for events.
 *
 * Uses `rss()` from `@astrojs/rss` internally and sets the Cache-Control
 * header to match the sitemap strategy (public, 24h SWR).
 *
 * @param locale - Validated locale for link construction.
 * @param siteUrl - Site base URL without trailing slash.
 * @param events - Event items fetched from the API.
 * @returns RSS Response with correct Content-Type and Cache-Control headers.
 */
export async function buildEventsFeed({
    locale,
    siteUrl,
    events
}: {
    readonly locale: SupportedLocale;
    readonly siteUrl: string;
    readonly events: readonly EventFeedItem[];
}): Promise<Response> {
    const feedTitle =
        locale === 'en'
            ? 'Hospeda - Events'
            : locale === 'pt'
              ? 'Hospeda - Eventos'
              : 'Hospeda - Eventos';

    const feedDescription =
        locale === 'en'
            ? 'Upcoming events and activities in the Argentine Litoral region'
            : locale === 'pt'
              ? 'Próximos eventos e atividades na região do Litoral Argentino'
              : 'Próximos eventos y actividades en el Litoral Entrerriano';

    const feedResponse = await rss({
        title: feedTitle,
        description: feedDescription,
        site: siteUrl,
        items: events.map((event) => {
            const slug = String(event.slug);
            const title = String(event.name ?? event.title ?? slug);
            const description = String(event.summary ?? event.description ?? '');
            const rawDate = event.date?.start ?? event.startDate ?? event.createdAt;
            const pubDate = rawDate ? new Date(rawDate) : new Date();
            const link = `${siteUrl}${buildUrl({ locale, path: `eventos/${slug}` })}`;

            return { title, link, pubDate, description };
        })
    });

    applyFeedCacheHeaders({ response: feedResponse, collectionTag: CACHE_TAG_COLLECTIONS.event });

    return feedResponse;
}
