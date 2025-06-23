/**
 * Defines the direction for sorting results.
 */
export type SortDirectionType = 'ASC' | 'DESC';

/**
 * Type for defining sorting parameters.
 * @property {string} field - The field to sort by.
 * @property {SortDirectionType} direction - The sorting direction.
 */
export type SortType = {
    field: string;
    direction: SortDirectionType;
};

/**
 * Type for defining pagination parameters.
 * @property {number} [page] - The page number to retrieve.
 * @property {number} [pageSize] - The number of items per page.
 */
export type PaginationType = {
    page?: number;
    pageSize?: number;
};

/**
 * Base type for search operations, including pagination and sorting.
 * @property {PaginationType} [pagination] - Pagination parameters.
 * @property {SortType[]} [sort] - An array of sorting criteria.
 */
export type BaseSearchType = {
    pagination?: PaginationType;
    sort?: SortType[];
};
