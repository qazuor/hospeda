/**
 * Bounded walk over a paginated source (HOS-1062).
 *
 * Both plan-listing endpoints have to see the WHOLE catalogue before they filter
 * it, and for the same reason: what they withhold — a testing tool, a negotiated
 * agreement — is interleaved with what they serve, so a page taken from the
 * source is a page that has already lost rows the caller was entitled to and
 * kept rows it was not. Filtering after paging silently truncates; filtering
 * before paging makes the response and its own `total` describe the same set.
 *
 * That was true of `GET /api/v1/protected/plans` when HOS-1062 rewrote it, and
 * it was true of `GET /api/v1/public/plans`, which was reading `planService`'s
 * DEFAULT page of 20 and filtering in memory — a limit nobody noticed because
 * the catalogue was a fixed set of six. HOS-1062 is what changes that: one plan
 * row per negotiated agreement means the catalogue now grows with the customers,
 * and a truncated list is answered with a 200 and no log line at all.
 *
 * (An earlier version of this note said such a response was "cached for an hour
 * (`cacheTTL: 3600`)". It is not: `cacheTTL` is declared on `RouteOptions`
 * (`route-factory.ts`) and read by nothing — `applyRouteMiddlewares` consumes
 * only `customRateLimit` and `middlewares`. The truncation is real; the caching
 * was not, and a safety argument resting on an inert mechanism is worse than no
 * argument.)
 *
 * This module exists so there is ONE implementation of that walk instead of two
 * that can drift. It is deliberately dumb: it knows how to ask for page N and
 * when to stop, and nothing about plans, marks or visibility.
 *
 * @module utils/collect-catalog-pages
 */

/** One page of a paginated source. */
export interface CatalogPage<T> {
    /** The rows on this page, in source order. */
    readonly items: readonly T[];
    /** Whether the source holds more rows beyond this page. */
    readonly hasMore: boolean;
    /**
     * How many rows the source says it holds in total, when it can say.
     *
     * Supplying it turns `hasMore` from an assertion into a claim that gets
     * CHECKED. Without it, a source answering `hasMore: false` while rows are
     * still pending hands back a short catalogue with no `null` and no
     * truncation callback — the last path on which "partial" still looks exactly
     * like "complete", which is the one thing this module exists to prevent.
     * Both callers already receive this number and were discarding it.
     *
     * Omit it only for a source that genuinely cannot count; the walk then
     * trusts `hasMore` alone.
     */
    readonly total?: number;
}

/** Input for {@link collectCatalogPages}. */
export interface CollectCatalogPagesInput<T> {
    /**
     * Fetches one page. Return `null` to abort the whole walk — a partial
     * catalogue is never handed back, because a caller cannot tell it apart from
     * a complete one.
     */
    readonly fetchPage: (args: {
        readonly pageIndex: number;
        readonly pageSize: number;
    }) => Promise<CatalogPage<T> | null>;
    /** Rows per request. Defaults to {@link DEFAULT_CATALOG_PAGE_SIZE}. */
    readonly pageSize?: number;
    /** Hard ceiling on requests. Defaults to {@link DEFAULT_CATALOG_MAX_PAGES}. */
    readonly maxPages?: number;
    /**
     * Called when the walk ends with rows left behind — either the ceiling was
     * reached with the source still reporting more, or the source stopped early
     * while its own `total` said there were more. Truncation is announced rather
     * than silent: the caller logs, and its response then describes fewer rows
     * than the source holds.
     *
     * `expected` carries the source's `total` when it reported one.
     */
    readonly onTruncated?: (info: {
        readonly fetched: number;
        readonly maxPages: number;
        readonly expected?: number;
    }) => void;
}

/**
 * Rows per request. 100 is qzpay's own `PaginationSchema` ceiling, and the
 * largest page `listPlans` is ever asked for elsewhere in the repo.
 */
export const DEFAULT_CATALOG_PAGE_SIZE = 100;

/**
 * How many pages the walk will request before giving up. A billing catalogue of
 * 1000 plans is a different problem than any of these endpoints; the bound is
 * here so a paging bug in a source cannot spin forever.
 */
export const DEFAULT_CATALOG_MAX_PAGES = 10;

/**
 * Walks every page of a paginated source and returns the rows, in source order.
 *
 * Costs ONE request while the source fits in a single page, which is every
 * catalogue in this repo today. It becomes N requests only once the source
 * outgrows `pageSize`, and it can never exceed `maxPages`.
 *
 * @param input - RO-RO input; see {@link CollectCatalogPagesInput}
 * @returns Every row, or `null` if any page failed to load
 *
 * @example
 * ```ts
 * const rows = await collectCatalogPages({
 *     fetchPage: async ({ pageIndex, pageSize }) => {
 *         const res = await source.list({ limit: pageSize, offset: pageIndex * pageSize });
 *         return { items: res.data, hasMore: res.hasMore };
 *     }
 * });
 * ```
 */
export async function collectCatalogPages<T>(
    input: CollectCatalogPagesInput<T>
): Promise<T[] | null> {
    const {
        fetchPage,
        pageSize = DEFAULT_CATALOG_PAGE_SIZE,
        maxPages = DEFAULT_CATALOG_MAX_PAGES,
        onTruncated
    } = input;

    const collected: T[] = [];
    let reportedTotal: number | undefined;

    for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
        const page = await fetchPage({ pageIndex, pageSize });

        // A failed page aborts the walk. Returning what was collected so far
        // would hand back a silently short catalogue, which is the exact failure
        // this module exists to remove.
        if (page === null) {
            return null;
        }

        collected.push(...page.items);
        reportedTotal = page.total ?? reportedTotal;

        if (!page.hasMore) {
            // `hasMore: false` is a CLAIM, and this is where it gets checked
            // against the source's own count. A source that stops early while
            // its `total` says otherwise has truncated the catalogue, and the
            // caller hears about it — the alternative is a short list that is
            // indistinguishable from a complete one.
            if (reportedTotal !== undefined && collected.length < reportedTotal) {
                onTruncated?.({
                    fetched: collected.length,
                    maxPages,
                    expected: reportedTotal
                });
            }
            return collected;
        }
    }

    onTruncated?.({ fetched: collected.length, maxPages, expected: reportedTotal });
    return collected;
}
