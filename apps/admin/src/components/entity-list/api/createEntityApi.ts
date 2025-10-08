import { fetchApi } from '@/lib/api/client';
import { z } from 'zod';
import type { EntityQueryParams, EntityQueryResponse } from '../types';

/**
 * Creates a generic API client for entity lists
 *
 * NOTE: This currently duplicates createPaginatedResponseSchema from @repo/schemas
 * due to Zod version incompatibility (admin: v3.25.76, schemas: v4.0.8).
 *
 * TODO Phase 4.1: After Zod version alignment, replace with:
 * import { createPaginatedResponseSchema } from '@repo/schemas';
 * const PaginatedResponseSchema = createPaginatedResponseSchema(itemSchema);
 */
export const createEntityApi = <TData>(endpoint: string, itemSchema: z.ZodSchema<TData>) => {
    // Temporary schema replicating @repo/schemas structure until version compatibility resolved
    const PaginatedResponseSchema = z
        .object({
            success: z.literal(true), // Align with @repo/schemas using literal(true)
            data: z.object({
                items: z.array(itemSchema),
                pagination: z.object({
                    page: z.number().int().positive(), // Match @repo/schemas validation
                    pageSize: z.number().int().positive(),
                    total: z.number().int().nonnegative(),
                    totalPages: z.number().int().nonnegative(),
                    hasNextPage: z.boolean(), // Add fields from @repo/schemas
                    hasPreviousPage: z.boolean()
                })
            }),
            metadata: z
                .object({
                    timestamp: z.string().datetime(), // Align with @repo/schemas datetime validation
                    requestId: z.string().optional(),
                    version: z.string().optional() // Add version field from @repo/schemas
                })
                .optional()
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
