/** Keep the non-type query parameters when switching to a page-one type or base path. */
export function buildAccommodationTypeChipHref({
    path,
    searchParams
}: {
    readonly path: string;
    readonly searchParams: URLSearchParams;
}): string {
    const params = new URLSearchParams(searchParams);
    for (const key of ['page', 'type', 'types']) params.delete(key);
    const query = params.toString();
    return query ? `${path}?${query}` : path;
}

/** Resolve the page-one action, selected sort and repeated filter fields for the native GET form. */
export function buildListingSortForm({
    url,
    options
}: {
    readonly url: URL;
    readonly options: readonly { readonly value: string }[];
}): {
    readonly path: string;
    readonly carried: ReadonlyArray<readonly [string, string]>;
    readonly currentSort: string | undefined;
} {
    const requestedSort = url.searchParams.get('sortBy');
    return {
        path: url.pathname.replace(/\/page\/\d+\/$/, '/'),
        carried: Array.from(url.searchParams).filter(
            ([key]) => !['page', 'sortBy', 'sortOrder'].includes(key)
        ),
        currentSort:
            options.find(({ value }) => value === requestedSort)?.value ?? options[0]?.value
    };
}
