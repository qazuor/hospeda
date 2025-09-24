import { fetchApi } from '@/lib/api/client';
import { z } from 'zod';

// Browser-safe minimal schema for destination list items
// TODO [35650d04-16a2-46bb-a58a-9afd46eebbfd]: Replace with a browser-safe build export from @repo/schemas when available
const DestinationListItemClientSchema = z
    .object({
        id: z.string(),
        slug: z.string(),
        name: z.string(),
        city: z.string().optional(),
        country: z.string().optional(),
        averageRating: z.number().optional(),
        reviewsCount: z.number().optional(),
        accommodationsCount: z.number().optional(),
        featuredImage: z.string().url().optional(),
        attractions: z.array(z.string()).optional(), // Array of attraction names
        media: z
            .object({
                featuredImage: z
                    .object({
                        url: z.string().url(),
                        caption: z.string().optional(),
                        description: z.string().optional()
                    })
                    .optional(),
                gallery: z
                    .array(
                        z.object({
                            url: z.string().url(),
                            caption: z.string().optional(),
                            description: z.string().optional()
                        })
                    )
                    .optional()
            })
            .optional()
    })
    .passthrough(); // Allow additional fields from the API

const PaginatedDestinationsSchema = z
    .object({
        success: z.boolean(),
        data: z.object({
            items: z.array(DestinationListItemClientSchema),
            pagination: z.object({
                page: z.number(),
                pageSize: z.number(), // Changed from 'limit' to 'pageSize' for consistency
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

export type Destination = z.infer<typeof DestinationListItemClientSchema>;

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
