/**
 * Pagination utilities for API responses
 * Centralizes pagination calculation logic to avoid duplication across routes
 */

export type PaginationParams = {
    page: number;
    pageSize: number;
    total: number;
};

export type PaginationResult = {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
};

/**
 * Calculate pagination metadata from page, pageSize and total count
 * @param params - Pagination parameters
 * @returns Complete pagination metadata
 */
export function calculatePagination(params: PaginationParams): PaginationResult {
    const { page, pageSize, total } = params;

    const totalPages = Math.ceil(total / pageSize);

    return {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
    };
}

/**
 * Extract and normalize pagination parameters from query object
 * @param query - Query object that may contain page and pageSize
 * @returns Normalized pagination parameters with defaults
 */
export function extractPaginationParams(query: Record<string, unknown> = {}): {
    page: number;
    pageSize: number;
} {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;

    return { page, pageSize };
}

/**
 * Complete pagination helper that combines extraction and calculation
 * @param total - Total number of items
 * @param query - Query object that may contain page and pageSize
 * @returns Complete pagination metadata
 */
export function getPaginationResponse(
    total: number,
    query: Record<string, unknown> = {}
): PaginationResult {
    const { page, pageSize } = extractPaginationParams(query);
    return calculatePagination({ page, pageSize, total });
}
