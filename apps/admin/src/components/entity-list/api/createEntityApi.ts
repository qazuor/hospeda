import { fetchApi } from '@/lib/api/client';
import { z } from 'zod';
import type { EntityQueryParams, EntityQueryResponse } from '../types';

/**
 * Creates a generic API client for entity lists
 */
export const createEntityApi = <TData>(endpoint: string, itemSchema: z.ZodSchema<TData>) => {
    // Create the paginated response schema
    const PaginatedResponseSchema = z
        .object({
            success: z.boolean(),
            data: z.object({
                items: z.array(itemSchema),
                pagination: z.object({
                    page: z.number(),
                    pageSize: z.number(), // API uses consistent pageSize
                    total: z.number(),
                    totalPages: z.number()
                })
            }),
            metadata: z.object({
                timestamp: z.string(),
                requestId: z.string(),
                total: z.number(),
                count: z.number()
            })
        })
        .strict();

    type ApiResponse = z.infer<typeof PaginatedResponseSchema>;

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

        // Parse the API response
        const apiResponse: ApiResponse = PaginatedResponseSchema.parse(data);

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
