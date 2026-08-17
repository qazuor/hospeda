/**
 * @file legacy-redirects.ts
 * @description Pure resolution logic for the web app's legacy URL aliases:
 * `/mi-cuenta/messages` -> `/mi-cuenta/consultas`, `/blog` -> `/publicaciones`,
 * `/publicaciones/autor` -> `/autores`, and the three H-110 facet-landing
 * legacy-English-slug redirects (`/alojamientos/tipo/`, `/eventos/categoria/`,
 * `/publicaciones/categoria/`).
 *
 * Extracted out of `middleware.ts` for two reasons:
 *
 * 1. **SEO one-hop guarantee.** A chained legacy URL — e.g.
 *    `/es/blog/categoria/gastronomy/`, which is BOTH the retired `/blog`
 *    alias AND a legacy English facet slug — must resolve in a SINGLE 301 to
 *    its true final destination, never an intermediate hop that a second
 *    request would have to redirect again (diluted link equity, extra
 *    latency, and the first thing any SEO audit flags). Composing the
 *    aliases as pure string transforms, computed BEFORE `middleware.ts` ever
 *    calls `context.redirect`, is what makes that possible — discovering the
 *    composition by accident across two separate requests is exactly the bug
 *    this module exists to prevent.
 * 2. **Testability.** Pure string-in, string-out functions with no
 *    `APIContext` dependency, so the composition logic can be unit-tested
 *    directly without spinning up the full `onRequest` pipeline.
 *
 * `middleware.ts` calls {@link resolveLegacyRedirectTarget} from TWO call
 * sites: once at Step 3.1 (the position these aliases have always lived at,
 * with the incoming path as-is — already trailing-slashed by Step 3), and
 * once more from Step 3 itself, WITH a trailing slash appended first. That
 * second call site exists because Step 3 runs BEFORE Step 3.1: without it, a
 * legacy link missing its trailing slash (`/es/blog/categoria/gastronomy`,
 * no trailing `/`) would get its own 301 from Step 3 (just adding the
 * slash), and only a SECOND request would ever reach Step 3.1's alias
 * resolution — two hops for a link that should resolve in one, for the exact
 * same "chained redirect" reason described above.
 */

import {
    ACCOMMODATION_TYPE_LEGACY_ENGLISH_SLUGS,
    EVENT_CATEGORY_LEGACY_ENGLISH_SLUGS,
    POST_CATEGORY_LEGACY_ENGLISH_SLUGS
} from './facet-slugs';

/** One facet-landing family's legacy-English-slug redirect config. */
interface LegacyFacetSlugRoute {
    /** The path segment between the locale and the slug, e.g. `/alojamientos/tipo/`. */
    readonly pathPrefix: string;
    /** Legacy English slug -> canonical Spanish slug (e.g. `{ cabin: 'cabana' }`). */
    readonly legacySlugMap: Readonly<Record<string, string>>;
}

/** Route config for the accommodation-type facet landing (`/alojamientos/tipo/{slug}/`). */
const ACCOMMODATION_TYPE_LEGACY_SLUG_ROUTE: LegacyFacetSlugRoute = {
    pathPrefix: '/alojamientos/tipo/',
    legacySlugMap: ACCOMMODATION_TYPE_LEGACY_ENGLISH_SLUGS
};

/** Route config for the event-category facet landing (`/eventos/categoria/{slug}/`). */
const EVENT_CATEGORY_LEGACY_SLUG_ROUTE: LegacyFacetSlugRoute = {
    pathPrefix: '/eventos/categoria/',
    legacySlugMap: EVENT_CATEGORY_LEGACY_ENGLISH_SLUGS
};

/** Route config for the post-category facet landing (`/publicaciones/categoria/{slug}/`). */
const POST_CATEGORY_LEGACY_SLUG_ROUTE: LegacyFacetSlugRoute = {
    pathPrefix: '/publicaciones/categoria/',
    legacySlugMap: POST_CATEGORY_LEGACY_ENGLISH_SLUGS
};

/**
 * Resolve a legacy-English facet-landing slug embedded in `path` to its
 * canonical Spanish counterpart (H-110), for one facet's route config.
 *
 * The legacy-slug maps deliberately OMIT any slug spelled identically in
 * English and Spanish (`hotel`, `camping`, `motel`, `festival`, `general`,
 * `rural`, ...) — see `buildLegacyEnglishSlugMap`'s doc in `facet-slugs.ts`.
 * That omission is what keeps this function from ever resolving a path to
 * itself: a segment that is already canonical simply never matches any
 * map's keys, so this returns `undefined` and the landing page resolves the
 * request directly with 200 — no redirect, no loop.
 *
 * @param params - Object containing the request `path` and the facet's `route` config.
 * @returns The rewritten path (locale + prefix + canonical slug + tail), or
 *   `undefined` when `path` doesn't match this facet's route at all, OR it
 *   does but the slug is already canonical / unrecognized (no redirect).
 */
function resolveLegacyFacetSlugPath({
    path,
    route
}: {
    readonly path: string;
    readonly route: LegacyFacetSlugRoute;
}): string | undefined {
    const pattern = new RegExp(`^/(es|en|pt)${route.pathPrefix}([^/]+)(/.*)?$`);
    const match = path.match(pattern);
    if (!match) return undefined;
    const locale = match[1] as string;
    const legacySlug = match[2] as string;
    const canonicalSlug = route.legacySlugMap[legacySlug.toLowerCase()];
    if (!canonicalSlug) return undefined;
    const tail = match[3] ?? '/';
    return `/${locale}${route.pathPrefix}${canonicalSlug}${tail}`;
}

/** One resolved legacy redirect: the final target path (no query string) and its HTTP status. */
export interface LegacyRedirectTarget {
    /** The fully-resolved destination path, WITHOUT the query string — the caller appends it. */
    readonly target: string;
    /** `308` preserves the request method (used only by the messages alias); every other alias is a plain `301`. */
    readonly status: 301 | 308;
}

/**
 * Resolve `path` (expected to already carry its trailing slash) against
 * EVERY legacy URL alias the web app serves, composing chained aliases into
 * their single, fully-resolved final destination.
 *
 * Tries, in order: the `/mi-cuenta/messages` -> `/mi-cuenta/consultas` alias
 * (308, method-preserving — deep links to a specific conversation must
 * survive), the `/blog` -> `/publicaciones` alias (301 — itself composed
 * with the post-category legacy-slug redirect so a chained link resolves in
 * one hop), the `/publicaciones/autor` -> `/autores` alias (301), and the
 * three H-110 facet-landing legacy-English-slug redirects (301 each). Order
 * matters only for the blog/post-category composition; the other five
 * aliases live on disjoint path prefixes and can never both match the same
 * `path`, so trying them in any order is otherwise safe.
 *
 * @param params - Object containing the `path` to resolve.
 * @returns The fully-resolved `{ target, status }`, or `undefined` when
 *   `path` matches none of the known legacy aliases (the ordinary case —
 *   most requests fall through here untouched).
 */
export function resolveLegacyRedirectTarget({
    path
}: {
    readonly path: string;
}): LegacyRedirectTarget | undefined {
    const legacyMessagesMatch = path.match(/^\/(es|en|pt)\/mi-cuenta\/messages(\/.*)?$/);
    if (legacyMessagesMatch) {
        const localeSegment = legacyMessagesMatch[1];
        const tail = legacyMessagesMatch[2] ?? '/';
        return { target: `/${localeSegment}/mi-cuenta/consultas${tail}`, status: 308 };
    }

    const legacyBlogMatch = path.match(/^\/(es|en|pt)\/blog(\/.*)?$/);
    if (legacyBlogMatch) {
        const localeSegment = legacyBlogMatch[1];
        const tail = legacyBlogMatch[2] ?? '/';
        const rewrittenPath = `/${localeSegment}/publicaciones${tail}`;
        // H-110: compose with the post-category legacy-slug redirect so a
        // chained link (`/blog/categoria/gastronomy/`) resolves in ONE 301,
        // instead of an intermediate `/publicaciones/categoria/gastronomy/`
        // hop a second request would have to redirect again.
        const composedTarget =
            resolveLegacyFacetSlugPath({
                path: rewrittenPath,
                route: POST_CATEGORY_LEGACY_SLUG_ROUTE
            }) ?? rewrittenPath;
        return { target: composedTarget, status: 301 };
    }

    const legacyAuthorMatch = path.match(/^\/(es|en|pt)\/publicaciones\/autor(\/.*)?$/);
    if (legacyAuthorMatch) {
        const localeSegment = legacyAuthorMatch[1];
        const tail = legacyAuthorMatch[2] ?? '/';
        return { target: `/${localeSegment}/autores${tail}`, status: 301 };
    }

    const accommodationTypeTarget = resolveLegacyFacetSlugPath({
        path,
        route: ACCOMMODATION_TYPE_LEGACY_SLUG_ROUTE
    });
    if (accommodationTypeTarget) {
        return { target: accommodationTypeTarget, status: 301 };
    }

    const eventCategoryTarget = resolveLegacyFacetSlugPath({
        path,
        route: EVENT_CATEGORY_LEGACY_SLUG_ROUTE
    });
    if (eventCategoryTarget) {
        return { target: eventCategoryTarget, status: 301 };
    }

    const postCategoryTarget = resolveLegacyFacetSlugPath({
        path,
        route: POST_CATEGORY_LEGACY_SLUG_ROUTE
    });
    if (postCategoryTarget) {
        return { target: postCategoryTarget, status: 301 };
    }

    return undefined;
}
