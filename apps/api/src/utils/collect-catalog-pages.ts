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
 * and a truncated public list is cached for an hour (`cacheTTL: 3600`) with no
 * error and no log.
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
     * Called when the ceiling is reached with the source still reporting more
     * rows. Truncation is announced rather than silent: the caller logs, and its
     * response then describes `pageSize * maxPages` rows only.
     */
    readonly onTruncated?: (info: { readonly fetched: number; readonly maxPages: number }) => void;
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

    for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
        const page = await fetchPage({ pageIndex, pageSize });

        // A failed page aborts the walk. Returning what was collected so far
        // would hand back a silently short catalogue, which is the exact failure
        // this module exists to remove.
        if (page === null) {
            return null;
        }

        collected.push(...page.items);

        if (!page.hasMore) {
            return collected;
        }
    }

    onTruncated?.({ fetched: collected.length, maxPages });
    return collected;
}
