import { fetchApi } from '@/lib/api/client';
import { z } from 'zod';

// Browser-safe minimal schema for destination list items
// TODO: Replace with a browser-safe build export from @repo/schemas when available
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
        featuredImage: z.string().url().optional()
    })
    .strict();

const PaginatedDestinationsSchema = z
    .object({
        data: z.array(DestinationListItemClientSchema),
        total: z.number(),
        page: z.number(),
        pageSize: z.number()
    })
    .strict();

export type Destination = z.infer<typeof DestinationListItemClientSchema>;
export type GetDestinationsOutput = z.infer<typeof PaginatedDestinationsSchema>;

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
    params.set('pageSize', String(pageSize));
    if (q) params.set('q', q);
    if (sort && sort.length > 0) params.set('sort', JSON.stringify(sort));

    const { data } = await fetchApi<unknown>({
        path: `/api/v1/public/destinations?${params.toString()}`
    });
    return PaginatedDestinationsSchema.parse(data);
};
