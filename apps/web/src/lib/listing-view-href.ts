/** Input for building the destination URL for the other listing view. */
export interface BuildListingViewHrefInput {
    readonly base: string;
    readonly searchParams: URLSearchParams;
}

/** Resulting URL for the list/map navigation control. */
export interface BuildListingViewHrefResult {
    readonly href: string;
}

/**
 * Builds the other listing view URL without changing the current params.
 * Pagination belongs to the current view and is intentionally discarded.
 */
export function buildListingViewHref({
    base,
    searchParams
}: BuildListingViewHrefInput): BuildListingViewHrefResult {
    const params = new URLSearchParams(searchParams);
    params.delete('page');
    const query = params.toString();

    return { href: query ? `${base}?${query}` : base };
}
