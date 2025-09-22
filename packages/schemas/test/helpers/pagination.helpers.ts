/**
 * Shared pagination helpers for test fixtures
 */

import type { PaginationType } from '../../src/common/pagination.schema.js';

/**
 * Creates pagination metadata
 */
export const createPaginationMetadata = (
    page = 1,
    pageSize = 10,
    total = 0
): PaginationType & {
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
} => {
    const totalPages = Math.ceil(total / pageSize);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage,
        hasPreviousPage
    };
};

/**
 * Creates a paginated response structure
 */
export const createPaginatedResponse = <T>(data: T[], page = 1, pageSize = 10, total?: number) => {
    const totalCount = total ?? data.length;
    const pagination = createPaginationMetadata(page, pageSize, totalCount);

    return {
        data,
        pagination
    };
};
