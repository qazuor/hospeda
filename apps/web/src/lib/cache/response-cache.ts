/**
 * @file cache/response-cache.ts
 * @description The one place a response may be declared edge-cacheable.
 *
 * Marking a response `public, s-maxage=…` and tagging it for purge are the same
 * decision, so they are the same call. A page cannot do the first without the
 * second (HOS-369 W1-1).
 *
 * That coupling is the point. Selective purge replaces `purge_everything`, so an
 * untagged cacheable response is no longer merely untidy — it is content that
 * nothing can invalidate until its TTL expires, and nothing would report the
 * omission. The previous shape (`Astro.response.headers.set('Cache-Control',
 * resolveListingCacheControl({ cacheable }))`) made forgetting the tags the
 * default; this shape makes it impossible.
 *
 * Two entry points, because responses are built two ways in this app:
 *
 *   - {@link applyCacheHeaders} for `.astro` pages, which mutate the
 *     `Astro.response.headers` that Astro will send;
 *   - {@link declareCacheTags} for endpoints that construct their own
 *     `new Response(...)` and therefore set `Cache-Control` in the constructor.
 *
 * Both only COLLECT tags. The `Cache-Tag` header itself is written once, by
 * middleware, after the render — see `src/middleware.ts` Step 11. Collecting
 * rather than writing is what lets a layout or a nested component contribute a
 * tag: their frontmatter runs after the page's, when the header would otherwise
 * already be decided.
 *
 * Since HOS-369 W1-2 the tags are namespaced by deployment environment
 * (`prod:list-accom`) at COLLECTION time, not at header-write time. Both
 * staging and production live in one Cloudflare zone, so an unqualified tag
 * lets either environment evict the other's cache. Namespacing here rather than
 * in middleware keeps `applyCacheHeaders`'s fail-closed check honest: a tag that
 * only becomes unusable once the prefix is added (over Cloudflare's 1024-char
 * ceiling, or already carrying a foreign namespace) is rejected while there is
 * still a chance to demote the response, instead of quietly vanishing from a
 * header written after the decision was made.
 *
 * Since the catch-all change, both entry points also add `<env>:all` on top of
 * whatever the caller asked for. That is what makes "flush this environment" a
 * TAG purge instead of a zone purge the shared Cloudflare zone would apply to
 * both deployments — see `CACHE_TAG_ALL` in `@repo/cache-tags`. Injecting it in
 * these two functions rather than at the call sites is the point: the catch-all
 * is only useful if it is on every cacheable response, and the two functions
 * below are the only way this app produces one.
 */

import type { CacheTagEnvironment } from '@repo/cache-tags';
import {
    CACHE_TAG_ALL,
    CACHE_TAG_HEADER_NAME,
    namespaceCacheTag,
    namespaceCacheTags,
    serializeCacheTags
} from '@repo/cache-tags';
import { getCacheTagEnvironment } from './cache-tag-environment.js';
import { LISTING_CACHEABLE_CONTROL, LISTING_PRIVATE_CONTROL } from './listing-cache.js';

/**
 * The environment catch-all every cacheable response carries in addition to its
 * own tags (HOS-369).
 *
 * Added HERE — inside the only two functions that may tag a response — rather
 * than at the ~11 call sites, because a tag a caller has to remember is a tag a
 * caller will eventually forget, and the whole value of the catch-all is that it
 * is on EVERY cacheable response without exception. `purgeEverything` now means
 * "purge `<env>:all`", so a response missing it is a response the environment
 * flush cannot reach: silently unpurgeable until its TTL, which is the failure
 * mode this file was built to make impossible.
 *
 * @param params.environment - The already-resolved deployment environment.
 * @returns The namespaced catch-all, or `null` if it cannot be built (which
 *   `namespaceCacheTag` only reports for an unusable tag, and `all` is not).
 */
function buildCatchAllTag({
    environment
}: {
    readonly environment: CacheTagEnvironment;
}): string | null {
    return namespaceCacheTag({ environment, tag: CACHE_TAG_ALL });
}

/**
 * Tags for a cacheable response. The tuple type requires at least one tag to be
 * known statically, so `applyCacheHeaders({ cacheable: true, tags: [] })` cannot
 * be written at all. Dynamic tags spread after the static one:
 * `[CACHE_TAG_COLLECTIONS.accommodation, ...buildEntityCacheTags({ … })]`.
 */
export type CacheTagList = readonly [string, ...(readonly string[])];

/** What {@link applyCacheHeaders} decided, for tests and for callers that log. */
export interface AppliedCacheHeaders {
    /** The `Cache-Control` value written to the response. */
    readonly cacheControl: string;
    /** Whether the response ended up edge-cacheable. */
    readonly cacheable: boolean;
    /** How many tags were registered for the purge header. */
    readonly tagCount: number;
}

/**
 * Register cache tags for the current response without touching
 * `Cache-Control` — for a page or component that has already decided its
 * cacheability elsewhere and only needs to contribute what purges it.
 *
 * Endpoints that construct their own `Response` do NOT use this: they never
 * reach the middleware collector these tags accumulate into, so they take
 * {@link buildStaticCacheHeaders} instead.
 *
 * Callers pass BARE vocabulary tags (`list-accom`); the deployment namespace is
 * added here. When the namespace cannot be resolved NOTHING is accepted, which
 * demotes the response at every call site rather than shipping a cacheable
 * response no purge can reach.
 *
 * The environment catch-all ({@link buildCatchAllTag}) is registered on top of
 * whatever the caller supplied, FIRST, so it survives `serializeCacheTags`'s
 * tail truncation. It is added only once at least one supplied tag was usable:
 * a response the catch-all alone could purge is a response no content write can
 * purge, so it must still be demoted rather than shipped.
 *
 * @param params.locals - `Astro.locals` for the current request.
 * @param params.tags - Bare tags that must purge this response.
 * @returns How many of the SUPPLIED tags were usable — the catch-all is
 *   deliberately NOT counted, or a page whose every real tag was unusable would
 *   stop being demoted. Deliberately not the size of the accumulated set
 *   either: {@link applyCacheHeaders} decides whether to demote a response from
 *   this number, and a tag some other component contributed does not make THIS
 *   response purgeable.
 */
export function declareCacheTags({
    locals,
    tags
}: {
    readonly locals: App.Locals;
    readonly tags: CacheTagList;
}): { readonly tagCount: number } {
    const environment = getCacheTagEnvironment();
    if (environment === null) return { tagCount: 0 };

    const accepted: string[] = [];
    for (const tag of tags) {
        const namespaced = namespaceCacheTag({ environment, tag });
        if (namespaced !== null) accepted.push(namespaced);
    }
    if (accepted.length === 0) return { tagCount: 0 };

    // Before the supplied tags, not after: `locals.cacheTags` is a Set, so the
    // first insertion pins the head of the iteration order middleware Step 11
    // serializes, and the head is what survives truncation.
    const catchAll = buildCatchAllTag({ environment });
    if (catchAll !== null) locals.cacheTags.add(catchAll);
    for (const tag of accepted) locals.cacheTags.add(tag);

    return { tagCount: accepted.length };
}

/**
 * Headers for an endpoint that builds its own `Response` and therefore never
 * reaches the middleware collector: `robots.txt`, `llms.txt`, the sitemaps and
 * the RSS feeds all short-circuit `isStaticAssetRoute` on their `.txt`/`.xml`
 * extension.
 *
 * These are the easiest sites in the app to get wrong, because nothing about
 * them looks like caching code — the `Cache-Control` is one entry in a headers
 * literal. This function keeps the same fail-closed rule as
 * {@link applyCacheHeaders}: no usable namespaced tag means the response is not
 * offered to the shared cache at all.
 *
 * `/api/og` is deliberately NOT a caller. It is content-addressed by its query
 * string, so it has no entity to purge by and nothing to tag.
 *
 * Like {@link declareCacheTags}, this prepends the environment catch-all — and
 * decides cacheability from the SUPPLIED tags alone, before the catch-all is
 * added, so a surface whose real tags all turned out unusable is still demoted
 * instead of shipping with only the coarse tag.
 *
 * @param params.cacheControl - The `Cache-Control` this endpoint wants when it
 *   is taggable (e.g. `public, max-age=3600`).
 * @param params.tags - Bare tags that must purge this response.
 * @returns The exact header pairs to set: both headers when tagging succeeded,
 *   or a lone demoted `Cache-Control` when it did not.
 */
export function buildStaticCacheHeaders({
    cacheControl,
    tags
}: {
    readonly cacheControl: string;
    readonly tags: CacheTagList;
}): Readonly<Record<string, string>> {
    const environment = getCacheTagEnvironment();
    if (environment === null) return { 'Cache-Control': LISTING_PRIVATE_CONTROL };

    const supplied = namespaceCacheTags({ environment, tags });
    if (supplied.length === 0) return { 'Cache-Control': LISTING_PRIVATE_CONTROL };

    const catchAll = buildCatchAllTag({ environment });
    const { header } = serializeCacheTags({
        tags: catchAll === null ? supplied : [catchAll, ...supplied]
    });
    if (header === null) return { 'Cache-Control': LISTING_PRIVATE_CONTROL };

    return { 'Cache-Control': cacheControl, [CACHE_TAG_HEADER_NAME]: header };
}

/**
 * Set `Cache-Control` on an `.astro` page response and register the tags that
 * will purge it.
 *
 * Fail-closed: if `cacheable` is true but no usable tag survives, the response
 * is demoted to `private, no-cache`. A cacheable response with no purge tag
 * would serve stale content for the full TTL with nothing able to evict it —
 * strictly worse than a cache miss, and invisible. The tuple type on
 * {@link CacheTagList} makes the empty case unreachable from well-typed code;
 * this branch covers the two runtime cases it cannot: every supplied tag being
 * an empty string built from missing data, and the deployment namespace being
 * unresolvable (HOS-369 W1-2), which disables tagging process-wide.
 *
 * @param params.locals - `Astro.locals` for the current request.
 * @param params.headers - `Astro.response.headers`.
 * @param params.cacheable - Whether this response is safe to share from the edge
 *   (anonymous, indexable, unfiltered — see `listing-cache.ts`).
 * @param params.tags - Tags that must purge this response when it is cacheable.
 * @returns The applied `Cache-Control`, the effective cacheability, and the tag count.
 */
export function applyCacheHeaders({
    locals,
    headers,
    cacheable,
    tags
}: {
    readonly locals: App.Locals;
    readonly headers: Headers;
    readonly cacheable: boolean;
    readonly tags: CacheTagList;
}): AppliedCacheHeaders {
    if (!cacheable) {
        headers.set('Cache-Control', LISTING_PRIVATE_CONTROL);
        return { cacheControl: LISTING_PRIVATE_CONTROL, cacheable: false, tagCount: 0 };
    }

    const { tagCount } = declareCacheTags({ locals, tags });
    if (tagCount === 0) {
        headers.set('Cache-Control', LISTING_PRIVATE_CONTROL);
        return { cacheControl: LISTING_PRIVATE_CONTROL, cacheable: false, tagCount: 0 };
    }

    headers.set('Cache-Control', LISTING_CACHEABLE_CONTROL);
    return { cacheControl: LISTING_CACHEABLE_CONTROL, cacheable: true, tagCount };
}

/**
 * Whether a `Cache-Control` value makes the response eligible for the shared
 * (CDN) cache, and therefore worth tagging.
 *
 * Read from the header rather than from a flag on `locals` on purpose: endpoints
 * that build their own `Response` set `Cache-Control` in the constructor, where
 * no flag from this module could reach. The header is the one signal every
 * producer has already committed to.
 *
 * @param params.cacheControl - The response's `Cache-Control`, or null.
 * @returns `true` for a shared-cacheable response.
 */
export function isEdgeCacheableControl({
    cacheControl
}: {
    readonly cacheControl: string | null;
}): boolean {
    if (!cacheControl) return false;
    const value = cacheControl.toLowerCase();
    if (value.includes('private') || value.includes('no-store')) return false;
    return value.includes('public') || value.includes('s-maxage');
}
