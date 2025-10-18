import { fetchApi } from '@/lib/api/client';
import {
    DestinationListItemWithStringAttractionsSchema,
    createPaginatedResponseSchema
} from '@repo/schemas';
import type { z } from 'zod';

// Use centralized schema from @repo/schemas
const DestinationListItemClientSchema =
    DestinationListItemWithStringAttractionsSchema.passthrough();

const PaginatedDestinationsSchema = createPaginatedResponseSchema(DestinationListItemClientSchema);

export type Destination = z.infer<typeof DestinationListItemWithStringAttractionsSchema>;

// Raw API response type
type ApiResponse = z.infer<typeof PaginatedDestinationsSchema>;

// Adapted response type for compatibility with existing code
export type GetDestinationsOutput = {
    data: Destination[];
    total: number;
    page: number;
    pageSize: number;
};

export type GetDestinationsInput = {
    readonly page: number;
    readonly pageSize: number;
    readonly q?: string;
    readonly sort?: ReadonlyArray<{
        readonly id: string;
        readonly desc: boolean;
    }>;
};

export const getDestinations = async ({
    page,
    pageSize,
    q,
    sort
}: GetDestinationsInput): Promise<GetDestinationsOutput> => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize)); // API uses consistent pageSize
    if (q) params.set('search', q); // API uses 'search' instead of 'q'
    if (sort && sort.length > 0) params.set('sort', JSON.stringify(sort));

    const { data } = await fetchApi<unknown>({
        path: `/api/v1/public/destinations?${params.toString()}`
    });

    // Parse the API response
    const apiResponse: ApiResponse = PaginatedDestinationsSchema.parse(data);

    // Adapt to the expected format
    return {
        data: apiResponse.data.items,
        total: apiResponse.data.pagination.total,
        page: apiResponse.data.pagination.page,
        pageSize: apiResponse.data.pagination.pageSize
    };
};
