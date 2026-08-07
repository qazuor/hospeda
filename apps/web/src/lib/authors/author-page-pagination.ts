/**
 * @file author-page-pagination.ts
 * @description The two URL-level rules of the author page's pagination that a
 * `.astro` file cannot be unit-tested through: which URL a paginated request is
 * canonical to, and when a page number is out of range.
 *
 * Both live here rather than inline in `autores/[slug]/index.astro` for the same
 * reason `author-indexable.ts` does: they are SEO decisions, and an SEO decision
 * that only exists inside frontmatter can only ever be covered by a source scan.
 *
 * HOS-375 §6.3 / §6.5 / §6.6.
 */

/**
 * Build the canonical path for whichever author URL is being served.
 *
 * The author page serves three URL shapes from one file (§6.3): the profile,
 * `/page/<n>/` (posts) and `/eventos/page/<n>/` (events). Pages 2+ are
 * `noindex`, and that is exactly why the canonical must be SELF-referential
 * rather than point at page 1: a `noindex` page canonicalising to an indexable
 * one asks Google to merge two different documents, one of which it has been
 * told to drop — the signals contradict each other and the resolution is
 * undefined. The listing pages already settled this (see the self-canonical
 * block in `eventos/index.astro`); this mirrors it.
 *
 * Precedence matches the render: a URL carrying BOTH params cannot come from
 * either rewrite, and posts win there too, so the canonical names the block the
 * page actually rendered.
 *
 * @param params.authorPath - Locale-prefixed profile path, trailing slash included.
 * @param params.eventsPath - Locale-prefixed events pagination base, trailing slash included.
 * @param params.postsPage - 1-based posts page from `?page`.
 * @param params.eventsPage - 1-based events page from `?eventsPage`.
 * @returns The path this request should declare as its own canonical.
 *
 * @example
 * resolveAuthorCanonicalPath({
 *   authorPath: '/es/autores/juan/',
 *   eventsPath: '/es/autores/juan/eventos/',
 *   postsPage: 2,
 *   eventsPage: 1
 * }); // '/es/autores/juan/page/2/'
 */
export function resolveAuthorCanonicalPath({
    authorPath,
    eventsPath,
    postsPage,
    eventsPage
}: {
    readonly authorPath: string;
    readonly eventsPath: string;
    readonly postsPage: number;
    readonly eventsPage: number;
}): string {
    if (postsPage > 1) {
        return `${authorPath}page/${postsPage}/`;
    }
    if (eventsPage > 1) {
        return `${eventsPath}page/${eventsPage}/`;
    }
    return authorPath;
}

/**
 * Whether a requested page number lies past the last real page.
 *
 * An out-of-range page used to render an empty state with HTTP 200, which mints
 * an unbounded family of crawlable URLs — the same failure the pagination routes
 * already refuse for `/page/0/` and `/page/abc/` by answering 404 rather than
 * clamping. This closes the remaining hole: the number is well-formed, it just
 * does not exist.
 *
 * `totalPages` is `null` when the count is UNKNOWN (the fetch failed, or the
 * block was not requested at all). Unknown never produces a 404: a transient
 * API failure must not turn every paginated URL of an author into a permanent-
 * looking dead end, exactly as it must not turn the profile into `noindex`
 * (see `contentCountsUnavailable` in `author-indexable.ts`).
 *
 * @param params.page - 1-based page number the request asked for.
 * @param params.totalPages - Real page count, or `null` when it could not be read.
 * @returns `true` iff the page is known not to exist.
 *
 * @example
 * isAuthorPageOutOfRange({ page: 4, totalPages: 3 });    // true  -> 404
 * isAuthorPageOutOfRange({ page: 4, totalPages: null }); // false -> render
 * isAuthorPageOutOfRange({ page: 1, totalPages: 0 });    // false -> the profile always exists
 */
export function isAuthorPageOutOfRange({
    page,
    totalPages
}: {
    readonly page: number;
    readonly totalPages: number | null;
}): boolean {
    // Page 1 is the profile itself: it exists even for an author with no
    // content at all, so it is never out of range.
    if (page <= 1) return false;
    if (totalPages === null) return false;
    return page > totalPages;
}
