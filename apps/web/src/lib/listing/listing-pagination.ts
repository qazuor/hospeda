/**
 * @file listing-pagination.ts
 * @description The single pagination mechanism shared by every vertical listing
 * (HOS-1797): accommodations, `comer-y-salir` and experiences.
 *
 * Pagination is PATH-based (`/{lang}/<listing>/page/N/`, SPEC-157). The
 * `page/[page].astro` route is a thin shim that validates N and
 * `Astro.rewrite`s into the parent listing with `?page=N`, so the listing itself
 * keeps reading its page from the query string. Three things must stay in
 * lock-step and used to be re-implemented per listing:
 *
 * 1. the shim's decision (404 / redirect page 1 / rewrite) —
 *    {@link resolvePaginationRoute} and {@link handlePaginationRoute};
 * 2. the canonical path the listing declares for page N —
 *    {@link buildPaginatedPath};
 * 3. the `rel=prev|next` neighbours — {@link buildPaginationLinks}.
 *
 * Before this module gastronomy and experiences declared a canonical at
 * `/page/N/` while no such route existed, so every page 2+ canonicalized to a
 * 404. A static guard (`listing-pagination.guard.test.ts`) now fails when a
 * listing canonicalizes to a route that is not there or builds the path by hand.
 *
 * Nothing here reads the session: it is safe on cacheable pages.
 */

/**
 * Status used when `/page/1/` is folded into the canonical page-1 URL.
 *
 * Kept as it was in the accommodation shims (301). It is one constant so that
 * whatever HOS-1956 decides about redirect statuses is a one-line change for
 * every listing at once.
 */
export const PAGE_ONE_REDIRECT_STATUS = 301 as const;

/**
 * Upper bound on a page number accepted by the shim (six digits). Keeps an
 * absurd `/page/99999999999/` from reaching the API as a page index.
 */
const PAGE_PARAM_PATTERN = /^[1-9]\d{0,5}$/;

/** What a `page/[page].astro` shim should do for a request. */
export type PaginationRouteDecision =
    | { readonly kind: 'not-found' }
    | {
          readonly kind: 'redirect';
          readonly location: string;
          readonly status: typeof PAGE_ONE_REDIRECT_STATUS;
      }
    | { readonly kind: 'rewrite'; readonly target: string };

/**
 * Parse the `[page]` route param strictly.
 *
 * Only canonical decimal spellings are accepted. `Number()` would also accept
 * `02`, `2.0`, `1e1` and ` 2`, each of which would be a second URL for the same
 * page.
 *
 * @param params.pageParam - Raw value of the `[page]` route param.
 * @returns The 1-based page number, or `null` when the param is not one.
 */
export function parsePageParam({
    pageParam
}: {
    readonly pageParam: string | undefined;
}): number | null {
    if (pageParam === undefined || !PAGE_PARAM_PATTERN.test(pageParam)) return null;
    return Number(pageParam);
}

/**
 * Decide what a pagination shim does. Pure, so it can be unit-tested without
 * rendering a page.
 *
 * - invalid page param -> `not-found`
 * - page 1 -> `redirect` to the listing root (no `/page/1/`), preserving every
 *   query param except `page`
 * - page N -> `rewrite` to the listing root with `?page=N` appended, preserving
 *   the other query params
 *
 * @param params.pageParam - Raw `[page]` route param.
 * @param params.basePath - Locale-prefixed listing path WITH trailing slash
 *   (e.g. `/es/experiencias/`).
 * @param params.search - The request's `url.search` (with or without `?`).
 * @returns The decision to apply.
 */
export function resolvePaginationRoute({
    pageParam,
    basePath,
    search
}: {
    readonly pageParam: string | undefined;
    readonly basePath: string;
    readonly search: string;
}): PaginationRouteDecision {
    const page = parsePageParam({ pageParam });
    if (page === null) return { kind: 'not-found' };

    const params = new URLSearchParams(search);
    params.delete('page');

    if (page === 1) {
        const qs = params.toString();
        return {
            kind: 'redirect',
            location: qs ? `${basePath}?${qs}` : basePath,
            status: PAGE_ONE_REDIRECT_STATUS
        };
    }

    params.set('page', String(page));
    return { kind: 'rewrite', target: `${basePath}?${params.toString()}` };
}

/**
 * The slice of the Astro global a pagination shim needs. Declared structurally
 * so the shim can pass `Astro` straight in and tests can pass a stub.
 */
export interface PaginationRouteContext {
    readonly params: Readonly<Record<string, string | undefined>>;
    readonly url: URL;
    redirect(path: string, status?: number): Response;
    rewrite(path: string): Promise<Response>;
}

/**
 * Run a pagination shim end to end. A `page/[page].astro` file reduces to
 * `return handlePaginationRoute({ astro: Astro, basePath })`.
 *
 * @param params.astro - The Astro global (or a stub with the same surface).
 * @param params.basePath - Locale-prefixed listing path WITH trailing slash.
 * @returns The response to return from the page frontmatter.
 */
export async function handlePaginationRoute({
    astro,
    basePath
}: {
    readonly astro: PaginationRouteContext;
    readonly basePath: string;
}): Promise<Response> {
    const decision = resolvePaginationRoute({
        pageParam: astro.params.page,
        basePath,
        search: astro.url.search
    });

    if (decision.kind === 'not-found') return new Response(null, { status: 404 });
    if (decision.kind === 'redirect') return astro.redirect(decision.location, decision.status);
    return astro.rewrite(decision.target);
}

/**
 * Path of page N of a listing: the listing root for page 1, `…/page/N/` after.
 * This is what a listing declares as its canonical and what `Pagination` links
 * to, and it must match the shim route.
 *
 * @param params.basePath - Listing path WITH trailing slash.
 * @param params.page - 1-based page number.
 * @returns The path for that page.
 */
export function buildPaginatedPath({
    basePath,
    page
}: {
    readonly basePath: string;
    readonly page: number;
}): string {
    return page > 1 ? `${basePath}page/${page}/` : basePath;
}

/** Canonical and neighbour paths for one page of a listing. */
export interface PaginationLinks {
    readonly canonicalPath: string;
    /** `undefined` on page 1. */
    readonly prevPath: string | undefined;
    /** `undefined` on the last page (or when there is only one). */
    readonly nextPath: string | undefined;
}

/**
 * Build the canonical / prev / next paths for the current page.
 *
 * `totalPages` of 0 (empty or failed result) yields no `next`.
 *
 * @param params.basePath - Listing path WITH trailing slash.
 * @param params.page - Current 1-based page.
 * @param params.totalPages - Total number of pages.
 * @returns The three paths.
 */
export function buildPaginationLinks({
    basePath,
    page,
    totalPages
}: {
    readonly basePath: string;
    readonly page: number;
    readonly totalPages: number;
}): PaginationLinks {
    return {
        canonicalPath: buildPaginatedPath({ basePath, page }),
        prevPath: page > 1 ? buildPaginatedPath({ basePath, page: page - 1 }) : undefined,
        nextPath: page < totalPages ? buildPaginatedPath({ basePath, page: page + 1 }) : undefined
    };
}
