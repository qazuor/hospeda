import { fetchApi } from '@/lib/api/client';
import { createPaginatedResponseSchema } from '@repo/schemas';
import type { z } from 'zod';
import type { EntityQueryParams, EntityQueryResponse } from '../types';

/**
 * Creates a generic API client for entity lists
 *
 * ✅ Now using createPaginatedResponseSchema from @repo/schemas
 * after Zod v4 compatibility has been resolved
 */
export const createEntityApi = <TData>(endpoint: string, itemSchema: z.ZodSchema<TData>) => {
    // Use centralized schema from @repo/schemas
    const PaginatedResponseSchema = createPaginatedResponseSchema(itemSchema);

    type ApiResponse = {
        success: true;
        data: {
            items: TData[];
            pagination: {
                page: number;
                pageSize: number;
                total: number;
                totalPages: number;
                hasNextPage: boolean;
                hasPreviousPage: boolean;
            };
        };
        metadata?: {
            timestamp: string;
            requestId?: string;
            version?: string;
        };
    };

    /**
     * Fetch entities with query parameters
     */
    const getEntities = async ({
        page,
        pageSize,
        q,
        sort
    }: EntityQueryParams): Promise<EntityQueryResponse<TData>> => {
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('pageSize', String(pageSize)); // API uses consistent pageSize

        if (q) {
            params.set('search', q); // API uses 'search' instead of 'q'
        }

        if (sort && sort.length > 0) {
            params.set('sort', JSON.stringify(sort));
        }

        const { data } = await fetchApi<unknown>({
            path: `${endpoint}?${params.toString()}`
        });

        // Parse the API response using the centralized schema
        const apiResponse = PaginatedResponseSchema.parse(data) as ApiResponse;

        // Adapt to the expected format
        return {
            data: apiResponse.data.items,
            total: apiResponse.data.pagination.total,
            page: apiResponse.data.pagination.page,
            pageSize: apiResponse.data.pagination.pageSize
        };
    };

    return {
        getEntities,
        itemSchema,
        responseSchema: PaginatedResponseSchema
    };
};
