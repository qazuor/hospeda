/**
 * Common types shared across DB models.
 * Used for pagination, filtering and utility options.
 */

/**
 * Pagination and sorting options for listings.
 */
export interface PaginationParams {
    /**
     * Maximum number of items to return.
     * @default 20
     */
    limit?: number;

    /**
     * Offset index for pagination.
     * @default 0
     */
    offset?: number;

    /**
     * Column to order results by.
     * @default 'createdAt'
     */
    orderBy?: string;

    /**
     * Sorting direction.
     * @default 'desc'
     */
    order?: 'asc' | 'desc';
}

/**
 * Parameters used for fuzzy search queries.
 */
export interface FindParams extends PaginationParams {
    /**
     * The term to search for (used in LIKE/ILIKE queries).
     */
    query?: string;
}
