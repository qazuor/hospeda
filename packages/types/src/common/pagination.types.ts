/**
 * Generic pagination parameters for list queries.
 *
 * @template TOrderBy - The type for the orderBy field (e.g., string, TagOrderByColumn, etc.)
 * @example
 * // Generic usage (orderBy is string)
 * const params: PaginationParams = { limit: 10, offset: 0, orderBy: 'createdAt' };
 *
 * // With specific orderBy type
 * type MyOrderBy = 'createdAt' | 'name';
 * const params: PaginationParams<MyOrderBy> = { limit: 10, offset: 0, orderBy: 'name' };
 */
export type PaginationParams<TOrderBy extends string = string> = {
    limit: number;
    offset: number;
    order?: 'asc' | 'desc';
    orderBy?: TOrderBy;
};

/**
 * Generic search parameters for list queries with search/filter.
 *
 * @template TOrderBy - The type for the orderBy field (e.g., string, TagOrderByColumn, etc.)
 * @example
 * // Generic usage
 * const params: SearchParams = { limit: 10, offset: 0, q: 'foo' };
 *
 * // With specific orderBy type
 * type MyOrderBy = 'createdAt' | 'name';
 * const params: SearchParams<MyOrderBy> = { limit: 10, offset: 0, orderBy: 'name', q: 'foo' };
 */
export type SearchParams<TOrderBy extends string = string> = PaginationParams<TOrderBy> & {
    q?: string;
    name?: string;
};
